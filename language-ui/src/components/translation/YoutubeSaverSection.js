import { useState } from "react";
import { Youtube, Loader2, Save } from "lucide-react";
import { SectionCard } from "../common/SectionCard";
import { MessageDisplay } from "../common/MessageDisplay";
import { LanguagePairSelector } from "../common/LanguagePairSelector"; // <-- IMPORT THE COMPONENT HERE TOO

export const YoutubeSaverSection = ({
  languages,
  languageNames,
  onSave,
  loading,
  message,
}) => {
  const [url, setUrl] = useState("");
  const [langState, setLangState] = useState({ srcLang: "en", tgtLang: "de" });

  const handleSaveClick = () => {
    if (url.trim()) {
      onSave({ url, srcLang: langState.srcLang, tgtLang: langState.tgtLang });
    }
  };

  return (
    <SectionCard
      title="Save YouTube Video with Transcript"
      icon={<Youtube className="w-5 h-5 text-red-500" />}
    >
      <p className="text-sm text-gray-600 -mt-2 mb-2">
        Paste a YouTube URL, choose languages, and save it to your library. The
        transcript will be automatically fetched and translated.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          YouTube Video URL
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* --- REUSABLE COMPONENT IN ACTION --- */}
      <LanguagePairSelector
        state={langState}
        onStateChange={setLangState}
        languages={languages}
        languageNames={languageNames}
        labels={{
          from: "Transcript Language (Source)",
          to: "Translate To (Target)",
        }}
      />

      <button
        onClick={handleSaveClick}
        disabled={loading || !url.trim()}
        className="w-full bg-red-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-red-700 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Save className="w-5 h-5" />
        )}
        Fetch & Save Video
      </button>
      <MessageDisplay message={message} />
    </SectionCard>
  );
};
