import React, { useState, useEffect } from "react";
import {
  Brain,
  Search,
  TrendingUp,
  Hash,
  BookOpen,
  Sparkles,
  Settings,
  Info,
  BarChart3,
  Target,
  Zap,
  Award,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

const EmbeddingsModal = ({ isOpen, onClose }) => {
  const [sentence, setSentence] = useState("");
  const [sortMethod, setSortMethod] = useState("frequency");
  const [topK, setTopK] = useState(10);
  const [language, setLanguage] = useState("de");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortMethods, setSortMethods] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  const API_BASE = "http://localhost:8000";

  // Load available sort methods
  useEffect(() => {
    const fetchSortMethods = async () => {
      try {
        const response = await fetch(`${API_BASE}/embeddings/sort-methods`);
        const data = await response.json();
        if (data.sort_methods) {
          setSortMethods(data.sort_methods);
        }
      } catch (error) {
        console.error("Error fetching sort methods:", error);
        // Fallback sort methods
        setSortMethods([
          {
            value: "frequency",
            label: "Frequency",
            description: "Raw word frequency",
          },
          {
            value: "lorentzian",
            label: "Lorentzian",
            description: "Balanced frequency",
          },
          {
            value: "combined",
            label: "Combined",
            description: "Combined score",
          },
        ]);
      }
    };

    if (isOpen) {
      fetchSortMethods();
    }
  }, [isOpen]);

  const analyzeText = async () => {
    if (!sentence.trim()) return;

    setLoading(true);
    try {
      const requestBody = {
        sentence: sentence,
        sort_method: sortMethod,
        k: topK,
        language: language,
      };

      const response = await fetch(`${API_BASE}/embeddings/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Error analyzing text:", error);
      setResults({
        success: false,
        error: "Failed to analyze sentence. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      analyzeText();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getScoreColor = (score, maxScore) => {
    const ratio = score / maxScore;
    if (ratio > 0.8) return "text-red-600 bg-red-50";
    if (ratio > 0.6) return "text-orange-600 bg-orange-50";
    if (ratio > 0.4) return "text-yellow-600 bg-yellow-50";
    if (ratio > 0.2) return "text-green-600 bg-green-50";
    return "text-blue-600 bg-blue-50";
  };

  const getPosIcon = (pos) => {
    const icons = {
      NOUN: "🏷️",
      VERB: "⚡",
      ADJ: "🎨",
      ADV: "📏",
    };
    return icons[pos] || "📝";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">
                  Word Commonality Analyzer
                </h2>
                <p className="text-purple-100">
                  Discover words most similar to your sentence
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row h-full">
          {/* Input Panel */}
          <div className="lg:w-1/2 p-6 border-r border-gray-200">
            <div className="space-y-6">
              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your sentence:
                </label>
                <textarea
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type any German sentence to analyze its word commonality..."
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={4}
                />
              </div>

              {/* Settings Toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Advanced Settings</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showSettings ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Advanced Settings */}
              {showSettings && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Sort Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sort Method:
                      </label>
                      <select
                        value={sortMethod}
                        onChange={(e) => setSortMethod(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      >
                        {sortMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                      {sortMethods.find((m) => m.value === sortMethod) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {
                            sortMethods.find((m) => m.value === sortMethod)
                              .description
                          }
                        </p>
                      )}
                    </div>

                    {/* Top K */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Top Words:
                      </label>
                      <input
                        type="number"
                        value={topK}
                        onChange={(e) =>
                          setTopK(parseInt(e.target.value) || 10)
                        }
                        min="1"
                        max="50"
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language:
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="de">🇩🇪 German</option>
                      <option value="en">🇺🇸 English</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Analyze Button */}
              <button
                onClick={analyzeText}
                disabled={loading || !sentence.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {loading ? "Analyzing..." : "Analyze Commonality"}
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:w-1/2 p-6 overflow-y-auto">
            {!results ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <Brain className="w-16 h-16 mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
                <p>
                  Enter a sentence and click "Analyze Commonality" to see which
                  words are most common in your corpus.
                </p>
              </div>
            ) : results.success ? (
              <div className="space-y-6">
                {/* Analysis Summary */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">
                      Analysis Results
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Words found:</span>
                      <span className="ml-2 font-medium">
                        {results.total_lemmas_found}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unique words:</span>
                      <span className="ml-2 font-medium">
                        {results.unique_lemmas_count}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Sort method:</span>
                      <span className="ml-2 font-medium capitalize">
                        {results.sort_method}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Average frequency:</span>
                      <span className="ml-2 font-medium">
                        {Math.round(
                          results.analysis_summary?.average_frequency || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Common Words List */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Most Common Words
                  </h4>

                  {results.common_words.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No common words found matching the criteria.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.common_words.map((word, index) => {
                        const maxFreq = Math.max(
                          ...results.common_words.map((w) => w.frequency)
                        );
                        const scoreColor = getScoreColor(
                          word.frequency,
                          maxFreq
                        );

                        return (
                          <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">
                                    {getPosIcon(word.pos)}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-lg text-gray-800">
                                        {word.lemma}
                                      </span>
                                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        {word.pos}
                                      </span>
                                    </div>
                                    {word.translation_en && (
                                      <p className="text-sm text-blue-600">
                                        → {word.translation_en}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div
                                    className={`px-3 py-1 rounded-full text-sm font-medium ${scoreColor}`}
                                  >
                                    {word.frequency.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Rank #{index + 1}
                                  </div>
                                </div>

                                <button
                                  onClick={() => copyToClipboard(word.lemma)}
                                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Copy word"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Score breakdown for combined/lorentzian */}
                            {(results.sort_method === "lorentzian" ||
                              results.sort_method === "combined") && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>Frequency: {word.frequency}</span>
                                  {word.lorentzian && (
                                    <span>
                                      Lorentzian: {word.lorentzian.toFixed(2)}
                                    </span>
                                  )}
                                  {word.combined && (
                                    <span>
                                      Combined: {word.combined.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Lemmas Found */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    All Words Found
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {results.lemmas_found.map((lemma, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm hover:bg-gray-200 cursor-pointer transition-colors"
                        onClick={() => copyToClipboard(lemma)}
                        title="Click to copy"
                      >
                        {lemma}
                        {results.lemma_frequencies_in_sentence[lemma] > 1 && (
                          <span className="ml-1 text-xs text-gray-500">
                            ×{results.lemma_frequencies_in_sentence[lemma]}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-red-50 p-6 rounded-lg">
                  <div className="text-red-600 mb-2">
                    <Target className="w-12 h-12 mx-auto" />
                  </div>
                  <h3 className="font-medium text-red-800 mb-2">
                    Analysis Error
                  </h3>
                  <p className="text-red-600 text-sm">
                    {results.error ||
                      results.message ||
                      "Failed to analyze the sentence"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddingsModal;
