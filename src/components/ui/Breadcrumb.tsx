import { type FC } from "react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-2">
            {idx > 0 && (
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-s-line text-xs"></i>
              </span>
            )}
            {isLast ? (
              <span className="text-gray-900 font-medium">{item.label}</span>
            ) : item.href ? (
              <Link to={item.href} className="hover:text-gray-700 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;