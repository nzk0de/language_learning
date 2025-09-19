import { BarChart3, Loader2, Eye } from "lucide-react";
import { SectionCard } from "../common/SectionCard";
import { MessageDisplay } from "../common/MessageDisplay";

export const WordFrequencySection = ({
  frequencyState,
  setFrequencyState,
  languages,
  languageNames,
  posTags,
  onAnalyze,
  onWordClick,
  loading,
  results,
  message,
}) => {
  const { lang, posTag, startRank, endRank } = frequencyState;

  const handleInputChange = (field, value) => {
    // Ensure rank values are numbers
    const isRankField = field === "startRank" || field === "endRank";
    const finalValue = isRankField ? parseInt(value, 10) || 0 : value;
    setFrequencyState((prev) => ({ ...prev, [field]: finalValue }));
  };

  return (
    <SectionCard
      title="Word Frequency Analysis"
      icon={<BarChart3 className="w-5 h-5" />}
    >
      <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-700">
          <strong>How it works:</strong> Analyzes the most frequent words by
          part of speech (POS) in your corpus. Click any word to see examples.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Language:
          </label>
          <select
            value={lang}
            onChange={(e) => handleInputChange("lang", e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            disabled={!languages.length}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {languageNames[l] || l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Part of Speech:
          </label>
          <select
            value={posTag}
            onChange={(e) => handleInputChange("posTag", e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            disabled={!posTags.length}
          >
            {(posTags || []).map((tag) => (
              <option
                key={tag.pos_tag}
                value={tag.pos_tag}
              >{`${tag.pos_tag} - ${tag.description}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Rank:
          </label>
          <input
            type="number"
            value={startRank}
            onChange={(e) => handleInputChange("startRank", e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Rank:
          </label>
          <input
            type="number"
            value={endRank}
            onChange={(e) => handleInputChange("endRank", e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={loading}
        className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <BarChart3 className="w-5 h-5" />
        )}
        Analyze Word Frequency
      </button>

      {results && (
        <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500 mt-4">
          <h3 className="font-medium text-gray-800 mb-3">
            Most Frequent {posTag} Words (Ranks {startRank}-{endRank}):
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {results.map((wordData, index) => (
              <button
                key={index}
                onClick={() => onWordClick(wordData.word)}
                className="flex items-center justify-between p-2 bg-white rounded border hover:bg-orange-100 hover:border-orange-300 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate block">
                    {wordData.word}
                  </span>
                  <span className="text-xs text-gray-500">
                    #{wordData.rank} • {wordData.count} times
                  </span>
                </div>
                <Eye className="w-4 h-4 text-gray-400 group-hover:text-orange-600 flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}
      <MessageDisplay message={message} />
    </SectionCard>
  );
};
