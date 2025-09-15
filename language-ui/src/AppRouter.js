import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Languages, Book, BarChart3, Maximize2 } from 'lucide-react';
import BooksPage from './BooksPage';
import TranslationPage from './TranslationPage';
import AnalysisPage from './AnalysisPage';

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
                to="/translation"
                className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-0.5 ${
                  location.pathname === '/translation'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/80 hover:shadow-md'
                }`}
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden lg:inline">Translation & Videos</span>
                <span className="lg:hidden">Translate</span>
              </Link>
              <Link
                to="/analysis"
                className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-0.5 ${
                  location.pathname === '/analysis'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50/80 hover:shadow-md'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden lg:inline">Analysis & Research</span>
                <span className="lg:hidden">Analysis</span>
              </Link>
              <Link
                to="/books"
                className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-0.5 ${
                  location.pathname === '/books'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50/80 hover:shadow-md'
                }`}
              >
                <Book className="w-4 h-4" />
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
          <Route path="/" element={<TranslationPage />} />
          <Route path="/translation" element={<TranslationPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/books" element={<BooksPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default AppRouter;
