from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import os

from app.es_utils import ElasticHelper
from app.schema import InputText, InsertText, TranslateAndStoreText
from app.translation import MYTranslator
from app.validators import validate_sentence, validate_word
from app.book_manager import BookManager


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
        "total_supported": len(translator.lang_codes)
    }


@app.post("/insert")
def insert(item: InsertText, elastic: ElasticHelper = Depends(get_elastic)):
    if not validate_sentence(item.text, item.lang):
        return {"error": f"Text is not detected as {item.lang}"}
    return elastic.insert_text(item.text, item.lang)


@app.post("/translate_and_store")
async def translate_and_store(
    item: TranslateAndStoreText, 
    translator: MYTranslator = Depends(get_translator),
    elastic: ElasticHelper = Depends(get_elastic)
):
    """Translate text and store both original and translation in Elasticsearch"""
    if item.src_lang not in translator.lang_codes or item.tgt_lang not in translator.lang_codes:
        return {"error": f"Invalid lang code. Supported: {sorted(translator.lang_codes)}"}
    
    # Validate original text
    if not validate_sentence(item.text, item.src_lang):
        return {"error": f"Text is not detected as {item.src_lang}"}
    
    # Translate using the async method
    translation = await translator.translate(item.text, src=item.src_lang, dest=item.tgt_lang)
    
    # Store both original and translation
    storage_result = elastic.insert_translation_pair(
        item.text, translation, item.src_lang, item.tgt_lang
    )
    
    return {
        "original": item.text,
        "translation": translation,
        "src_lang": item.src_lang,
        "tgt_lang": item.tgt_lang,
        "storage_result": storage_result
    }



@app.get("/translate_search")
async def translate_search(
    word: str = Query(..., description="Single word in any language"),
    src_lang: str = "en",
    tgt_lang: str = "de",
    corpus_lang: str = Query("de", description="Language of the corpus to search in"),
    limit: int = 5,
    translator: MYTranslator = Depends(get_translator),
    elastic: ElasticHelper = Depends(get_elastic),
):
    """Simplified translate and search: translates word and searches specified corpus language"""
    # ✅ Validate input is a real single word in source language
    if not validate_word(word, src_lang):
        return {"error": f"'{word}' is not a valid word in {src_lang}"}

    # Validate language codes
    if src_lang not in translator.lang_codes or tgt_lang not in translator.lang_codes or corpus_lang not in translator.lang_codes:
        return {"error": f"Invalid lang code. Supported: {sorted(translator.lang_codes)}"}

    # Step 1: Translate word using async method
    translated = await translator.translate(word, src=src_lang, dest=tgt_lang)

    # Step 2: Simplified logic - determine what word to search for in corpus_lang
    if src_lang == corpus_lang:
        # Input is in corpus language, search for original word
        search_word = word
    elif tgt_lang == corpus_lang:
        # Translation target is corpus language, search for translated word
        search_word = translated
    else:
        # Neither input nor target matches corpus language - translate to corpus language
        search_word = await translator.translate(word, src=src_lang, dest=corpus_lang)

    # Step 3: Always search in the specified corpus language
    examples = elastic.search_unified(search_word, corpus_lang, limit)

    return {
        "source_word": word,
        "source_lang": src_lang, 
        "translated_word": translated,
        "target_lang": tgt_lang,
        "search_word": search_word,
        "corpus_lang": corpus_lang,
        "examples": examples,
        "total_found": len(examples)
    }


@app.get("/quality/config")
def get_quality_config(elastic: ElasticHelper = Depends(get_elastic)):
    """Get current quality filtering configuration"""
    return {
        "config": elastic.quality_config,
        "description": {
            "min_length": "Minimum sentence length in characters",
            "max_length": "Maximum sentence length in characters", 
            "min_words": "Minimum number of words in sentence",
            "max_upper_ratio": "Maximum ratio of uppercase letters (0.0-1.0)",
            "min_alpha_ratio": "Minimum ratio of alphabetic characters (0.0-1.0)",
            "enable_quality_filter": "Whether to apply quality filtering"
        }
    }


