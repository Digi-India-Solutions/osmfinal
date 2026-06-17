import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exams, mockCheckerStats } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function CheckerPerformance() {
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

  const checkerData = useMemo(() => {
    if (selectedExamId === null) return mockCheckerStats;
    return mockCheckerStats.filter((s) => s.examId === selectedExamId);
  }, [selectedExamId]);

  const getEfficiencyBadge = (avgTime: number) => {
    if (avgTime < 10) return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Fast" };
    if (avgTime <= 20) return { bg: "bg-amber-100", text: "text-amber-700", label: "Normal" };
    return { bg: "bg-rose-100", text: "text-rose-700", label: "Slow" };
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      checker: { bg: "bg-sky-100", text: "text-sky-700", label: "Checker" },
      rechecking: { bg: "bg-violet-100", text: "text-violet-700", label: "Rechecker" },
      teacher_checker: { bg: "bg-amber-100", text: "text-amber-700", label: "Teacher+Checker" },
    };
    return map[role] || { bg: "bg-gray-100", text: "text-gray-600", label: role };
  };

  const chartData = useMemo(() => checkerData.map((s) => ({ name: s.checkerName, sheets: s.sheetsCompleted })), [checkerData]);

  const selectedExamName = selectedExamId ? exams.find((e) => e.id === selectedExamId)?.name || "Unknown" : "All Exams";

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports", href: "/admin/reports" }, { label: "Checker Performance" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Checker Performance</h1>
          <p className="text-sm text-gray-500 mt-1">Evaluate checker workload and accuracy</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId === null ? "all" : selectedExamId}
            onChange={(e) => { const val = e.target.value; setSelectedExamId(val === "all" ? null : Number(val)); }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="all">All Exams</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.name} ({exam.subject})</option>
            ))}
          </select>
          <button onClick={() => showToast("Exporting to Excel")} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-excel-2-line text-sm"></i></span> Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Sheets Completed per Checker — {selectedExamName}</h3>
        <div style={{ height: 220 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", fontSize: "13px" }} />
                <Bar dataKey="sheets" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon="ri-bar-chart-2-line" title="No data available" description="No data available for selected exam." />
          )}
        </div>
      </div>

      {checkerData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Checker Name</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Role</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sheets Completed</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Avg Time (mins)</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {checkerData.map((checker, idx) => {
                  const roleBadge = getRoleBadge(checker.role);
                  const effBadge = getEfficiencyBadge(checker.avgTimeMinutes);
                  return (
                    <tr key={checker.checkerId} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{checker.checkerName}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${roleBadge.bg} ${roleBadge.text}`}>{roleBadge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">{checker.sheetsCompleted}</td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{checker.avgTimeMinutes} min</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${effBadge.bg} ${effBadge.text}`}>{effBadge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedExamId && checkerData.length === 0 && (
        <EmptyState icon="ri-user-search-line" title="No data available" description="No data available for selected exam." />
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