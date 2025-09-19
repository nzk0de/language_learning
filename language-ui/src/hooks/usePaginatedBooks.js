import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:8000";
const PAGE_SIZE = 20;

const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

export const usePaginatedBooks = () => {
  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1); // NEW: Track total pages
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchBooks = useCallback(async (term, pageNum) => {
    setIsLoading(true);
    try {
      const url = `${API_BASE}/books?page=${pageNum}&limit=${PAGE_SIZE}&search=${encodeURIComponent(
        term
      )}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch books.");

      const data = await response.json();

      setBooks(data.books); // Always replace books for the current page
      setPage(pageNum);
      setTotalPages(Math.ceil(data.total / PAGE_SIZE)); // Calculate total pages from API response
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // When search term changes, reset to page 1 and fetch
    fetchBooks(searchTerm, 1);
  }, [searchTerm, fetchBooks]);

  // NEW: Function to jump to a specific page
  const goToPage = (pageNum) => {
    if (pageNum !== page && !isLoading) {
      fetchBooks(searchTerm, pageNum);
    }
  };

  const debouncedSetSearchTerm = useCallback(
    debounce((term) => {
      setSearchTerm(term);
    }, 400),
    []
  );

  return {
    books,
    isLoading,
    page, // Expose current page
    totalPages, // Expose total pages
    goToPage, // Expose the page change handler
    setSearchTerm: debouncedSetSearchTerm,
  };
};