@app.post("/quality/config")
def update_quality_config(
    config: dict,
    elastic: ElasticHelper = Depends(get_elastic)
):
    """Update quality filtering configuration"""
    try:
        elastic.configure_quality_filter(**config)
        return {
            "success": True,
            "message": "Quality configuration updated",
            "new_config": elastic.quality_config
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
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
            pos_tag=pos_tag,
            lang=lang,
            size=size,
            start_rank=start_rank,
            end_rank=end_rank
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
        return {
            "language": lang,
            "pos_tags": pos_tags,
            "total_count": len(pos_tags)
        }
        
    except Exception as e:
        return {"error": f"Failed to get POS tags: {str(e)}"}



@app.post("/quality/test")
def test_sentence_quality(
    sentences: list[str],
    elastic: ElasticHelper = Depends(get_elastic)
):
    """Test sentence quality for a list of sentences"""
    results = []
    for sentence in sentences:
        is_quality = elastic.is_quality_sentence(sentence)
        results.append({
            "sentence": sentence,
            "is_quality": is_quality,
            "length": len(sentence),
            "word_count": len(sentence.split())
        })
    
    stats = elastic.get_quality_stats(sentences)
    
    return {
        "results": results,
        "stats": stats,
        "config_used": elastic.quality_config
    }


# ---------- Book Management Endpoints ----------

@app.get("/books")
def get_books(
    search: str = Query(None, description="Search books by title, author, or description"),
    refresh: bool = Query(False, description="Force refresh book metadata cache"),
    book_manager: BookManager = Depends(get_book_manager)
):
    """Get all available EPUB books with metadata"""
    try:
        if search:
            books = book_manager.search_books(search)
        else:
            books = book_manager.get_all_books(force_refresh=refresh)
        
        return {
            "books": books,
            "count": len(books),
            "search_query": search if search else None
        }
        
    except Exception as e:
        return {"error": f"Failed to get books: {str(e)}"}


@app.get("/books/{filename}")
def get_book_info(
    filename: str,
    book_manager: BookManager = Depends(get_book_manager)
):
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
def download_book(
    filename: str,
    book_manager: BookManager = Depends(get_book_manager)
):
    """Download an EPUB book file"""
    try:
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book file not found")
        
        return FileResponse(
            path=book_path,
            filename=filename,
            media_type="application/epub+zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download book: {str(e)}")


@app.get("/books/{filename}/cover")
def get_book_cover(
    filename: str,
    book_manager: BookManager = Depends(get_book_manager)
):
    """Get book cover image"""
    try:
        cover_data = book_manager.get_book_cover(filename)
        if not cover_data:
            raise HTTPException(status_code=404, detail="Cover image not found")
        
        from fastapi.responses import Response
        return Response(
            content=cover_data,
            media_type="image/jpeg"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cover: {str(e)}")


@app.get("/books/{filename}/read")
def serve_epub_for_reading(
    filename: str,
    book_manager: BookManager = Depends(get_book_manager)
):
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
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve book: {str(e)}")


@app.get("/books/{filename}/content/{resource_path:path}")
def serve_epub_resource(
    filename: str,
    resource_path: str,
    book_manager: BookManager = Depends(get_book_manager)
):
    """Serve individual resources from EPUB (images, CSS, etc.)"""
    try:
        import zipfile
        from fastapi.responses import Response
        
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book file not found")
        
        with zipfile.ZipFile(book_path, 'r') as epub_zip:
            if resource_path not in epub_zip.namelist():
                raise HTTPException(status_code=404, detail="Resource not found")
            
            resource_data = epub_zip.read(resource_path)
            
            # Determine content type based on file extension
            content_type = "application/octet-stream"
            if resource_path.lower().endswith(('.jpg', '.jpeg')):
                content_type = "image/jpeg"
            elif resource_path.lower().endswith('.png'):
                content_type = "image/png"
            elif resource_path.lower().endswith('.gif'):
                content_type = "image/gif"
            elif resource_path.lower().endswith('.css'):
                content_type = "text/css"
            elif resource_path.lower().endswith(('.html', '.xhtml')):
                content_type = "application/xhtml+xml"
            elif resource_path.lower().endswith('.js'):
                content_type = "application/javascript"
            
            return Response(
                content=resource_data,
                media_type=content_type,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=3600"
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve resource: {str(e)}")


@app.get("/books/{filename}/stream")
def stream_epub(
    filename: str,
    request: Request,
    book_manager: BookManager = Depends(get_book_manager)
):
    """Stream EPUB file with range support for better loading"""
    try:
        book_path = book_manager.get_book_path(filename)
        if not book_path:
            raise HTTPException(status_code=404, detail="Book file not found")
        
        file_size = os.path.getsize(book_path)
        range_header = request.headers.get('Range')
        
        def generate_chunks(start: int = 0, end: int = file_size - 1):
            with open(book_path, 'rb') as f:
                f.seek(start)
                remaining = end - start + 1
                while remaining > 0:
                    chunk_size = min(8192, remaining)  # 8KB chunks
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
        
        if range_header:
            # Handle range requests for partial content
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1
            
            content_length = end - start + 1
            
            return StreamingResponse(
                generate_chunks(start, end),
                status_code=206,
                headers={
                    'Content-Range': f'bytes {start}-{end}/{file_size}',
                    'Accept-Ranges': 'bytes',
                    'Content-Length': str(content_length),
                    'Content-Type': 'application/epub+zip',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
                }
            )
        else:
            # Return full file
            return StreamingResponse(
                generate_chunks(),
                headers={
                    'Content-Length': str(file_size),
                    'Content-Type': 'application/epub+zip',
                    'Access-Control-Allow-Origin': '*',
                    'Accept-Ranges': 'bytes'
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stream book: {str(e)}")


@app.post("/books/{filename}/open")
async def open_book_with_system(filename: str, book_manager: BookManager = Depends(get_book_manager)):
    """Open book with system default application."""
    import subprocess
    import platform
    
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
            
            return {"success": True, "message": f"Opened {filename} with system default application"}
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Failed to open file: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open book: {str(e)}")
