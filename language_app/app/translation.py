import asyncio
import random
import re
from concurrent.futures import ThreadPoolExecutor
from time import sleep

import stanza
from googletrans import LANGUAGES
from googletrans import Translator as GoogleTranslator


class MYTranslator:
    def __init__(self) -> None:
        self.translator = GoogleTranslator()
        self.executor = ThreadPoolExecutor(max_workers=4)
        # Initialize Stanza pipeline once
        self.stanza_nlp = stanza.Pipeline("en", processors="tokenize", verbose=False)

        print("Google Translator initialized")

    @property
    def lang_codes(self) -> set:
        # Get all supported Google Translate language codes
        return set(LANGUAGES.keys())

    @property
    def supported_languages(self) -> dict:
        # Get all supported languages with their names
        return LANGUAGES.copy()

    def _sync_translate(self, text: str, src: str, dest: str) -> str:
        """Synchronous translation wrapper for thread execution"""

        result = self.translator.translate(text, src=src, dest=dest)
        return result.text

    def translate_sync(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Synchronous version for backward compatibility"""
        return self._sync_translate(text, src_lang, tgt_lang)

    def split_sentences(self, text: str) -> list[str]:
        """Split text into sentences using Stanza"""
        if not text.strip():
            return []

        if self.stanza_nlp:
            doc = self.stanza_nlp(text)
            return [sent.text.strip() for sent in doc.sentences if sent.text.strip()]

        # Fallback to regex splitting
        sentences = re.split(r"[.!?]+\s+", text)
        return [s.strip() for s in sentences if s.strip()]

    async def translate(self, text: str, src: str, dest: str) -> str:
        """
        Async translation with Google API 5k character limit handling
        """
        if not text or not text.strip():
            return ""

        # Clean text first

        # If text is under 4500 chars (safe buffer), translate directly
        if len(text) <= 4500:
            return await self._translate_single(text, src, dest)

        # For long texts, split by sentences and group into chunks under 4500 chars
        sentences = self.split_sentences(text)
        if not sentences:
            return ""

        chunks = []
        current_chunk = ""

        for sentence in sentences:
            # If adding this sentence would exceed limit, start new chunk
            if len(current_chunk + " " + sentence) > 4500:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk = current_chunk + " " + sentence if current_chunk else sentence

        # Add final chunk
        if current_chunk:
            chunks.append(current_chunk.strip())

        # Translate each chunk
        translated_chunks = []
        for chunk in chunks:
            if chunk.strip():
                # if should_sleep:
                sleep(random.uniform(0.05, 0.1))
                translated = await self._translate_single(chunk, src, dest)
                if translated:
                    translated_chunks.append(translated)

        return " ".join(translated_chunks)

    async def _translate_single(self, text: str, src: str, dest: str) -> str:
        """Translate a single chunk"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_translate, text, src, dest)
