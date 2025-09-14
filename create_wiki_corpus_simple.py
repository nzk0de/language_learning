#!/usr/bin/env python3
"""
Simplified Wikipedia Corpus Processing Script with Multiprocessing

This script processes Wikipedia dump files, extracts articles, parses them with Stanza NLP,
and indexes them in Elasticsearch. Only includes quality checks - no duplicate/similarity checking.

Author: Language Learning Project
Date: September 2025
"""

import bz2
import logging
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple
import argparse
import sys
from datetime import datetime
import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, as_completed

import mwparserfromhell
import stanza
import torch
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import ConnectionError, RequestError
from tqdm import tqdm
from language_app.app.quality_checker import SentenceQualityChecker

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


def process_article_worker(args):
    """
    Worker function for multiprocessing article processing.
    
    Args:
        args: Tuple of (title, text, language, use_gpu, index_name)
        
    Returns:
        Tuple of (title, success, documents_or_error_message)
    """
    title, text, language, use_gpu, index_name = args
    
    try:
        # Initialize Stanza pipeline in worker process
        device = 'cuda' if use_gpu and torch.cuda.is_available() else 'cpu'
        
        nlp = stanza.Pipeline(
            language,
            processors='tokenize,mwt,pos,lemma,depparse',
            verbose=False,
            use_gpu=(device == 'cuda')
        )
        
        # Initialize quality checker
        quality_checker = SentenceQualityChecker()
        
        # Process text with Stanza (limit length to avoid memory issues)
        if len(text) > 100000:
            text = text[:100000] + "..."
        
        doc = nlp(text)
        doc_dict = doc.to_dict()
        
        # Prepare documents for indexing with quality filtering
        documents = []
        
        for sent_idx, sentence in enumerate(doc_dict):
            # Extract sentence text from tokens
            sentence_text = " ".join([token['text'] for token in sentence])
            
            # Quality check - only keep high-quality sentences
            if quality_checker.is_quality_sentence(sentence_text):
                # Create unique sentence ID
                unique_sentence_id = f"{title}_{sent_idx:04d}"
                
                doc_body = {
                    "title": title,
                    "sentence_id": unique_sentence_id,
                    "sentence_text": sentence_text,
                    "tokens": sentence
                }
                documents.append({
                    "_index": index_name,
                    "_id": unique_sentence_id,
                    "_source": doc_body
                })
        
        return title, len(documents) > 0, documents
            
    except Exception as e:
        return title, False, str(e)


