import { useState, useRef, useEffect } from "react";

// Helper to get the correct language code for the SpeechSynthesis API
const getSpeechLanguageCode = (langCode) => {
  const languageMap = {
    en: "en-US",
    de: "de-DE",
    es: "es-ES" /* ... add others as needed */,
  };
  return languageMap[langCode] || langCode;
};

export const useSpeech = () => {
  const [speechState, setSpeechState] = useState({
    isSpeaking: false,
    currentText: "",
    currentLang: "",
    isPaused: false,
  });
  const speechSynthesis = useRef(window.speechSynthesis);

  // Ensure voices are loaded
  useEffect(() => {
    const handleVoicesChanged = () => {
      // The voices are now loaded and can be used.
      console.log("Speech synthesis voices loaded.");
    };
    speechSynthesis.current.addEventListener(
      "voiceschanged",
      handleVoicesChanged
    );
    return () => {
      speechSynthesis.current.removeEventListener(
        "voiceschanged",
        handleVoicesChanged
      );
      speechSynthesis.current.cancel(); // Clean up on unmount
    };
  }, []);

  const speak = (text, language) => {
    if (!text || !language || !speechSynthesis.current) return;

    if (speechState.isSpeaking && speechState.currentText === text) {
      stop();
      return;
    }

    speechSynthesis.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLanguageCode(language);
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Set up event listeners
    utterance.onstart = () =>
      setSpeechState({
        isSpeaking: true,
        currentText: text,
        currentLang: language,
        isPaused: false,
      });
    utterance.onend = () =>
      setSpeechState({
        isSpeaking: false,
        currentText: "",
        currentLang: "",
        isPaused: false,
      });
    utterance.onerror = () =>
      setSpeechState({
        isSpeaking: false,
        currentText: "",
        currentLang: "",
        isPaused: false,
      });

    speechSynthesis.current.speak(utterance);
  };

  const stop = () => {
    if (speechSynthesis.current) {
      speechSynthesis.current.cancel();
      setSpeechState({
        isSpeaking: false,
        currentText: "",
        currentLang: "",
        isPaused: false,
      });
    }
  };

  const pauseResume = () => {
    if (speechSynthesis.current) {
      if (speechState.isPaused) {
        speechSynthesis.current.resume();
        setSpeechState((prev) => ({ ...prev, isPaused: false }));
      } else {
        speechSynthesis.current.pause();
        setSpeechState((prev) => ({ ...prev, isPaused: true }));
      }
    }
  };

  return { speechState, speak, stop, pauseResume };
};
