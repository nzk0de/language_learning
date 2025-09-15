import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Languages, Book } from 'lucide-react';
import App from './App';
import BooksPage from './BooksPage';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-lg border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-12">
            {/* Enhanced Logo */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Languages className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Language Learning
                </span>
                <div className="text-xs text-gray-500 font-medium">German Study Suite</div>
              </div>
            </div>
            
            {/* Enhanced Navigation Links */}
            <div className="flex space-x-2">
              <Link
                to="/"
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-0.5 ${
                  location.pathname === '/'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/80 hover:shadow-md'
                }`}
              >
                <Languages className="w-5 h-5" />
                <span>Translator</span>
              </Link>
              <Link
                to="/books"
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-3 transform hover:-translate-y-0.5 ${
                  location.pathname === '/books'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/80 hover:shadow-md'
                }`}
              >
                <Book className="w-5 h-5" />
                <span>Library</span>
              </Link>
            </div>
          </div>
          
          {/* Optional: Add a status indicator or user info */}
          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

const AppRouter = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
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
