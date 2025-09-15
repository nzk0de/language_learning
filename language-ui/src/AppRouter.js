import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Languages, Book } from 'lucide-react';
import App from './App';
import BooksPage from './BooksPage';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center gap-2">
              <Languages className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-gray-900">Language Learning</span>
            </div>
            
            <div className="flex space-x-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Languages className="w-4 h-4" />
                Translator
              </Link>
              <Link
                to="/books"
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/books'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Book className="w-4 h-4" />
                Books
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

const AppRouter = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/books" element={<BooksPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default AppRouter;
