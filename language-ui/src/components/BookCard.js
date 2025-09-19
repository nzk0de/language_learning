import {
  Book,
  User,
  FileText,
  Languages,
  Star,
  BookOpen,
  Download,
} from "lucide-react";

// Pass the whole book object to onOpen, but just the filename to onDownload
export const BookCard = ({ book, onOpen, onDownload }) => (
  <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden hover:shadow-2xl hover:ring-indigo-200 transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
    {/* ... image and metadata divs ... */}
    <div className="relative h-56 bg-gradient-to-br from-indigo-50 to-pink-50 flex items-center justify-center">
      {book.cover_image ? (
        <img
          src={`http://localhost:8000/books/${encodeURIComponent(
            book.filename
          )}/cover`}
          alt={`Cover of ${book.title}`}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
        />
      ) : (
        <Book className="w-20 h-20 text-indigo-300" />
      )}
    </div>
    <div className="p-6 flex-1 flex flex-col">
      <h3
        className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-indigo-700"
        title={book.title}
      >
        {book.title}
      </h3>
      <div className="flex items-center gap-2 text-gray-600 mb-4 text-sm">
        <User className="w-4 h-4" />
        <span>{book.author}</span>
      </div>

      {book.description && (
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1 mb-6">
          {book.description}
        </p>
      )}

      <div className="mt-auto space-y-3">
        {/* --- THE FIX IS HERE --- */}
        <button
          onClick={() => onOpen(book)} // Pass the book object on click
          className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
        >
          <BookOpen className="w-5 h-5" /> Open Book
        </button>
        <button
          onClick={() => onDownload(book.filename)} // Pass the filename on click
          className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium"
        >
          <Download className="w-5 h-5" /> Download
        </button>
      </div>
    </div>
  </div>
);

// Skeleton loader remains the same
BookCard.Skeleton = () => (
  <div className="bg-white rounded-2xl shadow-xl p-6 animate-pulse">
    <div className="h-56 bg-gray-200 rounded-lg mb-4"></div>
    <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
    <div className="h-12 bg-gray-200 rounded-xl mt-4"></div>
    <div className="h-12 bg-gray-200 rounded-xl mt-3"></div>
  </div>
);
