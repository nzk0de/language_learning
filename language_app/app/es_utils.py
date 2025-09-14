import hashlib
import os
import re
from elasticsearch import Elasticsearch, helpers
import stanza
from .quality_checker import SentenceQualityChecker
from .quality_checker import quality_checker

class ElasticHelper:
    def __init__(self):
        self.client = Elasticsearch(os.getenv("ES_HOST", "http://localhost:9200"))
        # Initialize Stanza pipeline once
        try:
            self.stanza_nlp = stanza.Pipeline('en', processors='tokenize', verbose=False)
        except:
            self.stanza_nlp = None
        
        # Initialize quality checker
        self.quality_checker = SentenceQualityChecker()
        
        # Quality filtering configuration
        self.quality_config = {
            'min_length': 20,
            'max_length': 200,
            'min_words': 4,
            'max_upper_ratio': 0.3,
            'min_alpha_ratio': 0.7,
            'enable_quality_filter': True
        }

    def split_sentences(self, text: str) -> list[str]:
        """Split text into sentences using Stanza"""
        if not text.strip():
            return []
        
        if self.stanza_nlp:
            try:
                doc = self.stanza_nlp(text)
                return [sent.text.strip() for sent in doc.sentences if sent.text.strip()]
            except:
                pass
        
        # Fallback to regex splitting
        sentences = re.split(r'[.!?]+\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def is_quality_sentence(self, sentence: str) -> bool:
        """Check if a sentence meets quality criteria for Wikipedia content"""
        # Skip quality filtering if disabled
        if not self.quality_config.get('enable_quality_filter', True):
            return True
            
        if not sentence or not sentence.strip():
            return False
            
        sentence = sentence.strip()
        
        # Length checks
        min_length = self.quality_config.get('min_length', 20)
        max_length = self.quality_config.get('max_length', 200)
        if len(sentence) < min_length or len(sentence) > max_length:
            return False
        
        # Must start with uppercase letter (proper sentence start)
        if not sentence[0].isupper():
            return False
            
        # Must end with proper punctuation
        if not sentence.endswith(('.', '!', '?')):
            return False
            
        # Check for incomplete sentences (common Wikipedia artifacts)
        incomplete_patterns = [
            r'^\d+\.',  # Starts with number and dot (list item)
            r'^[•·\-\*]',  # Starts with bullet points
            r'^\(',  # Starts with opening parenthesis
            r'\)$',  # Ends with closing parenthesis only
            r'^\[',  # Starts with bracket (references)
            r'\]$',  # Ends with bracket
            r':\s*$',  # Ends with colon (incomplete)
            r'^[A-Z][a-z]*:',  # Category/namespace prefixes like "Category:"
            r'==.*==',  # Wiki section headers
            r'^\|\s*',  # Wiki table syntax
            r'^\{\{',  # Wiki template syntax
            r'\}\}$',  # Wiki template syntax
        ]
        
        for pattern in incomplete_patterns:
            if re.search(pattern, sentence):
                return False
        
        # Check for minimum word count (avoid fragments)
        word_count = len(sentence.split())
        min_words = self.quality_config.get('min_words', 4)
        if word_count < min_words:
            return False
            
        # Check for balanced parentheses and quotes
        if sentence.count('(') != sentence.count(')'):
            return False
        if sentence.count('"') % 2 != 0:
            return False
        if sentence.count("'") > 2:  # Avoid sentences with too many apostrophes (likely formatting issues)
            return False
            
        # Avoid sentences that are mostly numbers/special characters
        alpha_ratio = sum(c.isalpha() or c.isspace() for c in sentence) / len(sentence)
        min_alpha_ratio = self.quality_config.get('min_alpha_ratio', 0.7)
        if alpha_ratio < min_alpha_ratio:
            return False
            
        # Avoid sentences with excessive capitalization (likely titles/headers)
        upper_ratio = sum(c.isupper() for c in sentence if c.isalpha()) / max(sum(c.isalpha() for c in sentence), 1)
        max_upper_ratio = self.quality_config.get('max_upper_ratio', 0.3)
        if upper_ratio > max_upper_ratio:
            return False
            
        return True
    
    def configure_quality_filter(self, **kwargs):
        """Configure quality filtering parameters"""
        for key, value in kwargs.items():
            if key in self.quality_config:
                self.quality_config[key] = value
            else:
                print(f"Warning: Unknown quality config parameter: {key}")
    
    def get_quality_stats(self, sentences: list[str]) -> dict:
        """Get statistics about sentence quality in a list"""
        total = len(sentences)
        if total == 0:
            return {"total": 0, "quality": 0, "filtered": 0, "quality_rate": 0.0}
            
        quality_count = sum(1 for s in sentences if self.is_quality_sentence(s))
        filtered_count = total - quality_count
        quality_rate = quality_count / total
        
        return {
            "total": total,
            "quality": quality_count,
            "filtered": filtered_count,
            "quality_rate": round(quality_rate, 3)
        }

    def ensure_index(self, lang: str):
        index_name = f"sentences_{lang}"
        if not self.client.indices.exists(index=index_name):
            self.client.indices.create(index=index_name)

        return index_name

    def insert_text(self, text: str, lang: str):
        """Insert text without translation - with quality filtering"""
        index_name = self.ensure_index(lang)
        sentences = self.split_sentences(text)
        
        # Filter sentences by quality
        quality_sentences = [s for s in sentences if self.is_quality_sentence(s, lang)]
        
        actions = []
        for s in quality_sentences:
            doc_id = hashlib.sha256(f"{lang}:{s}".encode("utf-8")).hexdigest()
            actions.append(
                {
                    "_index": index_name,
                    "_id": doc_id,
                    "_op_type": "create",
                    "_source": {"sentence": s, "lang": lang},
                }
            )
        
        helpers.bulk(self.client, actions, raise_on_error=False)
        
        return {
            "inserted": len(quality_sentences), 
            "lang": lang,
            "total_sentences": len(sentences),
            "filtered_out": len(sentences) - len(quality_sentences)
        }

    def insert_translation_pair(self, original_text: str, translated_text: str, 
                               src_lang: str, tgt_lang: str):
        """Insert both original and translated sentences as a pair - with quality filtering"""
        # Create index for source language if needed
        src_index = self.ensure_index(src_lang)
        tgt_index = self.ensure_index(tgt_lang)
        
        # Split both texts into sentences
        original_sentences = self.split_sentences(original_text)
        translated_sentences = self.split_sentences(translated_text)
        
        actions = []
        inserted_pairs = 0
        filtered_pairs = 0
        
        # Match sentences by position (simple pairing)
        max_sentences = min(len(original_sentences), len(translated_sentences))
        
        for i in range(max_sentences):
            orig_sentence = original_sentences[i]
            trans_sentence = translated_sentences[i]
            
            # Check quality of both sentences
            if not self.is_quality_sentence(orig_sentence, src_lang) or not self.is_quality_sentence(trans_sentence, tgt_lang):
                filtered_pairs += 1
                continue
            
            # Create unique IDs for the translation pair
            pair_id = hashlib.sha256(f"{src_lang}:{orig_sentence}:{tgt_lang}:{trans_sentence}".encode("utf-8")).hexdigest()
            
            # Insert original sentence with translation reference
            orig_doc_id = hashlib.sha256(f"{src_lang}:{orig_sentence}".encode("utf-8")).hexdigest()
            actions.append({
                "_index": src_index,
                "_id": orig_doc_id,
                "_op_type": "index",  # Use index to allow updates
                "_source": {
                    "sentence": orig_sentence,
                    "lang": src_lang,
                    "translation": trans_sentence,
                    "translation_lang": tgt_lang,
                    "pair_id": pair_id
                },
            })
            
            # Insert translated sentence with original reference
            trans_doc_id = hashlib.sha256(f"{tgt_lang}:{trans_sentence}".encode("utf-8")).hexdigest()
            actions.append({
                "_index": tgt_index,
                "_id": trans_doc_id,
                "_op_type": "index",  # Use index to allow updates
                "_source": {
                    "sentence": trans_sentence,
                    "lang": tgt_lang,
                    "translation": orig_sentence,
                    "translation_lang": src_lang,
                    "pair_id": pair_id
                },
            })
            inserted_pairs += 1
        
        # Bulk insert
        helpers.bulk(self.client, actions, raise_on_error=False)
        
        return {
            "inserted_pairs": inserted_pairs,
            "src_lang": src_lang,
            "tgt_lang": tgt_lang,
            "original_sentences": len(original_sentences),
            "translated_sentences": len(translated_sentences),
            "filtered_pairs": filtered_pairs
        }

    def search_examples(self, word: str, lang: str, limit: int = 5):
        """Search for examples of a word in your Wikipedia corpus with consistent format"""
        # Use your actual corpus index name
        corpus_index = f"wiki_docs_{lang}"
        
        try:
            # Search in sentence_text field (based on your corpus structure)
            query = {
                "query": {
                    "bool": {
                        "should": [
                            # Match the word in sentence text
                            {"match": {"sentence_text": {"query": word, "boost": 2.0}}},
                            # Also search in token text for more precise matches
                            {
                                "nested": {
                                    "path": "tokens",
                                    "query": {
                                        "match": {"tokens.text": word}
                                    },
                                    "boost": 1.5
                                }
                            },
                            # Search in lemmas for word variations
                            {
                                "nested": {
                                    "path": "tokens", 
                                    "query": {
                                        "match": {"tokens.lemma": word}
                                    }
                                }
                            }
                        ],
                        "minimum_should_match": 1
                    }
                },
                "highlight": {
                    "fields": {
                        "sentence_text": {"pre_tags": ["<mark>"], "post_tags": ["</mark>"]}
                    }
                },
                "_source": ["sentence_text", "title", "sentence_id"],
                "size": limit * 3  # Fetch more results to account for quality filtering
            }
            
            res = self.client.search(index=corpus_index, body=query)
            
            examples = []
            for hit in res["hits"]["hits"]:
                source = hit["_source"]
                sentence_text = source["sentence_text"]
                
                # Apply quality filter
                if not self.is_quality_sentence(sentence_text):
                    continue
                
                example = {
                    "sentence": sentence_text,
                    "lang": lang,
                    "title": source.get("title"),
                    "sentence_id": source.get("sentence_id"),
                    "translation": None,
                    "translation_lang": None
                }
                
                # Add highlighting if available
                if "highlight" in hit and "sentence_text" in hit["highlight"]:
                    example["highlighted"] = hit["highlight"]["sentence_text"][0]
                
                examples.append(example)
                
                # Stop when we have enough quality examples
                if len(examples) >= limit:
                    break
            
            return examples
            
        except Exception as e:
            print(f"Error searching corpus: {e}")
            # Fallback to old method if corpus doesn't exist
            return self._fallback_search(word, lang, limit)
    
    def _fallback_search(self, word: str, lang: str, limit: int = 5):
        """Fallback to old sentence index if corpus not available - with consistent format and quality filtering"""
        try:
            index_name = self.ensure_index(lang)
            res = self.client.search(index=index_name, query={"match": {"sentence": word}}, size=limit * 2)
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
                    "translation_lang": source.get("translation_lang")
                }
                examples.append(example)
                
                # Stop when we have enough quality examples
                if len(examples) >= limit:
                    break
                    
            return examples
        except Exception as e:
            print(f"Fallback search error: {e}")
            return []
    
    def search_translation_pairs(self, word: str, lang: str, limit: int = 5):
        """Search for sentences containing the word and return both original and translation with consistent format and quality filtering"""
        try:
            index_name = self.ensure_index(lang)
            res = self.client.search(index=index_name, query={"match": {"sentence": word}}, size=limit * 2)
            
            results = []
            for hit in res["hits"]["hits"]:
                source = hit["_source"]
                sentence_text = source["sentence"]
                
                # Apply quality filter
                if not self.is_quality_sentence(sentence_text):
                    continue
                
                result = {
                    "sentence": sentence_text,
                    "lang": source.get("lang", lang),
                    "title": None,  # Translation pairs don't have titles
                    "sentence_id": None,
                    "highlighted": None,
                    "translation": source.get("translation"),
                    "translation_lang": source.get("translation_lang")
                }
                results.append(result)
                
                # Stop when we have enough quality examples
                if len(results) >= limit:
                    break
            
            return results
        except Exception as e:
            print(f"Error searching translation pairs: {e}")
            return []
    
    def is_quality_sentence(self, sentence: str, lang: str = "de") -> bool:
        """Check if a sentence meets quality standards using shared quality checker"""
        return self.quality_checker.is_quality_sentence(sentence)

    def search_unified(self, word: str, lang: str, limit: int = 5):
        """Unified search that tries both corpus and translation pairs"""
        # First try corpus search (usually more comprehensive)
        corpus_results = self.search_examples(word, lang, limit)
        
        # If we have good corpus results, return them
        if corpus_results and len(corpus_results) >= limit // 2:
            return corpus_results
        
        # Otherwise, try translation pairs as well
        translation_results = self.search_translation_pairs(word, lang, limit)
        
        # Combine results, prioritizing corpus results
        all_results = corpus_results + translation_results
        
        # Remove duplicates based on sentence text and limit results
        seen_sentences = set()
        unique_results = []
        for result in all_results:
            if result["sentence"] not in seen_sentences:
                seen_sentences.add(result["sentence"])
                unique_results.append(result)
                if len(unique_results) >= limit:
                    break
        
        return unique_results
    
    def cleanup_low_quality_sentences(self, index_pattern: str = None, lang: str = "en", batch_size: int = 100, dry_run: bool = True):
        """
        Clean up low-quality sentences from existing corpus.
        
        Args:
            index_pattern: Index pattern to search (e.g., "wiki_docs_*" or specific index)
            lang: Language code for quality checks
            batch_size: Number of documents to process per batch
            dry_run: If True, only report what would be deleted without actually deleting
            
        Returns:
            dict: Cleanup statistics
        """
        if index_pattern is None:
            index_pattern = f"wiki_docs_{lang}"
        
        stats = {
            'total_checked': 0,
            'low_quality_found': 0,
            'deleted': 0,
            'errors': 0,
            'dry_run': dry_run
        }
        
        try:
            # Check if index exists
            if not self.client.indices.exists(index=index_pattern):
                print(f"Index {index_pattern} does not exist")
                return stats
            
            # Scroll through all documents
            query = {
                "query": {"match_all": {}},
                "size": batch_size
            }
            
            print(f"Starting cleanup of {index_pattern} (dry_run={dry_run})")
            
            # Use scroll API for efficient processing
            response = self.client.search(
                index=index_pattern,
                body=query,
                scroll='5m'
            )
            
            scroll_id = response['_scroll_id']
            hits = response['hits']['hits']
            
            documents_to_delete = []
            
            while hits:
                # Process current batch
                for hit in hits:
                    stats['total_checked'] += 1
                    
                    # Get sentence text from different possible fields
                    sentence = None
                    source = hit['_source']
                    
                    if 'sentence_text' in source:
                        sentence = source['sentence_text']
                    elif 'sentence' in source:
                        sentence = source['sentence']
                    
                    if sentence and not self.is_quality_sentence(sentence, lang):
                        stats['low_quality_found'] += 1
                        documents_to_delete.append({
                            '_index': hit['_index'],
                            '_id': hit['_id'],
                            '_op_type': 'delete'
                        })
                        
                        # if not dry_run:
                        #     print(f"Will delete: {sentence[:100]}...")
                        # else:
                        #     print(f"Would delete: {sentence[:100]}...")
                    # else:
                    #     print(f"Keeping: {sentence[:100]}...")
                # Batch delete if we have enough documents or if this is the last batch
                if len(documents_to_delete) >= batch_size or len(hits) < batch_size:
                    if documents_to_delete and not dry_run:
                        try:
                            delete_response = helpers.bulk(self.client, documents_to_delete, raise_on_error=False)
                            stats['deleted'] += len(documents_to_delete)
                            print(f"Deleted {len(documents_to_delete)} low-quality sentences")
                        except Exception as e:
                            print(f"Error during bulk delete: {e}")
                            stats['errors'] += 1
                    
                    documents_to_delete = []
                
                # Get next batch
                try:
                    response = self.client.scroll(scroll_id=scroll_id, scroll='5m')
                    scroll_id = response['_scroll_id']
                    hits = response['hits']['hits']
                except Exception as e:
                    print(f"Error scrolling: {e}")
                    break
            
            # Clear scroll context
            try:
                self.client.clear_scroll(scroll_id=scroll_id)
            except:
                pass
            
        except Exception as e:
            print(f"Error during cleanup: {e}")
            stats['errors'] += 1
        
        return stats
    
    def get_quality_report_for_index(self, index_pattern: str = None, lang: str = "en", sample_size: int = None):
        """
        Get a quality report for sentences in an index.
        
        Args:
            index_pattern: Index pattern to analyze
            lang: Language code
            sample_size: Number of sentences to analyze (None = analyze ALL documents using scroll)
            
        Returns:
            dict: Quality analysis report
        """
        if index_pattern is None:
            index_pattern = f"wiki_docs_{lang}"
        
        try:
            quality_stats = {
                'total_sampled': 0,
                'high_quality': 0,
                'low_quality': 0,
                'quality_issues': {},
                'examples': {'high_quality': [], 'low_quality': []}
            }
            
            if sample_size is None:
                # Analyze ALL documents using scroll API
                print(f"🔍 Analyzing ALL documents in {index_pattern} (using scroll API)...")
                
                query = {
                    "query": {"match_all": {}},
                    "size": 1000  # Process 1000 docs at a time
                }
                
                response = self.client.search(
                    index=index_pattern,
                    body=query,
                    scroll='5m'
                )
                
                scroll_id = response['_scroll_id']
                hits = response['hits']['hits']
                
                while hits:
                    # Process current batch
                    for hit in hits:
                        quality_stats['total_sampled'] += 1
                        
                        source = hit['_source']
                        sentence = source.get('sentence_text') or source.get('sentence', '')
                        
                        if sentence:
                            report = quality_checker.get_quality_report(sentence, lang)
                            
                            if report['passes']:
                                quality_stats['high_quality'] += 1
                                if len(quality_stats['examples']['high_quality']) < 5:
                                    quality_stats['examples']['high_quality'].append(sentence)
                            else:
                                quality_stats['low_quality'] += 1
                                if len(quality_stats['examples']['low_quality']) < 5:
                                    quality_stats['examples']['low_quality'].append({
                                        'sentence': sentence,
                                        'issues': report['failed_checks']
                                    })
                                
                                # Count quality issues
                                for issue in report['failed_checks']:
                                    quality_stats['quality_issues'][issue] = quality_stats['quality_issues'].get(issue, 0) + 1
                    
                    # Show progress every 1000 documents
                    if quality_stats['total_sampled'] % 1000 == 0:
                        print(f"   Processed {quality_stats['total_sampled']:,} documents...")
                    
                    # Get next batch
                    try:
                        response = self.client.scroll(scroll_id=scroll_id, scroll='5m')
                        scroll_id = response['_scroll_id']
                        hits = response['hits']['hits']
                    except Exception as e:
                        print(f"Error scrolling: {e}")
                        break
                
                # Clear scroll context
                try:
                    self.client.clear_scroll(scroll_id=scroll_id)
                except:
                    pass
            
            else:
                # Sample-based analysis (limited to 10,000 due to ES limits)
                print(f"🔍 Analyzing random sample of {sample_size} documents...")
                
                if sample_size > 10000:
                    print(f"⚠️  Reducing sample size to 10,000 (Elasticsearch limit)")
                    sample_size = 10000
                
                query = {
                    "query": {"function_score": {"random_score": {}}},
                    "size": sample_size
                }
                
                response = self.client.search(index=index_pattern, body=query)
                hits = response['hits']['hits']
                
                quality_stats['total_sampled'] = len(hits)
                
                for hit in hits:
                    source = hit['_source']
                    sentence = source.get('sentence_text') or source.get('sentence', '')
                    
                    if sentence:
                        report = quality_checker.get_quality_report(sentence, lang)
                        
                        if report['passes']:
                            quality_stats['high_quality'] += 1
                            if len(quality_stats['examples']['high_quality']) < 5:
                                quality_stats['examples']['high_quality'].append(sentence)
                        else:
                            quality_stats['low_quality'] += 1
                            if len(quality_stats['examples']['low_quality']) < 5:
                                quality_stats['examples']['low_quality'].append({
                                    'sentence': sentence,
                                    'issues': report['failed_checks']
                                })
                            
                            # Count quality issues
                            for issue in report['failed_checks']:
                                quality_stats['quality_issues'][issue] = quality_stats['quality_issues'].get(issue, 0) + 1
            
            # Calculate quality percentage
            quality_stats['quality_percentage'] = (quality_stats['high_quality'] / quality_stats['total_sampled'] * 100) if quality_stats['total_sampled'] > 0 else 0
            
            return quality_stats
            
        except Exception as e:
            print(f"Error generating quality report: {e}")
            return None

    def get_word_frequency_by_pos(self, pos_tag: str, lang: str = "de", size: int = 100, 
                                 start_rank: int = 1, end_rank: int = None):
        """
        Get word frequency analysis by part-of-speech tag with ranking range.
        
        Args:
            pos_tag: POS tag to filter by (e.g., 'NOUN', 'VERB', 'ADJ', 'ADV')
            lang: Language code for index selection
            size: Maximum number of results to fetch (should be >= end_rank)
            start_rank: Starting rank (1-based, e.g., 10 for top 10th word)
            end_rank: Ending rank (1-based, e.g., 20 for top 20th word). If None, uses start_rank + size
            
        Returns:
            dict: Word frequency data with ranking information
        """
        if end_rank is None:
            end_rank = start_rank + size - 1
        
        # Ensure we fetch enough data to get the requested range
        fetch_size = max(size, end_rank)
        
        index_name = f"wiki_docs_{lang}"
        
        try:
            query = {
                "size": 0,  # We don't need the actual documents
                "aggs": {
                    "words_by_pos": {
                        "nested": {
                            "path": "tokens"
                        },
                        "aggs": {
                            "filter_pos": {
                                "filter": {
                                    "term": {
                                        "tokens.upos": pos_tag.upper()
                                    }
                                },
                                "aggs": {
                                    "word_frequency": {
                                        "terms": {
                                            "field": "tokens.lemma",
                                            "size": fetch_size,
                                            "order": {"_count": "desc"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            response = self.client.search(index=index_name, body=query)
            
            # Extract results
            buckets = response["aggregations"]["words_by_pos"]["filter_pos"]["word_frequency"]["buckets"]
            
            # Filter to requested range (convert to 0-based indexing)
            start_idx = start_rank - 1
            end_idx = end_rank
            range_buckets = buckets[start_idx:end_idx]
            
            # Format results with ranking
            results = []
            for i, bucket in enumerate(range_buckets):
                results.append({
                    "word": bucket["key"],
                    "lemma": bucket["key"],
                    "count": bucket["doc_count"],
                    "rank": start_rank + i,
                    "pos_tag": pos_tag.upper()
                })
            
            return {
                "pos_tag": pos_tag.upper(),
                "language": lang,
                "total_unique_words": len(buckets),
                "requested_range": f"{start_rank}-{end_rank}",
                "results": results,
                "range_start": start_rank,
                "range_end": min(end_rank, len(buckets)),
                "total_results": len(results)
            }
            
        except Exception as e:
            print(f"Error getting word frequency for POS {pos_tag}: {e}")
            return {
                "pos_tag": pos_tag.upper(),
                "language": lang,
                "error": str(e),
                "results": []
            }

    def get_available_pos_tags(self, lang: str = "de", limit: int = 50):
        """
        Get all available POS tags in the corpus.
        
        Args:
            lang: Language code
            limit: Maximum number of POS tags to return
            
        Returns:
            list: Available POS tags with unique word counts
        """
        index_name = f"wiki_docs_{lang}"
        
        try:
            query = {
                "size": 0,
                "aggs": {
                    "pos_tags": {
                        "nested": {
                            "path": "tokens"
                        },
                        "aggs": {
                            "unique_pos": {
                                "terms": {
                                    "field": "tokens.upos",
                                    "size": limit,
                                    "order": {"unique_words": "desc"}
                                },
                                "aggs": {
                                    "unique_words": {
                                        "cardinality": {
                                            "field": "tokens.lemma"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            response = self.client.search(index=index_name, body=query)
            buckets = response["aggregations"]["pos_tags"]["unique_pos"]["buckets"]
            
            return [
                {
                    "pos_tag": bucket["key"],
                    "count": bucket["unique_words"]["value"],
                    "description": self._get_pos_description(bucket["key"])
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
            "X": "Other"
        }
        return descriptions.get(pos_tag, pos_tag)
