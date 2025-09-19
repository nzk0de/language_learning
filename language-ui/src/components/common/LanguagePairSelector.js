import { ArrowRightLeft } from "lucide-react";

export const LanguagePairSelector = ({
  state, // An object like { srcLang: 'en', tgtLang: 'de' }
  onStateChange, // A function to update the parent's state
  languages,
  languageNames,
  labels = { from: "From", to: "To" }, // Optional custom labels
}) => {
  const handleSwap = () => {
    // Notify the parent to swap the languages
    onStateChange({ srcLang: state.tgtLang, tgtLang: state.srcLang });
  };

  const handleChange = (field, value) => {
    // Notify the parent of a change to either srcLang or tgtLang
    onStateChange({ ...state, [field]: value });
  };

  return (
    <div className="flex items-end gap-2">
      {/* From Language */}
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels.from}:
        </label>
        <select
          value={state.srcLang}
          onChange={(e) => handleChange("srcLang", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          disabled={!languages || languages.length === 0}
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {languageNames[lang] || lang}
            </option>
          ))}
        </select>
      </div>

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        title="Swap languages"
      >
        <ArrowRightLeft className="w-5 h-5" />
      </button>

      {/* To Language */}
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels.to}:
        </label>
        <select
          value={state.tgtLang}
          onChange={(e) => handleChange("tgtLang", e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          disabled={!languages || languages.length === 0}
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {languageNames[lang] || lang}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
