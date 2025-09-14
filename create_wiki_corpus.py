#!/usr/bin/env python3
"""
Wikipedia Corpus Processing Script

This script processes Wikipedia dump files, extracts articles, parses them with Stanza NLP,
and indexes them in Elasticsearch for language learning applications.

Author: Language Learning Project
Date: September 2025
"""

import bz2
import json
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
import sys
import re
from datetime import datetime

import mwparserfromhell
import stanza
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import ConnectionError, RequestError
from tqdm import tqdm
from rapidfuzz import fuzz

# Import the shared quality checker
import sys
sys.path.append('language_app')
from language_app.app.quality_checker import SentenceQualityChecker

# Import the shared quality checker
sys.path.append('language_app')
from language_app.app.quality_checker import quality_checker
def check_similar(title, existing_titles, threshold=90):
    for t in existing_titles:
        if fuzz.ratio(title, t) >= threshold:
            return True, t
    return False, None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('wiki_corpus.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class WikiCorpusProcessor:
    """
    A class to process Wikipedia dumps and create a searchable corpus using Elasticsearch.
    """
    
    def __init__(self, 
                 dump_file_path: str,
                 elasticsearch_host: str = "http://localhost:9200",
                 language: str = "de",
                 index_name: str = "wiki_docs"):
        """
        Initialize the WikiCorpusProcessor.
        
        Args:
            dump_file_path: Path to the Wikipedia dump file (.xml.bz2)
            elasticsearch_host: Elasticsearch connection string
            language: Language code for Stanza processing (e.g., 'de', 'en')
            index_name: Name of the Elasticsearch index to create
        """
        self.dump_file_path = Path(dump_file_path)
        self.elasticsearch_host = elasticsearch_host
        self.language = language
        self.index_name = index_name
        
        # Initialize components
        self.es = None
        self.nlp = None
        self.quality_checker = SentenceQualityChecker()
        
        # Statistics
        self.stats = {
            'articles_processed': 0,
            'articles_indexed': 0,
            'articles_skipped': 0,
            'errors': 0,
            'start_time': None,
            'end_time': None
        }
    
    def initialize_elasticsearch(self, force_recreate: bool = False) -> bool:
        """
        Initialize Elasticsearch connection and create index if needed.
        
        Args:
            force_recreate: If True, delete and recreate the index
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            self.es = Elasticsearch(self.elasticsearch_host)
            
            # Test connection
            if not self.es.ping():
                logger.error(f"Cannot connect to Elasticsearch at {self.elasticsearch_host}")
                return False
            
            logger.info(f"Connected to Elasticsearch at {self.elasticsearch_host}")
            
            # Only create/recreate index if needed
            if force_recreate:
                self._force_recreate_index()
            else:
                self._create_index_if_not_exists()
            return True
            
        except ConnectionError as e:
            logger.error(f"Elasticsearch connection error: {e}")
            return False
    
    def _create_index_if_not_exists(self):
        """Create Elasticsearch index with proper mapping - only if it doesn't exist."""
        mapping = {
            "mappings": {
                "properties": {
                    "title": {"type": "keyword"},
                    "sentence_id": {"type": "keyword"},
                    "sentence_text": {"type": "text"},
                    "tokens": {
                        "type": "nested",
                        "properties": {
                            "id": {"type": "integer"},
                            "text": {"type": "text"},
                            "lemma": {"type": "keyword"},
                            "upos": {"type": "keyword"},
                            "xpos": {"type": "keyword"},
                            "feats": {"type": "keyword"},
                            "head": {"type": "integer"},
                            "deprel": {"type": "keyword"},
                            "start_char": {"type": "integer"},
                            "end_char": {"type": "integer"}
                        }
                    }
                }
            }
        }
        
        try:
            # Only create index if it doesn't exist - NEVER delete existing data!
            if not self.es.indices.exists(index=self.index_name):
                self.es.indices.create(index=self.index_name, body=mapping)
                logger.info(f"Created new index: {self.index_name}")
            else:
                logger.info(f"Index '{self.index_name}' already exists - preserving existing data")
            
        except RequestError as e:
            logger.error(f"Error creating index: {e}")
            raise
    
    def _force_recreate_index(self):
        """Force delete and recreate the index - USE ONLY WHEN EXPLICITLY REQUESTED!"""
        mapping = {
            "mappings": {
                "properties": {
                    "title": {"type": "keyword"},
                    "sentence_id": {"type": "keyword"},
                    "sentence_text": {"type": "text"},
                    "tokens": {
                        "type": "nested",
                        "properties": {
                            "id": {"type": "integer"},
                            "text": {"type": "text"},
                            "lemma": {"type": "keyword"},
                            "upos": {"type": "keyword"},
                            "xpos": {"type": "keyword"},
                            "feats": {"type": "keyword"},
                            "head": {"type": "integer"},
                            "deprel": {"type": "keyword"},
                            "start_char": {"type": "integer"},
                            "end_char": {"type": "integer"}
                        }
                    }
                }
            }
        }
        
        try:
            # Delete existing index if it exists (ONLY when explicitly requested)
            if self.es.indices.exists(index=self.index_name):
                self.es.indices.delete(index=self.index_name)
                logger.warning(f"FORCE DELETED existing index: {self.index_name}")
            
            # Create new index
            self.es.indices.create(index=self.index_name, body=mapping)
            logger.info(f"Created new index: {self.index_name}")
            
        except RequestError as e:
            logger.error(f"Error force recreating index: {e}")
            raise
    
    def check_index_exists_and_populated(self) -> bool:
        """
        Check if the index exists and has documents.
        
        Returns:
            bool: True if index exists and has documents, False otherwise
        """
        try:
            if not self.es.indices.exists(index=self.index_name):
                return False
            
            # Check if index has documents
            count = self.es.count(index=self.index_name)
            doc_count = count['count']
            
            if doc_count > 0:
                logger.info(f"Index '{self.index_name}' exists with {doc_count} documents")
                return True
            else:
                logger.info(f"Index '{self.index_name}' exists but is empty")
                return False
                
        except Exception as e:
            logger.error(f"Error checking index: {e}")
            return False
    
    def get_all_existing_titles(self) -> set:
        """
        Fetch all unique titles from Elasticsearch at once for efficient similarity checking.
        
        Returns:
            set: Set of all existing article titles in the index
        """
        try:
            all_titles = set()
            
            # Use scroll API to get all titles efficiently
            query = {
                "query": {"match_all": {}},
                "_source": ["title"],
                "size": 1000  # Process in batches of 1000
            }
            
            # Initial search
            response = self.es.search(
                index=self.index_name,
                body=query,
                scroll='2m'  # Keep scroll context for 2 minutes
            )
            
            scroll_id = response['_scroll_id']
            hits = response['hits']['hits']
            
            # Process initial batch
            for hit in hits:
                all_titles.add(hit['_source']['title'])
            
            # Continue scrolling until no more results
            while hits:
                response = self.es.scroll(scroll_id=scroll_id, scroll='2m')
                scroll_id = response['_scroll_id']
                hits = response['hits']['hits']
                
                for hit in hits:
                    all_titles.add(hit['_source']['title'])
            
            # Clear the scroll context
            try:
                self.es.clear_scroll(scroll_id=scroll_id)
            except:
                pass  # Ignore errors when clearing scroll
            
            logger.info(f"Retrieved {len(all_titles)} unique titles from Elasticsearch")
            return all_titles
            
        except Exception as e:
            logger.error(f"Error retrieving all titles from Elasticsearch: {e}")
            return set()
    
    def check_similar_title_exists(self, title: str, existing_titles: set, similarity_threshold: float = 0.8) -> bool:
        """
        Check if a similar title already exists using local set comparison (much faster).
        
        Args:
            title: Title to check for similarity
            existing_titles: Set of existing titles from Elasticsearch
            similarity_threshold: Minimum similarity score (0.0-1.0)
            
        Returns:
            bool: True if similar title exists, False otherwise
        """
        try:
            # Use rapidfuzz for fast similarity checking against all existing titles
            threshold_score = int(similarity_threshold * 100)
            
            for existing_title in existing_titles:
                if fuzz.ratio(title, existing_title) >= threshold_score:
                    logger.debug(f"Found similar title: '{title}' similar to existing '{existing_title}'")
                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Error checking similar titles for '{title}': {e}")
            return False
    
    def initialize_stanza(self) -> bool:
        """
        Initialize Stanza NLP pipeline.
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Initializing Stanza pipeline for language: {self.language}")
            self.nlp = stanza.Pipeline(
                self.language, 
                processors='tokenize,mwt,pos,lemma,depparse',
                verbose=False
            )
            logger.info("Stanza pipeline initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Stanza: {e}")
            return False
    
    def process_with_stanza(self, text: str) -> Dict:
        """
        Process text with Stanza NLP pipeline and return sentence dictionary.
        
        Args:
            text: Raw text to process
            
        Returns:
            Dict with doc_dict (sentences) and statistics
        """
        try:
            # Limit text length to avoid memory issues
            max_chars = 10000
            if len(text) > max_chars:
                text = text[:max_chars] + "..."
            
            doc = self.nlp(text)
            doc_dict = doc.to_dict()
            
            return {
                "doc_dict": doc_dict,
                "sentence_count": len(doc_dict),
                "word_count": sum(len(sentence) for sentence in doc_dict)
            }
            
        except Exception as e:
            logger.error(f"Error processing text with Stanza: {e}")
            return {
                "doc_dict": [],
                "sentence_count": 0,
                "word_count": 0
            }
    
    def index_article(self, title: str, nlp_data: Dict) -> bool:
        """
        Index article sentences in Elasticsearch with quality filtering.
        
        Args:
            title: Article title
            nlp_data: NLP processing results with doc_dict
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Prepare documents for bulk indexing with quality filtering
            documents = []
            doc_dict = nlp_data["doc_dict"]
            filtered_count = 0
            
            for sent_idx, sentence in enumerate(doc_dict):
                # Extract sentence text from tokens
                sentence_text = " ".join([token['text'] for token in sentence])
                
                # Quality check using shared quality checker
                if not self.quality_checker.is_quality_sentence(sentence_text):
                    filtered_count += 1
                    continue
                
                # Create unique sentence ID based on title and sentence index
                unique_sentence_id = f"{title}_{sent_idx:04d}"
                
                doc_body = {
                    "title": title,
                    "sentence_id": unique_sentence_id,
                    "sentence_text": sentence_text,
                    "tokens": sentence
                }
                documents.append({
                    "_index": self.index_name,
                    "_id": unique_sentence_id,  # Use unique sentence ID as document ID
                    "_source": doc_body
                })
            
            # Bulk index the documents
            if documents:
                response = helpers.bulk(self.es, documents)
                logger.debug(f"Indexed {len(documents)} quality sentences from '{title}' (filtered out {filtered_count})")
                return True
            else:
                logger.warning(f"No quality sentences to index for '{title}' (filtered out {filtered_count})")
                return False
            
        except Exception as e:
            logger.error(f"Error indexing article '{title}': {e}")
            return False
    
    def process_dump(self, max_articles: int = 100, similarity_threshold: float = 0.8) -> Dict:
        """
        Process Wikipedia dump file and create corpus.
        
        Args:
            max_articles: Maximum number of articles to INDEX (not just process)
            similarity_threshold: Threshold for skipping similar articles (0.0-1.0)
            
        Returns:
            Dict containing processing statistics
        """
        if not self.dump_file_path.exists():
            logger.error(f"Dump file not found: {self.dump_file_path}")
            return self.stats
        
        logger.info(f"Starting to process dump file: {self.dump_file_path}")
        logger.info(f"Target: INDEX exactly {max_articles} new articles")
        
        self.stats['start_time'] = datetime.now()
        
        # Fetch all existing titles from Elasticsearch at once for efficient similarity checking
        logger.info("Fetching existing titles from Elasticsearch for similarity checking...")
        existing_titles = self.get_all_existing_titles()
        logger.info(f"Loaded {len(existing_titles)} existing titles for similarity checking")
        
        # Initialize progress bar without total - we don't know how many we'll need to process
        pbar = tqdm(desc=f"Indexing articles (target: {max_articles})", unit="articles")
        page_data = {}
        try:
            with bz2.open("/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2") as f:
                for event, elem in ET.iterparse(f, events=("start", "end")):
                    if event == "start":
                        if elem.tag.endswith("page"):
                            in_page = True
                            current_title = None
                            current_text = None
                    elif event == "end":
                        if elem.tag.endswith("title") and in_page:
                            current_title = elem.text
                            # if current_title:
                            #     print(f"Title: {current_title}")
                        elif elem.tag.endswith("text") and in_page:
                            if elem.text:
                                wikicode = mwparserfromhell.parse(elem.text)
                                current_text = wikicode.strip_code()
                        elif elem.tag.endswith("page") and in_page:
                            # End of page - process if not similar to existing articles
                            if current_title and current_text:
                                # First check: Local similarity with current batch (rapidfuzz)
                                is_similar_local, similar_local_title = check_similar(current_title, page_data.keys(), threshold=int(similarity_threshold * 100))
                                
                                # Second check: Similarity with existing corpus (local set - much faster!)
                                is_similar_existing = self.check_similar_title_exists(current_title, existing_titles, similarity_threshold)
                                
                                if is_similar_local:
                                    logger.debug(f"Skipping locally similar title: {current_title} (similar to {similar_local_title})")
                                    self.stats['articles_skipped'] += 1
                                elif is_similar_existing:
                                    logger.debug(f"Skipping existing similar title: {current_title}")
                                    self.stats['articles_skipped'] += 1
                                else:
                                    # Process the article (not similar and not duplicate)
                                    page_data[current_title] = current_text
                                    
                                    
                                    # Update progress bar description with current article
                                    pbar.set_description(f"Processing: {current_title[:30]}...")
                                    
                                    # Process with Stanza
                                    nlp_data = self.process_with_stanza(current_text)
                                    
                                    # Index in Elasticsearch
                                    if self.index_article(current_title, nlp_data):
                                        self.stats['articles_indexed'] += 1
                                        # Update progress bar ONLY when we successfully index
                                        pbar.update(1)
                                        pbar.set_description(f"Indexed {self.stats['articles_indexed']}/{max_articles}: {current_title[:30]}...")
                                        logger.info(f"Successfully indexed article {self.stats['articles_indexed']}/{max_articles}: {current_title}")
                                    else:
                                        self.stats['errors'] += 1
                                        self.stats['articles_processed'] += 1
                                    # Update progress bar postfix with processing stats
                                    pbar.set_postfix({
                                        'processed': self.stats['articles_processed'],
                                        'errors': self.stats['errors'],
                                        'skipped': self.stats['articles_skipped']
                                    })
                                
                                # Clean up XML elements to save memory
                            elem.clear()
                                
                        # Check if we've reached the target INDEXED articles (not processed)
                        if self.stats['articles_indexed'] >= max_articles:
                            logger.info(f"SUCCESS: Reached target of {max_articles} INDEXED articles!")
                            logger.info(f"Total processed: {self.stats['articles_processed']}, Skipped: {self.stats['articles_skipped']}")
                            break
        
        except Exception as e:
            logger.error(f"Error processing dump file: {e}")
            self.stats['errors'] += 1
        
        finally:
            pbar.close()
            self.stats['end_time'] = datetime.now()
            self._log_final_stats()
        
        return self.stats
    
    def _log_final_stats(self):
        """Log final processing statistics."""
        duration = self.stats['end_time'] - self.stats['start_time']
        
        logger.info("="*50)
        logger.info("PROCESSING COMPLETE")
        logger.info("="*50)
        logger.info(f"Articles processed: {self.stats['articles_processed']}")
        logger.info(f"Articles indexed: {self.stats['articles_indexed']}")
        logger.info(f"Articles skipped (similar): {self.stats['articles_skipped']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Duration: {duration}")
        logger.info(f"Index name: {self.index_name}")
        logger.info("="*50)


def main():
    """Main function to run the wiki corpus processor."""
    parser = argparse.ArgumentParser(description="Process Wikipedia dump and create searchable corpus")
    parser.add_argument("--dump_file", help="Path to Wikipedia dump file (.xml.bz2)", default="/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2")
    parser.add_argument("--max-articles", type=int, default=100, help="Exact number of articles to INDEX (will process as many as needed, default: 100)")
    parser.add_argument("--language", default="de", help="Language code for Stanza (default: de)")
    parser.add_argument("--elasticsearch-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--index-name", default="wiki_docs", help="Elasticsearch index name")
    parser.add_argument("--force-recreate", action="store_true", help="Force recreation of corpus even if it exists")
    parser.add_argument("--similarity-threshold", type=float, default=0.8, help="Similarity threshold for duplicate detection (0.0-1.0, default: 0.8)")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = WikiCorpusProcessor(
        dump_file_path=args.dump_file,
        elasticsearch_host=args.elasticsearch_host,
        language=args.language,
        index_name=args.index_name
    )
    
    # Initialize Elasticsearch first to check if corpus exists
    if not processor.initialize_elasticsearch(force_recreate=args.force_recreate):
        logger.error("Failed to initialize Elasticsearch")
        return 1
    
    # If we need to create/recreate, initialize Stanza
    if not processor.initialize_stanza():
        logger.error("Failed to initialize Stanza")
        return 1
    
    # Process the dump with similarity checking
    stats = processor.process_dump(
        max_articles=args.max_articles,
        similarity_threshold=args.similarity_threshold
    )
    
    # Check for success
    if stats['articles_indexed'] > 0:
        logger.info("Processing completed successfully!")
        return 0
    else:
        logger.error("No articles were successfully indexed")
        return 1


if __name__ == "__main__":
    exit(main())
