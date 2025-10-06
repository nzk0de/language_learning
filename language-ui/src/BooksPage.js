import { Book, Search } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { usePaginatedBooks } from "./hooks/usePaginatedBooks";
import Modal from "./components/Modal";
import ConfirmDialog from "./components/ConfirmDialog";
import { BookCard } from "./components/BookCard";
import { Pagination } from "./components/common/Pagination";
import { buildApiUrl } from "./config/api";

const BooksPage = () => {
  // The custom hook handles all fetching, searching, and pagination state.
  const {
    books,
    isLoading,
    isInitialLoad,
    page,
    totalPages,
    goToPage,
    setSearchTerm,
  } = usePaginatedBooks();
  const [localSearchTerm, setLocalSearchTerm] = useState("");

  // Modal and dialog state management remains in the page component.
  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const showModal = (type, title, message) =>
    setModal({ isOpen: true, type, title, message });
  const showConfirm = (title, message, onConfirm) =>
    setConfirmDialog({ isOpen: true, title, message, onConfirm });

  // --- FULL IMPLEMENTATION OF BOOK ACTION LOGIC ---

  const downloadBook = async (filename) => {
    try {
      const response = await fetch(
        buildApiUrl(`books/${encodeURIComponent(filename)}/download`)
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Download request failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showModal(
        "error",
        "Download Failed",
        `Could not download "${filename}". Reason: ${error.message}`
      );
    }
  };

  const openBookWithReader = async (book) => {
    try {
      // This is the fetch call that was missing.
      const response = await fetch(
        buildApiUrl(`books/${encodeURIComponent(book.filename)}/open`),
        {
          method: "POST",
        }
      );

      // Check if the request itself was successful
      if (!response.ok) {
        const errorData = await response.json();
        // This will trigger the catch block below
        throw new Error(
          errorData.detail || `Server responded with status ${response.status}`
        );
      }

      const result = await response.json();

      if (result.success) {
        showModal(
          "success",
          "Opening Book",
          `Attempting to open "${book.title}" with your system's default EPUB reader.`
        );
      } else {
        // If the server returns success: false, also trigger the fallback.
        throw new Error(result.message || "Backend could not open the book.");
      }
    } catch (error) {
      console.error("Error opening book:", error);
      // This catch block now correctly handles both network failures and server-side errors,
      // triggering the fallback dialog.
      showConfirm(
        "Reader Not Found",
        `We couldn't open "${book.title}" directly on your system. Would you like to download the file instead?`,
        () => downloadBook(book.filename)
      );
    }
  };

  // --- Search Input Handler ---
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setLocalSearchTerm(term);
    setSearchTerm(term); // This calls the debounced function from the hook
  };

  const clearSearch = () => {
    setLocalSearchTerm("");
    setSearchTerm("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Search Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 sticky top-4 z-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Your Library
          </h2>
          <div className="flex items-center gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={localSearchTerm}
                onChange={handleSearchChange}
                placeholder="Search by title, author..."
                className="w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            {localSearchTerm && (
              <button
                onClick={clearSearch}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Books Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isInitialLoad
            ? [...Array(12)].map((_, i) => (
                <BookCard.Skeleton key={`skeleton-${i}`} />
              ))
            : books.map((book) => (
                <BookCard
                  key={book.filename}
                  book={book}
                  onOpen={openBookWithReader} // Pass the fully implemented function
                  onDownload={downloadBook} // Pass the fully implemented function
                />
              ))}
        </div>

        {/* Loading indicator for subsequent pages */}
        {isLoading && !isInitialLoad && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <BookCard.Skeleton key={`loading-${i}`} />
            ))}
          </div>
        )}

        {/* Message for no results */}
        {!isLoading && books.length === 0 && (
          <div className="col-span-full bg-white rounded-xl shadow-lg p-12 text-center">
            <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No Books Found
            </h3>
            <p className="text-gray-500">
              {localSearchTerm
                ? `No books match your search for "${localSearchTerm}".`
                : "Your library is empty."}
            </p>
          </div>
        )}

        {/* Pagination Component */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          isLoading={isLoading}
        />
      </div>

      {/* Modals */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        {...modal}
      />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        {...confirmDialog}
      />
    </div>
  );
};

export default BooksPage;
