import { useAuth } from "@/context/AuthContext";
import { checkerStats } from "@/mock/mockData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function CheckerDashboard() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your checking queue and track your progress.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {checkerStats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-sm text-gray-500 whitespace-nowrap">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                <i className={`${stat.icon} text-lg`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Current Queue</h4>
          <div className="space-y-3">
            {[
              { exam: "Semester 6 - Mathematics", batch: "Batch A-42", sheets: 28, id: "#1042" },
              { exam: "Mid-Term - Physics", batch: "Batch B-15", sheets: 35, id: "#1043" },
              { exam: "Final - Chemistry", batch: "Batch C-08", sheets: 19, id: "#1044" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.exam}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.batch} &middot; {item.id} &middot; {item.sheets} sheets</p>
                </div>
                <button className="text-xs font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap">
                  Start Checking
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Today's Progress</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Sheets checked today</span>
              <span className="text-2xl font-bold text-gray-900">18</span>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-gray-500">Daily Target</span>
                <span className="font-medium text-gray-900">18 / 30</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: "60%" }}></div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <span className="text-sm text-gray-500">Average time per sheet</span>
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">3.2 min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Accuracy rate</span>
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">96.4%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}