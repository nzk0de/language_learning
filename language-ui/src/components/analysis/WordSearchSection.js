import { Search, Loader2 } from "lucide-react";
import { SpeechButton } from "../common/SpeechButton";
import { MessageDisplay } from "../common/MessageDisplay";
import { SectionCard } from "../common/SectionCard";
import { LanguagePairSelector } from "../common/LanguagePairSelector"; // <-- IMPORT THE NEW COMPONENT

export const WordSearchSection = ({
  searchState,
  setSearchState,
  learningLanguage,
  setLearningLanguage,
  languages,
  languageNames,
  loading,
  onSearch,
  searchResults,
  onOpenSentences,
  speechProps,
  message,
}) => {
  const { word, src, tgt } = searchState;

  // Handler for the new component to update the parent's state
  const handleLanguageChange = (newState) => {
    setSearchState((prev) => ({
      ...prev,
      src: newState.srcLang,
      tgt: newState.tgtLang,
    }));
  };

  return (
    <SectionCard
      title="Word Search & Translation"
      icon={<Search className="w-5 h-5" />}
    >
      <div className="space-y-4">
        {/* Learning Language Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Learning Language (Corpus):
          </label>
          <select
            value={learningLanguage}
            onChange={(e) => setLearningLanguage(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50"
            disabled={!languages || languages.length === 0}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {languageNames[lang] || lang}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={word}
          onChange={(e) =>
            setSearchState({ ...searchState, word: e.target.value })
          }
          placeholder="Enter word to translate and find examples..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          onKeyPress={(e) => e.key === "Enter" && onSearch()}
        />

        {/* --- REPLACED CODE --- */}
        <LanguagePairSelector
          state={{ srcLang: src, tgtLang: tgt }}
          onStateChange={handleLanguageChange}
          languages={languages}
          languageNames={languageNames}
        />
        {/* --- END OF REPLACED CODE --- */}

        <button
          onClick={onSearch}
          disabled={loading || !word.trim()}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
          Search & Translate
        </button>

        {searchResults?.examples?.length > 0 && (
          <div className="space-y-2 mt-4">
            {/* ... rest of the component remains the same ... */}
          </div>
        )}
        <MessageDisplay message={message} />
      </div>
    </SectionCard>
  );
};
