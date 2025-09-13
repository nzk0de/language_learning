import hashlib
import os
import re
from elasticsearch import Elasticsearch, helpers
import stanza

class ElasticHelper:
    def __init__(self):
        self.client = Elasticsearch(os.getenv("ES_HOST", "http://localhost:9200"))
        # Initialize Stanza pipeline once
        try:
            self.stanza_nlp = stanza.Pipeline('en', processors='tokenize', verbose=False)
        except:
            self.stanza_nlp = None

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

    def ensure_index(self, lang: str):
        index_name = f"sentences_{lang}"
        if not self.client.indices.exists(index=index_name):
            self.client.indices.create(index=index_name)

        return index_name

    def insert_text(self, text: str, lang: str):
        """Insert text without translation - original functionality"""
        index_name = self.ensure_index(lang)
        sentences = self.split_sentences(text)
        actions = []
        for s in sentences:
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
        return {"inserted": len(sentences), "lang": lang}

    def insert_translation_pair(self, original_text: str, translated_text: str, 
                               src_lang: str, tgt_lang: str):
        """Insert both original and translated sentences as a pair"""
        # Create index for source language if needed
        src_index = self.ensure_index(src_lang)
        tgt_index = self.ensure_index(tgt_lang)
        
        # Split both texts into sentences
        original_sentences = self.split_sentences(original_text)
        translated_sentences = self.split_sentences(translated_text)
        
        actions = []
        inserted_pairs = 0
        
        # Match sentences by position (simple pairing)
        max_sentences = min(len(original_sentences), len(translated_sentences))
        
        for i in range(max_sentences):
            orig_sentence = original_sentences[i]
            trans_sentence = translated_sentences[i]
            
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
            "translated_sentences": len(translated_sentences)
        }

    def search_examples(self, word: str, lang: str, limit: int = 5):
        index_name = self.ensure_index(lang)
        res = self.client.search(index=index_name, query={"match": {"sentence": word}}, size=limit)
        return [hit["_source"]["sentence"] for hit in res["hits"]["hits"]]
    
    def search_translation_pairs(self, word: str, lang: str, limit: int = 5):
        """Search for sentences containing the word and return both original and translation"""
        index_name = self.ensure_index(lang)
        res = self.client.search(index=index_name, query={"match": {"sentence": word}}, size=limit)
        
        results = []
        for hit in res["hits"]["hits"]:
            source = hit["_source"]
            result = {
                "sentence": source["sentence"],
                "lang": source["lang"]
            }
            # Include translation if available
            if "translation" in source:
                result["translation"] = source["translation"]
                result["translation_lang"] = source["translation_lang"]
            results.append(result)
        
        return results
