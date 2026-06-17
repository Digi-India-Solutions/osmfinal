import { type FC } from "react";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: FC<EmptyStateProps> = ({ icon, title, description, actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-5">
        <span className="w-8 h-8 flex items-center justify-center">
          <i className={`${icon} text-2xl text-gray-400`}></i>
        </span>
      </div>
      <h4 className="text-sm font-semibold text-gray-700 mb-1.5">{title}</h4>
      <p className="text-xs text-gray-400 max-w-sm text-center leading-relaxed mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;