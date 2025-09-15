#!/usr/bin/env python3
"""
German Books Elasticsearch Indexer

This script indexes processed German books  into Elasticsearch
for language learning applications. It processes the cleaned text files and creates
sentence-level documents with basic metadata.

Author: Language Learning Project  
Date: September 2025
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional
import argparse
import sys
from datetime import datetime

from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import ConnectionError, RequestError
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('german_books_indexer.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class GermanBooksIndexer:
    """
    A class to index processed German books into Elasticsearch for language learning.
    """
    
    def __init__(self, 
                 books_directory: str = "german_books",
                 elasticsearch_host: str = "http://localhost:9200",
                 index_name: str = "german_books"):
        """
        Initialize the GermanBooksIndexer.
        
        Args:
            books_directory: Directory containing processed German book files
            elasticsearch_host: Elasticsearch connection string
            index_name: Name of the Elasticsearch index to create
        """
        self.books_directory = Path(books_directory)
        self.elasticsearch_host = elasticsearch_host
        self.index_name = index_name
        
        # Initialize components
        self.es = None
        
        # Simple tracking file for processed books
        self.processed_books_file = Path("processed_german_books.txt")
        
        # Statistics
        self.stats = {
            'books_processed': 0,
            'books_indexed': 0,
            'sentences_indexed': 0,
            'books_skipped': 0,
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
            
            # Create or recreate index
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
                    "book_title": {"type": "keyword"},
                    "author": {"type": "keyword"},
                    "filename": {"type": "keyword"},
                    "sentence_id": {"type": "keyword"},
                    "sentence_text": {"type": "text"},
                    "sentence_number": {"type": "integer"},
                    "word_count": {"type": "integer"},
                    "char_count": {"type": "integer"},
                    "indexed_date": {"type": "date"}
                }
            }
        }
        
        try:
            if not self.es.indices.exists(index=self.index_name):
                self.es.indices.create(index=self.index_name, body=mapping)
                logger.info(f"Created new index: {self.index_name}")
            else:
                logger.info(f"Index '{self.index_name}' already exists - preserving existing data")
            
        except RequestError as e:
            logger.error(f"Error creating index: {e}")
            raise
    
    def _force_recreate_index(self):
        """Force delete and recreate the index."""
        mapping = {
            "mappings": {
                "properties": {
                    "book_title": {"type": "keyword"},
                    "author": {"type": "keyword"},
                    "filename": {"type": "keyword"},
                    "sentence_id": {"type": "keyword"},
                    "sentence_text": {"type": "text"},
                    "sentence_number": {"type": "integer"},
                    "word_count": {"type": "integer"},
                    "char_count": {"type": "integer"},
                    "indexed_date": {"type": "date"}
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
            logger.error(f"Error force recreating index: {e}")
            raise
    
    def get_processed_books(self) -> set:
        """
        Get set of already processed book filenames from local file.
        
        Returns:
            set: Set of processed book filenames
        """
        try:
            if self.processed_books_file.exists():
                with open(self.processed_books_file, 'r', encoding='utf-8') as f:
                    processed_books = set(line.strip() for line in f if line.strip())
                logger.info(f"Found {len(processed_books)} previously processed books")
                return processed_books
            else:
                logger.info("No processed books file found - starting fresh")
                return set()
        except Exception as e:
            logger.error(f"Error reading processed books file: {e}")
            return set()
    
    def add_processed_book(self, filename: str):
        """
        Add a book filename to the processed books file.
        
        Args:
            filename: Name of the processed book file
        """
        try:
            with open(self.processed_books_file, 'a', encoding='utf-8') as f:
                f.write(f"{filename}\n")
        except Exception as e:
            logger.error(f"Error adding processed book to file: {e}")
    
    def parse_filename(self, filename: str) -> Dict[str, str]:
        """
        Parse book filename to extract author and title.
        Expected format: "Author Name - Book Title_processed.txt"
        
        Args:
            filename: Name of the processed text file
            
        Returns:
            Dict with author, title, and clean_filename
        """
        try:
            # Remove _processed.txt extension
            clean_name = filename.replace('_processed.txt', '')
            
            # Split by " - " to separate author and title
            if ' - ' in clean_name:
                parts = clean_name.split(' - ', 1)
                author = parts[0].strip()
                title = parts[1].strip()
            else:
                # Fallback if format is different
                author = "Unknown"
                title = clean_name
            
            return {
                'author': author,
                'title': title,
                'clean_filename': clean_name
            }
            
        except Exception as e:
            logger.error(f"Error parsing filename '{filename}': {e}")
            return {
                'author': 'Unknown',
                'title': filename,
                'clean_filename': filename
            }
    
    def split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using simple sentence boundary detection.
        
        Args:
            text: Raw text to split
            
        Returns:
            List of sentences
        """
        try:
            # Simple sentence splitting - can be improved with more sophisticated NLP
            sentences = []
            
            # Split by common sentence endings
            text = re.sub(r'\n+', ' ', text)  # Replace newlines with spaces
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            
            # Split on sentence boundaries
            raw_sentences = re.split(r'[.!?]+\s+', text)
            
            for sentence in raw_sentences:
                sentence = sentence.strip()
                if sentence and len(sentence) > 10:  # Filter very short sentences
                    sentences.append(sentence)
            
            return sentences
            
        except Exception as e:
            logger.error(f"Error splitting text into sentences: {e}")
            return []
    
    def index_book(self, file_path: Path) -> bool:
        """
        Index a single book file into Elasticsearch.
        
        Args:
            file_path: Path to the processed book file
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            filename = file_path.name
            
            # Parse filename for metadata
            book_info = self.parse_filename(filename)
            
            # Read the processed text
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            
            # Split into sentences
            sentences = self.split_into_sentences(text)
            
            if not sentences:
                logger.warning(f"No sentences found in {filename}")
                return False
            
            # Prepare documents for bulk indexing
            documents = []
            
            for sent_idx, sentence_text in enumerate(sentences):
                # Create unique sentence ID
                sentence_id = f"{book_info['clean_filename']}_{sent_idx:06d}"
                
                # Basic quality check - skip very short or very long sentences
                word_count = len(sentence_text.split())
                if word_count < 3 or word_count > 100:
                    continue
                
                doc_body = {
                    "book_title": book_info['title'],
                    "author": book_info['author'],
                    "filename": filename,
                    "sentence_id": sentence_id,
                    "sentence_text": sentence_text,
                    "sentence_number": sent_idx + 1,
                    "word_count": word_count,
                    "char_count": len(sentence_text),
                    "indexed_date": datetime.now().isoformat()
                }
                
                documents.append({
                    "_index": self.index_name,
                    "_id": sentence_id,
                    "_source": doc_body
                })
            
            # Bulk index the documents
            if documents:
                helpers.bulk(self.es, documents)
                self.stats['sentences_indexed'] += len(documents)
                logger.info(f"Indexed {len(documents)} sentences from '{book_info['title']}' by {book_info['author']}")
                return True
            else:
                logger.warning(f"No quality sentences found in {filename}")
                return False
                
        except Exception as e:
            logger.error(f"Error indexing book '{file_path}': {e}")
            return False
    
    def process_books_directory(self, skip_existing: bool = True) -> Dict:
        """
        Process all processed book files in the directory.
        
        Args:
            skip_existing: If True, skip books already in the index
            
        Returns:
            Dict containing processing statistics
        """
        if not self.books_directory.exists():
            logger.error(f"Books directory not found: {self.books_directory}")
            return self.stats
        
        # Find all processed text files
        processed_files = list(self.books_directory.glob("*_processed.txt"))
        
        if not processed_files:
            logger.error(f"No processed book files found in {self.books_directory}")
            return self.stats
        
        logger.info(f"Found {len(processed_files)} processed book files")
        
        # Get processed books if skip_existing is enabled
        processed_books = set()
        if skip_existing:
            processed_books = self.get_processed_books()
        
        self.stats['start_time'] = datetime.now()
        
        # Process each book file
        with tqdm(processed_files, desc="Indexing books", unit="books") as pbar:
            for file_path in pbar:
                filename = file_path.name
                
                # Update progress bar with current book
                book_info = self.parse_filename(filename)
                pbar.set_description(f"Processing: {book_info['author']} - {book_info['title'][:30]}...")
                
                # Skip if already processed
                if skip_existing and filename in processed_books:
                    logger.info(f"Skipping already processed book: {filename}")
                    self.stats['books_skipped'] += 1
                    continue
                
                # Process the book
                self.stats['books_processed'] += 1
                
                try:
                    success = self.index_book(file_path)
                    
                    if success:
                        self.stats['books_indexed'] += 1
                        # Add to processed books file
                        self.add_processed_book(filename)
                        pbar.set_postfix({
                            'indexed': self.stats['books_indexed'],
                            'sentences': self.stats['sentences_indexed'],
                            'skipped': self.stats['books_skipped']
                        })
                    else:
                        self.stats['errors'] += 1
                        
                except Exception as e:
                    logger.error(f"Error processing {filename}: {e}")
                    self.stats['errors'] += 1
        
        self.stats['end_time'] = datetime.now()
        self._log_final_stats()
        
        return self.stats
    
    def _log_final_stats(self):
        """Log final processing statistics."""
        duration = self.stats['end_time'] - self.stats['start_time']
        
        logger.info("="*60)
        logger.info("GERMAN BOOKS INDEXING COMPLETE")
        logger.info("="*60)
        logger.info(f"Books processed: {self.stats['books_processed']}")
        logger.info(f"Books indexed: {self.stats['books_indexed']}")
        logger.info(f"Books skipped (existing): {self.stats['books_skipped']}")
        logger.info(f"Sentences indexed: {self.stats['sentences_indexed']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Duration: {duration}")
        logger.info(f"Index name: {self.index_name}")
        logger.info("="*60)


def main():
    """Main function to run the German books indexer."""
    parser = argparse.ArgumentParser(description="Index processed German books into Elasticsearch")
    parser.add_argument("--books-dir", default="german_books", help="Directory containing processed book files (default: german_books)")
    parser.add_argument("--elasticsearch-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--index-name", default="german_books", help="Elasticsearch index name")
    parser.add_argument("--force-recreate", action="store_true", help="Force recreation of index")
    parser.add_argument("--skip-existing", action="store_true", default=True, help="Skip books already in index (default: True)")
    
    args = parser.parse_args()
    
    # Initialize indexer
    indexer = GermanBooksIndexer(
        books_directory=args.books_dir,
        elasticsearch_host=args.elasticsearch_host,
        index_name=args.index_name
    )
    
    # Initialize Elasticsearch
    if not indexer.initialize_elasticsearch(force_recreate=args.force_recreate):
        logger.error("Failed to initialize Elasticsearch")
        return 1
    
    # Process all books
    stats = indexer.process_books_directory(skip_existing=args.skip_existing)
    
    # Check for success
    if stats['books_indexed'] > 0 or stats['books_skipped'] > 0:
        logger.info("Indexing completed successfully!")
        return 0
    else:
        logger.error("No books were processed successfully")
        return 1


if __name__ == "__main__":
    exit(main())
