import { Link } from "react-router-dom";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

const reportCards = [
  {
    title: "Result Report",
    description: "View final marks for all students",
    path: "/admin/reports/results",
    icon: "ri-award-line",
    color: "bg-emerald-50 text-emerald-600",
    borderColor: "border-emerald-200",
  },
  {
    title: "Recheck Report",
    description: "Compare original vs rechecked marks",
    path: "/admin/reports/recheck",
    icon: "ri-refresh-line",
    color: "bg-violet-50 text-violet-600",
    borderColor: "border-violet-200",
  },
  {
    title: "Checker Performance",
    description: "Evaluate checker workload and accuracy",
    path: "/admin/reports/performance",
    icon: "ri-bar-chart-grouped-line",
    color: "bg-amber-50 text-amber-600",
    borderColor: "border-amber-200",
  },
];

export default function AdminReports() {
  const loading = usePageLoading();

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports" }]} />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">View and analyze examination data across all subjects</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map((card) => (
          <Link
            key={card.path}
            to={card.path}
            className={`group bg-white border ${card.borderColor} rounded-xl p-6 hover:shadow-md transition-all duration-200 cursor-pointer`}
          >
            <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-200`}>
              <i className={`${card.icon} text-xl`}></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{card.title}</h3>
            <p className="text-sm text-gray-500 mb-4">{card.description}</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
              Go to Report
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-arrow-right-line text-sm"></i>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}