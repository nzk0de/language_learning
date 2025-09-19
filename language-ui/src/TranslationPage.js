import { useState, useMemo } from "react";
import { Languages } from "lucide-react";
import { useSpeech } from "./hooks/useSpeech";
import { useDataFetching } from "./hooks/useDataFetching";
import { TextTranslationSection } from "./components/translation/TextTranslationSection";
import { YoutubeReadingViewSection } from "./components/translation/YoutubeReadingViewSection";
import ReadingViewModal from "./components/modals/ReadingViewModal";

const API_BASE = "http://localhost:8000";

const extractYouTubeVideoId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const TranslationPage = () => {
  const speechProps = useSpeech();
  const { data: languagesData, loading: languagesLoading } =
    useDataFetching("/languages");
  const languages = useMemo(
    () => Object.keys(languagesData?.languages || {}),
    [languagesData]
  );
  const languageNames = useMemo(
    () => languagesData?.languages || {},
    [languagesData]
  );

  const [translateState, setTranslateState] = useState({
    srcLang: "en",
    tgtLang: "de",
    text: "",
  });
  const [translationResult, setTranslationResult] = useState("");
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateMessage, setTranslateMessage] = useState(null);

  const [readingView, setReadingView] = useState({ isOpen: false });

  const handleTranslate = async () => {
    if (!translateState.text.trim()) return;
    setTranslateLoading(true);
    setTranslateMessage(null);
    setTranslationResult("");
    try {
      const response = await fetch(`${API_BASE}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translateState.text,
          src_lang: translateState.srcLang,
          tgt_lang: translateState.tgtLang,
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTranslationResult(data.translation);
      setTranslateMessage({
        message: "Translation complete!",
        type: "success",
      });
    } catch (error) {
      setTranslateMessage({ message: error.message, type: "error" });
    } finally {
      setTranslateLoading(false);
    }
  };

  const handleSwap = () => {
    // Capture the current text before it gets updated
    const oldText = translateState.text;

    // Update the state for languages and set the new text
    setTranslateState((p) => ({
      ...p,
      srcLang: p.tgtLang,
      tgtLang: p.srcLang,
      text: translationResult || "", // The new text is the old translation
    }));

    // Set the new translation result to be the old input text
    setTranslationResult(oldText);
  };

  const openReadingView = (
    originalText,
    translatedText,
    srcLang,
    tgtLang,
    title,
    videoId = null
  ) => {
    setReadingView({
      isOpen: true,
      originalText,
      translatedText,
      srcLang,
      tgtLang,
      title,
      youtubeVideoId: videoId,
      youtubeOnly: !!videoId,
    });
  };

  const handleOpenYoutubeView = async (form) => {
    const videoId = extractYouTubeVideoId(form.url);
    if (!videoId) {
      alert("Invalid YouTube URL");
      return;
    }

    let finalTranslatedText = form.translated;

    // Auto-translate if translated text is empty but original is not
    if (!finalTranslatedText.trim() && form.original.trim()) {
      setTranslateLoading(true); // Show a loading indicator
      try {
        const response = await fetch(`${API_BASE}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: form.original,
            src_lang: translateState.srcLang,
            tgt_lang: translateState.tgtLang,
          }),
        });
        const data = await response.json();
        if (data.translation) {
          finalTranslatedText = data.translation;
        } else {
          throw new Error(data.error || "Translation failed");
        }
      } catch (error) {
        alert(`Auto-translation failed: ${error.message}`);
        setTranslateLoading(false);
        return; // Stop if translation fails
      } finally {
        setTranslateLoading(false);
      }
    }

    openReadingView(
      form.original,
      finalTranslatedText,
      translateState.srcLang,
      translateState.tgtLang,
      form.title,
      videoId
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Translation & Videos</h1>
          <p className="text-gray-600">
            Translate text and learn with YouTube videos
          </p>
        </div>
        <div className="space-y-6">
          <TextTranslationSection
            translateState={translateState}
            setTranslateState={setTranslateState}
            languages={languages}
            languageNames={languageNames}
            onTranslate={handleTranslate}
            onSwap={handleSwap}
            onOpenReadingView={() =>
              openReadingView(
                translateState.text,
                translationResult,
                translateState.srcLang,
                translateState.tgtLang,
                "Translation View"
              )
            }
            loading={translateLoading || languagesLoading}
            translationResult={translationResult}
            message={translateMessage}
            speechProps={speechProps}
          />
          <YoutubeReadingViewSection
            onOpen={handleOpenYoutubeView}
            srcLang={translateState.srcLang}
            tgtLang={translateState.tgtLang}
          />
        </div>
      </div>
      <ReadingViewModal
        readingView={readingView}
        closeReadingView={() => setReadingView({ isOpen: false })}
        languageNames={languageNames}
        {...speechProps}
      />
    </div>
  );
};

export default TranslationPage;
