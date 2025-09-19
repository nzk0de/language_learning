import { Volume2, VolumeX, Square } from "lucide-react";

export const SpeechButton = ({
  text,
  language,
  speechState,
  speak,
  pauseResume,
  stop,
  size = "normal",
  className = "",
  colorScheme = "blue",
}) => {
  if (!text) return null;

  const isCurrentlySpeaking =
    speechState.isSpeaking &&
    speechState.currentText === text &&
    speechState.currentLang === language;
  const isPausedForThis =
    speechState.isPaused &&
    speechState.currentText === text &&
    speechState.currentLang === language;

  const sizeClasses = size === "large" ? "p-3" : "p-2";
  const iconClasses = size === "large" ? "w-6 h-6" : "w-4 h-4";

  const colorClasses = isCurrentlySpeaking
    ? `text-${colorScheme}-600 bg-${colorScheme}-100 hover:bg-${colorScheme}-200`
    : `text-${colorScheme}-500 hover:text-${colorScheme}-600 hover:bg-${colorScheme}-50`;

  const handleSpeakClick = (e) => {
    e.stopPropagation(); // Prevent parent onClick events
    if (isPausedForThis) {
      pauseResume();
    } else {
      speak(text, language);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={handleSpeakClick}
        className={`${sizeClasses} ${colorClasses} rounded-lg transition-colors`}
        title={
          isPausedForThis ? "Resume" : isCurrentlySpeaking ? "Stop" : "Speak"
        }
      >
        {isCurrentlySpeaking && !isPausedForThis ? (
          <VolumeX className={iconClasses} />
        ) : (
          <Volume2 className={iconClasses} />
        )}
      </button>
      {isCurrentlySpeaking && !isPausedForThis && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            pauseResume();
          }}
          className={`${sizeClasses} text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors`}
          title="Pause"
        >
          <Square className={iconClasses} />
        </button>
      )}
    </div>
  );
};
