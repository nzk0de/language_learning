from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware  # Add this import

from app.es_utils import ElasticHelper
from app.schema import InputText, InsertText, TranslateAndStoreText
from app.translation import MYTranslator
from app.validators import validate_sentence, validate_word


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.translator = MYTranslator()
        app.state.elastic = ElasticHelper()
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




app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development (includes Chrome extensions)
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)
