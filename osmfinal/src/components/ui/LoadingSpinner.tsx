import { type FC } from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: "w-5 h-5 border-2",
  md: "w-8 h-8 border-[3px]",
  lg: "w-12 h-12 border-4",
};

const LoadingSpinner: FC<LoadingSpinnerProps> = ({ size = "md", fullPage = false }) => {
  const spinner = (
    <div className="flex items-center justify-center">
      <div
        className={`rounded-full border-gray-200 border-t-gray-900 animate-spin ${sizeMap[size]}`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {spinner}
    </div>
  );
};

export default LoadingSpinner;