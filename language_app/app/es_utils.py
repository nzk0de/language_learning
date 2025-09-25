import os
import re

import stanza
from elasticsearch import Elasticsearch, helpers

from app.quality_checker import SentenceQualityChecker

# from app.quality_checker import quality_checker


class ElasticHelper:
    def __init__(self):
        self.client = Elasticsearch(os.getenv("ES_HOST", "http://localhost:9200"))

        # Set consistent index name for the whole class
        self.index_name = "german_books"  # This is your main index

        self.stanza_nlp = stanza.Pipeline("en", processors="tokenize", verbose=False)
        # Initialize quality checker
        self.quality_checker = SentenceQualityChecker()

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

    # In ElasticHelper class inside es_utils.py

    def search_examples(self, word: str, lang: str, limit: int = 5):
        """
        Optimized search for example sentences.
        This version prioritizes speed by using a simpler query first.
        Only returns sentences that contain at least one verb.
        """
        try:
            query = {
                "size": limit,
                "query": {
                    "bool": {
                        "must": [
                            {
                                "multi_match": {
                                    "query": word,
                                    "fields": [
                                        "sentence_text^3",
                                        "tokens.text^2",
                                        "tokens.lemma",
                                    ],
                                    "type": "best_fields",
                                }
                            },
                            {
                                "nested": {
                                    "path": "tokens",
                                    "query": {"term": {"tokens.upos": "VERB"}},
                                }
                            },
                        ]
                    }
                },
                "highlight": {
                    "fields": {"sentence_text": {"pre_tags": ["<mark>"], "post_tags": ["</mark>"]}}
                },
                "_source": ["sentence_text", "title", "sentence_id"],
            }

            res = self.client.search(index=self.index_name, body=query)

            examples = [
                {
                    "sentence": hit.get("highlight", {}).get(
                        "sentence_text", [hit["_source"]["sentence_text"]]
                    )[0],
                    "lang": lang,
                    "title": hit["_source"].get("title"),
                    "sentence_id": hit["_source"].get("sentence_id"),
                    "translation": None,
                    "translation_lang": None,
                }
                for hit in res["hits"]["hits"]
            ]
            return examples

        except Exception as e:
            print(f"Error searching corpus: {e}")
            return self._fallback_search(word, lang, limit)

    def _fallback_search(self, word: str, lang: str, limit: int = 5):
        """Fallback to old sentence index if corpus not available"""
        try:
            res = self.client.search(
                index=self.index_name, query={"match": {"sentence": word}}, size=limit * 2
            )
            examples = []
            for hit in res["hits"]["hits"]:
                source = hit["_source"]
                sentence_text = source["sentence"]

                # Apply quality filter
                if not self.is_quality_sentence(sentence_text):
                    continue

                example = {
                    "sentence": sentence_text,
                    "lang": source.get("lang", lang),
                    "title": None,
                    "sentence_id": None,
                    "highlighted": None,
                    "translation": source.get("translation"),
                    "translation_lang": source.get("translation_lang"),
                }
                examples.append(example)

                # Stop when we have enough quality examples
                if len(examples) >= limit:
                    break

            return examples
        except Exception as e:
            print(f"Fallback search error: {e}")
            return []

    def is_quality_sentence(self, sentence: str, lang: str = "de") -> bool:
        """Check if a sentence meets quality standards using shared quality checker"""
        return self.quality_checker.is_quality_sentence(sentence, lang=lang)

    def get_word_frequency_by_pos(
        self,
        pos_tag: str,
        lang: str = "de",
        size: int = 100,
        start_rank: int = 1,
        end_rank: int = 1,
    ):
        """
        Get word frequency analysis by part-of-speech tag with ranking range.

        Args:
            pos_tag: POS tag to filter by (e.g., 'NOUN', 'VERB', 'ADJ', 'ADV')
            lang: Language code for index selection
            size: Maximum number of results to fetch (should be >= end_rank)
            start_rank: Starting rank (1-based, e.g., 10 for top 10th word)
            end_rank: Ending rank (1-based, e.g., 20 for top 20th word).
            If None, uses start_rank + size

        Returns:
            dict: Word frequency data with ranking information
        """
        if end_rank < start_rank:
            end_rank = start_rank + size - 1

        # Ensure we fetch enough data to get the requested range
        fetch_size = max(size, end_rank)

        try:
            query = {
                "size": 0,  # We don't need the actual documents
                "aggs": {
                    "words_by_pos": {
                        "nested": {"path": "tokens"},
                        "aggs": {
                            "filter_pos": {
                                "filter": {"term": {"tokens.upos": pos_tag.upper()}},
                                "aggs": {
                                    "word_frequency": {
                                        "terms": {
                                            "field": "tokens.lemma",
                                            "size": fetch_size,
                                            "order": {"_count": "desc"},
                                        }
                                    }
                                },
                            }
                        },
                    }
                },
            }

            response = self.client.search(index=self.index_name, body=query)

            # Extract results
            buckets = response["aggregations"]["words_by_pos"]["filter_pos"]["word_frequency"][
                "buckets"
            ]

            # Filter to requested range (convert to 0-based indexing)
            start_idx = start_rank - 1
            end_idx = end_rank
            range_buckets = buckets[start_idx:end_idx]

            # Format results with ranking
            results = []
            for i, bucket in enumerate(range_buckets):
                results.append(
                    {
                        "word": bucket["key"],
                        "lemma": bucket["key"],
                        "count": bucket["doc_count"],
                        "rank": start_rank + i,
                        "pos_tag": pos_tag.upper(),
                    }
                )

            return {
                "pos_tag": pos_tag.upper(),
                "language": lang,
                "total_unique_words": len(buckets),
                "requested_range": f"{start_rank}-{end_rank}",
                "results": results,
                "range_start": start_rank,
                "range_end": min(end_rank, len(buckets)),
                "total_results": len(results),
            }

        except Exception as e:
            print(f"Error getting word frequency for POS {pos_tag}: {e}")
            return {"pos_tag": pos_tag.upper(), "language": lang, "error": str(e), "results": []}

    def get_available_pos_tags(self, lang: str = "de", limit: int = 50):
        """
        Get all available POS tags in the corpus.

        Args:
            lang: Language code
            limit: Maximum number of POS tags to return

        Returns:
            list: Available POS tags with unique word counts
        """

        try:
            query = {
                "size": 0,
                "aggs": {
                    "pos_tags": {
                        "nested": {"path": "tokens"},
                        "aggs": {
                            "unique_pos": {
                                "terms": {
                                    "field": "tokens.upos",
                                    "size": limit,
                                    "order": {"unique_words": "desc"},
                                },
                                "aggs": {
                                    "unique_words": {"cardinality": {"field": "tokens.lemma"}}
                                },
                            }
                        },
                    }
                },
            }

            response = self.client.search(index=self.index_name, body=query)
            buckets = response["aggregations"]["pos_tags"]["unique_pos"]["buckets"]

            return [
                {
                    "pos_tag": bucket["key"],
                    "count": bucket["unique_words"]["value"],
                    "description": self._get_pos_description(bucket["key"]),
                }
                for bucket in buckets
            ]

        except Exception as e:
            print(f"Error getting POS tags: {e}")
            return []

    def _get_pos_description(self, pos_tag: str) -> str:
        """Get human-readable description for POS tags."""
        descriptions = {
            "NOUN": "Nouns",
            "VERB": "Verbs",
            "ADJ": "Adjectives",
            "ADV": "Adverbs",
            "PRON": "Pronouns",
            "DET": "Determiners",
            "ADP": "Prepositions",
            "CONJ": "Conjunctions",
            "CCONJ": "Coordinating Conjunctions",
            "SCONJ": "Subordinating Conjunctions",
            "PART": "Particles",
            "INTJ": "Interjections",
            "NUM": "Numbers",
            "PUNCT": "Punctuation",
            "SYM": "Symbols",
            "X": "Other",
        }
        return descriptions.get(pos_tag, pos_tag)

    def insert_youtube_video(self, video_data: dict):
        index_name = "youtube_videos"

        # Ensure the index exists
        if not self.client.indices.exists(index=index_name):
            self.client.indices.create(
                index=index_name,
                body={
                    "mappings": {
                        "properties": {
                            "video_id": {"type": "keyword"},
                            "title": {"type": "text"},
                            "thumbnail_url": {"type": "keyword"},
                            "src_lang": {"type": "keyword"},
                            "tgt_lang": {"type": "keyword"},
                            "saved_at": {"type": "date"},
                            "transcript": {
                                "type": "nested",  # Important for querying segments
                                "properties": {
                                    "original_sentence": {"type": "text"},
                                    "translated_sentence": {"type": "text"},
                                    "start_time": {"type": "float"},
                                    "end_time": {"type": "float"},
                                },
                            },
                        }
                    }
                },
            )

        # The video_id is the unique document ID
        doc_id = video_data.get("video_id")
        if not doc_id:
            raise ValueError("video_id is required to insert a YouTube video.")

        # Use 'index' op_type to allow overwriting/updating if needed
        action = {"_index": index_name, "_id": doc_id, "_op_type": "index", "_source": video_data}

        try:
            helpers.bulk(self.client, [action])
            return {"success": True, "video_id": doc_id}
        except Exception as e:
            print(f"Error inserting YouTube video {doc_id}: {e}")
            return {"success": False, "error": str(e)}

    def get_saved_videos(self, limit: int = 20):
        index_name = "youtube_videos"
        if not self.client.indices.exists(index=index_name):
            return []

        query = {
            "size": limit,
            "sort": [{"saved_at": {"order": "desc"}}],
            # Exclude the large transcript field from the list view
            "_source": {"excludes": ["transcript"]},
        }

        response = self.client.search(index=index_name, body=query)
        return [hit["_source"] for hit in response["hits"]["hits"]]

    def get_saved_video_by_id(self, video_id: str):
        index_name = "youtube_videos"
        if not self.client.indices.exists(index=index_name):
            return None

        try:
            response = self.client.get(index=index_name, id=video_id)
            return response["_source"]
        except Exception:
            return None
