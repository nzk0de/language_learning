import { useState, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useSpeech } from "./hooks/useSpeech";
import { useDataFetching } from "./hooks/useDataFetching";
import { WordSearchSection } from "./components/analysis/WordSearchSection";
import { WordFrequencySection } from "./components/analysis/WordFrequencySection";
import { SentencesModal } from "./components/modals/SentencesModal";
import ReadingViewModal from "./components/modals/ReadingViewModal";

const API_BASE = "http://localhost:8000";

const AnalysisPage = () => {
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

  // --- STATE GROUP 1: Word Search & Translation Section ---
  const [learningLanguage, setLearningLanguage] = useState("de");
  const [searchState, setSearchState] = useState({
    word: "",
    src: "en",
    tgt: "de",
  });
  const [searchResults, setSearchResults] = useState(null); // Results from the main search bar
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);

  // --- STATE GROUP 2: Word Frequency Section ---
  const [frequencyState, setFrequencyState] = useState({
    lang: "de",
    posTag: "NOUN",
    startRank: 1,
    endRank: 20,
  });
  const [frequencyResults, setFrequencyResults] = useState(null); // The list of frequent words
  const [frequencyLoading, setFrequencyLoading] = useState(false);
  const [frequencyMessage, setFrequencyMessage] = useState(null);

  // --- STATE GROUP 3: Word Click Examples (from Frequency Section) ---
  // This state is now separate and will not affect the main search bar's results.
  const [wordClickResults, setWordClickResults] = useState(null);
  const [wordClickLoading, setWordClickLoading] = useState(false);
  const [wordClickMessage, setWordClickMessage] = useState(null);

  // --- STATE GROUP 4: Modals ---
  const [sentencesModal, setSentencesModal] = useState({
    isOpen: false,
    sentences: [],
    translations: {},
    srcLang: "",
    tgtLang: "",
    title: "",
  });
  const [readingView, setReadingView] = useState({ isOpen: false });

  // --- API & Modal Logic ---

  // Generic API handler remains the same
  const handleApiCall = async (
    url,
    setLoading,
    setResults,
    setMessage,
    successMsgFn
  ) => {
    setLoading(true);
    setMessage(null);
    setResults(null);
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
      if (setMessage && successMsgFn) {
        setMessage({ message: successMsgFn(data), type: "success" });
      }
    } catch (error) {
      if (setMessage) {
        setMessage({ message: error.message, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handler for the main search bar
  const handleTranslateSearch = () => {
    if (!searchState.word.trim()) return;
    const url = `${API_BASE}/translate_search?word=${encodeURIComponent(
      searchState.word
    )}&src_lang=${searchState.src}&tgt_lang=${
      searchState.tgt
    }&corpus_lang=${learningLanguage}&limit=10`;
    handleApiCall(
      url,
      setSearchLoading,
      setSearchResults,
      setSearchMessage,
      (data) => `Found ${data.examples?.length || 0} examples.`
    );
  };

  // Handler for the frequency analysis button
  const handleWordFrequency = () => {
    const { lang, posTag, startRank, endRank } = frequencyState;
    const url = `${API_BASE}/word_frequency/${posTag}?lang=${lang}&start_rank=${startRank}&end_rank=${endRank}`;
    handleApiCall(
      url,
      setFrequencyLoading,
      setFrequencyResults,
      setFrequencyMessage,
      (data) => `Loaded ${data.results?.length || 0} words.`
    );
  };

  // *** UPDATED: Handler for clicking a word in the frequency list ***
  const handleWordClick = (word) => {
    const url = `${API_BASE}/translate_search?word=${encodeURIComponent(
      word
    )}&src_lang=${frequencyState.lang}&tgt_lang=en&corpus_lang=${
      frequencyState.lang
    }&limit=10`;

    // This now uses its own dedicated state setters
    handleApiCall(
      url,
      setWordClickLoading,
      setWordClickResults,
      setWordClickMessage,
      (data) => {
        if (data.examples?.length > 0) {
          // Open the modal with the new, separate results
          openSentencesModal(
            data.examples,
            0,
            frequencyState.lang,
            "en",
            `Examples for "${word}"`
          );
        }
        // Returning a message is optional here as it's not displayed anywhere, but good practice
        return `Found ${data.examples?.length || 0} examples for "${word}".`;
      }
    );
  };

  // Modal functions remain the same, they are generic enough to handle any data source
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
    // This function is self-contained and needs no changes
    const { sentences, translations, srcLang, tgtLang } = sentencesModal;
    const sentenceToTranslate = sentences[index].replace(/<[^>]*>/g, "");
    if (!sentenceToTranslate || translations[index]) return;
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
      if (data.translation) {
        setSentencesModal((prev) => ({
          ...prev,
          translations: { ...prev.translations, [index]: data.translation },
        }));
      } else {
        throw new Error(data.error || "Translation failed");
      }
    } catch (error) {
      console.error("Sentence translation failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Analysis & Research</h1>
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
            searchResults={searchResults} // This section only cares about its own results
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
            loading={frequencyLoading || posTagsLoading || wordClickLoading} // Show loading if fetching examples
          />
        </div>
      </div>

      <SentencesModal
        modalState={sentencesModal}
        closeModal={closeSentencesModal}
        onTranslate={translateSentenceInModal}
        speechProps={speechProps}
      />

      <ReadingViewModal
        readingView={readingView}
        closeReadingView={() => setReadingView({ isOpen: false })}
        languageNames={languageNames}
        {...speechProps}
      />
    </div>
  );
};

export default AnalysisPage;
