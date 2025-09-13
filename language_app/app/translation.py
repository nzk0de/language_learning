from googletrans import Translator as GoogleTranslator, LANGUAGES
import asyncio
from concurrent.futures import ThreadPoolExecutor


class Translator:
    def __init__(self):
        self.translator = GoogleTranslator()
        self.executor = ThreadPoolExecutor(max_workers=4)
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
        try:
            result = self.translator.translate(text, src=src, dest=dest)
            return result.text
        except Exception as e:
            print(f"Translation error: {e}")
            return text  # Return original text if translation fails

    async def translate(self, text: str, src: str, dest: str) -> str:
        """Async translation method using the format: 
        result = await translator.translate("Guten Morgen, wie geht es dir?", src="de", dest="en")
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, 
            self._sync_translate, 
            text, 
            src, 
            dest
        )

    def translate_sync(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Synchronous version for backward compatibility"""
        return self._sync_translate(text, src_lang, tgt_lang)