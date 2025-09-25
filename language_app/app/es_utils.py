import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Dict, List

import aiohttp
import feedparser
import stanza
from bs4 import BeautifulSoup
from elasticsearch import Elasticsearch, helpers

from app.quality_checker import SentenceQualityChecker

logger = logging.getLogger(__name__)

# from app.quality_checker import quality_checker


class ElasticHelper:
    def __init__(self):
        self.client = Elasticsearch(os.getenv("ES_HOST", "http://localhost:9200"))

        # Set consistent index name for the whole class
        self.index_name = "german_books"  # This is your main index
        self.rss_index_name = "rss_feeds"  # RSS articles index

        self.stanza_nlp = stanza.Pipeline("en", processors="tokenize", verbose=False)
        # Initialize quality checker
        self.quality_checker = SentenceQualityChecker()

        # Initialize German Stanza pipeline for RSS processing
        self.stanza_nlp_de = None

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

    # RSS Feed Management Methods

    async def setup_rss_index(self):
        """Create the RSS feeds index if it doesn't exist."""
        if not self.client.indices.exists(index=self.rss_index_name):
            mapping = {
                "mappings": {
                    "properties": {
                        "title": {"type": "text", "analyzer": "standard"},
                        "description": {"type": "text", "analyzer": "standard"},
                        "content": {"type": "text", "analyzer": "standard"},
                        "link": {"type": "keyword"},
                        "published": {"type": "date"},
                        "fetched_at": {"type": "date"},
                        "language": {"type": "keyword"},
                        "source_feed": {"type": "keyword"},
                        "guid": {"type": "keyword"},
                        "author": {"type": "text"},
                        "categories": {"type": "keyword"},
                        "summary": {"type": "text"},
                    }
                }
            }

            self.client.indices.create(index=self.rss_index_name, body=mapping)
            logger.info(f"Created RSS index: {self.rss_index_name}")

    def load_rss_config(self, config_path: str = "config/rss.json") -> Dict[str, List[str]]:
        """Load RSS feed URLs from configuration file."""
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"RSS config file not found: {config_path}")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing RSS config: {e}")
            return {}

    def clean_content(self, content: str) -> str:
        """Clean HTML content and extract readable text."""
        if not content:
            return ""

        # Parse HTML and extract text
        soup = BeautifulSoup(content, "html.parser")
        text = soup.get_text()

        # Clean up whitespace
        text = re.sub(r"\s+", " ", text).strip()

        return text

    def generate_article_id(self, title: str, link: str) -> str:
        """Generate unique article ID based on title and link."""
        content = f"{title}_{link}"
        return hashlib.md5(content.encode()).hexdigest()

    def initialize_german_stanza(self) -> bool:
        """Initialize German Stanza pipeline for processing German RSS content."""
        try:
            if self.stanza_nlp_de is None:
                logger.info("Initializing German Stanza pipeline for RSS processing...")
                self.stanza_nlp_de = stanza.Pipeline(
                    "de", processors="tokenize,mwt,pos,lemma,depparse", verbose=False
                )
                logger.info("German Stanza pipeline initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Error initializing German Stanza: {e}")
            return False

    def process_text_with_stanza(
        self, text: str, lang: str = "de", chunk_size: int = 40000
    ) -> Dict:
        """
        Process text with Stanza NLP pipeline in chunks to handle long articles.
        Adapted from index_german_books.py

        Args:
            text: Raw text to process
            lang: Language code ('de' for German)
            chunk_size: Maximum characters per chunk

        Returns:
            Dict with doc_dict (sentences) and statistics
        """
        try:
            # Initialize the appropriate Stanza pipeline
            if lang == "de":
                if not self.initialize_german_stanza():
                    return {"doc_dict": [], "sentence_count": 0, "word_count": 0}
                nlp_pipeline = self.stanza_nlp_de
            else:
                nlp_pipeline = self.stanza_nlp

            if len(text) <= chunk_size:
                # Process normally if text is small enough
                doc = nlp_pipeline(text)
                doc_dict = doc.to_dict()

                return {
                    "doc_dict": doc_dict,
                    "sentence_count": len(doc_dict),
                    "word_count": sum(len(sentence) for sentence in doc_dict),
                }

            # Process in chunks for long articles
            logger.info(f"Processing long text ({len(text)} chars) in chunks of {chunk_size}")

            all_sentences = []
            total_sentences = 0
            total_words = 0

            # Split text into chunks at sentence boundaries when possible
            chunks = self._split_into_smart_chunks(text, chunk_size)

            for i, chunk in enumerate(chunks):
                logger.debug(f"Processing chunk {i+1}/{len(chunks)} ({len(chunk)} chars)")

                try:
                    doc = nlp_pipeline(chunk)
                    doc_dict = doc.to_dict()

                    all_sentences.extend(doc_dict)
                    total_sentences += len(doc_dict)
                    total_words += sum(len(sentence) for sentence in doc_dict)

                except Exception as e:
                    logger.error(f"Error processing chunk {i+1}: {e}")
                    continue

            return {
                "doc_dict": all_sentences,
                "sentence_count": total_sentences,
                "word_count": total_words,
            }

        except Exception as e:
            logger.error(f"Error processing text with Stanza: {e}")
            return {"doc_dict": [], "sentence_count": 0, "word_count": 0}

    def _split_into_smart_chunks(self, text: str, chunk_size: int) -> List[str]:
        """
        Split text into chunks at natural boundaries (sentences/paragraphs).
        Adapted from index_german_books.py
        """
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        current_chunk = ""

        # Split by paragraphs first
        paragraphs = text.split("\n\n")

        for paragraph in paragraphs:
            # If adding this paragraph would exceed chunk size
            if len(current_chunk) + len(paragraph) > chunk_size and current_chunk:
                # Save current chunk and start new one
                chunks.append(current_chunk.strip())
                current_chunk = paragraph
            else:
                # Add paragraph to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph

            # If single paragraph is too large, split by sentences
            if len(current_chunk) > chunk_size:
                sentences = re.split(r"[.!?]+\s+", current_chunk)
                temp_chunk = ""

                for sentence in sentences:
                    if len(temp_chunk) + len(sentence) > chunk_size and temp_chunk:
                        chunks.append(temp_chunk.strip())
                        temp_chunk = sentence
                    else:
                        if temp_chunk:
                            temp_chunk += ". " + sentence
                        else:
                            temp_chunk = sentence

                current_chunk = temp_chunk

        # Add the final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks

    async def fetch_single_rss_feed(
        self, session: aiohttp.ClientSession, feed_url: str, language: str
    ) -> List[Dict]:
        """Fetch and parse a single RSS feed."""
        try:
            logger.info(f"Fetching RSS feed: {feed_url}")

            async with session.get(feed_url, timeout=30) as response:
                if response.status != 200:
                    logger.warning(f"Failed to fetch {feed_url}: HTTP {response.status}")
                    return []

                content = await response.text()
                feed = feedparser.parse(content)

                articles = []
                fetched_at = datetime.now(timezone.utc)

                for entry in feed.entries:
                    # Extract content
                    content = ""
                    if hasattr(entry, "content") and entry.content:
                        content = entry.content[0].value if entry.content else ""
                    elif hasattr(entry, "description"):
                        content = entry.description
                    elif hasattr(entry, "summary"):
                        content = entry.summary

                    # Clean content
                    clean_text = self.clean_content(content)

                    # Parse published date
                    published = datetime.now(timezone.utc)
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        try:
                            published = datetime(*entry.published_parsed[:6])
                        except Exception as e:
                            logger.error(f"Error parsing published date: {e}")
                            pass

                    article = {
                        "title": getattr(entry, "title", ""),
                        "description": getattr(entry, "description", ""),
                        "content": clean_text,
                        "link": getattr(entry, "link", ""),
                        "published": published.isoformat(),
                        "fetched_at": fetched_at.isoformat(),
                        "language": language,
                        "source_feed": feed_url,
                        "guid": getattr(entry, "guid", getattr(entry, "id", "")),
                        "author": getattr(entry, "author", ""),
                        "categories": [tag.term for tag in getattr(entry, "tags", [])],
                        "summary": (
                            getattr(entry, "summary", "")[:500]
                            if getattr(entry, "summary", "")
                            else ""
                        ),
                    }

                    # Use content if available, otherwise use description or summary
                    if not article["content"]:
                        article["content"] = article["description"] or article["summary"]

                    articles.append(article)

                logger.info(f"Fetched {len(articles)} articles from {feed_url}")
                return articles

        except Exception as e:
            logger.error(f"Error fetching RSS feed {feed_url}: {e}")
            return []

    async def store_rss_articles_with_corpus_insertion(
        self, articles: List[Dict]
    ) -> Dict[str, int]:
        """
        Store RSS articles in both RSS index AND insert sentences into main corpus.
        This combines the RSS metadata storage with the corpus sentence insertion.

        Returns:
            Dict with counts: {
                'rss_articles_stored': int,
                'corpus_sentences_added': int,
                'sentences_filtered': int
            }
        """
        rss_stored_count = 0
        corpus_sentences_added = 0
        sentences_filtered = 0

        for article in articles:
            try:
                # Generate unique document ID for RSS index
                doc_id = self.generate_article_id(
                    article.get("title", ""), article.get("link", "")
                )

                # Check if RSS article already exists
                if self.client.exists(index=self.rss_index_name, id=doc_id):
                    continue

                # Store in RSS index first
                self.client.index(index=self.rss_index_name, id=doc_id, body=article)
                rss_stored_count += 1

                # Now process article content and add sentences to main corpus
                article_content = article.get("content", "")
                if (
                    article_content and len(article_content.strip()) > 50
                ):  # Only process substantial content

                    # Process with Stanza NLP
                    nlp_data = self.process_text_with_stanza(
                        article_content, lang=article.get("language", "de")
                    )

                    if nlp_data["doc_dict"]:
                        # Prepare sentences for corpus insertion
                        corpus_documents = []
                        doc_dict = nlp_data["doc_dict"]

                        for sent_idx, sentence in enumerate(doc_dict):
                            # Extract sentence text from tokens
                            sentence_text = " ".join([token["text"] for token in sentence])

                            # Quality check using shared quality checker
                            if not self.quality_checker.is_quality_sentence(
                                sentence_text, lang=article.get("language", "de")
                            ):
                                sentences_filtered += 1
                                continue

                            # Create unique sentence ID for corpus
                            sentence_id = f"rss_{doc_id}_{sent_idx:06d}"

                            # Create corpus document (similar to index_german_books.py)
                            corpus_doc_body = {
                                "book_title": f"RSS: {article.get('title', 'Unknown Article')}",
                                "author": article.get("author", "RSS Feed"),
                                "filename": f"rss_article_{doc_id}.txt",
                                "sentence_id": sentence_id,
                                "sentence_text": sentence_text,
                                "sentence_number": sent_idx + 1,
                                "word_count": len(sentence_text.split()),
                                "char_count": len(sentence_text),
                                "indexed_date": datetime.now().isoformat(),
                                "tokens": sentence,  # Full Stanza token information
                                # Additional RSS metadata
                                "source_type": "rss",
                                "rss_article_id": doc_id,
                                "rss_link": article.get("link", ""),
                                "rss_source_feed": article.get("source_feed", ""),
                                "rss_published": article.get("published", ""),
                                "rss_categories": article.get("categories", []),
                            }

                            corpus_documents.append(
                                {
                                    "_index": self.index_name,  # Main corpus index
                                    "_id": sentence_id,
                                    "_source": corpus_doc_body,
                                }
                            )

                        # Bulk insert corpus sentences
                        if corpus_documents:
                            helpers.bulk(self.client, corpus_documents)
                            corpus_sentences_added += len(corpus_documents)
                            logger.info(
                                f"Added {len(corpus_documents)} sentences to corpus from RSS "
                                f"article: {article.get('title', 'Unknown')[:50]}..."
                            )

            except Exception as e:
                logger.error(f"Error storing RSS article: {e}")
                continue

        return {
            "rss_articles_stored": rss_stored_count,
            "corpus_sentences_added": corpus_sentences_added,
            "sentences_filtered": sentences_filtered,
        }

    async def fetch_all_rss_feeds(
        self, config_path: str = "config/rss.json"
    ) -> Dict[str, Dict[str, int]]:
        """
        Fetch all RSS feeds, store articles, AND insert sentences into corpus.

        Returns:
            Dict with results per language and totals
        """
        config = self.load_rss_config(config_path)

        if not config:
            logger.warning("No RSS feeds configured")
            return {}

        # Ensure RSS index exists
        await self.setup_rss_index()

        results = {
            "totals": {
                "rss_articles_stored": 0,
                "corpus_sentences_added": 0,
                "sentences_filtered": 0,
            },
        }

        async with aiohttp.ClientSession() as session:
            for language, feed_urls in config.items():
                logger.info(f"Processing {len(feed_urls)} feeds for language: {language}")

                all_articles = []

                # Fetch all feeds for this language
                for feed_url in feed_urls:
                    articles = await self.fetch_single_rss_feed(session, feed_url, language)
                    all_articles.extend(articles)

                # Store articles and insert into corpus
                lang_results = await self.store_rss_articles_with_corpus_insertion(all_articles)

                # Update totals
                results["totals"]["rss_articles_stored"] += lang_results["rss_articles_stored"]
                results["totals"]["corpus_sentences_added"] += lang_results[
                    "corpus_sentences_added"
                ]
                results["totals"]["sentences_filtered"] += lang_results["sentences_filtered"]

                logger.info(
                    f"Language {language}: {lang_results['rss_articles_stored']} articles,"
                    f" {lang_results['corpus_sentences_added']} corpus sentences,"
                    f"{lang_results['sentences_filtered']} filtered"
                )

        return results

    async def get_recent_rss_articles(
        self, language: str = "", limit: int = 20, offset: int = 0
    ) -> Dict:
        """Get recent RSS articles from the RSS index."""
        try:
            query = {
                "size": limit,
                "from": offset,
                "sort": [{"fetched_at": {"order": "desc"}}],
                "query": {"match_all": {}},
            }

            if language:
                query["query"] = {"term": {"language": language}}

            response = self.client.search(index=self.rss_index_name, body=query)

            articles = []
            for hit in response["hits"]["hits"]:
                article = hit["_source"]
                article["id"] = hit["_id"]
                articles.append(article)

            return {
                "articles": articles,
                "total": response["hits"]["total"]["value"],
                "count": len(articles),
            }

        except Exception as e:
            logger.error(f"Error fetching recent RSS articles: {e}")
            return {"articles": [], "total": 0, "count": 0}


# Global Elasticsearch client and helper instance
_es_client = None
_es_helper = None


def get_elasticsearch_client():
    """Get singleton Elasticsearch client."""
    global _es_client
    if _es_client is None:
        _es_client = Elasticsearch(
            [{"host": "localhost", "port": 9200, "scheme": "http"}],
            timeout=30,
            max_retries=10,
            retry_on_timeout=True,
        )
    return _es_client


def get_elastic_helper():
    """Get singleton ElasticHelper instance."""
    global _es_helper
    if _es_helper is None:
        _es_helper = ElasticHelper()
    return _es_helper
