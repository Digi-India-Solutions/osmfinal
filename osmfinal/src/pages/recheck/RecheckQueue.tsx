import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { mockRecheckRequests, exams, sheets, getRecheckTypeBadge, getFinalMarksRuleBadge } from "@/mock/mockData";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

type QueueTab = "pending" | "completed";

export default function RecheckQueue() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();
  const [activeTab, setActiveTab] = useState<QueueTab>("pending");

  const assignedRequests = mockRecheckRequests.filter((r) => r.assignedTo === currentUser?.id);
  const filteredRequests = assignedRequests.filter((r) => r.status === activeTab);

  const getSheetInfo = (request: typeof mockRecheckRequests[0]) => {
    const exam = exams.find((e) => e.id === request.examId);
    const sheet = request.sheetId ? sheets.find((s) => s.id === request.sheetId) : null;
    return { exam, sheet };
  };

  const tabs: { key: QueueTab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: assignedRequests.filter((r) => r.status === "pending").length },
    { key: "completed", label: "Completed", count: assignedRequests.filter((r) => r.status === "completed").length },
  ];

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Recheck Queue</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage and process recheck requests assigned to you.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${
            activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}>
            {tab.label}
            <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? "bg-violet-100 text-violet-600" : "bg-gray-200 text-gray-500"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon="ri-inbox-line"
            title="No recheck requests"
            description="No recheck requests assigned to you."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Exam</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Sheet / Student</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Reason</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Final Rule</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => {
                  const { exam, sheet } = getSheetInfo(req);
                  const typeBadge = getRecheckTypeBadge(req.type);
                  const ruleBadge = getFinalMarksRuleBadge(req.finalMarksRule);
                  const isPending = req.status === "pending";

                  return (
                    <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-900 tabular-nums">#{String(req.id).padStart(3, "0")}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${typeBadge.bg} ${typeBadge.text}`}>{typeBadge.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900 font-medium">{exam?.name || "—"}</p>
                        <p className="text-[10px] text-gray-400">{exam?.subject || "—"}</p>
                      </td>
                      <td className="py-3 px-4">
                        {sheet ? (<><p className="text-gray-900">{sheet.studentName}</p><p className="text-[10px] text-gray-400">Roll {sheet.rollNo}</p></>) : (<span className="text-gray-400">Full batch</span>)}
                      </td>
                      <td className="py-3 px-4 max-w-[160px]"><p className="text-gray-600 truncate">{req.reason}</p></td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${ruleBadge.bg} ${ruleBadge.text}`}>{ruleBadge.label}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                          isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}>{isPending ? "Pending" : "Completed"}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{req.createdAt}</td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <button onClick={() => navigate(`/recheck/marking/${req.id}`)} className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">Start Recheck</button>
                        ) : (
                          <button onClick={() => navigate(`/recheck/marking/${req.id}`)} className="text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">View</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}