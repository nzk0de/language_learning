export const BookStats = ({ stats }) => (
  <div className="bg-white rounded-xl shadow-lg p-6">
    <h3 className="text-lg font-semibold text-gray-800 mb-4">
      Collection Statistics
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-2xl font-bold text-indigo-600">
          {stats.totalBooks}
        </div>
        <div className="text-sm text-gray-600">Total Books</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-2xl font-bold text-green-600">{stats.authors}</div>
        <div className="text-sm text-gray-600">Authors</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-2xl font-bold text-blue-600">
          {stats.totalSizeMB} MB
        </div>
        <div className="text-sm text-gray-600">Total Size</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="text-2xl font-bold text-purple-600">
          {stats.languages}
        </div>
        <div className="text-sm text-gray-600">Languages</div>
      </div>
    </div>
  </div>
);
