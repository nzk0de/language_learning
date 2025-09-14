
from elasticsearch import Elasticsearch
es = Elasticsearch("http://localhost:9200")
# %%
# Search for rare words (high IDF) by using a match_all query with aggregations
resp = es.search(
    index="wiki_docs_de",
    body={
        "size": 0,  # We don't need the actual documents
        "aggs": {
            "verbs": {
                "nested": {
                    "path": "tokens"
                },
                "aggs": {
                    "filter_verbs": {
                        "filter": {
                            "term": {
                                "tokens.upos": "ADV"
                            }
                        },
                        "aggs": {
                            "common_verbs": {
                                "terms": {
                                    "field": "tokens.lemma",
                                    "size": 100,
                                    "order": {"_count": "desc"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
)

print("Most common verbs (UPOS=VERB):")
for bucket in resp["aggregations"]["verbs"]["filter_verbs"]["common_verbs"]["buckets"]:
    lemma = bucket["key"]
    count = bucket["doc_count"]
    print(f"Verb: {lemma:<20} Count: {count}")
# %%
