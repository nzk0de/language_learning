import { useState, useMemo } from "react";
import { useSpeech } from "./hooks/useSpeech";
import { useDataFetching } from "./hooks/useDataFetching";
import { WordSearchSection } from "./components/analysis/WordSearchSection";
import { WordFrequencySection } from "./components/analysis/WordFrequencySection";
import { SentencesModal } from "./components/modals/SentencesModal";
import ReadingViewModal from "./components/modals/ReadingViewModal";
import EmbeddingsModal from "./EmbeddingsModal";

const API_BASE = "http://localhost:8000";

const PlayGround = () => {
  // --- Hooks ---
  const speechProps = useSpeech();
  const { data: languagesData, loading: languagesLoading } =
    useDataFetching("/languages");
  const { data: posTagsData, loading: posTagsLoading } =
    useDataFetching("/pos_tags");

  // --- Memoized Data ---
  const languages = useMemo(
    () => Object.keys(languagesData?.languages || {}),
    [languagesData]
  );
  const languageNames = useMemo(
    () => languagesData?.languages || {},
    [languagesData]
  );
  const posTags = useMemo(() => posTagsData?.pos_tags || [], [posTagsData]);

  // --- State for UI components ---
  const [learningLanguage, setLearningLanguage] = useState("de");
  const [searchState, setSearchState] = useState({
    word: "",
    src: "en",
    tgt: "de",
  });
  const [frequencyState, setFrequencyState] = useState({
    lang: "de",
    posTag: "NOUN",
    startRank: 1,
    endRank: 20,
  });

  // --- State for API responses and loading ---
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);

  const [frequencyResults, setFrequencyResults] = useState(null);
  const [frequencyLoading, setFrequencyLoading] = useState(false);
  const [frequencyMessage, setFrequencyMessage] = useState(null);

  // --- State specifically for the Sentences Modal ---
  const [sentencesModal, setSentencesModal] = useState({
    isOpen: false,
    sentences: [],
    translations: {},
    srcLang: "",
    tgtLang: "",
    title: "",
  });
  const [modalTranslatedWord, setModalTranslatedWord] = useState(null);
  const [modalWordLoading, setModalWordLoading] = useState(false);

  // --- Reading View Modal State ---
  const [readingView, setReadingView] = useState({ isOpen: false });

  // --- Embeddings Modal State ---
  const [showEmbeddingsModal, setShowEmbeddingsModal] = useState(false);

  // --- Main Search Handler (Progressive Enhancement Pattern) ---
  const handleTranslateSearch = async () => {
    if (!searchState.word.trim()) return;

    // Reset states for a new search
    setSearchLoading(true);
    setModalWordLoading(true);
    setSearchMessage(null);
    setSearchResults(null);
    setModalTranslatedWord(null);

    const { word, src, tgt } = searchState;
    let wordToSearchInCorpus = word;

    // Step 1: Determine the correct word to search for in the corpus.
    // If the source language isn't the corpus language, we must translate first.
    // This is a necessary sequential step before parallel fetching can begin.
    if (src !== learningLanguage) {
      try {
        const url = `${API_BASE}/translate/word?word=${encodeURIComponent(
          word
        )}&src_lang=${src}&tgt_lang=${learningLanguage}`;
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.detail || "Translation for search failed");
        wordToSearchInCorpus = data.translated_word;
      } catch (error) {
        setSearchMessage({
          message: `Could not translate "${word}" to ${learningLanguage.toUpperCase()} to perform search: ${
            error.message
          }`,
          type: "error",
        });
        setSearchLoading(false);
        setModalWordLoading(false);
        return;
      }
    }

    // Step 2: Now that we have the correct search term, run fetches in parallel.
    const fetchExamplesPromise = fetch(
      `${API_BASE}/search/examples?word=${encodeURIComponent(
        wordToSearchInCorpus
      )}&corpus_lang=${learningLanguage}&limit=10`
    );
    const translateWordPromise =
      src === tgt
        ? Promise.resolve(null)
        : fetch(
            `${API_BASE}/translate/word?word=${encodeURIComponent(
              word
            )}&src_lang=${src}&tgt_lang=${tgt}`
          );

    try {
      const [examplesResponse, translationResponse] = await Promise.all([
        fetchExamplesPromise,
        translateWordPromise,
      ]);

      // Process examples response (fast part)
      const examplesData = await examplesResponse.json();
      if (!examplesResponse.ok)
        throw new Error(examplesData.detail || "Failed to fetch examples.");

      setSearchResults(examplesData);
      if (examplesData.examples?.length > 0) {
        openSentencesModal(
          examplesData.examples,
          0,
          learningLanguage,
          tgt,
          `Examples for "${word}"`
        );
      } else {
        setSearchMessage({
          message: `No examples found for "${wordToSearchInCorpus}" in your corpus.`,
          type: "info",
        });
      }

      // Process translation response (slow part)
      if (translationResponse) {
        // Will be null if src === tgt
        const translationData = await translationResponse.json();
        if (!translationResponse.ok)
          throw new Error(
            translationData.detail || "Failed to translate word."
          );
        setModalTranslatedWord(translationData.translated_word);
      } else {
        setModalTranslatedWord(word); // If no translation needed, use original word
      }
    } catch (error) {
      setSearchMessage({ message: error.message, type: "error" });
    } finally {
      setSearchLoading(false);
      setModalWordLoading(false);
    }
  };

  // --- Other Handlers ---
  const handleWordFrequency = async () => {
    setFrequencyLoading(true);
    setFrequencyMessage(null);
    try {
      const { lang, posTag, startRank, endRank } = frequencyState;
      const url = `${API_BASE}/word_frequency/${posTag}?lang=${lang}&start_rank=${startRank}&end_rank=${endRank}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Failed to fetch frequency data.");
      setFrequencyResults(data);
      setFrequencyMessage({
        message: `Loaded ${data.results?.length || 0} words.`,
        type: "success",
      });
    } catch (error) {
      setFrequencyMessage({ message: error.message, type: "error" });
    } finally {
      setFrequencyLoading(false);
    }
  };

  const handleWordClick = async (clickedWord) => {
    setModalWordLoading(true); // Re-use modal loading indicator
    setModalTranslatedWord(null);

    const { lang } = frequencyState;

    // Use the same parallel fetch pattern
    const fetchExamplesPromise = fetch(
      `${API_BASE}/search/examples?word=${encodeURIComponent(
        clickedWord
      )}&corpus_lang=${lang}&limit=10`
    );
    const translateWordPromise = fetch(
      `${API_BASE}/translate/word?word=${encodeURIComponent(
        clickedWord
      )}&src_lang=${lang}&tgt_lang=en`
    );

    try {
      const [examplesResponse, translationResponse] = await Promise.all([
        fetchExamplesPromise,
        translateWordPromise,
      ]);

      const examplesData = await examplesResponse.json();
      if (!examplesResponse.ok) throw new Error(examplesData.detail);
      if (examplesData.examples?.length > 0) {
        openSentencesModal(
          examplesData.examples,
          0,
          lang,
          "en",
          `Examples for "${clickedWord}"`
        );
      } else {
        // Show a message if no examples found from word click
        setSearchMessage({
          message: `No examples found for "${clickedWord}"`,
          type: "info",
        });
      }

      const translationData = await translationResponse.json();
      if (!translationResponse.ok) throw new Error(translationData.detail);
      setModalTranslatedWord(translationData.translated_word);
    } catch (error) {
      setSearchMessage({ message: error.message, type: "error" });
    } finally {
      setModalWordLoading(false);
    }
  };

  // --- Modal Functions ---
  const openSentencesModal = (sentences, idx, srcLang, tgtLang, title) => {
    const processedSentences = sentences.map((s) => s.sentence || String(s));
    setSentencesModal({
      isOpen: true,
      sentences: processedSentences,
      translations: {},
      srcLang,
      tgtLang,
      title,
    });
  };

  const closeSentencesModal = () =>
    setSentencesModal((prev) => ({ ...prev, isOpen: false }));

  const translateSentenceInModal = async (index) => {
    const { sentences, srcLang, tgtLang } = sentencesModal;
    const sentenceToTranslate = sentences[index].replace(/<[^>]*>/g, "");

    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sentenceToTranslate,
          src_lang: srcLang,
          tgt_lang: tgtLang,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Translation failed.");
      setSentencesModal((prev) => ({
        ...prev,
        translations: { ...prev.translations, [index]: data.translation },
      }));
    } catch (error) {
      console.error("Sentence translation failed:", error);
      // Optionally, update the UI to show the error for that specific sentence
      setSentencesModal((prev) => ({
        ...prev,
        translations: {
          ...prev.translations,
          [index]: `[Error: ${error.message}]`,
        },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Playground</h1>
          <p className="text-gray-600">Explore your learning corpus</p>
        </div>
        <div className="space-y-6">
          <WordSearchSection
            searchState={searchState}
            setSearchState={setSearchState}
            learningLanguage={learningLanguage}
            setLearningLanguage={setLearningLanguage}
            languages={languages}
            languageNames={languageNames}
            loading={searchLoading || languagesLoading}
            onSearch={handleTranslateSearch}
            searchResults={searchResults} // Keep this for potential future use (e.g., display if modal is closed)
            onOpenSentences={(sentences, idx) =>
              openSentencesModal(
                sentences,
                idx,
                learningLanguage,
                searchState.tgt,
                `Examples for "${searchState.word}"`
              )
            }
            speechProps={speechProps}
            message={searchMessage}
          />
          <WordFrequencySection
            frequencyState={frequencyState}
            setFrequencyState={setFrequencyState}
            languages={languages}
            languageNames={languageNames}
            posTags={posTags}
            onAnalyze={handleWordFrequency}
            onWordClick={handleWordClick}
            results={frequencyResults?.results}
            message={frequencyMessage}
            loading={frequencyLoading || posTagsLoading}
          />

          {/* Embeddings Analysis Section */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-lg shadow-md">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Word Commonality Analyzer
                </h3>
                <p className="text-gray-600">
                  Discover words most similar to your sentence
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <svg
                  className="w-4 h-4 text-purple-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">How it works:</span>
              </div>
              <p className="text-sm text-gray-600">
                Enter any German sentence to analyze which words are most common
                in your corpus. Uses advanced NLP processing and embeddings to
                rank words by frequency, Lorentzian scoring, or combined
                metrics.
              </p>
            </div>

            <button
              onClick={() => setShowEmbeddingsModal(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Analyze Text Commonality
            </button>
          </div>
        </div>
      </div>
      <SentencesModal
        modalState={sentencesModal}
        closeModal={closeSentencesModal}
        onTranslate={translateSentenceInModal}
        speechProps={speechProps}
        translatedWord={modalTranslatedWord}
        isTranslatingWord={modalWordLoading}
      />
      <ReadingViewModal
        readingView={readingView}
        closeReadingView={() => setReadingView({ isOpen: false })}
        languageNames={languageNames}
        {...speechProps}
      />
      <EmbeddingsModal
        isOpen={showEmbeddingsModal}
        onClose={() => setShowEmbeddingsModal(false)}
      />
    </div>
  );
};

export default PlayGround;
