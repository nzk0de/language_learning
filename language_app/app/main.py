from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.book_manager import BookManager
from app.es_utils import ElasticHelper
from app.schema import InputText
from app.translation import MYTranslator
from app.validators import validate_word
from app.youtube_handler import YouTubeHandler, extract_video_id


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.translator = MYTranslator()
        app.state.elastic = ElasticHelper()
        app.state.book_manager = BookManager()
        yield
    finally:
        # if you need cleanup, do it here
        pass


app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Dependencies ----------
def get_translator():
    return app.state.translator


def get_elastic():
    return app.state.elastic


def get_book_manager():
    return app.state.book_manager


# ---------- Endpoints ----------
@app.post("/translate")
async def translate(item: InputText, translator: MYTranslator = Depends(get_translator)):
    if item.src_lang not in translator.lang_codes or item.tgt_lang not in translator.lang_codes:
        return {"error": f"Invalid lang code. Supported: {sorted(translator.lang_codes)}"}

    # Use the new async translate method
    translation = await translator.translate(item.text, src=item.src_lang, dest=item.tgt_lang)
    return {"translation": translation}


@app.get("/languages")
def get_languages(translator: MYTranslator = Depends(get_translator)):
    return {
        "languages": translator.supported_languages,
        "language_codes": sorted(translator.lang_codes),
        "total_supported": len(translator.lang_codes),
    }


@app.get("/translate/word")
async def translate_word_endpoint(
    word: str = Query(..., description="The word to translate"),
    src_lang: str = Query(..., description="Source language of the word"),
    tgt_lang: str = Query(..., description="Target language for the translation"),
    translator: MYTranslator = Depends(get_translator),
):
    """
    Translates a single word. This is kept separate for asynchronous calling.
    """
    # Validation
    if not validate_word(word, src_lang):
        raise HTTPException(status_code=400, detail=f"'{word}' is not a valid word in {src_lang}")

    if not all(lang in translator.lang_codes for lang in [src_lang, tgt_lang]):
        raise HTTPException(status_code=400, detail="Invalid language code provided.")

    # Perform the translation
    translated_word = await translator.translate(word, src=src_lang, dest=tgt_lang)

    return {
        "source_word": word,
        "translated_word": translated_word,
        "source_lang": src_lang,
        "target_lang": tgt_lang,
    }


@app.get("/books")
def get_books(
    search: str = Query(None, description="Search books by title, author, or description"),
    page: int = Query(1, ge=1, description="Page number for pagination"),
    limit: int = Query(20, ge=1, le=100, description="Number of books per page"),
    refresh: bool = Query(False, description="Force refresh book metadata cache"),
    book_manager: BookManager = Depends(get_book_manager),
):
    """Get all available EPUB books with metadata, with server-side search and pagination."""
    try:
        # The book manager now handles caching internally, so force_refresh is passed down
        if refresh:
            book_manager.get_all_books(force_refresh=True)

        results = book_manager.search_books(query=search, page=page, limit=limit)
        return results

    except Exception as e:
        # Return a proper error response
        raise HTTPException(status_code=500, detail=f"Failed to get books: {str(e)}")


@app.get("/search/examples")
def search_examples_endpoint(
    word: str = Query(..., description="The word to search for in the corpus"),
    corpus_lang: str = Query(..., description="The language of the corpus"),
    limit: int = 5,
    elastic: ElasticHelper = Depends(get_elastic),
):
    """
    Performs a fast search for example sentences in Elasticsearch.
    This endpoint does NOT perform any translations.
    """
    # Basic validation
    if not word or not corpus_lang:
        raise HTTPException(status_code=400, detail="Both 'word' and 'corpus_lang' are required.")

    # Directly call the fast, optimized Elasticsearch search
    examples = elastic.search_examples(word, corpus_lang, limit)

    return {
        "search_word": word,
        "corpus_lang": corpus_lang,
        "examples": examples,
        "total_found": len(examples),
    }


@app.get("/word_frequency/{pos_tag}")
def get_word_frequency_by_pos(
    pos_tag: str,
    lang: str = "de",
    start_rank: int = Query(1, description="Starting rank (1-based)", ge=1),
    end_rank: int = Query(None, description="Ending rank (1-based)"),
    size: int = Query(50, description="Maximum results to fetch", le=500),
    elastic: ElasticHelper = Depends(get_elastic),
):
    """Get word frequency analysis by POS tag with ranking range"""
    try:
        result = elastic.get_word_frequency_by_pos(
            pos_tag=pos_tag, lang=lang, size=size, start_rank=start_rank, end_rank=end_rank
        )

        if "error" in result:
            return {"error": result["error"]}

        return result

    except Exception as e:
        return {"error": f"Failed to get word frequency: {str(e)}"}


