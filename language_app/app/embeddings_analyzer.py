import logging
from typing import Dict, List

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

from .es_utils import get_elastic_helper

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"


class EmbeddingsAnalyzer:
    """Analyzer for extracting and ranking common words from text using embeddings."""

    def __init__(self):
        self.helper = get_elastic_helper()
        self.embeddings_index = "german_embeddings"
        self.sentence_model = SentenceTransformer(EMBEDDING_MODEL)

    def get_sentence_embedding(self, sentence: str):
        """Get sentence embedding using SentenceTransformer."""
        return self.sentence_model.encode([sentence])[0]

    def get_similar_words_reranked(
        self, sentence: str, sort_method: str = "frequency", k: int = 10
    ) -> List[Dict]:
        """
        Get similar words using sentence embeddings - your simple approach.

        Args:
            sentence: Input sentence to get embeddings for
            sort_method: Sorting method ('frequency', 'lorentzian', 'combined')
            k: Number of results to return

        Returns:
            List of dictionaries with word data sorted by chosen method
        """
        try:
            # Get sentence embedding using SentenceTransformer
            query_vector = self.get_sentence_embedding(sentence)

            # Use your existing es_utils method
            target_pos_tags = ["NOUN", "VERB", "ADJ", "ADV"]
            results = self.helper.get_similar_words_reranked(
                query_vector=query_vector,
                target_pos_tags=target_pos_tags,
                k=2000,  # Get more candidates
                candidates=4000,
            )
            print(f"Found {len(results)} initial candidates")
            # Score the results just like in your test_embedding.py
            scored_results = []
            for r in results:
                sim = r["_score"]
                freq = r["_source"]["frequency"]

                # Your scoring functions

                mu = np.log(1000)
                sigma = 4

                lorentzian_score = sim * 1 / (1 + ((np.log(freq) - mu) / sigma) ** 2)

                scored_results.append(
                    {
                        "lemma": r["_source"]["lemma"],
                        "pos": r["_source"]["pos"],
                        "frequency": freq,
                        "translation_en": r["_source"].get("translation_en", ""),
                        "similarity": sim,
                        "lorentzian": lorentzian_score,
                        "combined": freq * lorentzian_score,
                    }
                )

            # Convert to DataFrame and apply your exact logic
            df = pd.DataFrame(scored_results)

            if df.empty:
                return []

            # Your exact logic: filter frequency > 3 and sort
            filtered_df = df[df["frequency"] > 3]

            if sort_method == "frequency":
                sorted_df = filtered_df.sort_values(by="frequency", ascending=False)
            elif sort_method == "lorentzian":
                sorted_df = filtered_df.sort_values(by="lorentzian", ascending=False)
            elif sort_method == "combined":
                sorted_df = filtered_df.sort_values(by="combined", ascending=False)
            else:
                sorted_df = filtered_df.sort_values(by="lorentzian", ascending=False)

            # Return top k results as list of dicts
            return sorted_df.head(k).to_dict("records")

        except Exception as e:
            logger.error(f"Error getting similar words: {e}")
            return []

    def analyze_sentence_commonality(
        self, sentence: str, sort_method: str = "frequency", k: int = 10, language: str = "de"
    ) -> Dict:
        """
        Complete analysis of sentence commonality using your simple approach.

        Args:
            sentence: Input sentence to analyze
            sort_method: Sorting method ('frequency', 'lorentzian', 'combined')
            k: Number of top words to return
            language: Language code (ignored - we use sentence embeddings directly)

        Returns:
            Dictionary with analysis results
        """
        try:
            # Use your simple approach - just get similar words via embeddings
            common_words = self.get_similar_words_reranked(sentence, sort_method, k)

            if not common_words:
                return {
                    "success": False,
                    "message": "No similar words found",
                    "sentence": sentence,
                    "common_words": [],
                }

            # Simple word extraction from sentence for basic stats
            words_in_sentence = sentence.split()

            return {
                "success": True,
                "sentence": sentence,
                "language": language,
                "total_lemmas_found": len(words_in_sentence),
                "unique_lemmas_count": len(set(words_in_sentence)),
                "lemmas_found": list(set(words_in_sentence)),
                "lemma_frequencies_in_sentence": {
                    word: words_in_sentence.count(word) for word in set(words_in_sentence)
                },
                "sort_method": sort_method,
                "top_k": k,
                "common_words": common_words,
                "analysis_summary": {
                    "most_common_word": common_words[0] if common_words else None,
                    "average_frequency": (
                        sum(w["frequency"] for w in common_words) / len(common_words)
                        if common_words
                        else 0
                    ),
                    "pos_distribution": {
                        pos: len([w for w in common_words if w["pos"] == pos])
                        for pos in set(w["pos"] for w in common_words)
                    },
                },
            }

        except Exception as e:
            logger.error(f"Error analyzing sentence: {e}")
            return {"success": False, "error": str(e), "sentence": sentence}

    def get_available_sort_methods(self) -> List[Dict[str, str]]:
        """Get available sorting methods with descriptions."""
        return [
            {
                "value": "frequency",
                "label": "Frequency",
                "description": "Sort by raw word frequency in corpus",
            },
            {
                "value": "lorentzian",
                "label": "Lorentzian",
                "description": "Sort by frequency with diminishing returns (balanced)",
            },
            {
                "value": "combined",
                "label": "Combined",
                "description": "Sort by frequency × lorentzian score",
            },
        ]


# Singleton instance
_embeddings_analyzer = None


def get_embeddings_analyzer():
    """Get singleton EmbeddingsAnalyzer instance."""
    global _embeddings_analyzer
    if _embeddings_analyzer is None:
        _embeddings_analyzer = EmbeddingsAnalyzer()
    return _embeddings_analyzer
