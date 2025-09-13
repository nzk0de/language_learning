import { ArrowRightLeft, Book, Languages, Loader2, Plus, Search, Volume2, VolumeX, Square, Maximize2, X, Eye } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

const LanguageTranslatorApp = () => {
  // State management
  const [languages, setLanguages] = useState([]);
  const [languageNames, setLanguageNames] = useState({});
  const [srcLang, setSrcLang] = useState('en');
  const [tgtLang, setTgtLang] = useState('de');
  const [translationText, setTranslationText] = useState('');
  const [translation, setTranslation] = useState('');
  const [insertText, setInsertText] = useState('');
  const [insertLang, setInsertLang] = useState('de');
  const [searchWord, setSearchWord] = useState('');
  const [searchLang, setSearchLang] = useState('de');
  const [searchResults, setSearchResults] = useState([]);
  const [translateSearchWord, setTranslateSearchWord] = useState('');
  const [translateSearchSrc, setTranslateSearchSrc] = useState('en');
  const [translateSearchTgt, setTranslateSearchTgt] = useState('de');
  const [translateSearchResults, setTranslateSearchResults] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState({
    languages: false,
    translate: false,
    translateAndStore: false,
    insert: false,
    search: false,
    translateSearch: false
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

  // Refs and state for synchronized scrolling in reading view
  const originalScrollRef = useRef(null);
  const translatedScrollRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  const API_BASE = 'http://localhost:8000';

  // Text-to-speech functionality
  const speakText = (text, language) => {
    if ('speechSynthesis' in window) {
      // If currently speaking the same text, stop it
      if (speechState.isSpeaking && speechState.currentText === text) {
        stopSpeech();
        return;
      }
      
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getLanguageCode(language);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      
      // Find a voice that matches the language
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith(language)) || voices.find(v => v.lang.startsWith('en'));
      if (voice) {
        utterance.voice = voice;
      }
      
      // Set up event listeners
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
      
      utterance.onerror = () => {
        setSpeechState({
          isSpeaking: false,
          currentText: '',
          currentLang: '',
          isPaused: false
        });
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser');
    }
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeechState({
        isSpeaking: false,
        currentText: '',
        currentLang: '',
        isPaused: false
      });
    }
  };

  const pauseResumeSpeech = () => {
    if ('speechSynthesis' in window) {
      if (speechState.isPaused) {
        window.speechSynthesis.resume();
        setSpeechState(prev => ({ ...prev, isPaused: false }));
      } else {
        window.speechSynthesis.pause();
        setSpeechState(prev => ({ ...prev, isPaused: true }));
      }
    }
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

  // Helper function to get proper language code for speech synthesis
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

  // Load languages on component mount and speech voices
  useEffect(() => {
    fetchLanguages();
    
    // Load speech synthesis voices
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    
    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
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
      // Use language_codes array and store language names object
      setLanguages(data.language_codes || []);
      setLanguageNames(data.languages || {});
    } catch (error) {
      setMessage('languages', 'Failed to load languages', 'error');
    } finally {
      setLoadingState('languages', false);
    }
  };

    const handleTranslate = async () => {
    if (!translationText.trim()) {
      console.log('Translation text is empty:', translationText);
      return;
    }
    
    
    setLoadingState('translate', true);
    try {
      const requestBody = {
        text: translationText,
        src_lang: srcLang,
        tgt_lang: tgtLang
      };
      console.log('Request body:', requestBody);
      console.log('Request body JSON:', JSON.stringify(requestBody));
      
      const response = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      
      console.log('Translation response:', data);
      
      if (data.error) {
        console.error('Translation API error:', data.error);
        setMessage('translate', data.error, 'error');
        setTranslation('');
        return null;
      } else {
        console.log('Translation successful:', data.translation);
        setTranslation(data.translation);
        setMessage('translate', 'Translation successful!', 'success');
        return data.translation;
      }
    } catch (error) {
      console.error('Translation request failed:', error);
      setMessage('translate', 'Translation failed: ' + error.message, 'error');
      setTranslation('');
      return null;
    } finally {
      setLoadingState('translate', false);
    }
  };

  const handleTranslateAndStore = async () => {
    if (!translationText.trim()) return;
    
    setLoadingState('translateAndStore', true);
    try {
      const response = await fetch(`${API_BASE}/translate_and_store`, {
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
        setMessage('translate', 'Translation and storage successful! Both sentences saved to Elasticsearch.', 'success');
      }
    } catch (error) {
      setMessage('translate', 'Translation and storage failed', 'error');
    } finally {
      setLoadingState('translateAndStore', false);
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
    const newSrcLang = tgtLang;
    const newTgtLang = srcLang;
    
    console.log('Swapping languages from', srcLang, 'to', newSrcLang, 'and from', tgtLang, 'to', newTgtLang);
    
    // If there's a current translation, swap the text and translation
    if (translation && translationText) {
      const newText = translation;
      const newTranslation = translationText;
      
      console.log('Swapping text and translation:', { oldText: translationText, newText, oldTranslation: translation, newTranslation });
      
      // Set new languages first
      setSrcLang(newSrcLang);
      setTgtLang(newTgtLang);
      
      // Then swap the text and translation
      setTranslationText(newText);
      setTranslation(newTranslation);
    } else {
      // Just swap languages and clear translation
      setSrcLang(newSrcLang);
      setTgtLang(newTgtLang);
      setTranslation('');
    }
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

  // Helper function to extract YouTube video ID from URL
  const extractYouTubeVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Helper function to extract start time from YouTube URL
  const extractYouTubeStartTime = (url) => {
    if (!url) return null;
    const regExp = /[?&]t=([^&]*)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  // Auto-fill YouTube inputs when translation text changes
  const handleTranslationTextChange = (text) => {
    setTranslationText(text);
    
    // Auto-fill YouTube fields if they exist and are empty
    const youtubeOriginalTextEl = document.getElementById('videoOriginalText');
    const youtubeTitleEl = document.getElementById('videoTitle');
    
    if (youtubeOriginalTextEl && !youtubeOriginalTextEl.value && text.trim()) {
      youtubeOriginalTextEl.value = text;
    }
    
    if (youtubeTitleEl && youtubeTitleEl.value === 'YouTube Video Learning Session' && text.trim()) {
      youtubeTitleEl.value = text.length > 50 ? text.substring(0, 50) + '...' : text;
    }
  };

  // Synchronized scrolling function
  const handleScroll = (sourceRef, targetRef) => {
    if (isScrollingRef.current) return;
    
    const source = sourceRef.current;
    const target = targetRef.current;
    
    if (!source || !target) return;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set scrolling flag
    isScrollingRef.current = true;
    
    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      if (source.scrollHeight > source.clientHeight && target.scrollHeight > target.clientHeight) {
        const scrollPercentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
        const targetScrollTop = scrollPercentage * (target.scrollHeight - target.clientHeight);
        target.scrollTop = targetScrollTop;
      }
      
      // Reset scrolling flag after a delay
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    });
  };

  // Reading View Modal Component
  const ReadingViewModal = () => {
    if (!readingView.isOpen) return null;

    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
        readingView.youtubeOnly ? 'p-0' : 'p-4'
      }`}>
        <div className={`bg-white shadow-2xl flex flex-col ${
          readingView.youtubeOnly 
            ? 'w-full h-full max-w-none max-h-none m-0 rounded-none' 
            // : 'w-full max-w-6xl h-5/6 rounded-xl'
            : 'w-full h-full max-w-none max-h-none m-0 rounded-none' 
        }`}>
          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Book className="w-6 h-6 text-indigo-600" />
              {readingView.title}
            </h2>
            <button
              onClick={closeReadingView}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* YouTube Video Panel (conditional) */}
            {readingView.youtubeVideoId && (
              <div className="flex-1 flex flex-col border-r border-gray-200">
                <div className="p-4 bg-red-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>Video</span>
                  </h3>
                </div>
                <div className="flex-1 p-4">
                  <div className="w-full h-full">
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${readingView.youtubeVideoId}${readingView.youtubeStartTime ? `?start=${readingView.youtubeStartTime}` : ''}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              </div>
            )}
            
            {/* Original Text Panel - Only show if not YouTube-only mode */}
            {!readingView.youtubeOnly && (
              <div className={`${readingView.youtubeVideoId ? 'flex-1' : 'flex-1'} flex flex-col border-r border-gray-200`}>
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>{readingView.srcLang} - {languageNames[readingView.srcLang] || readingView.srcLang}</span>
                </h3>
                <SpeechButton 
                  text={readingView.originalText} 
                  language={readingView.srcLang} 
                  size="normal"
                  colorScheme="indigo"
                />
              </div>
                <div 
                  ref={originalScrollRef}
                  className="flex-1 p-6 overflow-y-auto"
                  onScroll={() => handleScroll(originalScrollRef, translatedScrollRef)}
                >
                  <div className="prose prose-gray max-w-none">
                    {readingView.originalText.split('\n').map((paragraph, index) => (
                      <p key={index} className="mb-4 text-lg leading-relaxed text-gray-700">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Translation Panel */}
            <div className="flex-1 flex flex-col">
              <div className="p-4 bg-blue-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>{readingView.tgtLang} - {languageNames[readingView.tgtLang] || readingView.tgtLang}</span>
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(readingView.translatedText);
                      // You might want to show a toast here
                    }}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Copy translation"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <SpeechButton 
                    text={readingView.translatedText} 
                    language={readingView.tgtLang} 
                    size="normal"
                    colorScheme="blue"
                  />
                </div>
              </div>
              <div 
                ref={translatedScrollRef}
                className="flex-1 p-6 overflow-y-auto"
                onScroll={() => handleScroll(translatedScrollRef, originalScrollRef)}
              >
                <div className="prose prose-gray max-w-none">
                  {readingView.translatedText.split('\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 text-lg leading-relaxed text-gray-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="w-4 h-4" />
              <span>
                {readingView.youtubeVideoId 
                  ? 'Reading view with video and synchronized scrolling' 
                  : 'Side-by-side reading view with synchronized scrolling'
                }
              </span>
            </div>
            <button
              onClick={closeReadingView}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Speech button component
  const SpeechButton = ({ text, language, size = 'normal', className = '', colorScheme = 'indigo' }) => {
    const isCurrentlySpeaking = speechState.isSpeaking && speechState.currentText === text;
    const isPaused = isCurrentlySpeaking && speechState.isPaused;
    
    const sizeClasses = size === 'small' ? 'w-3 h-3' : size === 'large' ? 'w-6 h-6' : 'w-4 h-4';
    const buttonSizeClasses = size === 'small' ? 'p-1' : 'p-2';
    
    const colorClasses = {
      indigo: isCurrentlySpeaking 
        ? 'text-indigo-600 bg-indigo-100 hover:bg-indigo-200' 
        : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50',
      green: isCurrentlySpeaking 
        ? 'text-green-600 bg-green-100 hover:bg-green-200' 
        : 'text-gray-400 hover:text-green-600 hover:bg-green-50',
      blue: isCurrentlySpeaking 
        ? 'text-blue-600 bg-blue-100 hover:bg-blue-200' 
        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
    };

    const handleClick = () => {
      if (isCurrentlySpeaking) {
        if (isPaused) {
          pauseResumeSpeech();
        } else {
          stopSpeech();
        }
      } else {
        speakText(text, language);
      }
    };

    const getIcon = () => {
      if (isCurrentlySpeaking) {
        return isPaused ? <Volume2 className={sizeClasses} /> : <Square className={sizeClasses} />;
      }
      return <Volume2 className={sizeClasses} />;
    };

    const getTitle = () => {
      const langName = languageNames[language] || language;
      if (isCurrentlySpeaking) {
        return isPaused ? `Resume in ${langName}` : `Stop speaking in ${langName}`;
      }
      return `Listen in ${langName}`;
    };

    return (
      <button
        onClick={handleClick}
        className={`${buttonSizeClasses} ${colorClasses[colorScheme]} rounded transition-colors ${className}`}
        title={getTitle()}
      >
        {getIcon()}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8 relative">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Languages className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Language Translator</h1>
            {speechState.isSpeaking && (
              <button
                onClick={stopSpeech}
                className="absolute right-0 top-0 p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                title="Stop all speech"
              >
                <VolumeX className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-gray-600">Translate text, manage your corpus, and explore word meanings</p>
          {speechState.isSpeaking && (
            <div className="mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                <Volume2 className="w-4 h-4" />
                <span>Speaking in {languageNames[speechState.currentLang] || speechState.currentLang}</span>
                {speechState.isPaused && <span className="text-indigo-500">(Paused)</span>}
                <button
                  onClick={pauseResumeSpeech}
                  className="ml-1 p-1 hover:bg-indigo-200 rounded transition-colors"
                  title={speechState.isPaused ? "Resume" : "Pause"}
                >
                  {speechState.isPaused ? <Volume2 className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
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
                    <option key={lang} value={lang}>
                      {lang} - {languageNames[lang] || lang}
                    </option>
                  ))}
                </select>
                
                <button 
                  onClick={swapLanguages}
                  className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Swap languages"
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
                    <option key={lang} value={lang}>
                      {lang} - {languageNames[lang] || lang}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <textarea
                  value={translationText}
                  onChange={(e) => handleTranslationTextChange(e.target.value)}
                  placeholder="Enter text to translate..."
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                {translationText && (
                  <SpeechButton 
                    text={translationText} 
                    language={srcLang} 
                    size="normal"
                    className="absolute top-3 right-3 rounded-lg"
                    colorScheme="indigo"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTranslate}
                  disabled={loading.translate || !translationText.trim()}
                  className="bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loading.translate ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-5 h-5" />
                  )}
                  Translate
                </button>
                
                <button
                  onClick={handleTranslateAndStore}
                  disabled={loading.translateAndStore || !translationText.trim()}
                  className="bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loading.translateAndStore ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  Translate & Store
                </button>
              </div>

              {/* Reading View Button */}
              {translationText && translation && (
                <button
                  onClick={() => openReadingView(
                    translationText, 
                    translation, 
                    srcLang, 
                    tgtLang, 
                    'Translation Reading View'
                  )}
                  className="w-full mt-2 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <Maximize2 className="w-5 h-5" />
                  Open Reading View
                </button>
              )}

              {translation && (
                <div className="bg-gray-50 rounded-lg border relative">
                  <div className="flex items-center justify-between p-3 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Translation</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(translation);
                          setMessage('translate', 'Translation copied to clipboard!', 'success');
                        }}
                        className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Copy translation"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <SpeechButton 
                        text={translation} 
                        language={tgtLang} 
                        size="normal"
                        className="rounded-lg"
                        colorScheme="indigo"
                      />
                    </div>
                  </div>
                  <div className="p-4 h-32 overflow-y-auto">
                    <p className="text-gray-700 leading-relaxed">{translation}</p>
                  </div>
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
                  <option key={lang} value={lang}>
                    {lang} - {languageNames[lang] || lang}
                  </option>
                ))}
              </select>

              <div className="relative">
                <textarea
                  value={insertText}
                  onChange={(e) => setInsertText(e.target.value)}
                  placeholder="Enter text to add to corpus..."
                  className="w-full p-3 pr-12 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
                {insertText && (
                  <SpeechButton 
                    text={insertText} 
                    language={insertLang} 
                    size="normal"
                    className="absolute top-3 right-3 rounded-lg"
                    colorScheme="green"
                  />
                )}
              </div>

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
                    <option key={lang} value={lang}>
                      {lang} - {languageNames[lang] || lang}
                    </option>
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
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border relative">
                      <p className="text-gray-700 pr-24">{example}</p>
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button
                          onClick={async () => {
                            // Translate the example and open in reading view
                            try {
                              const response = await fetch(`${API_BASE}/translate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  text: example,
                                  src_lang: searchLang,
                                  tgt_lang: searchLang === 'en' ? 'de' : 'en'
                                })
                              });
                              const data = await response.json();
                              if (data.translation) {
                                openReadingView(
                                  example,
                                  data.translation,
                                  searchLang,
                                  searchLang === 'en' ? 'de' : 'en',
                                  'Example Reading View'
                                );
                              }
                            } catch (error) {
                              console.error('Translation failed:', error);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Open in Reading View"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <SpeechButton 
                          text={example} 
                          language={searchLang} 
                          size="normal"
                          className="rounded"
                          colorScheme="indigo"
                        />
                      </div>
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
                      <option key={lang} value={lang}>
                        {lang} - {languageNames[lang] || lang}
                      </option>
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
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 relative">
                    <div className="pr-12">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Original:</span> 
                        <span>{translateSearchResults.source_word}</span>
                        <SpeechButton 
                          text={translateSearchResults.source_word} 
                          language={translateSearchSrc} 
                          size="normal"
                          className="rounded"
                          colorScheme="blue"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Translation:</span> 
                        <span>{translateSearchResults.translated_word}</span>
                        <SpeechButton 
                          text={translateSearchResults.translated_word} 
                          language={translateSearchTgt} 
                          size="normal"
                          className="rounded"
                          colorScheme="blue"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {translateSearchResults.examples && translateSearchResults.examples.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-2">Examples:</h3>
                      <div className="space-y-2">
                        {translateSearchResults.examples.map((example, index) => {
                          // Determine if example has translation info
                          const isTranslationPair = typeof example === 'object' && example.sentence;
                          const sentence = isTranslationPair ? example.sentence : example;
                          const translation = isTranslationPair ? example.translation : null;
                          const exampleLang = isTranslationPair ? example.lang : translateSearchTgt;
                          
                          return (
                            <div key={index} className="p-3 bg-gray-50 rounded-lg border relative">
                              <div className="pr-12">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-gray-700">{sentence}</p>
                                  <SpeechButton 
                                    text={sentence} 
                                    language={exampleLang} 
                                    size="normal"
                                    className="rounded"
                                    colorScheme="indigo"
                                  />
                                </div>
                                {translation && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span>{translation}</span>
                                    <SpeechButton 
                                      text={translation} 
                                      language={example.translation_lang} 
                                      size="small"
                                      className="rounded"
                                      colorScheme="indigo"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <MessageDisplay messageKey="translateSearch" />
            </div>
          </div>
        </div>

        {/* YouTube Video + Translation Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube Video + Translation
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">YouTube Video URL</label>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  id="youtubeUrl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  placeholder="Enter a title for this content"
                  defaultValue="YouTube Video Learning Session"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  id="videoTitle"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Original Text ({srcLang})</label>
                <textarea
                  placeholder="Enter the original text (e.g., video transcript, subtitle, or related content)..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  id="videoOriginalText"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Translated Text ({tgtLang})</label>
                <textarea
                  placeholder="Enter the translated text or let the system translate..."
                  className="w-full p-3 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  id="videoTranslatedText"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                const youtubeUrl = document.getElementById('youtubeUrl').value;
                const title = document.getElementById('videoTitle').value;
                const originalText = document.getElementById('videoOriginalText').value;
                let translatedText = document.getElementById('videoTranslatedText').value;
                
                if (!youtubeUrl.trim() || !originalText.trim()) {
                  alert('Please provide both YouTube URL and original text');
                  return;
                }
                
                const videoId = extractYouTubeVideoId(youtubeUrl);
                if (!videoId) {
                  alert('Please provide a valid YouTube URL');
                  return;
                }
                
                const startTime = extractYouTubeStartTime(youtubeUrl);
                
                // Auto-translate if no translation is provided
                if (!translatedText.trim() && originalText.trim()) {
                  try {
                    const response = await fetch(`${API_BASE}/translate`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        text: originalText,
                        src_lang: srcLang,
                        tgt_lang: tgtLang
                      })
                    });
                    const data = await response.json();
                    if (data.translation) {
                      translatedText = data.translation;
                      // Update the textarea with the translation
                      document.getElementById('videoTranslatedText').value = translatedText;
                    }
                  } catch (error) {
                    console.error('Auto-translation failed:', error);
                  }
                }
                
                // For YouTube-only mode, we only show video + translation
                openReadingView(
                  originalText, // Keep original for reference
                  translatedText || originalText, // translatedText - this is what we want to show
                  srcLang,
                  tgtLang,
                  title || 'YouTube Video Learning Session',
                  videoId,
                  startTime,
                  true // youtubeOnly = true for full screen experience
                );
              }}
              className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-lg font-medium"
            >
              <Maximize2 className="w-5 h-5" />
              Open Video Reading View
            </button>

            <div className="text-sm text-gray-600">
              <p>💡 <strong>Tip:</strong> You can include timestamps in YouTube URLs (e.g., ?t=120s) to start the video at a specific time.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reading View Modal */}
      <ReadingViewModal />
    </div>
  );
};

export default LanguageTranslatorApp;