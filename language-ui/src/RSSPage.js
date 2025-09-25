import React, { useState, useEffect } from "react";
import {
  Globe,
  RefreshCw,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  BookOpen,
} from "lucide-react";

const RSSPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingNew, setFetchingNew] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [limit, setLimit] = useState(20);
  const [lastFetch, setLastFetch] = useState(null);

  const API_BASE = "http://localhost:8000";

  const fetchArticles = async (
    language = selectedLanguage,
    articleLimit = limit
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (language) params.append("language", language);
      params.append("limit", articleLimit);

      const response = await fetch(`${API_BASE}/rss/articles?${params}`);
      const data = await response.json();

      if (response.ok) {
        setArticles(data.articles);
        setLastFetch(new Date().toLocaleString());
      } else {
        console.error("Failed to fetch articles:", data);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  };

  const triggerFetch = async () => {
    setFetchingNew(true);
    try {
      const response = await fetch(`${API_BASE}/rss/fetch`, { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        // Refresh the articles list after successful fetch
        await fetchArticles();
        alert(`Successfully fetched ${data.total_stored} new articles!`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error triggering fetch:", error);
      alert("Error triggering RSS fetch");
    } finally {
      setFetchingNew(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return "Unknown date";
    }
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const getLanguageFlag = (lang) => {
    const flags = {
      de: "🇩🇪",
      en: "🇺🇸",
      es: "🇪🇸",
      fr: "🇫🇷",
      it: "🇮🇹",
    };
    return flags[lang] || "🌍";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">RSS News Feed</h1>
          </div>
          <p className="text-gray-600">
            Latest news articles for language learning
          </p>
        </header>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Languages</option>
                <option value="de">🇩🇪 German (de)</option>
                <option value="en">🇺🇸 English (en)</option>
                <option value="es">🇪🇸 Spanish (es)</option>
                <option value="fr">🇫🇷 French (fr)</option>
              </select>

              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={10}>10 articles</option>
                <option value={20}>20 articles</option>
                <option value={50}>50 articles</option>
                <option value={100}>100 articles</option>
              </select>

              <button
                onClick={() => fetchArticles()}
                disabled={loading}
                className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-4">
              {lastFetch && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>Last updated: {lastFetch}</span>
                </div>
              )}

              <button
                onClick={triggerFetch}
                disabled={fetchingNew}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {fetchingNew ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Fetch New
              </button>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-4">
          {loading && articles.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
              <p className="text-gray-600">Loading articles...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">
                No articles found. Try fetching new articles or changing
                filters.
              </p>
            </div>
          ) : (
            articles.map((article, index) => (
              <div
                key={article.id || index}
                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getLanguageFlag(article.language)}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-indigo-600 uppercase tracking-wide">
                        {article.language}
                      </span>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(article.published)}</span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Open original article"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                  {article.title}
                </h2>

                <p className="text-gray-700 mb-4 leading-relaxed">
                  {truncateText(
                    article.description || article.summary || article.content
                  )}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    {article.author && <span>By {article.author}</span>}
                    {article.categories && article.categories.length > 0 && (
                      <span className="ml-2">
                        {article.categories.slice(0, 2).map((cat) => (
                          <span
                            key={cat}
                            className="inline-block bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs mr-1"
                          >
                            {cat}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      // Future: Open in reading mode or translate
                      alert("Reading mode coming soon!");
                    }}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm"
                  >
                    Read & Learn
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        {articles.length > 0 && articles.length >= limit && (
          <div className="text-center mt-8">
            <button
              onClick={() => fetchArticles(selectedLanguage, limit + 20)}
              disabled={loading}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              Load More Articles
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RSSPage;
