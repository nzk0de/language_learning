# app/handler.py
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

import stanza
from stanza import Pipeline
from youtube_transcript_api import NoTranscriptFound, YouTubeTranscriptApi

from app.translation import MYTranslator


# --- Utility Functions --- (Keep extract_video_id as is)
def extract_video_id(url: str) -> str:
    """Extracts the video ID from a YouTube URL."""
    if "youtu.be" in url:
        return url.split("/")[-1].split("?")[0]
    query = urlparse(url).query
    params = parse_qs(query)
    if "v" in params:
        return params["v"][0]
    return ""


# --- Main Handler Class ---
class YouTubeHandler:
    stanza_pipelines: Dict[str, Optional[Pipeline]]

    def __init__(self, translator: MYTranslator):
        self.translator = translator
        self.stanza_pipelines = {}  # type: ignore

    def _get_stanza_pipeline(self, lang: str) -> Pipeline:
        if lang not in self.stanza_pipelines:
            print(f"Initializing Stanza pipeline for language: {lang}")
            nlp_pipeline = stanza.Pipeline(
                lang, processors="tokenize", verbose=False, use_gpu=False
            )
            self.stanza_pipelines[lang] = nlp_pipeline
        return self.stanza_pipelines[lang]

    def _get_transcript_data(self, video_id: str, lang_code: str) -> list[Dict[str, Any]]:
        """Fetches raw transcript data for a given video and language."""
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
                f"Successfully fetched transcript: lang='{transcript_obj.language}', "
                f"generated={transcript_obj.is_generated}"
            )
            return transcript_data
        except NoTranscriptFound:
            print(f"No transcript found for video_id '{video_id}' with lang '{lang_code}'.")
            raise ValueError(f"Transcript not available for language '{lang_code}'.")
        except Exception as e:
            print(f"An unexpected error occurred while fetching transcript: {e}")
            raise

    def _create_timed_chunks(self, raw_transcript: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups raw transcript segments into chunks of ~20 seconds to reduce granularity.
        """
        if not raw_transcript:
            return []

        chunk_duration = 20
        chunks = []
        current_chunk_text = ""
        current_chunk_start = -1

        for segment in raw_transcript:
            segment_text = segment["text"].replace("\n", " ").strip()
            if not segment_text:
                continue

            if current_chunk_start == -1:
                current_chunk_start = segment["start"]
                current_chunk_text = segment_text
            else:
                time_elapsed = segment["start"] - current_chunk_start
                if time_elapsed >= chunk_duration:
                    chunks.append(
                        {
                            "text": current_chunk_text.strip(),
                            "start_time": current_chunk_start,
                            "end_time": segment["start"],
                        }
                    )
                    current_chunk_start = segment["start"]
                    current_chunk_text = segment_text
                else:
                    current_chunk_text += " " + segment_text

        if current_chunk_start != -1:
            last_segment = raw_transcript[-1]
            end_time = last_segment["start"] + last_segment["duration"]
            chunks.append(
                {
                    "text": current_chunk_text.strip(),
                    "start_time": current_chunk_start,
                    "end_time": end_time,
                }
            )

        print(f"Created {len(chunks)} timed chunks from transcript.")
        return chunks

    async def process_video(self, video_id: str, src_lang: str, tgt_lang: str) -> Dict[str, Any]:
        """
        Orchestrator that implements the specified timestamp-embedding logic.
        """

        def get_times(time_secs: float) -> str:
            hours = int(time_secs // 3600)
            mins = int(time_secs // 60)
            secs = int(time_secs % 60)
            return f"{hours:02}:{mins:02}:{secs:02}"

        # Step 1 & 2: Fetch data and group into timed chunks for reduced granularity.
        raw_transcript_data = self._get_transcript_data(video_id, src_lang)
        original_chunks = self._create_timed_chunks(raw_transcript_data)
        if not original_chunks:
            return {}

        # Step 3: Create ONE large string with embedded timestamps, as instructed.
        # The format is a repeating pattern of "\n{start_time}\n{text_chunk}"
        string_parts = []
        for chunk in original_chunks:
            string_parts.append(
                (
                    f"\n[{get_times(chunk['start_time'])}-"
                    f"{get_times(chunk['end_time'])}]\n{chunk['text']}"
                )
            )
        full_text_to_translate = "".join(string_parts)

        # Step 4: Send the single large string to the translator.
        # The translator is now responsible for handling the 5000 character limit.
        print("Sending one large string with embedded timestamps to the translator...")
        translated_full_text = await self.translator.translate(
            full_text_to_translate, src=src_lang, dest=tgt_lang
        )
        print(translated_full_text)

        # Filter out empty strings that result from splitting at the start/end.

        # Re-align the original chunk data with the parsed translated text.

        final = {"original_text": original_chunks, "translated_text": translated_full_text}
        return final
