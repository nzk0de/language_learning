import { ArrowRightLeft, Languages, Loader2, Volume2, VolumeX, Square, Maximize2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import ReadingViewModal from './components/ReadingViewModal';

const TranslationPage = () => {
  // State management
  const [languages, setLanguages] = useState([]);
  const [languageNames, setLanguageNames] = useState({});
  const [srcLang, setSrcLang] = useState('en');
  const [tgtLang, setTgtLang] = useState('de');
  const [translationText, setTranslationText] = useState('');
  const [translation, setTranslation] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState({
    languages: false,
    translate: false
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

  // Reading view state
  const [readingView, setReadingView] = useState({
    isOpen: false,
    originalText: '',
    translatedText: '',
    srcLang: 'en',
    tgtLang: 'de',
    title: 'Reading View',
    youtubeVideoId: null,
    youtubeStartTime: null,
    youtubeOnly: false
  });

  // Word examples state
  const [wordExamples, setWordExamples] = useState({
    isOpen: false,
    word: '',
    examples: [],
    translation: '',
    language: ''
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

  // Initialize languages
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

    fetchLanguages();
  }, []);

  // Auto-fill YouTube video form when translation is completed
  useEffect(() => {
    if (translationText && translation) {
      // Auto-fill original text with the input text
      const videoOriginalTextEl = document.getElementById('videoOriginalText');
      if (videoOriginalTextEl && !videoOriginalTextEl.value.trim()) {
        videoOriginalTextEl.value = translationText;
      }
      
      // Auto-fill translated text with the translation
      const videoTranslatedTextEl = document.getElementById('videoTranslatedText');
      if (videoTranslatedTextEl && !videoTranslatedTextEl.value.trim()) {
        videoTranslatedTextEl.value = translation;
      }
      
      // Auto-fill title based on translation
      const videoTitleEl = document.getElementById('videoTitle');
      if (videoTitleEl && videoTitleEl.value === 'YouTube Video Learning Session') {
        const titleText = translation.length > 50 ? translation.substring(0, 50) + '...' : translation;
        videoTitleEl.value = `Learning: ${titleText}`;
      }
    }
  }, [translationText, translation]);

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

  // Translation functions
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
      } else {
        setTranslation(data.translation);
        setMessage('translate', 'Translation completed!', 'success');
      }
    } catch (error) {
      setMessage('translate', 'Translation failed', 'error');
    } finally {
      setLoadingState('translate', false);
    }
  };

  const swapLanguages = () => {
    const newSrc = tgtLang;
    const newTgt = srcLang;
    setSrcLang(newSrc);
    setTgtLang(newTgt);
    setTranslation('');
  };

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
      srcLang: 'en',
      tgtLang: 'de',
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

  // Wrapper for speech with proper language codes
  const speakText = (text, language) => {
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

  // Helper function to extract YouTube video ID from URL
  const extractYouTubeVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  // Helper function to extract start time from YouTube URL
  const extractYouTubeStartTime = (url) => {
    const match = url.match(/[?&]t=(\d+)/);
    return match ? parseInt(match[1]) : null;
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
      youtubeTitleEl.value = text.substring(0, 50) + (text.length > 50 ? '...' : '');
    }
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

  // Reading View Modal Component
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl">
              <Languages className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Translation & Videos
            </h1>
          </div>
          <p className="text-gray-600">Translate text and learn with YouTube videos</p>
        </div>

        {/* Content Grid */}
        <div className="space-y-6">
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
                  {(languages || []).map(lang => (
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
                  {(languages || []).map(lang => (
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
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTranslate}
                  disabled={loading.translate || !translationText.trim()}
                  className="bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loading.translate ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Languages className="w-5 h-5" />
                  )}
                  Translate
                </button>

                {(translationText && translation) && (
                  <button
                    onClick={() => openReadingView(translationText, translation, srcLang, tgtLang, 'Translation Reading View')}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    title="Open in reading view"
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              {translation && (
                <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-indigo-500">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">Translation ({tgtLang}):</h3>
                    <SpeechButton 
                      text={translation} 
                      language={tgtLang} 
                      size="normal"
                      colorScheme="green"
                    />
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{translation}</p>
                </div>
              )}

              <MessageDisplay messageKey="translate" />
            </div>
          </div>

          {/* YouTube Video Section */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Maximize2 className="w-5 h-5 text-red-500" />
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
                  
                  // Auto-translate if translated text is empty
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
      </div>

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

export default TranslationPage;
