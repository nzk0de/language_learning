import { useState, useMemo, useEffect } from "react";
import { useSpeech } from "./hooks/useSpeech";
import { useDataFetching } from "./hooks/useDataFetching";
import { YoutubeSaverSection } from "./components/translation/YoutubeSaverSection";
import { SavedVideosList } from "./components/translation/SavedVideosList";
import ReadingViewModal from "./components/modals/ReadingViewModal";

const API_BASE = "http://localhost:8000";

const YoutubePage = () => {
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

  const [savedVideos, setSavedVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [readingView, setReadingView] = useState({ isOpen: false });

  const fetchSavedVideos = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/youtube/saved`);
      const data = await response.json();
      if (data.videos) {
        setSavedVideos(data.videos);
      }
    } catch (error) {
      setMessage({ message: "Failed to fetch saved videos.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch videos on initial component mount
  useEffect(() => {
    fetchSavedVideos();
  }, []);

  const handleSaveVideo = async ({ url, srcLang, tgtLang }) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE}/youtube/save?youtube_url=${encodeURIComponent(
          url
        )}&src_lang=${srcLang}&tgt_lang=${tgtLang}`,
        {
          method: "POST",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to save video.");
      }
      setMessage({ message: data.message, type: "success" });
      fetchSavedVideos(); // Refresh the list of saved videos
    } catch (error) {
      setMessage({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoSelect = async (videoId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/youtube/saved/${videoId}`);
      const videoData = await response.json();
      if (!response.ok) {
        throw new Error(videoData.detail || "Failed to fetch video details.");
      }
      // The ReadingViewModal needs separate texts, not a combined transcript object
      const originalText = videoData.transcript
        .map((t) => t.original_sentence)
        .join("\n\n");
      const translatedText = videoData.transcript
        .map((t) => t.translated_sentence)
        .join("\n\n");

      setReadingView({
        isOpen: true,
        originalText,
        translatedText,
        srcLang: videoData.src_lang,
        tgtLang: videoData.tgt_lang,
        title: videoData.title,
        youtubeVideoId: videoData.video_id,
        youtubeOnly: true, // Or based on your preference
      });
    } catch (error) {
      setMessage({ message: error.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900">
            YouTube Language Library
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Save videos with translated transcripts to study anytime.
          </p>
        </div>
        <div className="space-y-12">
          <YoutubeSaverSection
            languages={languages}
            languageNames={languageNames}
            onSave={handleSaveVideo}
            loading={isLoading || languagesLoading}
            message={message}
          />
          <SavedVideosList
            videos={savedVideos}
            onVideoSelect={handleVideoSelect}
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

export default YoutubePage;
