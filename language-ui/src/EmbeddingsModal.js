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
import { buildApiUrl } from "./config/api";

const EmbeddingsModal = ({ isOpen, onClose }) => {
  const [sentence, setSentence] = useState("");
  const [sortMethod, setSortMethod] = useState("frequency");
  const [topK, setTopK] = useState(10);
  const [language, setLanguage] = useState("de");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortMethods, setSortMethods] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // ... (useEffect and other functions remain the same) ...
  // Load available sort methods
  useEffect(() => {
    const fetchSortMethods = async () => {
      try {
        const response = await fetch(buildApiUrl("embeddings/sort-methods"));
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

      const response = await fetch(buildApiUrl("embeddings/analyze"), {
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
      {/* 
        CHANGE 1: Make this main card a flex container with a column direction.
        This allows us to make the content area below the header grow to fill available space.
      */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - This will now be a non-growing flex item */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex-shrink-0">
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

        {/* 
          CHANGE 2: Make this content area grow to fill the remaining space.
          `flex-1` makes it take up all available vertical space.
          `min-h-0` is a crucial flexbox fix that allows its children to scroll properly.
        */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Input Panel */}
          <div className="lg:w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
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

          {/* Results Panel - The inner structure here was already correct! */}
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
              <div className="flex flex-col h-full">
                {/* Analysis Summary - Fixed at top */}
                <div className="flex-shrink-0 mb-4">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-green-800">
                          Found {results.common_words.length} similar words
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Sorted by:{" "}
                        <span className="font-medium capitalize">
                          {results.sort_method}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header - Fixed */}
                <div className="flex-shrink-0 mb-3">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Most Similar Words
                  </h4>
                </div>

                {/* Scrollable Words List - This part will now work correctly */}
                <div className="flex-1 min-h-0">
                  {results.common_words.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No similar words found matching the criteria.</p>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {results.common_words.map((word, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors flex-shrink-0"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm flex-shrink-0">
                              {getPosIcon(word.pos)}
                            </span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-gray-800 flex-shrink-0">
                                {word.lemma}
                              </span>
                              {word.translation_en && (
                                <span className="text-sm text-blue-600 truncate">
                                  → {word.translation_en}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">
                              #{index + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {word.frequency.toLocaleString()}
                            </span>
                            <button
                              onClick={() => copyToClipboard(word.lemma)}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                              title="Copy"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ... (Error handling remains the same) ...
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
