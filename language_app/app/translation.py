import asyncio
import random
import re
from concurrent.futures import ThreadPoolExecutor
from time import sleep

import ollama
import stanza


class MYTranslator:
    def __init__(self) -> None:
        self.ollama_client = ollama.Client()
        self.executor = ThreadPoolExecutor(max_workers=4)
        # Initialize Stanza pipeline once
        self.stanza_nlp = stanza.Pipeline("en", processors="tokenize", verbose=False)

        # Common language mappings for user-friendly names
        self.language_map = {
            "de": "German",
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "it": "Italian",
            "pt": "Portuguese",
            "ru": "Russian",
            "ja": "Japanese",
            "ko": "Korean",
            "zh": "Chinese",
            "ar": "Arabic",
            "hi": "Hindi",
            "tr": "Turkish",
            "nl": "Dutch",
            "sv": "Swedish",
            "da": "Danish",
            "no": "Norwegian",
            "fi": "Finnish",
            "pl": "Polish",
            "cs": "Czech",
            "hu": "Hungarian",
            "ro": "Romanian",
            "bg": "Bulgarian",
            "hr": "Croatian",
            "sk": "Slovak",
            "sl": "Slovenian",
            "et": "Estonian",
            "lv": "Latvian",
            "lt": "Lithuanian",
            "mt": "Maltese",
            "el": "Greek",
            "he": "Hebrew",
            "th": "Thai",
            "vi": "Vietnamese",
            "id": "Indonesian",
            "ms": "Malay",
            "tl": "Filipino",
            "uk": "Ukrainian",
            "be": "Belarusian",
            "mk": "Macedonian",
            "sq": "Albanian",
            "bs": "Bosnian",
            "sr": "Serbian",
            "me": "Montenegrin",
            "is": "Icelandic",
            "fo": "Faroese",
            "ga": "Irish",
            "gd": "Scottish Gaelic",
            "cy": "Welsh",
            "br": "Breton",
            "eu": "Basque",
            "ca": "Catalan",
            "gl": "Galician",
            "oc": "Occitan",
        }

        print("Ollama Translator initialized")

    @property
    def lang_codes(self) -> set:
        # Return supported language codes
        return set(self.language_map.keys())

    @property
    def supported_languages(self) -> dict:
        # Return supported languages with their names (reverse mapping)
        return {code: name for code, name in self.language_map.items()}

    def _sync_translate(self, text: str, src: str, dest: str) -> str:
        """Synchronous translation wrapper for thread execution using Ollama"""
        try:
            src_lang = self.language_map.get(src, src)
            dest_lang = self.language_map.get(dest, dest)

            prompt = f"""You are a professional translator. Translate the
            following {src_lang} to  text from  {dest_lang} as accurately as possible.
            PLease keep the time brackets intact (f.e. [00:03:36-00:03:57]
            only and only if they  exist).
            IMPORTANT RULES:
            - Only return the translated text, nothing else
            - Do not add explanations, comments, or additional context
            - Preserve the original formatting and structure
            - If the text is already in the target language, return it as is
            - Maintain the same tone and style

            Text to translate:
            {text}

            Translation:"""

            response = self.ollama_client.chat(
                model="llama3.2", messages=[{"role": "user", "content": prompt}]
            )

            return response["message"]["content"].strip()

        except Exception as e:
            print(f"Translation error: {e}")
            return text  # Return original text if translation fails

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
        Async translation with Ollama - handling long texts by chunking
        """
        if not text or not text.strip():
            return ""

        # If text is under 3000 chars (safe for Ollama context), translate directly
        if len(text) <= 3000:
            return await self._translate_single(text, src, dest)

        # For long texts, split by sentences and group into chunks under 3000 chars
        sentences = self.split_sentences(text)
        if not sentences:
            return ""

        chunks = []
        current_chunk = ""

        for sentence in sentences:
            # If adding this sentence would exceed limit, start new chunk
            if len(current_chunk + " " + sentence) > 3000:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk = current_chunk + " " + sentence if current_chunk else sentence

        # Add final chunk
        if current_chunk:
            chunks.append(current_chunk.strip())

        # Translate each chunk with a small delay to avoid overwhelming Ollama
        translated_chunks = []
        for i, chunk in enumerate(chunks):
            if chunk.strip():
                if i > 0:  # Add delay between chunks
                    sleep(random.uniform(0.1, 0.3))
                translated = await self._translate_single(chunk, src, dest)
                if translated:
                    translated_chunks.append(translated)

        return " ".join(translated_chunks)

    async def _translate_single(self, text: str, src: str, dest: str) -> str:
        """Translate a single chunk"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_translate, text, src, dest)
