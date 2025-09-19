export const SectionCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl shadow-lg p-6">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
      {icon}
      {title}
    </h2>
    {children}
  </div>
);
