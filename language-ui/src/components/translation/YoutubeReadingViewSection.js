import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { SectionCard } from "../common/SectionCard";

export const YoutubeReadingViewSection = ({ onOpen, srcLang, tgtLang }) => {
  const [formState, setFormState] = useState({
    url: "",
    title: "YouTube Learning Session",
    original: "",
    translated: "",
  });

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormState((p) => ({ ...p, [id]: value }));
  };

  return (
    <SectionCard
      title="YouTube Video + Translation"
      icon={<Maximize2 className="w-5 h-5 text-red-500" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">YouTube URL</label>
          <input
            type="text"
            id="url"
            value={formState.url}
            onChange={handleChange}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full p-3 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            id="title"
            value={formState.title}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Original Text ({srcLang})
          </label>
          <textarea
            id="original"
            value={formState.original}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg h-32 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Translated Text ({tgtLang})
          </label>
          <textarea
            id="translated"
            value={formState.translated}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg h-32 resize-none"
          />
        </div>
      </div>
      <button
        onClick={() => onOpen(formState)}
        disabled={!formState.url || !formState.original}
        className="w-full bg-red-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Maximize2 className="w-5 h-5" /> Open Video Reading View
      </button>
    </SectionCard>
  );
};
