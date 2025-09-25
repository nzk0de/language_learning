import json
import logging
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List

logger = logging.getLogger(__name__)


class BookManager:
    """Manages EPUB books for the language learning application."""

    def __init__(self, books_directory: str = "../german_books"):
        self.books_directory = Path(books_directory)
        self.cache_file = self.books_directory / "books_metadata_cache.json"
        self._books_cache: List[Dict] = []
        self._cache_loaded = False  # Flag to ensure we only load from file once

    def get_epub_files(self) -> List[Path]:
        if not self.books_directory.exists():
            self.books_directory.mkdir(parents=True, exist_ok=True)
            logger.warning(f"Books directory created at: {self.books_directory.resolve()}")
            return []
        return list(self.books_directory.glob("*.epub"))

    def get_all_books(self, force_refresh: bool = False) -> List[Dict]:
        """
        Get metadata for all EPUB books, with robust caching.
        This is the central method to get the master list of books.
        """
        if not force_refresh and self._cache_loaded and self._books_cache:
            return self._books_cache

        if not force_refresh and self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                self._books_cache = cached_data["books"]
                self._cache_loaded = True
                logger.info(f"Loaded {len(self._books_cache)} books from cache.")
                return self._books_cache
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Cache file is invalid, rebuilding. Error: {e}")

        logger.info("Refreshing book metadata from files...")
        epub_files = self.get_epub_files()
        books = [self.extract_epub_metadata(epub_path) for epub_path in epub_files]

        self._save_cache(books)
        self._books_cache = books
        self._cache_loaded = True
        logger.info(f"Refreshed and cached {len(books)} books.")
        return books

    def search_books(self, query: str, page: int = 1, limit: int = 20) -> Dict:
        """
        Search books by title, author, or description with pagination from the master list.
        """
        all_books = self.get_all_books()

        def book_text(book):
            return " ".join(book.get(k, "").lower() for k in ("title", "author", "description"))

        if query:
            query_lower = query.lower()
            matches = [book for book in all_books if query_lower in book_text(book)]
        else:
            matches = all_books

        total_items = len(matches)
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_results = matches[start_index:end_index]

        return {
            "books": paginated_results,
            "total": total_items,
            "page": page,
            "limit": limit,
            "has_more": end_index < total_items,
        }

    def _save_cache(self, books: List[Dict]):
        try:
            cache_data = {"timestamp": datetime.now().isoformat(), "books": books}
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Could not save metadata cache: {e}")

    def get_book_by_filename(self, filename: str) -> Dict:
        """
        Get book metadata by filename EFFICIENTLY using the cached master list.
        """
        all_books = self.get_all_books()  # This will be fast as it hits the cache
        return next((book for book in all_books if book["filename"] == filename), {})

    def get_book_path(self, filename: str) -> Path:
        book_path = self.books_directory / filename
        return book_path if book_path.exists() else Path("")

    def get_book_cover(self, filename: str) -> bytes:
        """
        Extract cover image from EPUB file EFFICIENTLY.
        """
        book_meta = self.get_book_by_filename(filename)  # Fast lookup
        if not book_meta or not book_meta.get("cover_image"):
            return b""

        book_path = self.get_book_path(filename)
        if not book_path:
            return b""

        try:
            with zipfile.ZipFile(book_path, "r") as epub_zip:
                cover_path_in_zip = book_meta["cover_image"]
                if cover_path_in_zip in epub_zip.namelist():
                    return epub_zip.read(cover_path_in_zip)
        except Exception as e:
            logger.warning(f"Could not extract cover from {filename}: {e}")

        return b""

    def extract_epub_metadata(self, epub_path: Path) -> Dict:
        """
        Extract metadata from a single EPUB file.
        (Logic is complex but kept as is, with debugging prints removed for production)
        """
        metadata = {
            "filename": epub_path.name,
            "title": epub_path.stem,
            "author": "Unknown Author",
            "language": "de",  # Default language
            "file_size": epub_path.stat().st_size,
            "description": "",
            "cover_image": None,
        }

        try:
            with zipfile.ZipFile(epub_path, "r") as epub_zip:
                opf_files = [f for f in epub_zip.namelist() if f.endswith(".opf")]
                if not opf_files:
                    return metadata  # Return basic info if no OPF file

                opf_content = epub_zip.read(opf_files[0])
                root = ET.fromstring(opf_content)
                ns = {
                    "dc": "http://purl.org/dc/elements/1.1/",
                    "opf": "http://www.idpf.org/2007/opf",
                }

                # Helper to find and get text
                def find_text(path):
                    elem = root.find(path, ns)
                    return elem.text.strip() if elem is not None and elem.text else None

                metadata["title"] = find_text(".//dc:title") or metadata["title"]
                metadata["author"] = find_text(".//dc:creator") or metadata["author"]
                metadata["language"] = find_text(".//dc:language") or metadata["language"]
                metadata["description"] = find_text(".//dc:description") or ""

                # Cover image extraction logic
                manifest = root.find(".//opf:manifest", ns)
                if manifest is None:
                    return metadata

                cover_href = None
                cover_meta = root.find('.//opf:meta[@name="cover"]', ns)
                if cover_meta is not None:
                    cover_id = cover_meta.get("content")
                    cover_item = manifest.find(f".//opf:item[@id='{cover_id}']", ns)
                    if cover_item is not None:
                        cover_href = cover_item.get("href")

                if not cover_href:
                    # Fallback search for 'cover' in properties
                    cover_item = manifest.find(".//*[@properties='cover-image']", ns)
                    if cover_item is not None:
                        cover_href = cover_item.get("href")

                if cover_href:
                    opf_dir = Path(opf_files[0]).parent
                    full_cover_path = (opf_dir / Path(cover_href)).as_posix()  # Normalize path
                    if full_cover_path in epub_zip.namelist():
                        metadata["cover_image"] = full_cover_path

        except Exception as e:
            logger.debug(f"Could not fully parse EPUB metadata from {epub_path.name}: {e}")

        return metadata
