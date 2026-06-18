import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { mockRecheckRequests, exams, sheets, getFinalMarksRuleBadge } from "@/mock/mockData";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function RecheckHistory() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const assignedRequests = mockRecheckRequests.filter(
    (r) => r.assignedTo === currentUser?.id && r.status === "completed"
  );

  const getSheetInfo = (request: typeof mockRecheckRequests[0]) => {
    const exam = exams.find((e) => e.id === request.examId);
    const sheet = request.sheetId ? sheets.find((s) => s.id === request.sheetId) : null;
    return { exam, sheet };
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Recheck History</h2>
        <p className="text-sm text-gray-500 mt-0.5">View completed recheck evaluations and mark differences.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        {assignedRequests.length === 0 ? (
          <EmptyState
            icon="ri-history-line"
            title="No completed rechecks"
            description="No completed rechecks yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Req ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Exam</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Student</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Roll No</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Round 1</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Round 2</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Final</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Difference</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Rule</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignedRequests.map((req) => {
                  const { exam, sheet } = getSheetInfo(req);
                  const ruleBadge = getFinalMarksRuleBadge(req.finalMarksRule);

                  const round1Total = sheet?.totalMarks ?? 57;
                  const round2Total = req.finalMarksRule === "higher" ? 64 : req.finalMarksRule === "average" ? 60 : 55;
                  const finalMarks = req.finalMarksRule === "higher" ? Math.max(round1Total, round2Total) : req.finalMarksRule === "average" ? Math.round((round1Total + round2Total) / 2) : round2Total;
                  const diff = finalMarks - round1Total;

                  return (
                    <tr key={req.id} onClick={() => navigate(`/recheck/marking/${req.id}`)} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors cursor-pointer">
                      <td className="py-3 px-4 font-mono text-gray-900 tabular-nums">#{String(req.id).padStart(3, "0")}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{exam?.name || "—"}</td>
                      <td className="py-3 px-4 text-gray-900">{sheet?.studentName || "—"}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono">{sheet?.rollNo || "—"}</td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono tabular-nums">{round1Total}</td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono tabular-nums">{round2Total}</td>
                      <td className="py-3 px-4 text-right text-gray-900 font-semibold tabular-nums">{finalMarks}</td>
                      <td className="py-3 px-4 text-center">
                        {diff > 0 ? (<span className="text-emerald-600 font-semibold whitespace-nowrap">+{diff}</span>) : diff < 0 ? (<span className="text-rose-600 font-semibold whitespace-nowrap">{diff}</span>) : (<span className="text-gray-400 whitespace-nowrap">No change</span>)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${ruleBadge.bg} ${ruleBadge.text}`}>{ruleBadge.label}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{req.createdAt}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-medium text-violet-600 whitespace-nowrap">View →</span>
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