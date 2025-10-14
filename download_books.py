#!/usr/bin/env python3
"""
Download German books from Project Gutenberg and extract clean text.
"""

import os
import re
from urllib.parse import urlencode, urljoin

import requests
from bs4 import BeautifulSoup


def get_books_from_page(soup):
    """Extract book information from a search results page."""
    books = []
    for item in soup.select("li.booklink"):
        title_tag = item.select_one("span.title")
        author_tag = item.select_one("span.subtitle")
        link_tag = item.select_one("a.link")

        title = title_tag.get_text(strip=True) if title_tag else None
        author = author_tag.get_text(strip=True) if author_tag else None

        page_url = None
        if link_tag and link_tag.get("href", "").startswith("/ebooks/"):
            page_url = urljoin("https://www.gutenberg.org", link_tag["href"])

        books.append({"title": title, "author": author, "page_url": page_url})
    return books


def find_text_download_links(book_page_url):
    """Find both EPUB and plain text download links for a book."""
    resp = requests.get(book_page_url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    epub_link = None
    txt_link = None

    for a in soup.select("a[href]"):
        text = a.get_text(strip=True).lower()
        href = a["href"]

        if "epub" in text and not epub_link:
            epub_link = urljoin("https://www.gutenberg.org", href)
        elif ("plain text utf-8" in text or "txt.utf-8" in href) and not txt_link:
            txt_link = urljoin("https://www.gutenberg.org", href)

    return epub_link, txt_link


def extract_gutenberg_text(text_content):
    """
    Extract main text from Project Gutenberg content.
    Skips [Illustration] rows and rows with numbers.
    """
    lines = text_content.split("\n")

    # Find the start point (after "Inhalt" section)
    start_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.lower() == "inhalt":
            # Skip the table of contents - find first substantial content
            for j in range(i + 1, len(lines)):
                current_line = lines[j].strip()

                if (
                    current_line
                    and not re.search(r"\d", current_line)  # No numbers
                    and not re.match(r"^[^.]*\.+", current_line)  # No dots
                    and len(current_line) > 20  # Substantial content
                    and not current_line.isupper()
                ):  # Not a title in all caps
                    start_idx = j
                    break
            break

    # If no "Inhalt" found, look for the start marker
    if start_idx is None:
        for i, line in enumerate(lines):
            if "*** START OF THE PROJECT GUTENBERG EBOOK" in line:
                start_idx = i + 1
                break

    # Find the end point
    end_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith("*** END OF THE PROJECT GUTENBERG EBOOK"):
            end_idx = i
            break

    if start_idx is None or end_idx is None:
        print("Could not find text boundaries, using full content")
        start_idx = 0
        end_idx = len(lines)

    # Extract and filter the content
    filtered_lines = []
    for line in lines[start_idx:end_idx]:
        stripped = line.strip()

        # Skip empty lines
        if not stripped:
            continue

        # Skip [Illustration] lines
        if "[Illustration]" in line:
            continue

        # Skip lines that contain any numbers
        if re.search(r"\d", stripped):
            continue

        # Normalize special characters
        line = normalize_special_characters(line)

        # Keep the line
        filtered_lines.append(line)

    return "\n".join(filtered_lines)


def normalize_special_characters(text):
    """
    Normalize special characters and fix spacing to prevent word concatenation.
    """
    # Dictionary of character replacements that need space preservation
    char_replacements = {
        # Quotes - normalize to standard quotes
        "«": '"',
        "»": '"',
        '"': '"',
        '"': '"',
        "„": '"',
        # Apostrophes - normalize to standard apostrophe
        """: "'",
        """: "'",
        "‚": "'",
        "‛": "'",
        "\u2019": "'",  # Replace curly apostrophe with straight apostrophe
        # Dashes - replace with space-dash-space to prevent concatenation
        "–": " - ",
        "—": " - ",
        "―": " - ",
        # Other punctuation
        "…": "...",
        "•": " ",  # Remove bullet point
        "·": " ",  # Remove middle dot
        "*": " ",  # Remove asterisk
        "~": " ",  # Replace tilde with space to prevent concatenation
        "=": " ",  # Replace equals with space
        "+": " ",  # Replace plus with space
        "_": " ",  # Replace underscore with space
        "[": " ",  # Replace left bracket with space
        "]": " ",  # Replace right bracket with space
        # Brackets
        "⟨": " <",
        "⟩": "> ",
        "〈": " <",
        "〉": "> ",
        # Special spaces - normalize to regular space
        " ": " ",  # Non-breaking space
        " ": " ",  # En space
        " ": " ",  # Em space
    }

    # Apply replacements
    for old_char, new_char in char_replacements.items():
        text = text.replace(old_char, new_char)

    # Clean up multiple spaces but preserve single spaces
    text = re.sub(r" +", " ", text)

    # Fix common spacing issues around punctuation
    text = re.sub(r"\s+([,.!?;:])", r"\1", text)  # Remove space before punctuation
    text = re.sub(
        r"([,.!?;:])([A-Za-z])", r"\1 \2", text
    )  # Add space after punctuation if missing

    # Handle German contractions specifically
    text = fix_german_contractions(text)

    return text


def fix_german_contractions(text):
    """
    Fix German colloquial contractions that may have been broken during character normalization.
    """
    # Common German contractions - fix spacing issues
    contractions = {
        # Common verb contractions
        r"(\w+)\s*'\s*s\b": r"\1's",  # war 's -> war's, gibt 's -> gibt's
        r"(\w+)\s*'\s*t\b": r"\1't",  # kann 't -> kann't
        r"(\w+)\s*'\s*m\b": r"\1'm",  # ich 'm -> ich'm
        r"(\w+)\s*'\s*n\b": r"\1'n",  # wir 'n -> wir'n
        r"(\w+)\s*'\s*ne\b": r"\1'ne",  # ich 'ne -> ich'ne
        # Specific common contractions
        r"\bwar\s*'\s*s\b": "war's",
        r"\bgibt\s*'\s*s\b": "gibt's",
        r"\bhol\s*'\s*s\b": "hol's",
        r"\bhol\s*'\s*ich\b": "hol' ich",
        r"\bsteh\s*'\s*nicht\b": "steh' nicht",
        r"\bHeut\s*'\s*um\b": "Heut' um",
        # Fix separated apostrophes at end of words
        r"(\w+)\s+'\s*([^a-zA-Z]|$)": r"\1'\2",  # word ' -> word'
        r"(\w+)\s*'\s+(\w)": r"\1' \2",  # word' letter -> word' letter
    }

    for pattern, replacement in contractions.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    return text

    return text


def download_and_process_book(book_info, output_dir):
    """Download and process a single book."""
    title = book_info["title"] or "Unknown"
    author = book_info["author"] or "Unknown"

    # Create safe filename
    safe_title = re.sub(r"[^\w\s-]", "", title)[:50]
    safe_author = re.sub(r"[^\w\s-]", "", author)[:30]
    base_filename = f"{safe_author} - {safe_title}"

    print(f"\nProcessing: {title} by {author}")

    if not book_info["page_url"]:
        print("  No page URL found, skipping")
        return False

    try:
        # Get download links
        epub_link, txt_link = find_text_download_links(book_info["page_url"])

        # Download and save EPUB if available
        if epub_link:
            print(f"  Downloading EPUB from: {epub_link}")
            resp = requests.get(epub_link)
            resp.raise_for_status()

            epub_path = os.path.join(output_dir, f"{base_filename}.epub")
            with open(epub_path, "wb") as f:
                f.write(resp.content)
            print(f"  EPUB saved: {epub_path}")

        # Download and process text
        if txt_link:
            print(f"  Downloading text from: {txt_link}")
            resp = requests.get(txt_link)
            resp.raise_for_status()

            # Extract clean text
            clean_text = extract_gutenberg_text(resp.text)

            # Save processed text
            txt_path = os.path.join(output_dir, f"{base_filename}_processed.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(clean_text)
            print(f"  Processed text saved: {txt_path}")
            print(f"  Extracted {len(clean_text)} characters")

        return True

    except Exception as e:
        print(f"  Error processing book: {e}")
        return False


def scrape_and_download_german_books(
    query="l.de", max_books=5, output_dir="german_books", start_book_index=0
):
    """
    Main function to scrape German books and download/process them.

    Args:
        query: Search query for Project Gutenberg (default: "l.de" for German language)
        max_books: Maximum number of books to download
        output_dir: Directory to save downloaded books
        start_book_index: Starting book index (0-based) to resume downloading from
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    results = []
    books_processed = 0

    # Calculate starting page and book offset based on start_book_index
    # Each page has 25 books
    start_page = start_book_index // 25
    page_num = start_page

    print(f"Searching for German books with query: '{query}'")
    print(f"Starting from book index: {start_book_index}")
    print(f"Starting from page: {start_page + 1}")
    print(f"Target: {max_books} books")
    print(f"Output directory: {output_dir}")

    books_seen_count = 0  # Track how many books we've seen (including skipped ones)
    while books_processed < max_books:
        start = page_num * 25 + 1
        url = "https://www.gutenberg.org/ebooks/search/?"
        f'{urlencode({"query": query, "sort_order": "release_date", "start_index": start})}'

        print(f"\nScraping page {page_num + 1}: {url}")

        try:
            resp = requests.get(url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            books = get_books_from_page(soup)

            if not books:
                print("No more books found")
                break

            for book in books:
                if books_processed >= max_books:
                    break

                # Skip books until we reach the starting index
                if books_seen_count < start_book_index:
                    books_seen_count += 1
                    continue

                books_seen_count += 1
                success = download_and_process_book(book, output_dir)
                if success:
                    books_processed += 1
                    results.append(book)

            page_num += 1

        except Exception as e:
            print(f"Error scraping page: {e}")
            break

    print("\n=== Summary ===")
    print(f"Started from book index: {start_book_index}")
    print(f"Successfully processed {books_processed} books")
    print(f"Total books seen: {books_seen_count}")
    print(f"Files saved in: {output_dir}")

    return results


def main():
    """Main function with configurable parameters."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Download and process German books from Project Gutenberg"
    )
    parser.add_argument("--query", default="l.de", help="Search query (default: l.de)")
    parser.add_argument(
        "--max-books",
        type=int,
        default=5,
        help="Maximum number of books to download (default: 5)",
    )
    parser.add_argument(
        "--output-dir",
        default="german_books",
        help="Output directory (default: german_books)",
    )
    parser.add_argument(
        "--start-book-index",
        type=int,
        default=0,
        help="Starting book index (0-based) to resume downloading from (default: 0)",
    )

    args = parser.parse_args()

    scrape_and_download_german_books(
        query=args.query,
        max_books=args.max_books,
        output_dir=args.output_dir,
        start_book_index=args.start_book_index,
    )


if __name__ == "__main__":
    main()
