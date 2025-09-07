import { ArrowRightLeft, Book, Languages, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

const LanguageTranslatorApp = () => {
  // State management
  const [languages, setLanguages] = useState([]);
  const [srcLang, setSrcLang] = useState('en_XX');
  const [tgtLang, setTgtLang] = useState('de_DE');
  const [translationText, setTranslationText] = useState('');
  const [translation, setTranslation] = useState('');
  const [insertText, setInsertText] = useState('');
  const [insertLang, setInsertLang] = useState('de');
  const [searchWord, setSearchWord] = useState('');
  const [searchLang, setSearchLang] = useState('de');
  const [searchResults, setSearchResults] = useState([]);
  const [translateSearchWord, setTranslateSearchWord] = useState('');
  const [translateSearchSrc, setTranslateSearchSrc] = useState('en_XX');
  const [translateSearchTgt, setTranslateSearchTgt] = useState('de');
  const [translateSearchResults, setTranslateSearchResults] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    languages: false,
    translate: false,
    insert: false,
    search: false,
    translateSearch: false
  });

  // Messages
  const [messages, setMessages] = useState({});

  const API_BASE = 'http://localhost:8001';

  // Load languages on component mount
  useEffect(() => {
    fetchLanguages();
  }, []);

  const setLoadingState = (key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  const setMessage = (key, message, type = 'info') => {
    setMessages(prev => ({ ...prev, [key]: { message, type } }));
    setTimeout(() => {
      setMessages(prev => ({ ...prev, [key]: null }));
    }, 3000);
  };

  const fetchLanguages = async () => {
    setLoadingState('languages', true);
    try {
      const response = await fetch(`${API_BASE}/languages`);
      const data = await response.json();
      setLanguages(data.languages || []);
    } catch (error) {
      setMessage('languages', 'Failed to load languages', 'error');
    } finally {
      setLoadingState('languages', false);
    }
  };

  const handleTranslate = async () => {
    if (!translationText.trim()) return;
    
    setLoadingState('translate', true);
    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: translationText,
          src_lang: srcLang,
          tgt_lang: tgtLang
        })
      });
      const data = await response.json();
      
      if (data.error) {
        setMessage('translate', data.error, 'error');
        setTranslation('');
      } else {
        setTranslation(data.translation);
        setMessage('translate', 'Translation successful!', 'success');
      }
    } catch (error) {
      setMessage('translate', 'Translation failed', 'error');
    } finally {
      setLoadingState('translate', false);
    }
  };

  const handleInsert = async () => {
    if (!insertText.trim()) return;
    
    setLoadingState('insert', true);
    try {
      const response = await fetch(`${API_BASE}/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: insertText,
          lang: insertLang
        })
      });
      const data = await response.json();
      
      if (data.error) {
        setMessage('insert', data.error, 'error');
      } else {
        setMessage('insert', 'Text added to corpus successfully!', 'success');
        setInsertText('');
      }
    } catch (error) {
      setMessage('insert', 'Failed to add text to corpus', 'error');
    } finally {
      setLoadingState('insert', false);
    }
  };

  const handleSearch = async () => {
    if (!searchWord.trim()) return;
    
    setLoadingState('search', true);
    try {
      const response = await fetch(
        `${API_BASE}/search?word=${encodeURIComponent(searchWord)}&lang=${searchLang}&limit=5`
      );
      const data = await response.json();
      
      if (data.error) {
        setMessage('search', data.error, 'error');
        setSearchResults([]);
      } else {
        setSearchResults(data.examples || []);
        setMessage('search', `Found ${data.examples?.length || 0} examples`, 'success');
      }
    } catch (error) {
      setMessage('search', 'Search failed', 'error');
    } finally {
      setLoadingState('search', false);
    }
  };

  const handleTranslateSearch = async () => {
    if (!translateSearchWord.trim()) return;
    
    setLoadingState('translateSearch', true);
    try {
      const response = await fetch(
        `${API_BASE}/translate_search?word=${encodeURIComponent(translateSearchWord)}&src_lang=${translateSearchSrc}&tgt_lang=${translateSearchTgt}&limit=5`
      );
      const data = await response.json();
      
      if (data.error) {
        setMessage('translateSearch', data.error, 'error');
        setTranslateSearchResults(null);
      } else {
        setTranslateSearchResults(data);
        setMessage('translateSearch', 'Translation and examples found!', 'success');
      }
    } catch (error) {
      setMessage('translateSearch', 'Translate search failed', 'error');
    } finally {
      setLoadingState('translateSearch', false);
    }
  };

  const swapLanguages = () => {
    setSrcLang(tgtLang);
    setTgtLang(srcLang);
  };

  const MessageDisplay = ({ messageKey }) => {
    const msg = messages[messageKey];
    if (!msg) return null;
    
    const bgColor = msg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 
                    msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 
                    'bg-blue-50 text-blue-700 border-blue-200';
    
    return (
      <div className={`p-3 rounded-lg border ${bgColor} text-sm`}>
        {msg.message}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Languages className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Language Translator</h1>
          </div>
          <p className="text-gray-600">Translate text, manage your corpus, and explore word meanings</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Translation Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Translation
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <select 
                  value={srcLang} 
                  onChange={(e) => setSrcLang(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading.languages}
                >
                  {languages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                
                <button 
                  onClick={swapLanguages}
                  className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                </button>
                
                <select 
                  value={tgtLang} 
                  onChange={(e) => setTgtLang(e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading.languages}
                >
                  {languages.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>

              <textarea
                value={translationText}
                onChange={(e) => setTranslationText(e.target.value)}
                placeholder="Enter text to translate..."
                className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />

              <button
                onClick={handleTranslate}
                disabled={loading.translate || !translationText.trim()}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.translate ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-5 h-5" />
                )}
                Translate
              </button>

              {translation && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-gray-700">{translation}</p>
                </div>
              )}

              <MessageDisplay messageKey="translate" />
            </div>
          </div>

          {/* Add to Corpus Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add to Corpus
            </h2>
            
            <div className="space-y-4">
              <select
                value={insertLang}
                onChange={(e) => setInsertLang(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading.languages}
              >
                {languages.map(lang => (
                  <option key={lang} value={lang.replace('_XX', '').replace('_DE', '')}>{lang}</option>
                ))}
              </select>

              <textarea
                value={insertText}
                onChange={(e) => setInsertText(e.target.value)}
                placeholder="Enter text to add to corpus..."
                className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />

              <button
                onClick={handleInsert}
                disabled={loading.insert || !insertText.trim()}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.insert ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Add to Corpus
              </button>

              <MessageDisplay messageKey="insert" />
            </div>
          </div>

          {/* Search Examples Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Examples
            </h2>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchWord}
                  onChange={(e) => setSearchWord(e.target.value)}
                  placeholder="Enter word to search..."
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <select
                  value={searchLang}
                  onChange={(e) => setSearchLang(e.target.value)}
                  className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading.languages}
                >
                  {languages.map(lang => (
                    <option key={lang} value={lang.replace('_XX', '').replace('_DE', '')}>{lang}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading.search || !searchWord.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.search ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Search Examples
              </button>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-700">Examples:</h3>
                  {searchResults.map((example, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                      <p className="text-gray-700">{example}</p>
                    </div>
                  ))}
                </div>
              )}

              <MessageDisplay messageKey="search" />
            </div>
          </div>

          {/* Translate & Search Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Book className="w-5 h-5" />
              Translate & Find Examples
            </h2>
            
            <div className="space-y-4">
              <input
                type="text"
                value={translateSearchWord}
                onChange={(e) => setTranslateSearchWord(e.target.value)}
                placeholder="Enter word to translate and find examples..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleTranslateSearch()}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From:</label>
                  <select
                    value={translateSearchSrc}
                    onChange={(e) => setTranslateSearchSrc(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading.languages}
                  >
                    {languages.map(lang => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                  <select
                    value={translateSearchTgt}
                    onChange={(e) => setTranslateSearchTgt(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading.languages}
                  >
                    {languages.map(lang => (
                      <option key={lang} value={lang.replace('_XX', '').replace('_DE', '')}>{lang}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleTranslateSearch}
                disabled={loading.translateSearch || !translateSearchWord.trim()}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.translateSearch ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Book className="w-5 h-5" />
                )}
                Translate & Search
              </button>

              {translateSearchResults && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p><span className="font-medium">Original:</span> {translateSearchResults.source_word}</p>
                    <p><span className="font-medium">Translation:</span> {translateSearchResults.translated_word}</p>
                  </div>
                  
                  {translateSearchResults.examples && translateSearchResults.examples.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-2">Examples:</h3>
                      <div className="space-y-2">
                        {translateSearchResults.examples.map((example, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                            <p className="text-gray-700">{example}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <MessageDisplay messageKey="translateSearch" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageTranslatorApp;