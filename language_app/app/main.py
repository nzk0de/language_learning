from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware  # Add this import

from app.es_utils import ElasticHelper
from app.schema import InputText, InsertText, TranslateAndStoreText
from app.translation import Translator
from app.validators import validate_sentence, validate_word


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        app.state.translator = Translator()
        app.state.elastic = ElasticHelper()
        yield
    finally:
        # if you need cleanup, do it here
        pass


app = FastAPI(lifespan=lifespan)


# ---------- Dependencies ----------
def get_translator():
    return app.state.translator


def get_elastic():
    return app.state.elastic


# ---------- Endpoints ----------
@app.post("/translate")
async def translate(item: InputText, translator: Translator = Depends(get_translator)):
    if item.src_lang not in translator.lang_codes or item.tgt_lang not in translator.lang_codes:
        return {"error": f"Invalid lang code. Supported: {sorted(translator.lang_codes)}"}
    
    # Use the new async translate method
    translation = await translator.translate(item.text, src=item.src_lang, dest=item.tgt_lang)
    return {"translation": translation}


@app.get("/languages")
def get_languages(translator: Translator = Depends(get_translator)):
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
    translator: Translator = Depends(get_translator),
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


@app.get("/search")
def search(
    word: str,
    lang: str = "de",
    limit: int = 5,
    elastic: ElasticHelper = Depends(get_elastic),
):
    if not validate_word(word, lang):
        return {"error": f"'{word}' is not a valid word in {lang}"}
    return {"examples": elastic.search_examples(word, lang, limit)}


@app.get("/translate_search")
async def translate_search(
    word: str = Query(..., description="Single word in source language"),
    src_lang: str = "en",
    tgt_lang: str = "de",
    limit: int = 5,
    translator: Translator = Depends(get_translator),
    elastic: ElasticHelper = Depends(get_elastic),
):
    # ✅ Validate input is a real single word in source language
    if not validate_word(word, src_lang):
        return {"error": f"'{word}' is not a valid word in {src_lang}"}

    # Step 1: Translate word using async method
    translated = await translator.translate(word, src=src_lang, dest=tgt_lang)

    # Step 2: Query ES in target language - try translation pairs first
    translation_results = elastic.search_translation_pairs(translated, tgt_lang, limit)
    
    # Fallback to regular search if no translation pairs found
    if not translation_results:
        examples = elastic.search_examples(translated, tgt_lang, limit)
        translation_results = [{"sentence": ex, "lang": tgt_lang} for ex in examples]

    return {
        "source_word": word, 
        "translated_word": translated, 
        "examples": translation_results
    }


@app.get("/search_with_translations")
def search_with_translations(
    word: str,
    lang: str = "de",
    limit: int = 5,
    elastic: ElasticHelper = Depends(get_elastic),
):
    """Search for sentences containing a word and return translation pairs if available"""
    if not validate_word(word, lang):
        return {"error": f"'{word}' is not a valid word in {lang}"}
    
    results = elastic.search_translation_pairs(word, lang, limit)
    return {"word": word, "examples": results}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
