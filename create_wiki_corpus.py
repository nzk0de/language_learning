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
from datetime import datetime

import mwparserfromhell
import stanza
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import ConnectionError, RequestError
from tqdm import tqdm
from rapidfuzz import fuzz
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
        
        # Statistics
        self.stats = {
            'articles_processed': 0,
            'articles_indexed': 0,
            'errors': 0,
            'start_time': None,
            'end_time': None
        }
    
    def initialize_elasticsearch(self) -> bool:
        """
        Initialize Elasticsearch connection and create index.
        
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
            
            # Create index with proper mapping
            self._create_index()
            return True
            
        except ConnectionError as e:
            logger.error(f"Elasticsearch connection error: {e}")
            return False
    
    def _create_index(self):
        """Create Elasticsearch index with proper mapping for sentence documents."""
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
            # Delete existing index if it exists
            if self.es.indices.exists(index=self.index_name):
                self.es.indices.delete(index=self.index_name)
                logger.info(f"Deleted existing index: {self.index_name}")
            
            # Create new index
            self.es.indices.create(index=self.index_name, body=mapping)
            logger.info(f"Created index: {self.index_name}")
            
        except RequestError as e:
            logger.error(f"Error creating index: {e}")
            raise
    
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
        Index article sentences in Elasticsearch using your exact method.
        
        Args:
            title: Article title
            nlp_data: NLP processing results with doc_dict
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Prepare documents for bulk indexing exactly as in your code
            documents = []
            doc_dict = nlp_data["doc_dict"]
            
            for sent_idx, sentence in enumerate(doc_dict):
                # Create unique sentence ID based on title and sentence index
                unique_sentence_id = f"{title}_{sent_idx:04d}"
                
                # Extract sentence text from tokens
                sentence_text = " ".join([token['text'] for token in sentence])
                
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
                logger.debug(f"Indexed {len(documents)} sentences from '{title}'")
                return True
            else:
                logger.warning(f"No sentences to index for '{title}'")
                return False
            
        except Exception as e:
            logger.error(f"Error indexing article '{title}': {e}")
            return False
    
    def process_dump(self, max_articles: int = 100) -> Dict:
        """
        Process Wikipedia dump file and create corpus.
        
        Args:
            max_articles: Maximum number of articles to process
            
        Returns:
            Dict containing processing statistics
        """
        if not self.dump_file_path.exists():
            logger.error(f"Dump file not found: {self.dump_file_path}")
            return self.stats
        
        logger.info(f"Starting to process dump file: {self.dump_file_path}")
        logger.info(f"Target: {max_articles} articles")
        
        self.stats['start_time'] = datetime.now()
        
        # Initialize progress bar
        pbar = tqdm(total=max_articles, desc="Processing articles", unit="articles")
        page_data = {}
        try:
            with bz2.open("/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2") as f:
                for event, elem in tqdm(ET.iterparse(f, events=("start", "end"))):
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
                            # End of page - store the title-text pair
                            is_similar, similar_title = check_similar(current_title, page_data.keys())

                            if is_similar:
                                print(f"Skipping similar title: {current_title} (similar to {similar_title})")
                            
                            elif current_title and current_text and current_title not in page_data:
                                page_data[current_title] = current_text
                                logger.info(f"Collected {len(page_data)} titles so far")
                                # Update progress bar description with current article
                                pbar.set_description(f"Processing: {current_title[:30]}...")
                                
                                # Process with Stanza
                                nlp_data = self.process_with_stanza(current_text)
                                
                                # Index in Elasticsearch
                                if self.index_article(current_title, nlp_data):
                                    self.stats['articles_indexed'] += 1
                                else:
                                    self.stats['errors'] += 1
                                
                                self.stats['articles_processed'] += 1
                                
                                # Update progress bar
                                pbar.update(1)
                                pbar.set_postfix({
                                    'indexed': self.stats['articles_indexed'],
                                    'errors': self.stats['errors']
                                })
                                
                                # Clean up XML elements to save memory
                            elem.clear()
                                
                        # Check if we've reached the target
                        if self.stats['articles_processed'] >= max_articles:
                            logger.info(f"Reached target of {max_articles} articles")
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
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Duration: {duration}")
        logger.info(f"Index name: {self.index_name}")
        logger.info("="*50)


def main():
    """Main function to run the wiki corpus processor."""
    parser = argparse.ArgumentParser(description="Process Wikipedia dump and create searchable corpus")
    parser.add_argument("--dump_file", help="Path to Wikipedia dump file (.xml.bz2)", default="/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2")
    parser.add_argument("--max-articles", type=int, default=100, help="Maximum articles to process (default: 100)")
    parser.add_argument("--language", default="de", help="Language code for Stanza (default: de)")
    parser.add_argument("--elasticsearch-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--index-name", default="wiki_docs", help="Elasticsearch index name")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = WikiCorpusProcessor(
        dump_file_path=args.dump_file,
        elasticsearch_host=args.elasticsearch_host,
        language=args.language,
        index_name=args.index_name
    )
    
    # Initialize components
    if not processor.initialize_elasticsearch():
        logger.error("Failed to initialize Elasticsearch")
        return 1
    
    if not processor.initialize_stanza():
        logger.error("Failed to initialize Stanza")
        return 1
    
    # Process the dump
    stats = processor.process_dump(max_articles=args.max_articles)
    
    # Check for success
    if stats['articles_indexed'] > 0:
        logger.info("Processing completed successfully!")
        return 0
    else:
        logger.error("No articles were successfully indexed")
        return 1


if __name__ == "__main__":
    exit(main())
