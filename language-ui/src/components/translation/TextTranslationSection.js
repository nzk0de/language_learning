import { ArrowRightLeft, Languages, Loader2, Maximize2 } from "lucide-react";
import { SectionCard } from "../common/SectionCard";
import { SpeechButton } from "../common/SpeechButton";
import { MessageDisplay } from "../common/MessageDisplay";

export const TextTranslationSection = ({
  translateState,
  setTranslateState,
  languages,
  languageNames,
  onTranslate,
  onSwap,
  onOpenReadingView,
  loading,
  translationResult,
  message,
  speechProps,
}) => {
  const { srcLang, tgtLang, text } = translateState;

  return (
    <SectionCard
      title="Translate Text"
      icon={<Languages className="w-5 h-5" />}
    >
      <div className="flex items-center gap-2">
        <select
          value={srcLang}
          onChange={(e) =>
            setTranslateState((p) => ({ ...p, srcLang: e.target.value }))
          }
          className="flex-1 p-3 border rounded-lg"
          disabled={!languages.length}
        >
          {languages.map((l) => (
            <option key={l} value={l}>
              {languageNames[l] || l}
            </option>
          ))}
        </select>
        <button
          onClick={onSwap}
          className="p-3 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
        >
          <ArrowRightLeft className="w-5 h-5" />
        </button>
        <select
          value={tgtLang}
          onChange={(e) =>
            setTranslateState((p) => ({ ...p, tgtLang: e.target.value }))
          }
          className="flex-1 p-3 border rounded-lg"
          disabled={!languages.length}
        >
          {languages.map((l) => (
            <option key={l} value={l}>
              {languageNames[l] || l}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) =>
            setTranslateState((p) => ({ ...p, text: e.target.value }))
          }
          placeholder="Enter text to translate..."
          className="w-full p-3 pr-12 border rounded-lg h-32 resize-none"
        />
        <div className="absolute top-2 right-2">
          <SpeechButton
            text={text}
            language={srcLang}
            {...speechProps}
            colorScheme="indigo"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onTranslate}
          disabled={loading || !text.trim()}
          className="flex-1 bg-indigo-600 text-white py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Languages className="w-5 h-5" />
          )}{" "}
          Translate
        </button>
        {translationResult && (
          <button
            onClick={onOpenReadingView}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        )}
      </div>
      {translationResult && (
        <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-800">Translation:</h3>
            <SpeechButton
              text={translationResult}
              language={tgtLang}
              {...speechProps}
              colorScheme="green"
            />
          </div>
          <p className="text-gray-700 whitespace-pre-wrap">
            {translationResult}
          </p>
        </div>
      )}
      <MessageDisplay message={message} />
    </SectionCard>
  );
};
