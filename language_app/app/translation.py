import asyncio
import re
from concurrent.futures import ThreadPoolExecutor

import ollama
import stanza


class MYTranslator:
    def __init__(self, model: str = "llama3.2") -> None:
        """
        Initializes the translator.

        Args:
            model (str): The name of the Ollama model to use for translation.
        """
        self.ollama_client = ollama.Client()
        self.executor = ThreadPoolExecutor(max_workers=4)
        # Stanza pipelines will be initialized on-demand and cached here
        self.stanza_pipelines = {}  # type: ignore
        self.model = model

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

        print(f"Ollama Translator initialized with model '{self.model}'")

    @property
    def lang_codes(self) -> set:
        # Return supported language codes
        return set(self.language_map.keys())

    @property
    def supported_languages(self) -> dict:
        # Return supported languages with their names
        return self.language_map.copy()

    def _get_stanza_pipeline(self, lang: str):
        """
        Initializes and retrieves a Stanza pipeline for a given language,
        caching it for future use.
        """
        if lang not in self.stanza_pipelines:
            try:
                print(f"Initializing Stanza pipeline for '{lang}'...")
                stanza.download(lang, verbose=False)
                pipeline = stanza.Pipeline(lang, processors="tokenize", verbose=False)
                self.stanza_pipelines[lang] = pipeline
                print(f"Stanza pipeline for '{lang}' is ready.")
            except Exception as e:
                print(
                    f"Warning: Could not initialize Stanza for '{lang}': {e}"
                    ". Falling back to regex splitter."
                )
                self.stanza_pipelines[lang] = None
        return self.stanza_pipelines[lang]

    def _sync_translate(self, text: str, src: str, dest: str) -> str:
        """Synchronous translation wrapper for thread execution using Ollama"""
        if not text or not text.strip():
            return ""
        try:
            src_lang = self.language_map.get(src, src)
            dest_lang = self.language_map.get(dest, dest)

            # Corrected and clarified prompt
            prompt = f"""You are a professional translator. Translate the following
             text from  {src_lang} to {dest_lang} as accurately as possible.
IMPORTANT RULES:
- Only return the translated text. Do not include the original text.
- Do not add explanations, comments, or any extra content.
- Preserve the original formatting, including line breaks.
- If the text contains time brackets like [00:03:36-00:03:57]
or markers like [Musik], keep them  exactly as they are.
- If a sentence or phrase is already in {dest_lang}, return it as is.
- Maintain the original tone and style.

Text to translate:
{text}

Translation:"""

            response = self.ollama_client.chat(
                model=self.model, messages=[{"role": "user", "content": prompt}]
            )
            return response["message"]["content"].strip()

        except Exception as e:
            print(f"Translation error: {e}")
            return text  # Return original text if translation fails

    def translate_sync(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Synchronous version for backward compatibility"""
        # A simple async-to-sync wrapper for the robust async method
        return asyncio.run(self.translate(text, src_lang, tgt_lang))

    def split_sentences(self, text: str, lang: str) -> list[str]:
        """Split text into sentences using a language-specific Stanza pipeline."""
        if not text.strip():
            return []

        pipeline = self._get_stanza_pipeline(lang)
        if pipeline:
            doc = pipeline(text)
            return [sent.text.strip() for sent in doc.sentences if sent.text.strip()]

        # Fallback to simple regex splitting if Stanza fails
        print(f"Using regex fallback for sentence splitting ({lang}).")
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return [s.strip() for s in sentences if s.strip()]

    async def _translate_paragraph(self, p_text: str, src: str, dest: str, max_size: int) -> str:
        """Translates a single paragraph, chunking it if it's too long."""
        if not p_text.strip():
            return p_text  # Preserve empty lines which act as paragraph separators

        # Pass through special content without translation
        if re.match(r"^\s*(\[[\d:-]+\]|\[Musik\])\s*$", p_text):
            return p_text

        # Translate short paragraphs directly
        if len(p_text) <= max_size:
            return await self._translate_single(p_text, src, dest)

        # If a paragraph is too long, split it into sentences and chunk those
        sentences = self.split_sentences(p_text, src)
        if not sentences:
            return ""

        chunks = []
        current_chunk = ""
        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 > max_size:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
            else:
                current_chunk = f"{current_chunk} {sentence}" if current_chunk else sentence
        if current_chunk:
            chunks.append(current_chunk)

        # Translate each sentence-based chunk concurrently
        translated_chunks = await asyncio.gather(
            *(self._translate_single(chunk, src, dest) for chunk in chunks if chunk)
        )
        # Re-join the translated sentences with spaces to form the translated paragraph
        return " ".join(filter(None, translated_chunks))

    async def translate(self, text: str, src: str, dest: str) -> str:
        """
        Asynchronously translates text by breaking it into paragraphs, processing them
        concurrently, and handling long content by chunking. This preserves document
        structure and formatting.
        """
        if not text or not text.strip():
            return ""

        MAX_CHUNK_SIZE = 2800  # Safe character limit for each chunk

        # Split text into paragraphs by newline characters
        paragraphs = text.split("\n")

        # Create a translation task for each paragraph
        tasks = [self._translate_paragraph(p, src, dest, MAX_CHUNK_SIZE) for p in paragraphs]

        # Execute all paragraph translations concurrently
        translated_paragraphs = await asyncio.gather(*tasks)

        # Reassemble the document from the translated paragraphs
        return "\n".join(translated_paragraphs)

    async def _translate_single(self, text: str, src: str, dest: str) -> str:
        """Wraps the synchronous translation call in an executor for async usage."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, self._sync_translate, text, src, dest)
