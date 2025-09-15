import { Search, BarChart3, ArrowRightLeft, Loader2, Volume2, VolumeX, Square, Eye } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import ReadingViewModal from './components/ReadingViewModal';

const AnalysisPage = () => {
  // State management
  const [languages, setLanguages] = useState([]);
  const [languageNames, setLanguageNames] = useState({});
  const [translateSearchWord, setTranslateSearchWord] = useState('');
  const [translateSearchSrc, setTranslateSearchSrc] = useState('en');
  const [translateSearchTgt, setTranslateSearchTgt] = useState('de');
  const [translateSearchResults, setTranslateSearchResults] = useState(null);
  
  // Learning language - the language of your corpus that you're learning from
  const [learningLanguage, setLearningLanguage] = useState('de');
  
  // Word frequency state
  const [posTags, setPosTags] = useState([]);
  const [selectedPosTag, setSelectedPosTag] = useState('NOUN');
  const [frequencyLang, setFrequencyLang] = useState('de');
  const [startRank, setStartRank] = useState(1);
  const [endRank, setEndRank] = useState(20);
  const [wordFrequencyResults, setWordFrequencyResults] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    languages: false,
    translateSearch: false,
    wordFrequency: false,
    posTags: false
  });

  // Messages
  const [messages, setMessages] = useState({});

  // Speech state management
  const [speechState, setSpeechState] = useState({
    isSpeaking: false,
    currentText: '',
    currentLang: '',
    isPaused: false
  });

  // Word examples state
  const [wordExamples, setWordExamples] = useState({
    isOpen: false,
    word: '',
    examples: [],
    translation: '',
    language: ''
  });

  // Reading view modal state
  const [readingView, setReadingView] = useState({
    isOpen: false,
    originalText: '',
    translatedText: '',
    srcLang: '',
    tgtLang: '',
    title: 'Reading View',
    youtubeVideoId: null,
    youtubeStartTime: null,
    youtubeOnly: false
  });

  const API_BASE = 'http://localhost:8000';
  const speechSynthesis = useRef(window.speechSynthesis);
  
  // Utility functions
  const setLoadingState = (key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  const setMessage = (key, message, type = 'info') => {
    setMessages(prev => ({ ...prev, [key]: { message, type } }));
    setTimeout(() => {
      setMessages(prev => ({ ...prev, [key]: null }));
    }, 3000);
  };

  // Initialize languages and POS tags
  useEffect(() => {
    const fetchLanguages = async () => {
      setLoadingState('languages', true);
      try {
        const response = await fetch(`${API_BASE}/languages`);
        const data = await response.json();
        console.log('Languages API response:', data);
        if (data.error) {
          setMessage('general', data.error, 'error');
        } else {
          // data.languages is a dictionary like {'en': 'English', 'de': 'German', ...}
          const languageCodes = Object.keys(data.languages || {});
          console.log('Language codes:', languageCodes);
          setLanguages(languageCodes);
          setLanguageNames(data.languages || {});
        }
      } catch (error) {
        console.error('Languages API error:', error);
        setMessage('general', 'Failed to load languages', 'error');
        // Set empty arrays as fallback
        setLanguages([]);
        setLanguageNames({});
      } finally {
        setLoadingState('languages', false);
      }
    };

    const fetchPosTags = async () => {
      setLoadingState('posTags', true);
      try {
        const response = await fetch(`${API_BASE}/pos_tags`);
        const data = await response.json();
        if (data.error) {
          setMessage('general', data.error, 'error');
        } else {
          console.log('POS tags API response:', data);
          console.log('POS tags data:', data.pos_tags);
          setPosTags(data.pos_tags || []);
        }
      } catch (error) {
        setMessage('general', 'Failed to load POS tags', 'error');
      } finally {
        setLoadingState('posTags', false);
      }
    };

    fetchLanguages();
    fetchPosTags();
  }, []);

  // Speech synthesis functions
  const speak = (text, language) => {
    if (speechState.isSpeaking && !speechState.isPaused) {
      speechSynthesis.current.cancel();
      setSpeechState({
        isSpeaking: false,
        currentText: '',
        currentLang: '',
        isPaused: false
      });
      return;
    }

    if (speechState.isPaused && speechState.currentText === text && speechState.currentLang === language) {
      speechSynthesis.current.resume();
      setSpeechState(prev => ({ ...prev, isPaused: false }));
      return;
    }

    speechSynthesis.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    
    utterance.onstart = () => {
      setSpeechState({
        isSpeaking: true,
        currentText: text,
        currentLang: language,
        isPaused: false
      });
    };

    utterance.onend = () => {
      setSpeechState({
        isSpeaking: false,
        currentText: '',
        currentLang: '',
        isPaused: false
      });
    };

    speechSynthesis.current.speak(utterance);
  };

  const pauseSpeech = () => {
    if (speechState.isSpeaking && !speechState.isPaused) {
      speechSynthesis.current.pause();
      setSpeechState(prev => ({ ...prev, isPaused: true }));
    }
  };

  const stopSpeech = () => {
    speechSynthesis.current.cancel();
    setSpeechState({
      isSpeaking: false,
      currentText: '',
      currentLang: '',
      isPaused: false
    });
  };

  // Reading view functions
  const openReadingView = (originalText, translatedText, srcLang, tgtLang, title = 'Reading View', youtubeVideoId = null, youtubeStartTime = null, youtubeOnly = false) => {
    setReadingView({
      isOpen: true,
      originalText,
      translatedText,
      srcLang,
      tgtLang,
      title,
      youtubeVideoId,
      youtubeStartTime,
      youtubeOnly
    });
  };

  const closeReadingView = () => {
    setReadingView({
      isOpen: false,
      originalText: '',
      translatedText: '',
      srcLang: '',
      tgtLang: '',
      title: 'Reading View',
      youtubeVideoId: null,
      youtubeStartTime: null,
      youtubeOnly: false
    });
  };

  // Helper function for speech synthesis with proper language codes
  const speakText = (text, language) => {
    const getLanguageCode = (langCode) => {
      const languageMap = {
        'en': 'en-US',
        'de': 'de-DE',
        'es': 'es-ES', 
        'fr': 'fr-FR',
        'it': 'it-IT',
        'pt': 'pt-BR',
        'ru': 'ru-RU',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'zh-cn': 'zh-CN',
        'zh-tw': 'zh-TW',
        'ar': 'ar-SA',
        'hi': 'hi-IN',
        'tr': 'tr-TR',
        'pl': 'pl-PL',
        'nl': 'nl-NL',
        'sv': 'sv-SE',
        'da': 'da-DK',
        'no': 'no-NO',
        'fi': 'fi-FI',
        'hu': 'hu-HU',
        'cs': 'cs-CZ',
        'sk': 'sk-SK',
        'ro': 'ro-RO',
        'bg': 'bg-BG',
        'hr': 'hr-HR',
        'sl': 'sl-SI',
        'et': 'et-EE',
        'lv': 'lv-LV',
        'lt': 'lt-LT',
        'el': 'el-GR',
        'he': 'he-IL',
        'th': 'th-TH',
        'vi': 'vi-VN',
        'id': 'id-ID',
        'ms': 'ms-MY',
        'tl': 'tl-PH',
        'sw': 'sw-KE',
        'ca': 'ca-ES',
        'eu': 'eu-ES',
        'gl': 'gl-ES'
      };
      return languageMap[langCode] || langCode;
    };

    speak(text, getLanguageCode(language));
  };

  const pauseResumeSpeech = () => {
    if (speechState.isPaused) {
      speechSynthesis.current.resume();
      setSpeechState(prev => ({ ...prev, isPaused: false }));
    } else {
      pauseSpeech();
    }
  };

  // Search and analysis functions
  const handleTranslateSearch = async () => {
    if (!translateSearchWord.trim()) return;
    
    setLoadingState('translateSearch', true);
    try {
      // Enhanced search API call with proper corpus language
      // - Always search corpus in learningLanguage
      const response = await fetch(
        `${API_BASE}/translate_search?word=${encodeURIComponent(translateSearchWord)}&src_lang=${translateSearchSrc}&tgt_lang=${translateSearchTgt}&corpus_lang=${learningLanguage}&limit=10`
      );
      const data = await response.json();
      
      if (data.error) {
        setMessage('translateSearch', data.error, 'error');
      } else {
        setTranslateSearchResults(data);
        setMessage('translateSearch', `Found ${data.examples?.length || 0} examples for "${translateSearchWord}"`, 'success');
      }
    } catch (error) {
      setMessage('translateSearch', 'Search failed', 'error');
    } finally {
      setLoadingState('translateSearch', false);
    }
  };

  const handleWordFrequency = async () => {
    setLoadingState('wordFrequency', true);
    try {
      const response = await fetch(
        `${API_BASE}/word_frequency/${selectedPosTag}?lang=${frequencyLang}&start_rank=${startRank}&end_rank=${endRank}`
      );
      const data = await response.json();
      console.log('Word frequency API response:', data);
      
      if (data.error) {
        setMessage('wordFrequency', data.error, 'error');
      } else {
        console.log('Word frequency data:', data);
        setWordFrequencyResults(data);
        setMessage('wordFrequency', `Loaded ${data.results?.length || 0} words`, 'success');
      }
    } catch (error) {
      setMessage('wordFrequency', 'Failed to load word frequency data', 'error');
    } finally {
      setLoadingState('wordFrequency', false);
    }
  };

  const handleWordClick = async (word) => {
    try {
      // Use learningLanguage as source (corpus language) and English as target for translation
      const response = await fetch(
        `${API_BASE}/translate_search?word=${encodeURIComponent(word)}&src_lang=${learningLanguage}&tgt_lang=en&corpus_lang=${learningLanguage}&limit=10`
      );
      const data = await response.json();
      
      if (data.error) {
        setMessage('wordExamples', data.error, 'error');
      } else {
        setWordExamples({
          isOpen: true,
          word: word,
          examples: data.examples || [],
          translation: data.translation || '',
          language: learningLanguage
        });
      }
    } catch (error) {
      setMessage('wordExamples', 'Failed to load word examples', 'error');
    }
  };

  const closeWordExamples = () => {
    setWordExamples({
      isOpen: false,
      word: '',
      examples: [],
      translation: '',
      language: ''
    });
  };

  // Speech Button Component
  const SpeechButton = ({ text, language, size = 'normal', className = '', colorScheme = 'blue' }) => {
    if (!text) return null;

    const isCurrentlySpeaking = speechState.isSpeaking && speechState.currentText === text && speechState.currentLang === language;
    const isPausedForThis = speechState.isPaused && speechState.currentText === text && speechState.currentLang === language;
    
    const sizeClasses = size === 'large' ? 'p-3' : 'p-2';
    const iconClasses = size === 'large' ? 'w-6 h-6' : 'w-4 h-4';
    
    let colorClasses = '';
    switch (colorScheme) {
      case 'green':
        colorClasses = isCurrentlySpeaking 
          ? 'text-green-600 bg-green-100 hover:bg-green-200' 
          : 'text-green-500 hover:text-green-600 hover:bg-green-50';
        break;
      case 'purple':
        colorClasses = isCurrentlySpeaking 
          ? 'text-purple-600 bg-purple-100 hover:bg-purple-200' 
          : 'text-purple-500 hover:text-purple-600 hover:bg-purple-50';
        break;
      default: // blue
        colorClasses = isCurrentlySpeaking 
          ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' 
          : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50';
    }

    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={() => speak(text, language)}
          className={`${sizeClasses} ${colorClasses} rounded transition-colors ${className}`}
          title={isPausedForThis ? "Resume" : (isCurrentlySpeaking ? "Stop" : "Speak")}
        >
          {isPausedForThis ? (
            <Volume2 className={iconClasses} />
          ) : isCurrentlySpeaking ? (
            <VolumeX className={iconClasses} />
          ) : (
            <Volume2 className={iconClasses} />
          )}
        </button>
        {isCurrentlySpeaking && !isPausedForThis && (
          <>
            <button
              onClick={pauseSpeech}
              className={`${sizeClasses} text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors`}
              title="Pause"
            >
              <Square className={iconClasses} />
            </button>
            <button
              onClick={stopSpeech}
              className={`${sizeClasses} text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors`}
              title="Stop"
            >
              <VolumeX className={iconClasses} />
            </button>
          </>
        )}
      </div>
    );
  };

  // Message Display Component
  const MessageDisplay = ({ messageKey }) => {
    const message = messages[messageKey];
    if (!message) return null;

    const bgColor = {
      success: 'bg-green-100 border-green-400 text-green-700',
      error: 'bg-red-100 border-red-400 text-red-700',
      info: 'bg-blue-100 border-blue-400 text-blue-700'
    }[message.type];

    return (
      <div className={`p-3 rounded border ${bgColor}`}>
        {message.message}
      </div>
    );
  };

  // Word Examples Modal Component
  const WordExamplesModal = () => {
    if (!wordExamples.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-800">
                Examples for "{wordExamples.word}"
              </h2>
              {wordExamples.translation && (
                <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                  {wordExamples.translation}
                </span>
              )}
              <SpeechButton 
                text={wordExamples.word} 
                language={wordExamples.language}
                size="normal"
                colorScheme="purple"
              />
            </div>
            <button
              onClick={closeWordExamples}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ×
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-4 overflow-auto">
            {wordExamples.examples.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No examples found for this word.</p>
            ) : (
              <div className="space-y-3">
                {wordExamples.examples.map((example, index) => {
                  // Handle both string examples and object examples
                  const sentence = typeof example === 'string' ? example : (example.sentence || String(example));
                  
                  return (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border-l-4 border-purple-500">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-gray-700 flex-1">{sentence}</p>
                        <SpeechButton 
                          text={sentence} 
                          language={wordExamples.language}
                          size="normal"
                          colorScheme="purple"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Analysis & Research
            </h1>
          </div>
          <p className="text-gray-600">Search for words, analyze frequency, and explore your learning corpus</p>
        </div>

        {/* Content Grid */}
        <div className="space-y-6">
          {/* Word Search & Translation Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Word Search & Translation
            </h2>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                💡 <strong>Smart Search:</strong> Enter any word, get translation, and find examples from your {learningLanguage.toUpperCase()} corpus!
              </p>
            </div>
            
            <div className="space-y-4">
              {/* Learning Language Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Learning Language (Corpus):</label>
                <select
                  value={learningLanguage}
                  onChange={(e) => setLearningLanguage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-purple-50"
                  disabled={loading.languages}
                >
                  {(languages || []).map(lang => (
                    <option key={lang} value={lang}>
                      {lang} - {languageNames[lang] || lang}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-600 mt-1">This is the language of your corpus that you're learning from</p>
              </div>
              
              <input
                type="text"
                value={translateSearchWord}
                onChange={(e) => setTranslateSearchWord(e.target.value)}
                placeholder="Enter any word to translate and find examples..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleTranslateSearch()}
              />

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">From:</label>
                  <select
                    value={translateSearchSrc}
                    onChange={(e) => setTranslateSearchSrc(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading.languages}
                  >
                    {(languages || []).map(lang => (
                      <option key={lang} value={lang}>
                        {lang} - {languageNames[lang] || lang}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={() => {
                    const newSrc = translateSearchTgt;
                    const newTgt = translateSearchSrc;
                    setTranslateSearchSrc(newSrc);
                    setTranslateSearchTgt(newTgt);
                    // Clear previous results when swapping
                    setTranslateSearchResults(null);
                  }}
                  className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mb-0"
                  title="Swap languages"
                >
                  <ArrowRightLeft className="w-5 h-5" />
                </button>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                  <select
                    value={translateSearchTgt}
                    onChange={(e) => setTranslateSearchTgt(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading.languages}
                  >
                    {(languages || []).map(lang => (
                      <option key={lang} value={lang}>
                        {lang} - {languageNames[lang] || lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleTranslateSearch}
                disabled={loading.translateSearch || !translateSearchWord.trim()}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.translateSearch ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Search & Translate
              </button>

              {translateSearchResults && (
                <div className="space-y-4">
                  {translateSearchResults.translation && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-800">
                          Translation: <span className="text-green-700">{translateSearchResults.translation}</span>
                        </h3>
                        <SpeechButton 
                          text={translateSearchResults.translation} 
                          language={translateSearchTgt} 
                          size="normal"
                          colorScheme="green"
                        />
                      </div>
                    </div>
                  )}

                  {translateSearchResults.examples && translateSearchResults.examples.length > 0 && (
                    <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                      <h3 className="font-medium text-gray-800 mb-3">
                        Examples from {learningLanguage.toUpperCase()} corpus ({translateSearchResults.examples.length} found):
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {translateSearchResults.examples.map((example, index) => {
                          // Handle both string examples and object examples
                          const sentence = typeof example === 'string' ? example : (example.sentence || String(example));
                          
                          return (
                            <div key={index} className="flex items-start justify-between gap-2 p-2 bg-white rounded border">
                              <p className="text-gray-700 text-sm flex-1">{sentence}</p>
                              <SpeechButton 
                                text={sentence} 
                                language={learningLanguage} 
                                size="normal"
                                colorScheme="purple"
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        💡 Searches for "{learningLanguage.toUpperCase()}" sentences in your corpus containing relevant words.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <MessageDisplay messageKey="translateSearch" />
            </div>
          </div>

          {/* Word Frequency Analysis Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Word Frequency Analysis
            </h2>

            <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">
                <strong>How it works:</strong> Analyzes the most frequent words by part of speech (POS) in your corpus. 
                Click any word to see examples and translations!
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language:</label>
                  <select
                    value={frequencyLang}
                    onChange={(e) => setFrequencyLang(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={loading.languages}
                  >
                    {(languages || []).map(lang => (
                      <option key={lang} value={lang}>
                        {lang} - {languageNames[lang] || lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Part of Speech:</label>
                  <select
                    value={selectedPosTag}
                    onChange={(e) => setSelectedPosTag(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={loading.posTags}
                  >
                    {(posTags || []).map((tagData, index) => {
                      // Handle both string tags and object tags
                      const tag = typeof tagData === 'string' ? tagData : tagData.pos_tag;
                      const description = typeof tagData === 'object' ? tagData.description : '';
                      const displayText = description ? `${tag} - ${description}` : tag;
                      
                      return (
                        <option key={index} value={tag}>{displayText}</option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Rank:</label>
                  <input
                    type="number"
                    value={startRank}
                    onChange={(e) => setStartRank(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Rank:</label>
                  <input
                    type="number"
                    value={endRank}
                    onChange={(e) => setEndRank(Math.max(startRank, parseInt(e.target.value) || startRank))}
                    min={startRank}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={handleWordFrequency}
                disabled={loading.wordFrequency}
                className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {loading.wordFrequency ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <BarChart3 className="w-5 h-5" />
                )}
                Analyze Word Frequency
              </button>

              {wordFrequencyResults && (
                <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                  <h3 className="font-medium text-gray-800 mb-3">
                    Most Frequent {selectedPosTag} Words (Ranks {startRank}-{endRank}):
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {wordFrequencyResults.results?.map((wordData, index) => {
                      // Use the correct properties from the API response
                      const word = wordData.word || wordData.lemma || String(wordData);
                      const count = wordData.count || 'N/A';
                      const rank = wordData.rank || (startRank + index);
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleWordClick(word)}
                          className="flex items-center justify-between p-2 bg-white rounded border hover:bg-orange-100 hover:border-orange-300 transition-colors text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-800 truncate block">
                              {word}
                            </span>
                            <span className="text-xs text-gray-500">
                              #{rank} • {count} times
                            </span>
                          </div>
                          <Eye className="w-4 h-4 text-gray-400 group-hover:text-orange-600 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-600 mt-3">
                    💡 Click any word to see example sentences and get translations!
                  </p>
                </div>
              )}

              <MessageDisplay messageKey="wordFrequency" />
            </div>
          </div>
        </div>
      </div>

      {/* Word Examples Modal */}
      <WordExamplesModal />
      
      {/* Reading View Modal */}
      <ReadingViewModal 
        readingView={readingView}
        closeReadingView={closeReadingView}
        languageNames={languageNames}
        speechState={speechState}
        speakText={speakText}
        stopSpeech={stopSpeech}
        pauseResumeSpeech={pauseResumeSpeech}
      />
    </div>
  );
};

export default AnalysisPage;