@app.get("/pos_tags")
def get_available_pos_tags(
    lang: str = "de",
    limit: int = Query(50, description="Maximum POS tags to return", le=100),
    elastic: ElasticHelper = Depends(get_elastic),
):
    """Get all available POS tags in the corpus"""
    try:
        pos_tags = elastic.get_available_pos_tags(lang=lang, limit=limit)
        return {"language": lang, "pos_tags": pos_tags, "total_count": len(pos_tags)}

    except Exception as e:
        return {"error": f"Failed to get POS tags: {str(e)}"}


# ---------- Book Management Endpoints ----------
@app.get("/books/{filename}")
def get_book_info(filename: str, book_manager: BookManager = Depends(get_book_manager)):
    """Get detailed information about a specific book"""
    try:
        book = book_manager.get_book_by_filename(filename)
        if not book:
            raise HTTPException(status_code=404, detail="Book not found")

        return book

    except HTTPException:
        raise
    except Exception as e:
        return {"error": f"Failed to get book info: {str(e)}"}


@app.get("/books/{filename}/download")
def download_book(filename: str, book_manager: BookManager = Depends(get_book_manager)):
    """Download an EPUB book file"""
    try:
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book file not found")

        return FileResponse(path=book_path, filename=filename, media_type="application/epub+zip")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download book: {str(e)}")


@app.get("/books/{filename}/cover")
def get_book_cover(filename: str, book_manager: BookManager = Depends(get_book_manager)):
    """Get book cover image"""
    try:
        cover_data = book_manager.get_book_cover(filename)
        if not cover_data:
            raise HTTPException(status_code=404, detail="Cover image not found")

        from fastapi.responses import Response

        return Response(content=cover_data, media_type="image/jpeg")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cover: {str(e)}")


@app.get("/books/{filename}/read")
def serve_epub_for_reading(filename: str, book_manager: BookManager = Depends(get_book_manager)):
    """Serve EPUB file for online reading with proper CORS headers"""
    try:
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book file not found")

        return FileResponse(
            path=book_path,
            media_type="application/epub+zip",
            headers={
                "Content-Disposition": "inline",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Range, Content-Range, Accept-Ranges",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve book: {str(e)}")


@app.post("/books/{filename}/open")
async def open_book_with_system(
    filename: str, book_manager: BookManager = Depends(get_book_manager)
):
    """Open book with system default application."""
    import platform
    import subprocess

    try:
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book not found")

        # Get the absolute path
        abs_path = str(book_path.absolute())

        # Open with system default application
        system = platform.system()
        try:
            if system == "Darwin":  # macOS
                subprocess.run(["open", abs_path], check=True)
            elif system == "Windows":
                subprocess.run(["start", abs_path], shell=True, check=True)
            else:  # Linux
                subprocess.run(["xdg-open", abs_path], check=True)

            return {
                "success": True,
                "message": f"Opened {filename} with system default application",
            }
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Failed to open file: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open book: {str(e)}")


# Add this dependency
def get_youtube_handler(translator: MYTranslator = Depends(get_translator)):
    return YouTubeHandler(translator)


# --- New YouTube Endpoints ---


@app.post("/youtube/save")
async def save_youtube_video(
    youtube_url: str,
    src_lang: str,
    tgt_lang: str,
    handler: YouTubeHandler = Depends(get_youtube_handler),
    elastic: ElasticHelper = Depends(get_elastic),
):
    video_id = extract_video_id(youtube_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL provided.")

    try:
        # Use a library like pytube to get video metadata (optional but recommended)
        # For simplicity, we'll use placeholder metadata
        # from pytube import YouTube
        # yt = YouTube(youtube_url)
        # title = yt.title
        # thumbnail_url = yt.thumbnail_url
        title = f"YouTube Video: {video_id}"
        thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

        # Process the transcript
        processed_transcript: Dict[str, str] = await handler.process_video(
            video_id, src_lang, tgt_lang
        )

        if not processed_transcript:
            raise HTTPException(
                status_code=404, detail=f"Could not generate transcript for {src_lang}."
            )

        video_document = {
            "video_id": video_id,
            "title": title,
            "thumbnail_url": thumbnail_url,
            "src_lang": src_lang,
            "tgt_lang": tgt_lang,
            "saved_at": datetime.utcnow(),
            "transcript": processed_transcript,
        }

        # Save to Elasticsearch
        result = elastic.insert_youtube_video(video_document)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail="Failed to save video to database.")

        return {
            "success": True,
            "message": f"Video '{title}' saved successfully.",
            "data": video_document,
        }

    except ValueError as e:  # From transcript fetching
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.get("/youtube/saved")
def get_saved_youtube_videos(elastic: ElasticHelper = Depends(get_elastic)):
    videos = elastic.get_saved_videos()
    return {"videos": videos}


@app.get("/youtube/saved/{video_id}")
def get_saved_video_details(video_id: str, elastic: ElasticHelper = Depends(get_elastic)):
    video = elastic.get_saved_video_by_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    return video
