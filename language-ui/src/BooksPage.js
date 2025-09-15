import { Book, Search, Loader2, Download, FileText, Languages, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';

const BooksPage = () => {
  // Books state
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksSearch, setBooksSearch] = useState('');

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
          alert(`Opening "${book.title}" with your system's default EPUB reader...`);
          return;
        }
      }
      
      // Fallback: offer to download
      const userChoice = window.confirm(
        `Cannot open "${book.title}" directly. Would you like to download it to open with Calibre or another EPUB reader?\n\n` +
        `Click OK to download, or Cancel to go back.`
      );
      
      if (userChoice) {
        // Download the book
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
          
          // Show helpful instructions
          setTimeout(() => {
            const instructions = `📚 "${book.title}" has been downloaded!\n\nTo read this book:\n• Install Calibre (free): https://calibre-ebook.com/\n• Or use any EPUB reader app\n• Open the downloaded .epub file\n\nThe file has been saved to your Downloads folder.`;
            alert(instructions);
          }, 500);
        } else {
          throw new Error('Failed to download book');
        }
      }
    } catch (error) {
      console.error('Error opening book:', error);
      alert('Error opening book. Please try again.');
    }
  };

  // Load books on component mount
  useEffect(() => {
    console.log('BooksPage component mounted, fetching books...');
    fetchBooks();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Book className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">German Books Collection</h1>
          </div>
          <p className="text-gray-600">Browse and download your EPUB book collection</p>
        </header>

        <div className="space-y-6">
          {/* Search and Controls */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Your Books ({books.length})
              </h2>
              <button
                onClick={() => fetchBooks(booksSearch)}
                disabled={booksLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {booksLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Refresh
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={booksSearch}
                  onChange={(e) => setBooksSearch(e.target.value)}
                  placeholder="Search by title, author, or description..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="flex flex-col h-full">
                    {/* Cover Image */}
                    <div className="h-48 bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                      {book.cover_image ? (
                        <img
                          src={`http://localhost:8000/books/${encodeURIComponent(book.filename)}/cover`}
                          alt={`Cover of ${book.title}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center h-full w-full ${book.cover_image ? 'hidden' : ''}`}>
                        <Book className="w-16 h-16 text-indigo-400" />
                      </div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2" title={book.title}>
                          {book.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2" title={book.author}>
                          by {book.author}
                        </p>
                      </div>
                    
                    {/* Book metadata */}
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center text-xs text-gray-500">
                        <FileText className="w-3 h-3 mr-1" />
                        <span>{(book.file_size / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      {book.language && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Languages className="w-3 h-3 mr-1" />
                          <span>{book.language}</span>
                        </div>
                      )}
                      {book.publisher && (
                        <div className="text-xs text-gray-500 truncate" title={book.publisher}>
                          Publisher: {book.publisher}
                        </div>
                      )}
                    </div>

                    {/* Description (if available) */}
                    {book.description && (
                      <div className="flex-1 mb-4">
                        <p className="text-sm text-gray-600 line-clamp-3" title={book.description}>
                          {book.description.length > 120 
                            ? book.description.substring(0, 120) + '...' 
                            : book.description
                          }
                        </p>
                      </div>
                    )}

                      {/* Action buttons */}
                      <div className="mt-auto space-y-2">
                        <button
                          onClick={() => openBookWithReader(book)}
                          className="w-full bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <BookOpen className="w-4 h-4" />
                          Open Book
                        </button>
                        <button
                          onClick={() => downloadBook(book.filename)}
                          className="w-full bg-indigo-600 text-white py-2 px-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
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
          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ← Back to Translator
            </a>
          </div>
        </div>


      </div>
    </div>
  );
};

export default BooksPage;
