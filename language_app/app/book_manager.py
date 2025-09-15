"""
Book Manager for German EPUB Books

Handles listing, metadata extraction, and serving of EPUB books for the language learning app.
"""

import os
import zipfile
from pathlib import Path
from typing import List, Dict, Optional
import xml.etree.ElementTree as ET
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class BookManager:
    """Manages EPUB books for the language learning application."""
    
    def __init__(self, books_directory: str = "../german_books"):
        """
        Initialize BookManager.
        
        Args:
            books_directory: Path to directory containing EPUB files
        """
        self.books_directory = Path(books_directory)
        self.cache_file = Path("books_cache.json")
        self._books_cache = None
    
    def get_epub_files(self) -> List[Path]:
        """Get all EPUB files from the books directory."""
        if not self.books_directory.exists():
            logger.warning(f"Books directory not found: {self.books_directory}")
            return []
        
        epub_files = list(self.books_directory.glob("*.epub"))
        logger.info(f"Found {len(epub_files)} EPUB files")
        return epub_files
    
    def extract_epub_metadata(self, epub_path: Path) -> Dict:
        """
        Extract metadata from an EPUB file.
        
        Args:
            epub_path: Path to the EPUB file
            
        Returns:
            Dict containing book metadata
        """
        try:
            metadata = {
                "filename": epub_path.name,
                "title": "Unknown Title",
                "author": "Unknown Author",
                "language": "de",
                "file_size": epub_path.stat().st_size,
                "modified_date": datetime.fromtimestamp(epub_path.stat().st_mtime).isoformat(),
                "description": "",
                "publisher": "",
                "identifier": "",
                "cover_image": None
            }
            
            # Parse filename for basic info (fallback)
            filename_without_ext = epub_path.stem
            if " - " in filename_without_ext:
                parts = filename_without_ext.split(" - ", 1)
                metadata["author"] = parts[0].strip()
                metadata["title"] = parts[1].strip()
            else:
                metadata["title"] = filename_without_ext
            
            # Try to extract metadata from EPUB structure
            try:
                with zipfile.ZipFile(epub_path, 'r') as epub_zip:
                    # Look for OPF file (contains metadata)
                    opf_files = [f for f in epub_zip.namelist() if f.endswith('.opf')]
                    
                    if opf_files:
                        opf_content = epub_zip.read(opf_files[0])
                        root = ET.fromstring(opf_content)
                        
                        # Define namespace
                        ns = {'dc': 'http://purl.org/dc/elements/1.1/',
                              'opf': 'http://www.idpf.org/2007/opf'}
                        
                        # Extract metadata
                        title_elem = root.find('.//dc:title', ns)
                        if title_elem is not None and title_elem.text:
                            metadata["title"] = title_elem.text.strip()
                        
                        creator_elem = root.find('.//dc:creator', ns)
                        if creator_elem is not None and creator_elem.text:
                            metadata["author"] = creator_elem.text.strip()
                        
                        lang_elem = root.find('.//dc:language', ns)
                        if lang_elem is not None and lang_elem.text:
                            metadata["language"] = lang_elem.text.strip()
                        
                        desc_elem = root.find('.//dc:description', ns)
                        if desc_elem is not None and desc_elem.text:
                            metadata["description"] = desc_elem.text.strip()
                        
                        pub_elem = root.find('.//dc:publisher', ns)
                        if pub_elem is not None and pub_elem.text:
                            metadata["publisher"] = pub_elem.text.strip()
                        
                        id_elem = root.find('.//dc:identifier', ns)
                        if id_elem is not None and id_elem.text:
                            metadata["identifier"] = id_elem.text.strip()
                        
                        # Look for cover image - simplified approach
                        try:
                            manifest_items = root.findall('.//opf:item', ns)
                            cover_href = None
                            
                            # Method 1: Look for meta tag with cover
                            cover_meta = root.find('.//opf:meta[@name="cover"]', ns)
                            if cover_meta is not None:
                                cover_id = cover_meta.get('content')
                                for item in manifest_items:
                                    if item.get('id') == cover_id:
                                        cover_href = item.get('href')
                                        break
                            
                            # Method 2: Look for items with "cover" in id or href
                            if not cover_href:
                                for item in manifest_items:
                                    item_id = item.get('id', '').lower()
                                    item_href = item.get('href', '').lower()
                                    media_type = item.get('media-type', '')
                                    if media_type.startswith('image/') and ('cover' in item_id or 'cover' in item_href):
                                        cover_href = item.get('href')
                                        break
                            
                            # Method 3: Get first image file
                            if not cover_href:
                                for item in manifest_items:
                                    if item.get('media-type', '').startswith('image/'):
                                        cover_href = item.get('href')
                                        break
                            
                            # Store cover path if found
                            if cover_href:
                                # Handle relative paths from OPF directory
                                opf_dir = '/'.join(opf_files[0].split('/')[:-1]) if '/' in opf_files[0] else ''
                                if opf_dir:
                                    full_cover_path = f"{opf_dir}/{cover_href}"
                                else:
                                    full_cover_path = cover_href
                                
                                # Check if cover file exists in zip
                                if full_cover_path in epub_zip.namelist():
                                    metadata["cover_image"] = full_cover_path
                                elif cover_href in epub_zip.namelist():
                                    metadata["cover_image"] = cover_href
                                    
                        except Exception as cover_e:
                            logger.debug(f"Could not extract cover from {epub_path}: {cover_e}")
                            
            except Exception as e:
                logger.debug(f"Could not extract EPUB metadata from {epub_path}: {e}")
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error processing EPUB file {epub_path}: {e}")
            return {
                "filename": epub_path.name,
                "title": epub_path.stem,
                "author": "Unknown",
                "language": "de",
                "file_size": 0,
                "modified_date": datetime.now().isoformat(),
                "description": "",
                "publisher": "",
                "identifier": "",
                "error": str(e)
            }
    
    def get_all_books(self, force_refresh: bool = False) -> List[Dict]:
        """
        Get metadata for all EPUB books, with caching.
        
        Args:
            force_refresh: If True, ignore cache and refresh all metadata
            
        Returns:
            List of book metadata dictionaries
        """
        # Check cache first
        if not force_refresh and self._books_cache is not None:
            return self._books_cache
        
        if not force_refresh and self.cache_file.exists():
            try:
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                    # Check if cache is still valid (files haven't changed)
                    if self._is_cache_valid(cached_data):
                        self._books_cache = cached_data['books']
                        logger.info(f"Loaded {len(self._books_cache)} books from cache")
                        return self._books_cache
            except Exception as e:
                logger.warning(f"Could not load cache: {e}")
        
        # Refresh metadata
        logger.info("Refreshing book metadata...")
        epub_files = self.get_epub_files()
        books = []
        
        for epub_path in epub_files:
            metadata = self.extract_epub_metadata(epub_path)
            books.append(metadata)
        
        # Save to cache
        self._save_cache(books)
        self._books_cache = books
        
        logger.info(f"Found {len(books)} books")
        return books
    
    def _is_cache_valid(self, cached_data: Dict) -> bool:
        """Check if the cached data is still valid."""
        try:
            if 'timestamp' not in cached_data or 'books' not in cached_data:
                return False
            
            # Check if files have changed since cache was created
            cache_time = datetime.fromisoformat(cached_data['timestamp'])
            
            for book in cached_data['books']:
                book_path = self.books_directory / book['filename']
                if not book_path.exists():
                    return False
                
                file_mod_time = datetime.fromtimestamp(book_path.stat().st_mtime)
                if file_mod_time > cache_time:
                    return False
            
            return True
            
        except Exception:
            return False
    
    def _save_cache(self, books: List[Dict]):
        """Save books metadata to cache file."""
        try:
            cache_data = {
                'timestamp': datetime.now().isoformat(),
                'books': books
            }
            
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
                
        except Exception as e:
            logger.warning(f"Could not save cache: {e}")
    
    def get_book_by_filename(self, filename: str) -> Optional[Dict]:
        """Get book metadata by filename."""
        books = self.get_all_books()
        for book in books:
            if book['filename'] == filename:
                return book
        return None
    
    def get_book_path(self, filename: str) -> Optional[Path]:
        """Get the full path to a book file."""
        book_path = self.books_directory / filename
        if book_path.exists() and book_path.suffix.lower() == '.epub':
            return book_path
        return None
    
    def get_book_cover(self, filename: str) -> Optional[bytes]:
        """
        Extract cover image from EPUB file.
        
        Args:
            filename: EPUB filename
            
        Returns:
            Cover image bytes or None
        """
        try:
            book_path = self.get_book_path(filename)
            if not book_path:
                return None

            with zipfile.ZipFile(book_path, 'r') as epub_zip:
                # First, try to get cover from cached metadata
                book = self.get_book_by_filename(filename)
                if book and book.get('cover_image'):
                    cover_path = book['cover_image']
                    if cover_path in epub_zip.namelist():
                        return epub_zip.read(cover_path)
                
                # If not found, search for cover dynamically
                # Look for container.xml to find OPF file
                container_content = epub_zip.read('META-INF/container.xml')
                container_root = ET.fromstring(container_content)
                opf_path = container_root.find('.//{urn:oasis:names:tc:opendocument:xmlns:container}rootfile').get('full-path')
                
                # Read OPF file
                opf_content = epub_zip.read(opf_path)
                opf_root = ET.fromstring(opf_content)
                
                # Define namespace
                ns = {'opf': 'http://www.idpf.org/2007/opf'}
                
                # Look for cover in manifest
                manifest_items = opf_root.findall('.//opf:item', ns)
                cover_href = None
                
                # Try different methods to find cover
                # Method 1: Look for meta tag with cover
                cover_meta = opf_root.find('.//opf:meta[@name="cover"]', ns)
                if cover_meta is not None:
                    cover_id = cover_meta.get('content')
                    for item in manifest_items:
                        if item.get('id') == cover_id:
                            cover_href = item.get('href')
                            break
                
                # Method 2: Look for items with "cover" in id or href
                if not cover_href:
                    for item in manifest_items:
                        item_id = item.get('id', '').lower()
                        item_href = item.get('href', '').lower()
                        if ('cover' in item_id or 'cover' in item_href) and item.get('media-type', '').startswith('image/'):
                            cover_href = item.get('href')
                            break
                
                # Method 3: Get first image file
                if not cover_href:
                    for item in manifest_items:
                        if item.get('media-type', '').startswith('image/'):
                            cover_href = item.get('href')
                            break
                
                # Read cover image if found
                if cover_href:
                    # Handle relative paths
                    if '/' in opf_path:
                        opf_dir = '/'.join(opf_path.split('/')[:-1]) + '/'
                        full_cover_path = opf_dir + cover_href if not cover_href.startswith(opf_dir) else cover_href
                    else:
                        full_cover_path = cover_href
                    
                    if full_cover_path in epub_zip.namelist():
                        return epub_zip.read(full_cover_path)
                    elif cover_href in epub_zip.namelist():
                        return epub_zip.read(cover_href)
                    
        except Exception as e:
            logger.error(f"Error extracting cover from {filename}: {e}")
            
        return None
    
    def search_books(self, query: str) -> List[Dict]:
        """
        Search books by title, author, or description.
        
        Args:
            query: Search query string
            
        Returns:
            List of matching book metadata
        """
        if not query:
            return self.get_all_books()
        
        query_lower = query.lower()
        books = self.get_all_books()
        matches = []
        
        for book in books:
            # Search in title, author, and description
            searchable_text = f"{book['title']} {book['author']} {book.get('description', '')}".lower()
            if query_lower in searchable_text:
                matches.append(book)
        
        return matches
