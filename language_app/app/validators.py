import re

from wordfreq import zipf_frequency


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
