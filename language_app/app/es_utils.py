import hashlib
import os
import re

import spacy
from elasticsearch import Elasticsearch, helpers


class NLPProcessor:
    def __init__(self):
        self.nlp = spacy.load("de_core_news_sm")

    def clean_and_split(self, text: str) -> list[str]:
        text = re.sub(r"\.{2,}", ".", text)  # collapse multiple dots
        text = re.sub(r"\s+", " ", text).strip()  # normalize whitespace
        doc = self.nlp(text)
        return [sent.text.strip() for sent in doc.sents if sent.text.strip()]


class ElasticHelper:
    def __init__(self):
        self.client = Elasticsearch(os.getenv("ES_HOST", "http://localhost:9200"))
        self.nlp = NLPProcessor()

    def ensure_index(self, lang: str):
        index_name = f"sentences_{lang}"
        if not self.client.indices.exists(index=index_name):
            self.client.indices.create(index=index_name)

        return index_name

    def insert_text(self, text: str, lang: str):
        index_name = self.ensure_index(lang)
        sentences = self.nlp.clean_and_split(text)
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

    def search_examples(self, word: str, lang: str, limit: int = 5):
        index_name = self.ensure_index(lang)
        res = self.client.search(index=index_name, query={"match": {"sentence": word}}, size=limit)
        return [hit["_source"]["sentence"] for hit in res["hits"]["hits"]]
