import { Book, X, Volume2, Square, Eye } from 'lucide-react';
import { useRef, useEffect } from 'react';

const ReadingViewModal = ({ 
  readingView, 
  closeReadingView, 
  languageNames, 
  speechState, 
  speakText, 
  stopSpeech, 
  pauseResumeSpeech 
}) => {
  // Refs for synchronized scrolling
  const originalScrollRef = useRef(null);
  const translatedScrollRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  if (!readingView.isOpen) return null;

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
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${
      readingView.youtubeOnly ? 'p-0' : 'p-4'
    }`}>
      <div className={`bg-white shadow-2xl flex flex-col ${
        readingView.youtubeOnly 
          ? 'w-full h-full max-w-none max-h-none m-0 rounded-none' 
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

export default ReadingViewModal;
