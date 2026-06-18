import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { mockRecheckRequests, users, exams, sheets, getRecheckTypeBadge, getFinalMarksRuleBadge } from "@/mock/mockData";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function RecheckDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const assignedRequests = mockRecheckRequests.filter((r) => r.assignedTo === currentUser?.id);
  const pendingRequests = assignedRequests.filter((r) => r.status === "pending");
  const completedRequests = assignedRequests.filter((r) => r.status === "completed");

  const pendingCount = pendingRequests.length;
  const completedCount = completedRequests.length;
  const totalCount = assignedRequests.length;

  const getSheetInfo = (request: typeof mockRecheckRequests[0]) => {
    const exam = exams.find((e) => e.id === request.examId);
    const sheet = request.sheetId ? sheets.find((s) => s.id === request.sheetId) : null;
    return { exam, sheet };
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Review recheck requests and verify first-round evaluations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">Pending Rechecks</p>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="ri-time-line text-lg text-amber-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">Completed</p>
              <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="ri-check-double-line text-lg text-emerald-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">Total Assigned</p>
              <p className="text-2xl font-bold text-violet-600">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <i className="ri-inbox-line text-lg text-violet-600"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">Pending Rechecks</h4>
            <button onClick={() => navigate("/recheck/queue")} className="text-xs font-medium text-violet-600 hover:text-violet-700 cursor-pointer whitespace-nowrap transition-colors">
              View All →
            </button>
          </div>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No pending rechecks</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const { exam, sheet } = getSheetInfo(req);
                const typeBadge = getRecheckTypeBadge(req.type);
                return (
                  <div key={req.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{exam?.name || `Exam #${req.examId}`}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${typeBadge.bg} ${typeBadge.text}`}>{typeBadge.label}</span>
                        {sheet && <span className="text-[10px] text-gray-400 whitespace-nowrap">{sheet.studentName} (Roll {sheet.rollNo})</span>}
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{req.createdAt}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{req.reason}</p>
                    </div>
                    <button onClick={() => navigate(`/recheck/marking/${req.id}`)} className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ml-3">
                      Start Recheck
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">Recent Completed</h4>
            <button onClick={() => navigate("/recheck/history")} className="text-xs font-medium text-violet-600 hover:text-violet-700 cursor-pointer whitespace-nowrap transition-colors">
              View All →
            </button>
          </div>
          {completedRequests.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No completed rechecks yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 font-medium text-gray-500">Sheet</th>
                    <th className="text-left py-2 font-medium text-gray-500">Rule</th>
                    <th className="text-right py-2 font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {completedRequests.map((req) => {
                    const { exam, sheet } = getSheetInfo(req);
                    const ruleBadge = getFinalMarksRuleBadge(req.finalMarksRule);
                    return (
                      <tr key={req.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5">
                          <p className="text-gray-900 font-medium">{sheet?.studentName || "—"}</p>
                          <p className="text-[10px] text-gray-400">{exam?.name || "—"}</p>
                        </td>
                        <td className="py-2.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${ruleBadge.bg} ${ruleBadge.text}`}>{ruleBadge.label}</span>
                        </td>
                        <td className="py-2.5 text-right text-gray-400">{req.createdAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}