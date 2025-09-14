# %%
import stanza
import re
import pandas as pd

with open("sample.txt", "r", encoding="utf-8") as f:
    my_text = f.read()

nlp = stanza.Pipeline("de", processors='tokenize,mwt,pos,lemma,depparse')
# %%
doc = nlp(my_text)
# %%
doc_dict = doc.to_dict()
# %%
from elasticsearch import Elasticsearch, helpers
from collections import defaultdict
import math
import hashlib

# Initialize Elasticsearch client
es = Elasticsearch("http://localhost:9200")

# Define a title for this document (you can modify this)
document_title = "sample_document"  # Change this to your desired title

# Clean up existing Elasticsearch data
try:
    # Delete all indices with pattern matching (optional - removes all indices)
    # es.indices.delete(index='*')
    
    # Or delete specific index if it exists
    if es.indices.exists(index='stanza_documents'):
        es.indices.delete(index='stanza_documents')
        print("Deleted existing 'stanza_documents' index")
    
    # Clear cluster cache (optional)
    es.indices.clear_cache()
    
except Exception as e:
    print(f"Error during cleanup: {e}")

# Create index with proper mapping for nested tokens
mapping = {
    "mappings": {
        "properties": {
            "title": {"type": "keyword"},
            "sentence_id": {"type": "keyword"},
            "sentence_text": {"type": "text"},
            "tokens": {
                "type": "nested",
                "properties": {
                    "id": {"type": "integer"},
                    "text": {"type": "text"},
                    "lemma": {"type": "keyword"},
                    "upos": {"type": "keyword"},
                    "xpos": {"type": "keyword"},
                    "feats": {"type": "keyword"},
                    "head": {"type": "integer"},
                    "deprel": {"type": "keyword"},
                    "start_char": {"type": "integer"},
                    "end_char": {"type": "integer"}
                }
            }
        }
    }
}

# Create index with proper mapping
try:
    es.indices.create(index='stanza_documents', body=mapping)
    print("Successfully created 'stanza_documents' index")
except Exception as e:
    print(f"Error creating index: {e}")

# Prepare documents for bulk indexing
documents = []
for sent_idx, sentence in enumerate(doc_dict):
    # Create unique sentence ID based on title and sentence index
    unique_sentence_id = f"{document_title}_{sent_idx:04d}"
    
    # Extract sentence text from tokens
    sentence_text = " ".join([token['text'] for token in sentence])
    
    doc_body = {
        "title": document_title,
        "sentence_id": unique_sentence_id,
        "sentence_text": sentence_text,
        "tokens": sentence
    }
    documents.append({
        "_index": "stanza_documents",
        "_id": unique_sentence_id,  # Use unique sentence ID as document ID
        "_source": doc_body
    })

# Bulk index the documents
try:
    response = helpers.bulk(es, documents)
    print(f"Successfully indexed {len(documents)} documents")
    print(f"Bulk response: {response}")
except Exception as e:
    print(f"Error during bulk indexing: {e}")



# %%
# Get lemmas with highest IDF using Elasticsearch's built-in scoring
# This uses Elasticsearch's TF-IDF scoring which includes IDF calculation

# Search for rare words (high IDF) by using a match_all query with aggregations
resp = es.search(
    index="stanza_documents",
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
                                "tokens.upos": "VERB"
                            }
                        },
                        "aggs": {
                            "common_verbs": {
                                "terms": {
                                    "field": "tokens.lemma",
                                    "size": 50,
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
