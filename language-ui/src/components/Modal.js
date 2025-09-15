import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const Modal = ({ isOpen, onClose, type = 'info', title, message, actions = [] }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in zoom-in duration-200">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${getHeaderColor()}`}>
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-gray-700 whitespace-pre-line leading-relaxed">
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  if (action.closeOnClick !== false) onClose();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${action.className || 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