class SimpleWikiCorpusProcessor:
    """
    Simplified Wikipedia corpus processor with multiprocessing support.
    Only processes articles with quality filtering - no caching or similarity checks.
    """
    
    def __init__(self, 
                 dump_file_path: str,
                 elasticsearch_host: str = "http://localhost:9200",
                 language: str = "de",
                 index_name: str = "wiki_docs",
                 use_gpu: bool = True,
                 num_workers: int = None):
        """
        Initialize the processor.
        
        Args:
            dump_file_path: Path to the Wikipedia dump file (.xml.bz2)
            elasticsearch_host: Elasticsearch connection string
            language: Language code for Stanza processing (e.g., 'de', 'en')
            index_name: Name of the Elasticsearch index to create
            use_gpu: Whether to use GPU if available
            num_workers: Number of worker processes (default: CPU count - 1)
        """
        self.dump_file_path = Path(dump_file_path)
        self.elasticsearch_host = elasticsearch_host
        self.language = language
        self.index_name = index_name
        self.use_gpu = use_gpu
        self.num_workers = num_workers or max(1, mp.cpu_count() - 1)
        
        # Initialize components
        self.es = None
        self.device = self._detect_device()
        
        # Simple statistics
        self.stats = {
            'articles_processed': 0,
            'articles_indexed': 0,
            'articles_rejected': 0,
            'errors': 0,
            'start_time': None,
            'end_time': None
        }
    
    def _detect_device(self) -> str:
        """Detect whether to use GPU or CPU for processing."""
        if not self.use_gpu:
            logger.info("GPU usage disabled by user - using CPU")
            return 'cpu'
            
        try:
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
                logger.info(f"GPU detected: {gpu_name} ({gpu_memory:.1f}GB) - using CUDA")
                return 'cuda'
            else:
                logger.info("No CUDA-compatible GPU found - using CPU")
                return 'cpu'
        except Exception as e:
            logger.warning(f"Error detecting GPU: {e} - falling back to CPU")
            return 'cpu'
    
    def initialize_elasticsearch(self, force_recreate: bool = False) -> bool:
        """Initialize Elasticsearch connection and create index if needed."""
        try:
            self.es = Elasticsearch(self.elasticsearch_host)
            
            if not self.es.ping():
                logger.error(f"Cannot connect to Elasticsearch at {self.elasticsearch_host}")
                return False
            
            logger.info(f"Connected to Elasticsearch at {self.elasticsearch_host}")
            
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
            if not self.es.indices.exists(index=self.index_name):
                self.es.indices.create(index=self.index_name, body=mapping)
                logger.info(f"Created new index: {self.index_name}")
            else:
                logger.info(f"Index '{self.index_name}' already exists")
            
        except RequestError as e:
            logger.error(f"Error creating index: {e}")
            raise
    
    def _force_recreate_index(self):
        """Force delete and recreate the index."""
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
            if self.es.indices.exists(index=self.index_name):
                self.es.indices.delete(index=self.index_name)
                logger.warning(f"DELETED existing index: {self.index_name}")
            
            self.es.indices.create(index=self.index_name, body=mapping)
            logger.info(f"Created new index: {self.index_name}")
            
        except RequestError as e:
            logger.error(f"Error recreating index: {e}")
            raise
    
    def index_documents_batch(self, all_documents: List[Dict]) -> Tuple[int, int]:
        """Index a batch of documents in Elasticsearch."""
        try:
            if not all_documents:
                return 0, 0
                
            response = helpers.bulk(self.es, all_documents, chunk_size=1000)
            success_count = len(all_documents)
            error_count = 0
            
            # Check for any errors in the response
            if isinstance(response, tuple) and len(response) > 1:
                errors = response[1]
                if errors:
                    error_count = len(errors)
                    success_count -= error_count
                    logger.warning(f"Bulk indexing had {error_count} errors")
            
            return success_count, error_count
            
        except Exception as e:
            logger.error(f"Error in bulk indexing: {e}")
            return 0, len(all_documents)
    
    def process_articles_batch(self, articles_batch: List[Tuple[str, str]]) -> Tuple[int, int, int]:
        """Process a batch of articles using multiprocessing."""
        if not articles_batch:
            return 0, 0, 0
            
        logger.info(f"Processing batch of {len(articles_batch)} articles with {self.num_workers} workers")
        
        # Prepare arguments for worker processes
        worker_args = [
            (title, text, self.language, (self.device == 'cuda'), self.index_name)
            for title, text in articles_batch
        ]
        
        all_documents = []
        indexed_count = 0
        rejected_count = 0
        error_count = 0
        
        try:
            # Use ProcessPoolExecutor for parallel processing
            with ProcessPoolExecutor(max_workers=self.num_workers) as executor:
                # Submit all tasks
                future_to_title = {
                    executor.submit(process_article_worker, args): args[0] 
                    for args in worker_args
                }
                
                # Process completed tasks
                for future in as_completed(future_to_title):
                    title = future_to_title[future]
                    try:
                        result_title, success, data = future.result()
                        
                        if success:
                            # Add documents to batch for indexing
                            all_documents.extend(data)
                        elif isinstance(data, str):  # Error message
                            error_count += 1
                            logger.error(f"Error processing {result_title}: {data}")
                        else:  # Empty documents (rejected)
                            rejected_count += 1
                            logger.debug(f"Rejected: {result_title} - no quality sentences")
                            
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Exception processing {title}: {e}")
            
            # Bulk index all documents at once
            if all_documents:
                success_indexed, index_errors = self.index_documents_batch(all_documents)
                indexed_count = success_indexed
                error_count += index_errors
                logger.info(f"Batch indexed: {indexed_count} articles, {len(all_documents)} documents")
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            error_count += len(articles_batch)
        
        return indexed_count, rejected_count, error_count
    
    def process_dump(self, max_articles: int = 100, batch_size: int = 10) -> Dict:
        """
        Process Wikipedia dump file and create corpus using multiprocessing.
        
        Args:
            max_articles: Maximum number of articles to INDEX
            batch_size: Number of articles to process in parallel batches
            
        Returns:
            Dict containing processing statistics
        """
        if not self.dump_file_path.exists():
            logger.error(f"Dump file not found: {self.dump_file_path}")
            return self.stats
        
        logger.info(f"Starting to process dump file: {self.dump_file_path}")
        logger.info(f"Target: INDEX {max_articles} articles")
        logger.info(f"Using {self.num_workers} workers, batch size: {batch_size}")
        logger.info(f"Device: {self.device}")
        
        self.stats['start_time'] = datetime.now()
        
        # Initialize progress bar
        pbar = tqdm(desc=f"Processing articles (target: {max_articles})", unit="articles")
        
        # Batch processing variables
        current_batch = []
        
        try:
            with bz2.open(self.dump_file_path) as f:
                in_page = False
                current_title = None
                current_text = None
                
                for event, elem in ET.iterparse(f, events=("start", "end")):
                    if event == "start":
                        if elem.tag.endswith("page"):
                            in_page = True
                            current_title = None
                            current_text = None
                    elif event == "end":
                        if elem.tag.endswith("title") and in_page:
                            current_title = elem.text
                        elif elem.tag.endswith("text") and in_page:
                            if elem.text:
                                wikicode = mwparserfromhell.parse(elem.text)
                                current_text = wikicode.strip_code()
                        elif elem.tag.endswith("page") and in_page:
                            in_page = False
                            
                            # Process article if valid
                            if current_title and current_text:
                                # Add to batch for processing
                                current_batch.append((current_title, current_text))
                                self.stats['articles_processed'] += 1
                                
                                # Process batch when it's full
                                if len(current_batch) >= batch_size:
                                    batch_indexed, batch_rejected, batch_errors = self.process_articles_batch(current_batch)
                                    
                                    # Update statistics
                                    self.stats['articles_indexed'] += batch_indexed
                                    self.stats['articles_rejected'] += batch_rejected
                                    self.stats['errors'] += batch_errors
                                    
                                    # Update progress bar
                                    pbar.update(batch_indexed)
                                    pbar.set_postfix({
                                        'processed': self.stats['articles_processed'],
                                        'indexed': self.stats['articles_indexed'],
                                        'rejected': self.stats['articles_rejected'],
                                        'errors': self.stats['errors']
                                    })
                                    
                                    # Clear batch
                                    current_batch = []
                                    
                                    # Check if target reached
                                    if self.stats['articles_indexed'] >= max_articles:
                                        logger.info(f"SUCCESS: Reached target of {max_articles} INDEXED articles!")
                                        break
                            
                            # Clean up XML elements to save memory
                            elem.clear()
                    
                    # Check if target reached (outside the page processing)
                    if self.stats['articles_indexed'] >= max_articles:
                        break
                
                # Process remaining articles in the last batch
                if current_batch and self.stats['articles_indexed'] < max_articles:
                    logger.info(f"Processing final batch of {len(current_batch)} articles...")
                    batch_indexed, batch_rejected, batch_errors = self.process_articles_batch(current_batch)
                    
                    self.stats['articles_indexed'] += batch_indexed
                    self.stats['articles_rejected'] += batch_rejected
                    self.stats['errors'] += batch_errors
                    
                    pbar.update(batch_indexed)
        
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
        
        logger.info("="*60)
        logger.info("PROCESSING COMPLETE")
        logger.info("="*60)
        logger.info(f"Articles processed: {self.stats['articles_processed']}")
        logger.info(f"Articles indexed: {self.stats['articles_indexed']}")
        logger.info(f"Articles rejected (quality): {self.stats['articles_rejected']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Duration: {duration}")
        logger.info(f"Index name: {self.index_name}")
        logger.info("="*60)


