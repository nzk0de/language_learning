import { Book, Search, Loader2, Download, FileText, Languages, BookOpen, Star, Calendar, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from './components/Modal';
import ConfirmDialog from './components/ConfirmDialog';

const BooksPage = () => {
  // Books state
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksSearch, setBooksSearch] = useState('');
  
  // Modal state
  const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', actions: [] });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Modal helpers
  const showModal = (type, title, message, actions = []) => {
    setModal({ isOpen: true, type, title, message, actions });
  };

  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  const closeModal = () => setModal({ isOpen: false, type: 'info', title: '', message: '', actions: [] });
  const closeConfirmDialog = () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });

  // Books functions
  const fetchBooks = async (search = '') => {
    console.log('Fetching books with search:', search);
    setBooksLoading(true);
    try {
      const url = search 
        ? `http://localhost:8000/books?search=${encodeURIComponent(search)}`
        : 'http://localhost:8000/books';
      
      console.log('Fetching from URL:', url);
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.books) {
        console.log('Successfully fetched', data.books.length, 'books');
        setBooks(data.books);
      } else {
        console.error('Failed to fetch books:', data.error);
        setBooks([]);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  const downloadBook = async (filename) => {
    try {
      const response = await fetch(`http://localhost:8000/books/${encodeURIComponent(filename)}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to download book');
      }
    } catch (error) {
      console.error('Error downloading book:', error);
    }
  };

  const openBookWithReader = async (book) => {
    try {
      // Try to open with system default application first
      const response = await fetch(`http://localhost:8000/books/${encodeURIComponent(book.filename)}/open`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showModal('success', 'Book Opening', `"${book.title}" is opening with your system's default EPUB reader...`);
          return;
        }
      }
      
      // Fallback: offer to download
      const fallbackDownload = async () => {
        try {
          const downloadResponse = await fetch(`http://localhost:8000/books/${encodeURIComponent(book.filename)}/download`);
          if (downloadResponse.ok) {
            const blob = await downloadResponse.blob();
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = book.filename;
            document.body.appendChild(a);
            a.click();
            
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Show success message with instructions
            const instructions = `"${book.title}" has been downloaded successfully!\n\nTo read this book:\n• Install Calibre (free): https://calibre-ebook.com/\n• Or use any EPUB reader app\n• Open the downloaded .epub file\n\nThe file is now in your Downloads folder.`;
            showModal('success', 'Download Complete', instructions);
          } else {
            throw new Error('Failed to download book');
          }
        } catch (error) {
          showModal('error', 'Download Failed', `Failed to download "${book.title}". Please try again.`);
        }
      };
      
      showConfirm(
        'Open Book',
        `Cannot open "${book.title}" directly with the system reader.\n\nWould you like to download it to open with Calibre or another EPUB reader?`,
        fallbackDownload,
        'warning'
      );
      
    } catch (error) {
      console.error('Error opening book:', error);
      showModal('error', 'Error', `Failed to open "${book.title}". Please try again.`);
    }
  };

  // Load books on component mount
  useEffect(() => {
    console.log('BooksPage component mounted, fetching books...');
    fetchBooks();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="space-y-8">
          {/* Enhanced Search and Controls */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-gray-200 p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <Book className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">
                    Your Library
                  </h2>
                  <p className="text-sm text-gray-600">{books.length} books available</p>
                </div>
              </div>
            </div>
            
            {/* Enhanced Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={booksSearch}
                  onChange={(e) => setBooksSearch(e.target.value)}
                  placeholder="Search by title, author, or description..."
                  className="w-full pl-12 pr-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white/80 backdrop-blur-sm"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      fetchBooks(booksSearch);
                    }
                  }}
                />
              </div>
              <button
                onClick={() => fetchBooks(booksSearch)}
                disabled={booksLoading}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                Search
              </button>
              {booksSearch && (
                <button
                  onClick={() => {
                    setBooksSearch('');
                    fetchBooks('');
                  }}
                  className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Books Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {booksLoading ? (
              // Loading skeleton
              [...Array(8)].map((_, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))
            ) : books.length > 0 ? (
              books.map((book, index) => (
                <div key={index} className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden hover:shadow-2xl hover:ring-indigo-200 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex flex-col h-full">
                    {/* Enhanced Cover Image */}
                    <div className="relative h-56 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center overflow-hidden">
                      {book.cover_image ? (
                        <img
                          src={`http://localhost:8000/books/${encodeURIComponent(book.filename)}/cover`}
                          alt={`Cover of ${book.title}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center h-full w-full ${book.cover_image ? 'hidden' : ''}`}>
                        <div className="p-6 bg-white/20 rounded-2xl backdrop-blur-sm">
                          <Book className="w-20 h-20 text-indigo-400" />
                        </div>
                      </div>
                      {/* Gradient overlay for better text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-2 group-hover:text-indigo-700 transition-colors" title={book.title}>
                          {book.title}
                        </h3>
                        <div className="flex items-center gap-2 text-gray-600 mb-3">
                          <User className="w-4 h-4" />
                          <p className="text-sm font-medium" title={book.author}>
                            {book.author}
                          </p>
                        </div>
                      </div>
                    
                    {/* Enhanced Book metadata */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        <FileText className="w-3 h-3" />
                        <span>{(book.file_size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      {book.language && (
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                          <Languages className="w-3 h-3" />
                          <span>{book.language.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        <Star className="w-3 h-3" />
                        <span>EPUB</span>
                      </div>
                    </div>

                    {/* Description (if available) */}
                    {book.description && (
                      <div className="flex-1 mb-6">
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3" title={book.description}>
                          {book.description.length > 100 
                            ? book.description.substring(0, 100) + '...' 
                            : book.description || 'No description available.'
                          }
                        </p>
                      </div>
                    )}

                      {/* Enhanced Action buttons */}
                      <div className="mt-auto space-y-3">
                        <button
                          onClick={() => openBookWithReader(book)}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <BookOpen className="w-5 h-5" />
                          Open Book
                        </button>
                        <button
                          onClick={() => downloadBook(book.filename)}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                          <Download className="w-5 h-5" />
                          Download EPUB
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white rounded-xl shadow-lg p-12 text-center">
                <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Books Found</h3>
                <p className="text-gray-500 mb-4">
                  {booksSearch 
                    ? `No books match your search for "${booksSearch}"`
                    : 'No German books available in your collection'
                  }
                </p>
                <button
                  onClick={() => {
                    setBooksSearch('');
                    fetchBooks('');
                  }}
                  className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Show All Books
                </button>
              </div>
            )}
          </div>

          {/* Books Statistics */}
          {books.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Collection Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-indigo-600">{books.length}</div>
                  <div className="text-sm text-gray-600">Total Books</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(books.map(book => book.author)).size}
                  </div>
                  <div className="text-sm text-gray-600">Authors</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {(books.reduce((sum, book) => sum + (book.file_size || 0), 0) / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <div className="text-sm text-gray-600">Total Size</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(books.map(book => book.language)).size}
                  </div>
                  <div className="text-sm text-gray-600">Languages</div>
                </div>
              </div>
            </div>
          )}

          {/* Back to Translator Link */}
          <div className="text-center mt-12">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/70 backdrop-blur-sm text-indigo-600 hover:text-indigo-800 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 ring-1 ring-gray-200 hover:ring-indigo-200"
            >
              ← Back to Translator
            </a>
          </div>
        </div>

        {/* Custom Modals */}
        <Modal
          isOpen={modal.isOpen}
          onClose={closeModal}
          type={modal.type}
          title={modal.title}
          message={modal.message}
          actions={modal.actions}
        />
        
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={closeConfirmDialog}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />
      </div>
    </div>
  );
};

export default BooksPage;
