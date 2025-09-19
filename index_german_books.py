#!/usr/bin/env python3
"""
German Books Elasticsearch Indexer

This script indexes processed German books into Elasticsearch
for language learning applications. It processes the cleaned text files with
Stanza NLP pipeline and creates sentence-level documents with full linguistic data.

Author: Language Learning Project  
Date: September 2025
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import argparse
import sys
from datetime import datetime

import stanza
from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import ConnectionError, RequestError
from tqdm import tqdm

# Import the shared quality checker
sys.path.append('language_app')
from language_app.app.quality_checker import SentenceQualityChecker

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
                 index_name: str = "german_books",
                 language: str = "de"):
        """
        Initialize the GermanBooksIndexer.
        
        Args:
            books_directory: Directory containing processed German book files
            elasticsearch_host: Elasticsearch connection string
            index_name: Name of the Elasticsearch index to create
            language: Language code for Stanza processing (default: 'de')
        """
        self.books_directory = Path(books_directory)
        self.elasticsearch_host = elasticsearch_host
        self.index_name = index_name
        self.language = language
        
        # Initialize components
        self.es = None
        self.nlp = None
        self.quality_checker = SentenceQualityChecker()
        
        # Simple tracking file for processed books
        self.processed_books_file = Path("processed_german_books.txt")
        
        # Statistics
        self.stats = {
            'books_processed': 0,
            'books_indexed': 0,
            'sentences_indexed': 0,
            'sentences_filtered': 0,
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
                    "indexed_date": {"type": "date"},
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
                    "indexed_date": {"type": "date"},
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
    
    def initialize_stanza(self) -> bool:
        """
        Initialize Stanza NLP pipeline for German text processing.
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            logger.info(f"Initializing Stanza pipeline for language: {self.language}")
            self.nlp = stanza.Pipeline(
                self.language, 
                processors='tokenize,mwt,pos,lemma,depparse',
                verbose=False,
                use_gpu=True  # Set to True if you have GPU support
            )
            logger.info("Stanza pipeline initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Stanza: {e}")
            return False
    
    def process_with_stanza_chunked(self, text: str, chunk_size: int = 40000) -> Dict:
        """
        Process text with Stanza NLP pipeline in chunks to handle long books.
        
        Args:
            text: Raw text to process
            chunk_size: Maximum characters per chunk
            
        Returns:
            Dict with doc_dict (sentences) and statistics
        """
        try:
            if len(text) <= chunk_size:
                # Process normally if text is small enough
                doc = self.nlp(text)
                doc_dict = doc.to_dict()
                
                return {
                    "doc_dict": doc_dict,
                    "sentence_count": len(doc_dict),
                    "word_count": sum(len(sentence) for sentence in doc_dict)
                }
            
            # Process in chunks for long books
            logger.info(f"Processing long text ({len(text)} chars) in chunks of {chunk_size}")
            
            all_sentences = []
            total_sentences = 0
            total_words = 0
            
            # Split text into chunks at sentence boundaries when possible
            chunks = self._split_into_smart_chunks(text, chunk_size)
            
            for i, chunk in enumerate(chunks):
                logger.debug(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")
                
                try:
                    doc = self.nlp(chunk)
                    doc_dict = doc.to_dict()
                    
                    all_sentences.extend(doc_dict)
                    total_sentences += len(doc_dict)
                    total_words += sum(len(sentence) for sentence in doc_dict)
                    
                except Exception as e:
                    logger.error(f"Error processing chunk {i+1}: {e}")
                    continue
            
            return {
                "doc_dict": all_sentences,
                "sentence_count": total_sentences,
                "word_count": total_words
            }
            
        except Exception as e:
            logger.error(f"Error processing text with Stanza: {e}")
            return {
                "doc_dict": [],
                "sentence_count": 0,
                "word_count": 0
            }
    
    def _split_into_smart_chunks(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks at natural boundaries (sentences/paragraphs).
        
        Args:
            text: Text to split
            chunk_size: Target chunk size
            
        Returns:
            List of text chunks
        """
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        current_chunk = ""
        
        # Split by paragraphs first
        paragraphs = text.split('\n\n')
        
        for paragraph in paragraphs:
            # If adding this paragraph would exceed chunk size
            if len(current_chunk) + len(paragraph) > chunk_size and current_chunk:
                # Save current chunk and start new one
                chunks.append(current_chunk.strip())
                current_chunk = paragraph
            else:
                # Add paragraph to current chunk
                if current_chunk:
                    current_chunk += '\n\n' + paragraph
                else:
                    current_chunk = paragraph
            
            # If single paragraph is too large, split by sentences
            if len(current_chunk) > chunk_size:
                sentences = re.split(r'[.!?]+\s+', current_chunk)
                temp_chunk = ""
                
                for sentence in sentences:
                    if len(temp_chunk) + len(sentence) > chunk_size and temp_chunk:
                        chunks.append(temp_chunk.strip())
                        temp_chunk = sentence
                    else:
                        if temp_chunk:
                            temp_chunk += '. ' + sentence
                        else:
                            temp_chunk = sentence
                
                current_chunk = temp_chunk
        
        # Add the final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
    
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
    

    
    def index_book(self, file_path: Path) -> Tuple[bool, str]:
        """
        Index a single book file into Elasticsearch with Stanza NLP processing.
        
        Args:
            file_path: Path to the processed book file
            
        Returns:
            Tuple[bool, str]: (success, reason) - reason explains the outcome
        """
        try:
            filename = file_path.name
            
            # Parse filename for metadata
            book_info = self.parse_filename(filename)
            
            # Read the processed text
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            
            if not text.strip():
                logger.warning(f"Empty text in {filename}")
                return False, "empty_text"
            
            # Process with Stanza NLP (chunked for long books)
            logger.info(f"Processing with Stanza: {book_info['title'][:50]}... ({len(text)} chars)")
            nlp_data = self.process_with_stanza_chunked(text)
            
            if not nlp_data["doc_dict"]:
                logger.warning(f"No sentences found after NLP processing in {filename}")
                return False, "no_sentences"
            
            # Prepare documents for bulk indexing with quality filtering
            documents = []
            doc_dict = nlp_data["doc_dict"]
            filtered_count = 0
            
            for sent_idx, sentence in enumerate(doc_dict):
                # Extract sentence text from tokens
                sentence_text = " ".join([token['text'] for token in sentence])
                
                # Quality check using shared quality checker
                if not self.quality_checker.is_quality_sentence(sentence_text, lang=self.language):
                    filtered_count += 1
                    continue
                
                # Create unique sentence ID
                sentence_id = f"{book_info['clean_filename']}_{sent_idx:06d}"
                
                doc_body = {
                    "book_title": book_info['title'],
                    "author": book_info['author'],
                    "filename": filename,
                    "sentence_id": sentence_id,
                    "sentence_text": sentence_text,
                    "sentence_number": sent_idx + 1,
                    "word_count": len(sentence_text.split()),
                    "char_count": len(sentence_text),
                    "indexed_date": datetime.now().isoformat(),
                    "tokens": sentence  # Full Stanza token information
                }
                
                documents.append({
                    "_index": self.index_name,
                    "_id": sentence_id,
                    "_source": doc_body
                })
            
            # Update statistics
            self.stats['sentences_filtered'] += filtered_count
            
            # Bulk index the documents
            if documents:
                helpers.bulk(self.es, documents)
                self.stats['sentences_indexed'] += len(documents)
                logger.info(f"Indexed {len(documents)} quality sentences from '{book_info['title']}' by {book_info['author']} (filtered out {filtered_count})")
                return True, "indexed"
            else:
                logger.warning(f"No quality sentences found in {filename} after filtering (filtered out {filtered_count})")
                return False, "no_quality_sentences"
                
        except Exception as e:
            logger.error(f"Error indexing book '{file_path}': {e}")
            return False, "error"
    
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
        
        # Initialize Stanza NLP pipeline
        if not self.initialize_stanza():
            logger.error("Failed to initialize Stanza pipeline")
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
                    success, reason = self.index_book(file_path)
                    
                    if success:
                        self.stats['books_indexed'] += 1
                        # Add to processed books file
                        self.add_processed_book(filename)
                        pbar.set_postfix({
                            'indexed': self.stats['books_indexed'],
                            'sentences': self.stats['sentences_indexed'],
                            'filtered': self.stats['sentences_filtered'],
                            'skipped': self.stats['books_skipped']
                        })
                    else:
                        self.stats['errors'] += 1
                        logger.warning(f"Failed to index {filename}: {reason}")
                        
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
        logger.info(f"Sentences filtered out: {self.stats['sentences_filtered']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Duration: {duration}")
        logger.info(f"Language: {self.language}")
        logger.info(f"Index name: {self.index_name}")
        logger.info("="*60)


def main():
    """Main function to run the German books indexer."""
    parser = argparse.ArgumentParser(description="Index processed German books into Elasticsearch with Stanza NLP processing")
    parser.add_argument("--books-dir", default="german_books", help="Directory containing processed book files (default: german_books)")
    parser.add_argument("--elasticsearch-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--index-name", default="german_books", help="Elasticsearch index name")
    parser.add_argument("--language", default="de", help="Language code for Stanza processing (default: de)")
    parser.add_argument("--force-recreate", action="store_true", help="Force recreation of index")
    parser.add_argument("--skip-existing", action="store_true", default=True, help="Skip books already in index (default: True)")
    
    args = parser.parse_args()
    
    # Initialize indexer
    indexer = GermanBooksIndexer(
        books_directory=args.books_dir,
        elasticsearch_host=args.elasticsearch_host,
        index_name=args.index_name,
        language=args.language
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