def main():
    """Main function to run the simplified wiki corpus processor."""
    parser = argparse.ArgumentParser(description="Process Wikipedia dump and create searchable corpus (simplified)")
    parser.add_argument("--dump_file", help="Path to Wikipedia dump file (.xml.bz2)", 
                        default="/home/ubuntu/Downloads/dewiki-20250901-pages-articles-multistream1.xml-p1p297012.bz2")
    parser.add_argument("--max-articles", type=int, default=100, 
                        help="Number of articles to INDEX (default: 100)")
    parser.add_argument("--language", default="de", help="Language code for Stanza (default: de)")
    parser.add_argument("--elasticsearch-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--index-name", default="wiki_docs_simple", help="Elasticsearch index name")
    parser.add_argument("--force-recreate", action="store_true", 
                        help="Force recreation of index (deletes existing data)")
    parser.add_argument("--batch-size", type=int, default=10, 
                        help="Number of articles to process in parallel batches (default: 10)")
    parser.add_argument("--num-workers", type=int, 
                        help="Number of worker processes (default: CPU count - 1)")
    parser.add_argument("--no-gpu", action="store_true", help="Disable GPU usage, force CPU processing")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = SimpleWikiCorpusProcessor(
        dump_file_path=args.dump_file,
        elasticsearch_host=args.elasticsearch_host,
        language=args.language,
        index_name=args.index_name,
        use_gpu=(not args.no_gpu),
        num_workers=args.num_workers
    )
    
    # Initialize Elasticsearch
    if not processor.initialize_elasticsearch(force_recreate=args.force_recreate):
        logger.error("Failed to initialize Elasticsearch")
        return 1
    
    # Process the dump with batch processing
    stats = processor.process_dump(
        max_articles=args.max_articles,
        batch_size=args.batch_size
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
