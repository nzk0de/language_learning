from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query

from app.es_utils import ElasticHelper
from app.schema import InputText, InsertText
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
def translate(item: InputText, translator: Translator = Depends(get_translator)):
    if item.src_lang not in translator.lang_codes or item.tgt_lang not in translator.lang_codes:
        return {"error": f"Invalid lang code. Supported: {sorted(translator.lang_codes)}"}
    return {"translation": translator.translate(item.text, item.src_lang, item.tgt_lang)}


@app.get("/languages")
def get_languages(translator: Translator = Depends(get_translator)):
    return {"languages": sorted(translator.lang_codes)}


@app.post("/insert")
def insert(item: InsertText, elastic: ElasticHelper = Depends(get_elastic)):
    if not validate_sentence(item.text, item.lang):
        return {"error": f"Text is not detected as {item.lang}"}
    return elastic.insert_text(item.text, item.lang)


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
def translate_search(
    word: str = Query(..., description="Single word in source language"),
    src_lang: str = "en_XX",
    tgt_lang: str = "de",
    limit: int = 5,
    translator: Translator = Depends(get_translator),
    elastic: ElasticHelper = Depends(get_elastic),
):
    # ✅ Validate input is a real single word in source language
    lang_short = src_lang.split("_")[0]  # e.g. "de" from "de_DE"
    if not validate_word(word, lang_short):
        return {"error": f"'{word}' is not a valid word in {lang_short}"}

    # Step 1: Translate word
    tgt_code = f"{tgt_lang}_DE" if tgt_lang == "de" else f"{tgt_lang}_XX"
    translated = translator.translate(word, src_lang, tgt_code)

    # Step 2: Query ES in target language
    results = elastic.search_examples(translated, tgt_lang, limit)

    return {"source_word": word, "translated_word": translated, "examples": results}
