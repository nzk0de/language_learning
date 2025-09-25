import logging
import os
import sys
from collections import Counter
from typing import Dict

import numpy as np
import torch
from app.es_utils import get_elastic_helper
from elasticsearch import helpers
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
from transformers import pipeline  # <-- Import the pipeline

# Add the parent directory to the path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# --- Configuration ---
SOURCE_INDEX = "german_books"
UNIFIED_INDEX = "german_embeddings"
TARGET_POS_TAGS = ["NOUN", "VERB", "ADJ", "ADV"]
MIN_WORD_FREQUENCY = 2
EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
TRANSLATION_MODEL = "Helsinki-NLP/opus-mt-de-en"
NUM_SLICES = 20
TERMS_AGG_SIZE_PER_SLICE = 50000


# get_lemmas_and_frequencies function remains unchanged
def get_lemmas_and_frequencies(
    es_client, index_name: str, pos_tag: str
) -> list[tuple[str, int]]:
    # ... (This function is unchanged from the previous version) ...
    logging.info(
        f"Fetching frequent lemmas and frequencies for POS tag: '{pos_tag}'..."
    )
    pit = es_client.open_point_in_time(index=index_name, keep_alive="1m")
    pit_id = pit["id"]
    merged_lemma_counts: Dict = Counter()
    try:
        for i in range(NUM_SLICES):
            query = {
                "size": 0,
                "pit": {"id": pit_id, "keep_alive": "1m"},
                "slice": {"id": i, "max": NUM_SLICES},
                "query": {
                    "nested": {
                        "path": "tokens",
                        "query": {"term": {"tokens.upos": pos_tag}},
                    }
                },
                "aggs": {
                    "tokens_path": {
                        "nested": {"path": "tokens"},
                        "aggs": {
                            "pos_filter": {
                                "filter": {"term": {"tokens.upos": pos_tag}},
                                "aggs": {
                                    "lemmas": {
                                        "terms": {
                                            "field": "tokens.lemma",
                                            "size": TERMS_AGG_SIZE_PER_SLICE,
                                        }
                                    }
                                },
                            }
                        },
                    }
                },
            }
            response = es_client.options(request_timeout=300).search(body=query)
            buckets = response["aggregations"]["tokens_path"]["pos_filter"]["lemmas"][
                "buckets"
            ]
            for bucket in buckets:
                merged_lemma_counts[bucket["key"]] += bucket["doc_count"]
    finally:
        es_client.close_point_in_time(id=pit_id)
    frequent_lemmas = [
        (lemma, count)
        for lemma, count in merged_lemma_counts.items()
        if count >= MIN_WORD_FREQUENCY
    ]
    logging.info(
        f"Found {len(frequent_lemmas):,} lemmas for '{pos_tag}'"
        f" with frequency >= {MIN_WORD_FREQUENCY}."
    )
    return sorted(frequent_lemmas, key=lambda x: x[1], reverse=True)


def create_unified_index(es_client, index_name: str, embedding_dim: int):
    """Creates the single, unified ES index WITH the new translation field."""
    if es_client.indices.exists(index=index_name):
        logging.warning(f"Index '{index_name}' already exists. Deleting.")
        es_client.indices.delete(index=index_name)

    mapping = {
        "properties": {
            "lemma": {"type": "keyword"},
            "translation_en": {"type": "keyword"},
            "pos": {"type": "keyword"},
            "frequency": {"type": "integer"},
            "embedding": {
                "type": "dense_vector",
                "dims": embedding_dim,
                "index": True,
                "similarity": "cosine",
            },
        }
    }
    es_client.indices.create(index=index_name, mappings=mapping)
    logging.info(f"Created unified index '{index_name}'.")


# --- NEW FUNCTION ---
def translate_words_in_batches(
    words: list, translation_pipeline, batch_size: int = 64
) -> list[str]:
    """Translates a list of words using a Hugging Face pipeline with batching."""
    translations = []
    for i in tqdm(range(0, len(words), batch_size), desc="Translating batches"):
        batch = words[i : i + batch_size]
        translated_batch = translation_pipeline(batch)
        translations.extend([t["translation_text"] for t in translated_batch])
    return translations


def generate_bulk_actions(
    lemma_freq_pairs: list,
    embeddings: np.ndarray,
    translations: list,
    pos_tag: str,
    index_name: str,
):
    """Yields actions for the Elasticsearch bulk helper, now including translations."""
    for (lemma, freq), embedding, translation in zip(
        lemma_freq_pairs, embeddings, translations
    ):
        doc_id = f"{lemma}_{pos_tag}"
        yield {
            "_index": index_name,
            "_id": doc_id,
            "_source": {
                "lemma": lemma,
                "translation_en": translation,  # <-- NEW FIELD
                "pos": pos_tag,
                "frequency": freq,
                "embedding": embedding.tolist(),
            },
        }


def main():
    helper = get_elastic_helper()
    es_client = helper.client

    # Load embedding model
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    embedding_dim = embedding_model.get_sentence_embedding_dimension()

    # --- NEW: Load translation model ---
    # Auto-detect device for performance (GPU if available, otherwise CPU)
    device = 0 if torch.cuda.is_available() else -1
    logging.info(
        f"Loading translation model '{TRANSLATION_MODEL}'"
        f"on device: {'cuda' if device == 0 else 'cpu'}"
    )
    translation_pipeline = pipeline(
        "translation", model=TRANSLATION_MODEL, device=device
    )

    create_unified_index(es_client, UNIFIED_INDEX, embedding_dim)

    for pos_tag in TARGET_POS_TAGS:
        logging.info(f"\n----- Processing POS Tag: {pos_tag} -----")
        lemma_freq_pairs = get_lemmas_and_frequencies(es_client, SOURCE_INDEX, pos_tag)
        if not lemma_freq_pairs:
            continue

        lemmas_only = [item[0] for item in lemma_freq_pairs]

        # --- NEW STEP: Translate all lemmas before embedding ---
        # This will take a significant amount of time, especially on CPU.
        logging.info(f"Translating {len(lemmas_only):,} words...")
        translations = translate_words_in_batches(lemmas_only, translation_pipeline)

        logging.info(f"Generating embeddings for {len(lemmas_only):,} words...")
        embeddings = embedding_model.encode(
            lemmas_only, show_progress_bar=True, batch_size=128
        )

        logging.info(f"Bulk indexing into '{UNIFIED_INDEX}'...")
        helpers.bulk(
            es_client,
            generate_bulk_actions(
                lemma_freq_pairs, embeddings, translations, pos_tag, UNIFIED_INDEX
            ),
        )
        logging.info(f"Bulk indexing for '{pos_tag}' complete.")

    logging.info("\nUnified embedding index with translations created successfully!")


if __name__ == "__main__":
    main()
