import { Search, ArrowRightLeft, Loader2 } from "lucide-react";
import { SpeechButton } from "../common/SpeechButton";
import { MessageDisplay } from "../common/MessageDisplay";
import { SectionCard } from "../common/SectionCard";

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

  const handleSwap = () => {
    setSearchState({ ...searchState, src: tgt, tgt: src });
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
            disabled={!languages}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang} - {languageNames[lang] || lang}
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

        <div className="flex items-end gap-2">
          {/* From Language */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From:
            </label>
            <select
              value={src}
              onChange={(e) =>
                setSearchState({ ...searchState, src: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={!languages}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang} - {languageNames[lang] || lang}
                </option>
              ))}
            </select>
          </div>
          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>
          {/* To Language */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To:
            </label>
            <select
              value={tgt}
              onChange={(e) =>
                setSearchState({ ...searchState, tgt: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={!languages}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang} - {languageNames[lang] || lang}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            <h3 className="font-medium text-gray-700">Examples:</h3>
            {searchResults.examples.map((example, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 rounded-lg border relative cursor-pointer hover:bg-gray-100"
                onClick={() =>
                  onOpenSentences(
                    searchResults.examples,
                    index,
                    learningLanguage,
                    tgt,
                    `Examples for "${word}"`
                  )
                }
              >
                <p className="text-gray-700 pr-16">
                  {example.sentence || example}
                </p>
                <div className="absolute top-2 right-2">
                  <SpeechButton
                    text={example.sentence || example}
                    language={learningLanguage}
                    {...speechProps}
                    colorScheme="indigo"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <MessageDisplay message={message} />
      </div>
    </SectionCard>
  );
};
