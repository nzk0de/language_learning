from typing import Any, Dict, List
from urllib.parse import parse_qs, urlparse

import stanza

# --- Utility Functions ---
from stanza import Pipeline
from youtube_transcript_api import NoTranscriptFound, YouTubeTranscriptApi

from app.translation import MYTranslator


def extract_video_id(url: str) -> str:
    """
    Extracts the video ID from a YouTube URL.
    Returns: video ID as a string, or an empty string if not found.
    """
    if "youtu.be" in url:
        return url.split("/")[-1].split("?")[0]

    query = urlparse(url).query
    params = parse_qs(query)

    if "v" in params:
        return params["v"][0]

    return ""


# --- Main Handler Class ---


class YouTubeHandler:
    def __init__(self, translator: MYTranslator):
        self.translator = translator
        self.stanza_pipelines: Dict[str, Pipeline] = {}  # Cache for stanza pipelines

    def _get_stanza_pipeline(self, lang: str) -> Pipeline:
        if lang not in self.stanza_pipelines:
            print(f"Initializing Stanza pipeline for language: {lang}")
            nlp_pipeline: Pipeline = stanza.Pipeline(
                lang, processors="tokenize", verbose=False, use_gpu=False
            )
            self.stanza_pipelines[lang] = nlp_pipeline
        return self.stanza_pipelines[lang]

    # --- THIS IS THE CORRECTED METHOD USING YOUR EXACT CODE ---
    def _get_transcript_data(self, video_id: str, lang_code: str) -> list[Dict[str, Any]]:
        """
        Fetches transcript data using the user-provided, confirmed working method.
        """
        try:
            # 1. Create an instance of the API class
            api_instance = YouTubeTranscriptApi()

            # 2. Call the .list() method on the instance, as you specified.
            transcript_list = api_instance.list(video_id=video_id)
            import time

            start_time = time.time()
            # 3. Find the transcript object from the list.
            transcript_obj = transcript_list.find_transcript([lang_code])

            # 4. Fetch the data.
            transcript_data = transcript_obj.fetch().to_raw_data()
            print(f"Transcript fetch took {time.time() - start_time:.2f} seconds")
            print(
                f"Successfully fetched transcript: lang='{transcript_obj.language}',"
                f"generated={transcript_obj.is_generated}"
            )
            return transcript_data

        except NoTranscriptFound:
            print(
                f"No transcript found for video_id '{video_id}' with language code '{lang_code}'."
            )
            raise ValueError(f"Transcript not available for language '{lang_code}'.")
        except Exception as e:
            print(f"An unexpected error occurred while fetching transcript for {video_id}: {e}")
            raise

    def _process_and_align_transcript(
        self, raw_transcript: list, lang: str
    ) -> List[Dict[str, Any]]:
        # This function processes the output from the now-correct _get_transcript_data method.
        # It includes a more robust alignment logic.

        full_text = " ".join([item["text"].replace("\n", " ") for item in raw_transcript])
        if not full_text.strip():
            return []

        nlp = self._get_stanza_pipeline(lang)
        doc = nlp(full_text)
        stanza_sentences = [sent.text for sent in doc.sentences]

        aligned_sentences = []
        transcript_idx = 0

        for sentence in stanza_sentences:
            print(sentence)
            start_time = -1
            end_time = -1
            temp_sentence = ""

            for i in range(transcript_idx, len(raw_transcript)):
                segment = raw_transcript[i]
                if start_time == -1:
                    start_time = segment["start"]

                temp_sentence += segment["text"].replace("\n", " ") + " "

                if sentence in temp_sentence:
                    end_time = segment["start"] + segment["duration"]
                    transcript_idx = i + 1  # Start the next search from the next segment
                    aligned_sentences.append(
                        {"text": sentence.strip(), "start": start_time, "end": end_time}
                    )
                    break  # Move to the next Stanza sentence
        return aligned_sentences

    async def process_video(self, video_id: str, src_lang: str, tgt_lang: str) -> Dict[str, str]:
        # This orchestrator function now works correctly.

        raw_transcript_data = self._get_transcript_data(video_id, src_lang)
        aligned_original_sentences = self._process_and_align_transcript(
            raw_transcript_data, src_lang
        )
        # print(aligned_original_sentences)
        # raise
        original_texts: List[str] = [s["text"] for s in aligned_original_sentences]
        if not original_texts:
            print(
                f"Warning: No sentences were aligned for video {video_id}"
                ". Returning empty transcript."
            )
            return {}
        original_texts_str = " ".join(original_texts)

        translated_texts = await self.translator.translate(
            original_texts_str, src=src_lang, dest=tgt_lang
        )

        # final_transcript = []
        # print(final_transcript)
        # from time import sleep
        # print("SLEEPING")
        # sleep(1)
        # print("#" * 20)
        # print(translated_texts)
        # raise
        # for i, original_sent_obj in enumerate(aligned_original_sentences):
        #     if i < len(translated_texts):
        #         final_transcript.append(
        #             {
        #                 "original_sentence": original_sent_obj["text"],
        #                 "translated_sentence": translated_texts[i],
        #                 "start_time": original_sent_obj["start"],
        #                 "end_time": original_sent_obj["end"],
        #             }
        #         )
        final_transcript = {
            "original_text": aligned_original_sentences,
            "translated_text": translated_texts,
        }
        return final_transcript
