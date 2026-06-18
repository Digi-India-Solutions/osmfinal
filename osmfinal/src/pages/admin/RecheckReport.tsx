import { useState, useMemo } from "react";
import { exams, mockRecheckRequests, mockResults } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <i className={`${icon} text-sm`}></i>
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function RecheckReport() {
  const loading = usePageLoading();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const availableExams = useMemo(
    () => exams.filter((e) => e.status === "completed" || e.status === "active"),
    []
  );

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [selectedExamId]
  );

  const completedRechecks = useMemo(() => {
    if (!selectedExamId) return [];
    return mockRecheckRequests.filter((r) => r.examId === selectedExamId && r.status === "completed");
  }, [selectedExamId]);

  const summary = useMemo(() => {
    const data = completedRechecks;
    if (!data.length) return null;
    return { total: data.length, increased: 1, decreased: 0, noChange: 0 };
  }, [completedRechecks]);

  const recheckRows = useMemo(() => {
    return completedRechecks.map((req) => {
      const result = req.sheetId ? mockResults.find((r) => r.sheetId === req.sheetId) : null;
      const originalTotal = result ? result.totalMarks : null;
      const recheckedTotal = originalTotal !== null ? originalTotal + 7 : null;
      const diff = recheckedTotal !== null && originalTotal !== null ? recheckedTotal - originalTotal : 0;

      return {
        id: req.id,
        rollNo: result ? result.rollNo : "—",
        studentName: result ? result.studentName : "—",
        originalTotal,
        recheckedTotal,
        diff,
        rule: req.finalMarksRule,
        date: req.createdAt,
      };
    });
  }, [completedRechecks]);

  const getChangeBadge = (diff: number) => {
    if (diff > 0) return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Increased", icon: "ri-arrow-up-line" };
    if (diff < 0) return { bg: "bg-rose-100", text: "text-rose-700", label: "Decreased", icon: "ri-arrow-down-line" };
    return { bg: "bg-gray-100", text: "text-gray-600", label: "No Change", icon: "ri-subtract-line" };
  };

  const getRuleLabel = (rule: string): string => {
    const map: Record<string, string> = { higher: "Higher", recheck_marks: "Recheck Marks", average: "Average" };
    return map[rule] || rule;
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports", href: "/admin/reports" }, { label: "Recheck Report" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Recheck Report</h1>
          <p className="text-sm text-gray-500 mt-1">Compare original vs rechecked marks</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId ?? ""}
            onChange={(e) => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="">-- Select Exam --</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.name} ({exam.subject})</option>
            ))}
          </select>
          {selectedExam && (
            <button onClick={() => showToast("Exporting to Excel")} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-excel-2-line text-sm"></i></span> Excel
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Rechecked" value={summary.total} icon="ri-refresh-line" color="bg-violet-50 text-violet-600" />
          <StatCard label="Marks Increased" value={summary.increased} icon="ri-arrow-up-line" color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Marks Decreased" value={summary.decreased} icon="ri-arrow-down-line" color="bg-rose-50 text-rose-600" />
          <StatCard label="No Change" value={summary.noChange} icon="ri-subtract-line" color="bg-gray-50 text-gray-600" />
        </div>
      )}

      {selectedExamId && recheckRows.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Student</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Original Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rechecked Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Difference</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Change</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rule Used</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {recheckRows.map((row, idx) => {
                  const changeBadge = getChangeBadge(row.diff);
                  return (
                    <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{row.rollNo}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.studentName}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{row.originalTotal ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-900 font-semibold whitespace-nowrap">{row.recheckedTotal ?? "—"}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`font-medium ${row.diff > 0 ? "text-emerald-600" : row.diff < 0 ? "text-rose-600" : "text-gray-400"}`}>
                          {row.diff > 0 ? `+${row.diff}` : row.diff === 0 ? "0" : row.diff}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${changeBadge.bg} ${changeBadge.text}`}>
                          <span className="w-3 h-3 flex items-center justify-center"><i className={`${changeBadge.icon} text-[10px]`}></i></span>
                          {changeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 whitespace-nowrap">{getRuleLabel(row.rule)}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">{row.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedExamId && recheckRows.length === 0 && (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <i className="ri-refresh-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-gray-500 text-sm">No completed rechecks found for this exam</p>
        </div>
      )}

      {!selectedExamId && (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <i className="ri-bar-chart-2-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-gray-500 text-sm">Select an exam to view recheck data</p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-lg text-sm font-medium shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line text-sm"></i></span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}