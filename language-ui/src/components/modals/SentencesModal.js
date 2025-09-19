import { X, Book, Loader2 } from "lucide-react"; // <-- ADD Loader2 HERE
import { SpeechButton } from "../common/SpeechButton";

export const SentencesModal = ({
  modalState,
  closeModal,
  onTranslate,
  speechProps,
  translatedWord,
  isTranslatingWord,
}) => {
  if (!modalState.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* --- MODAL HEADER --- */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {" "}
            {/* Increased gap for better spacing */}
            <div className="flex items-center gap-2">
              <Book className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                {modalState.title}
              </h2>
            </div>
            <div className="flex items-center px-3 py-1 bg-gray-100 rounded-full text-sm">
              {isTranslatingWord ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
              ) : (
                <span className="text-gray-700 font-medium">
                  {translatedWord}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* --- MODAL CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {modalState.sentences.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No sentences to display.</p>
            </div>
          ) : (
            modalState.sentences.map((sentence, index) => {
              const translation = modalState.translations[index];
              const isTranslated = !!translation;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Original Sentence */}
                  <div className="p-4 bg-gray-50 flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                        Original ({modalState.srcLang})
                      </span>
                      <div
                        className="text-gray-800 mt-1 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: sentence }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {" "}
                      {/* Ensured items-center */}
                      <button
                        onClick={() => onTranslate(index)}
                        disabled={isTranslated}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          isTranslated
                            ? "bg-green-100 text-green-700 cursor-default"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        {isTranslated ? "Translated" : "Translate"}
                      </button>
                      <SpeechButton
                        text={sentence.replace(/<[^>]*>/g, "")}
                        language={modalState.srcLang}
                        {...speechProps}
                        colorScheme="indigo"
                      />
                    </div>
                  </div>
                  {/* Translated Sentence */}
                  {isTranslated && (
                    <div className="p-4 bg-blue-50 border-t border-gray-200 flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">
                          Translation ({modalState.tgtLang})
                        </span>
                        <div
                          className="text-blue-800 mt-1 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: translation }}
                        />
                      </div>
                      <SpeechButton
                        text={translation.replace(/<[^>]*>/g, "")}
                        language={modalState.tgtLang}
                        {...speechProps}
                        colorScheme="blue"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* --- MODAL FOOTER --- */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
          <button
            onClick={closeModal}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
