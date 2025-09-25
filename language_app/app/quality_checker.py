"""
Sentence Quality Checker Module

This module provides quality assessment for sentences to ensure only well-formed,
complete sentences are included in the language learning corpus.

Author: Language Learning Project
Date: September 2025
"""

import re


class SentenceQualityChecker:
    """
    A class to assess the quality of sentences for corpus inclusion.
    Filters out incomplete, malformed, or low-quality sentences.
    """

    def __init__(self):
        """Initialize the quality checker with default parameters."""
        self.config = {
            "min_length": 10,
            "max_length": 500,
            "min_words": 3,
            "max_words": 50,
            "max_number_ratio": 0.3,  # Max 30% numbers
            "max_punct_ratio": 0.2,  # Max 20% punctuation
            "min_caps_ratio_de": 0.1,  # Min 10% capitalized words for German
        }

    def is_quality_sentence(self, sentence: str, lang: str = "en") -> bool:
        """
        Check if a sentence meets quality standards for corpus inclusion.

        Args:
            sentence: The sentence to check
            lang: Language code ('en', 'de', etc.)

        Returns:
            bool: True if sentence passes quality checks, False otherwise
        """
        if not sentence or not sentence.strip():
            return False

        sentence = sentence.strip()

        # Length checks
        if len(sentence) < self.config["min_length"] or len(sentence) > self.config["max_length"]:
            return False

        # Word count checks
        words = sentence.split()
        if len(words) < self.config["min_words"] or len(words) > self.config["max_words"]:
            return False

        # Check for proper sentence endings
        if not sentence.endswith((".", "!", "?", ":", ";")):
            return False

        # Check for incomplete sentences (common wiki artifacts)
        if self._has_incomplete_patterns(sentence):
            return False

        # Check for too many numbers (likely data/statistics)
        if self._has_too_many_numbers(sentence, words):
            return False

        # Check for excessive punctuation
        if self._has_excessive_punctuation(sentence):
            return False

        # Check for proper capitalization (avoid all caps or no caps)
        if sentence.isupper() or sentence.islower():
            return False

        # Language-specific checks
        if not self._passes_language_checks(sentence, words, lang):
            return False

        # Check for common wiki artifacts
        if self._has_wiki_artifacts(sentence):
            return False

        return True

    def _has_incomplete_patterns(self, sentence: str) -> bool:
        """Check for patterns that indicate incomplete sentences."""
        incomplete_patterns = [
            r"^\s*\d+\.?\s*$",  # Just numbers
            r"^\s*[A-Z][a-z]*:?\s*$",  # Single word/title
            r"^\s*\([^)]*$",  # Unclosed parenthesis
            r"^[^)]*\)\s*$",  # Starts with closing parenthesis
            r"^\s*[-–—]\s*",  # Starts with dash
            r"\s+[-–—]\s*$",  # Ends with dash
            r"^\s*\*",  # Starts with bullet point
            r"^\s*[•·▪▫]\s*",  # Other bullet characters
            r"\.{3,}",  # Multiple dots (ellipsis issues)
            r"^[^A-ZÄÖÜ]",  # Doesn't start with capital (for German/English)
        ]

        for pattern in incomplete_patterns:
            if re.search(pattern, sentence):
                return True
        return False

    def _has_too_many_numbers(self, sentence: str, words: list) -> bool:
        """Check if sentence has too many numbers (likely statistics)."""
        number_count = len(re.findall(r"\d+", sentence))
        return number_count > len(words) * self.config["max_number_ratio"]

    def _has_excessive_punctuation(self, sentence: str) -> bool:
        """Check if sentence has excessive punctuation."""
        punct_count = len(re.findall(r"[^\w\s]", sentence))
        return punct_count > len(sentence) * self.config["max_punct_ratio"]

    def _passes_language_checks(self, sentence: str, words: list, lang: str) -> bool:
        """Perform language-specific quality checks."""
        if lang == "de":
            # German should have reasonable amount of capitalized words (nouns)
            caps_count = len(re.findall(r"\b[A-ZÄÖÜ][a-zäöüß]+", sentence))
            if caps_count < len(words) * self.config["min_caps_ratio_de"]:
                return False

        return True

    def _has_wiki_artifacts(self, sentence: str) -> bool:
        """Check for common Wikipedia artifacts."""
        wiki_artifacts = [
            "siehe auch",  # German "see also"
            "see also",
            "category:",
            "kategorie:",
            "thumb|",
            "px|",
            "left|",
            "right|",
            "center|",
            "{{",
            "}}",
            "[[",
            "]]",
            "file:",
            "image:",
            "datei:",
            "bild:",
        ]

        sentence_lower = sentence.lower()
        for artifact in wiki_artifacts:
            if artifact in sentence_lower:
                return True
        return False

    def get_quality_report(self, sentence: str, lang: str = "en") -> dict:
        """
        Get a detailed quality report for a sentence.

        Args:
            sentence: The sentence to analyze
            lang: Language code

        Returns:
            dict: Quality report with checks and reasons
        """
        if not sentence or not sentence.strip():
            return {"passes": False, "reason": "Empty or whitespace-only sentence"}

        sentence = sentence.strip()
        words = sentence.split()

        checks = {
            "length_check": self.config["min_length"]
            <= len(sentence)
            <= self.config["max_length"],
            "word_count_check": self.config["min_words"] <= len(words) <= self.config["max_words"],
            "ending_check": sentence.endswith((".", "!", "?", ":", ";")),
            "incomplete_patterns_check": not self._has_incomplete_patterns(sentence),
            "numbers_check": not self._has_too_many_numbers(sentence, words),
            "punctuation_check": not self._has_excessive_punctuation(sentence),
            "capitalization_check": not (sentence.isupper() or sentence.islower()),
            "language_check": self._passes_language_checks(sentence, words, lang),
            "wiki_artifacts_check": not self._has_wiki_artifacts(sentence),
        }

        passes = all(checks.values())
        failed_checks = [check for check, passed in checks.items() if not passed]

        return {
            "passes": passes,
            "checks": checks,
            "failed_checks": failed_checks,
            "sentence_length": len(sentence),
            "word_count": len(words),
        }

    def update_config(self, **kwargs):
        """Update configuration parameters."""
        for key, value in kwargs.items():
            if key in self.config:
                self.config[key] = value
            else:
                raise ValueError(f"Unknown configuration parameter: {key}")

    def get_config(self) -> dict:
        """Get current configuration."""
        return self.config.copy()


# Global instance for easy import
quality_checker = SentenceQualityChecker()
