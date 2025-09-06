import re

from langdetect import DetectorFactory, LangDetectException, detect
from wordfreq import zipf_frequency

DetectorFactory.seed = 0  # make langdetect deterministic


def validate_word(word: str, lang: str) -> bool:
    """Return True if `word` looks valid in the given language."""
    # reject multi-word inputs (only one token allowed)
    if len(word.split()) != 1:
        return False
    # reject if not alphabetic
    if not re.fullmatch(r"[^\W\d_]+", word, flags=re.UNICODE):
        return False
    # check frequency in language corpus
    return zipf_frequency(word, lang) > 0


def validate_sentence(text: str, lang: str) -> bool:
    try:
        return detect(text) == lang
    except LangDetectException:
        return False
