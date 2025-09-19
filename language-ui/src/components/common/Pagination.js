import { ChevronLeft, ChevronRight } from "lucide-react";

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  isLoading,
}) => {
  if (totalPages <= 1) {
    return null; // Don't render pagination if there's only one page
  }

  const handlePageClick = (page) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) {
      return;
    }
    onPageChange(page);
  };

  const pageNumbers = [];
  // Logic to create a condensed list of page numbers (e.g., 1 ... 5 6 7 ... 12)
  const pageWindow = 2; // How many pages to show around the current page

  // Always show the first page
  pageNumbers.push(1);

  // Add ellipsis if needed after the first page
  if (currentPage > pageWindow + 2) {
    pageNumbers.push("...");
  }

  // Add pages around the current page
  for (
    let i = Math.max(2, currentPage - pageWindow);
    i <= Math.min(totalPages - 1, currentPage + pageWindow);
    i++
  ) {
    pageNumbers.push(i);
  }

  // Add ellipsis if needed before the last page
  if (currentPage < totalPages - pageWindow - 1) {
    pageNumbers.push("...");
  }

  // Always show the last page
  pageNumbers.push(totalPages);

  const buttonClass = (page) =>
    `px-4 py-2 rounded-md transition-colors text-sm font-medium ${
      isLoading
        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
        : page === currentPage
        ? "bg-indigo-600 text-white shadow-md"
        : "bg-white text-gray-700 hover:bg-indigo-50"
    }`;

  return (
    <nav className="flex items-center justify-center space-x-2 mt-8">
      <button
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={currentPage === 1 || isLoading}
        className={`${buttonClass()} flex items-center disabled:opacity-50`}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className="ml-1">Prev</span>
      </button>

      {pageNumbers.map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className="px-4 py-2 text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => handlePageClick(page)}
            className={buttonClass(page)}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={currentPage === totalPages || isLoading}
        className={`${buttonClass()} flex items-center disabled:opacity-50`}
      >
        <span className="mr-1">Next</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
};
