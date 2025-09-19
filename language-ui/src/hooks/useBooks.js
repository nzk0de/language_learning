import { useState, useEffect, useMemo, useCallback } from "react";

const API_BASE = "http://localhost:8000";

// Debounce helper function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

export const useBooks = () => {
  const [allBooks, setAllBooks] = useState([]); // Master list of all books
  const [filteredBooks, setFilteredBooks] = useState([]); // Books currently displayed
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all books once on initial load
  useEffect(() => {
    const fetchAllBooks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/books`);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        if (data.books) {
          setAllBooks(data.books);
          setFilteredBooks(data.books); // Initially, show all books
        } else {
          throw new Error(data.error || "Failed to fetch books");
        }
      } catch (err) {
        setError(err.message);
        setAllBooks([]);
        setFilteredBooks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllBooks();
  }, []); // Empty dependency array means this runs only once

  // Memoized search function to perform filtering on the client side
  const performSearch = useMemo(() => {
    if (!searchTerm) {
      setFilteredBooks(allBooks);
      return;
    }

    const lowercasedTerm = searchTerm.toLowerCase();
    const results = allBooks.filter((book) =>
      `${book.title} ${book.author} ${book.description || ""}`
        .toLowerCase()
        .includes(lowercasedTerm)
    );
    setFilteredBooks(results);
  }, [searchTerm, allBooks]);

  // Debounced search handler that updates the search term
  const debouncedSearch = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 300),
    []
  ); // 300ms delay

  return {
    books: filteredBooks,
    isLoading,
    error,
    searchTerm,
    setSearchTerm: debouncedSearch, // Expose the debounced setter
    totalBooks: allBooks.length,
    stats: useMemo(() => {
      if (allBooks.length === 0) return null;
      return {
        totalBooks: allBooks.length,
        authors: new Set(allBooks.map((b) => b.author)).size,
        totalSizeMB: (
          allBooks.reduce((sum, b) => sum + (b.file_size || 0), 0) /
          1024 /
          1024
        ).toFixed(1),
        languages: new Set(allBooks.map((b) => b.language)).size,
      };
    }, [allBooks]),
  };
};
