export const MessageDisplay = ({ message }) => {
  if (!message) return null;

  const typeClasses = {
    success: "bg-green-100 border-green-400 text-green-700",
    error: "bg-red-100 border-red-400 text-red-700",
    info: "bg-blue-100 border-blue-400 text-blue-700",
  };

  return (
    <div className={`p-3 rounded-lg border ${typeClasses[message.type]}`}>
      {message.message}
    </div>
  );
};
