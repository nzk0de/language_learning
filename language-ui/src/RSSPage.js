import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Globe,
  RefreshCw,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  BookOpen,
  Search,
  Filter,
  TrendingUp,
  Calendar,
  User,
  Tag,
  Eye,
  Volume2,
  ChevronDown,
  Star,
  Bookmark,
  Share2,
  Copy,
  Check,
  Rss,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Languages,
  MessageSquare,
  Heart,
} from "lucide-react";
import "./RSSPageStyles.css";
import { buildApiUrl } from "./config/api";

const RSSPage = () => {
  // Core state
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingNew, setFetchingNew] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // UI state
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(new Set());

  // Interactive state
  const [bookmarkedArticles, setBookmarkedArticles] = useState(new Set());
  const [likedArticles, setLikedArticles] = useState(new Set());
  const [copiedLink, setCopiedLink] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Intersection Observer for infinite scroll
  const observer = useRef();
  const lastArticleElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMoreArticles();
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  // Languages with flags and names
  const languages = [
    { code: "", name: "All Languages", flag: "🌍" },
    { code: "de", name: "German", flag: "🇩🇪" },
    { code: "en", name: "English", flag: "🇺🇸" },
    { code: "es", name: "Spanish", flag: "🇪🇸" },
    { code: "fr", name: "French", flag: "🇫🇷" },
    { code: "it", name: "Italian", flag: "🇮🇹" },
  ];

  // Fetch articles
  const fetchArticles = async (isLoadMore = false) => {
    setLoading(true);
    try {
      const currentOffset = isLoadMore ? offset : 0;
      const params = new URLSearchParams({
        limit: limit,
        offset: currentOffset,
        ...(selectedLanguage && { language: selectedLanguage }),
      });

      const response = await fetch(buildApiUrl(`rss/articles?${params}`));
      const data = await response.json();

      if (response.ok) {
        const newArticles = data.articles || [];

        if (isLoadMore) {
          setArticles((prev) => [...prev, ...newArticles]);
        } else {
          setArticles(newArticles);
          setOffset(0);
        }

        setHasMore(newArticles.length === limit);
        setOffset((prev) => (isLoadMore ? prev + limit : limit));
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

  const loadMoreArticles = () => {
    if (!loading && hasMore) {
      fetchArticles(true);
    }
  };

  // Trigger RSS fetch
  const triggerFetch = async () => {
    setFetchingNew(true);
    try {
      const response = await fetch(buildApiUrl("rss/fetch"), { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        await fetchArticles();
        alert(
          `Successfully fetched ${
            data.results?.totals?.rss_articles_stored || 0
          } new articles!`
        );
      } else {
        alert(`Error: ${data.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error triggering fetch:", error);
      alert("Error triggering RSS fetch");
    } finally {
      setFetchingNew(false);
    }
  };

  // Filtering and sorting
  useEffect(() => {
    let filtered = [...articles];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (article) =>
          article.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          article.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter((article) =>
        article.categories?.some((cat) => selectedCategories.has(cat))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "title":
          aValue = a.title || "";
          bValue = b.title || "";
          break;
        case "author":
          aValue = a.author || "";
          bValue = b.author || "";
          break;
        case "date":
        default:
          aValue = new Date(a.published || a.fetched_at);
          bValue = new Date(b.published || b.fetched_at);
          break;
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredArticles(filtered);
  }, [articles, searchQuery, selectedCategories, sortBy, sortOrder]);

  // Get unique categories
  const allCategories = [
    ...new Set(articles.flatMap((article) => article.categories || [])),
  ];

  // Utility functions
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  };

  const truncateText = (text, maxLength = 150) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const getLanguageInfo = (langCode) => {
    const lang = languages.find((l) => l.code === langCode);
    return lang || { code: langCode, name: langCode, flag: "🌍" };
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const toggleBookmark = (articleId) => {
    setBookmarkedArticles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const toggleLike = (articleId) => {
    setLikedArticles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const toggleCategory = (category) => {
    setSelectedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const speakText = (text, language) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "de" ? "de-DE" : "en-US";
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Initialize
  useEffect(() => {
    fetchArticles();
  }, [selectedLanguage]);

  // Article Card Component
  const ArticleCard = ({ article, index }) => {
    const langInfo = getLanguageInfo(article.language);
    const isBookmarked = bookmarkedArticles.has(article.id);
    const isLiked = likedArticles.has(article.id);
    const isLastArticle = index === filteredArticles.length - 1;

    return (
      <div
        ref={isLastArticle ? lastArticleElementRef : null}
        className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
          viewMode === "grid" ? "p-6" : "p-4 flex gap-4 items-start"
        }`}
      >
        {/* Header */}
        <div className={`${viewMode === "list" ? "flex-1" : ""}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{langInfo.flag}</span>
                <div>
                  <span className="text-sm font-medium text-indigo-600 uppercase tracking-wide">
                    {langInfo.name}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(article.published)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1">
              <button
                onClick={() => toggleLike(article.id)}
                className={`p-2 rounded-lg transition-colors ${
                  isLiked
                    ? "text-red-500 bg-red-50"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                }`}
                title="Like article"
              >
                <Heart
                  className="w-4 h-4"
                  fill={isLiked ? "currentColor" : "none"}
                />
              </button>

              <button
                onClick={() => toggleBookmark(article.id)}
                className={`p-2 rounded-lg transition-colors ${
                  isBookmarked
                    ? "text-yellow-500 bg-yellow-50"
                    : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
                }`}
                title="Bookmark article"
              >
                <Bookmark
                  className="w-4 h-4"
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </button>

              <button
                onClick={() => copyLink(article.link)}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Copy link"
              >
                {copiedLink === article.link ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={() =>
                  speakText(
                    article.title + ". " + article.description,
                    article.language
                  )
                }
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Listen"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Open original"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Title */}
          <h2
            className={`font-bold text-gray-900 mb-3 leading-tight ${
              viewMode === "grid" ? "text-xl" : "text-lg"
            }`}
          >
            {article.title}
          </h2>

          {/* Content */}
          <p
            className={`text-gray-700 leading-relaxed mb-4 ${
              viewMode === "grid" ? "" : "text-sm"
            }`}
          >
            {truncateText(
              article.description || article.summary || article.content,
              viewMode === "grid" ? 200 : 120
            )}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              {article.author && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{article.author}</span>
                </div>
              )}

              {article.categories && article.categories.length > 0 && (
                <div className="flex gap-1">
                  {article.categories.slice(0, 2).map((cat) => (
                    <span
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="inline-flex items-center gap-1 bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors"
                    >
                      <Tag className="w-2 h-2" />
                      {cat}
                    </span>
                  ))}
                  {article.categories.length > 2 && (
                    <span className="text-gray-400 text-xs">
                      +{article.categories.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => alert("Reading mode coming soon!")}
              className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 text-sm font-medium flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Learn
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Rss className="w-8 h-8 text-indigo-600 animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Language Learning News
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Discover and learn from authentic news content in multiple languages
          </p>
        </header>

        {/* Controls Bar */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 sticky top-4 z-10">
          {/* Top Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, topics, or keywords..."
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50"
              />
            </div>

            {/* View Mode & Actions */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded ${
                    viewMode === "grid" ? "bg-white shadow-sm" : "text-gray-500"
                  }`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded ${
                    viewMode === "list" ? "bg-white shadow-sm" : "text-gray-500"
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${
                  showFilters
                    ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Fetch New */}
              <button
                onClick={triggerFetch}
                disabled={fetchingNew}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 font-medium"
              >
                {fetchingNew ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Fetch Latest
              </button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Language Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      <option value="author">Author</option>
                    </select>
                    <button
                      onClick={() =>
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                      }
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      title={`Sort ${
                        sortOrder === "asc" ? "Descending" : "Ascending"
                      }`}
                    >
                      {sortOrder === "asc" ? (
                        <SortAsc className="w-4 h-4" />
                      ) : (
                        <SortDesc className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {allCategories.slice(0, 10).map((category) => (
                      <button
                        key={category}
                        onClick={() => toggleCategory(category)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedCategories.has(category)
                            ? "bg-indigo-100 text-indigo-700 border border-indigo-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active Filters */}
              {(selectedCategories.size > 0 || searchQuery) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Active filters:</span>
                    {searchQuery && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                        Search: "{searchQuery}"
                      </span>
                    )}
                    {Array.from(selectedCategories).map((cat) => (
                      <span
                        key={cat}
                        className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {cat}
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="hover:bg-indigo-200 rounded-full p-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-6 text-sm text-gray-600">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span>{filteredArticles.length} articles</span>
            </div>
            {lastFetch && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>Updated: {lastFetch}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-purple-500" />
              <span>
                {languages.find((l) => l.code === selectedLanguage)?.name ||
                  "All Languages"}
              </span>
            </div>
          </div>

          {bookmarkedArticles.size > 0 && (
            <div className="flex items-center gap-2 text-yellow-600">
              <Bookmark className="w-4 h-4" />
              <span>{bookmarkedArticles.size} bookmarked</span>
            </div>
          )}
        </div>

        {/* Articles Grid/List */}
        <div
          className={`${
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              : "space-y-4"
          }`}
        >
          {loading && filteredArticles.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
              <p className="text-gray-600">Loading amazing articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white/50 rounded-2xl">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">No articles found</p>
              <p className="text-sm text-gray-500">
                Try adjusting your filters or fetch new articles
              </p>
            </div>
          ) : (
            filteredArticles.map((article, index) => (
              <ArticleCard
                key={article.id || index}
                article={article}
                index={index}
              />
            ))
          )}
        </div>

        {/* Loading More Indicator */}
        {loading && filteredArticles.length > 0 && (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            <p className="text-gray-600">Loading more articles...</p>
          </div>
        )}

        {/* No More Articles */}
        {!hasMore && filteredArticles.length > 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-gray-600">
              <Check className="w-4 h-4" />
              <span>You've reached the end! 🎉</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RSSPage;
