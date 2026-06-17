import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { exams, mockResults, mockRecheckRequests, mockPublishedExams } from "@/mock/mockData";
import type { ResultEntry } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
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

export default function ResultReport() {
  const loading = usePageLoading();
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishedExams, setPublishedExams] = useState<number[]>(mockPublishedExams);
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

  const examResults = useMemo<ResultEntry[]>(() => {
    if (!selectedExamId) return [];
    return mockResults.filter((r) => r.examId === selectedExamId);
  }, [selectedExamId]);

  const summary = useMemo(() => {
    if (!examResults.length || !selectedExam) return null;
    const total = examResults.length;
    const marks = examResults.map((r) => r.totalMarks);
    const maxMarks = selectedExam.maxMarks;
    const avg = (marks.reduce((a, b) => a + b, 0) / total / maxMarks * 100).toFixed(1);
    const highest = Math.max(...marks);
    const lowest = Math.min(...marks);
    const passCount = examResults.filter((r) => r.totalMarks / maxMarks * 100 >= 40).length;
    const failCount = total - passCount;
    return { total, avg, highest, lowest, passCount, failCount };
  }, [examResults, selectedExam]);

  const isPublished = selectedExamId !== null && publishedExams.includes(selectedExamId);

  const handlePublish = () => {
    if (!selectedExamId) return;
    mockPublishedExams.push(selectedExamId);
    setPublishedExams([...mockPublishedExams]);
    setShowPublishModal(false);
    showToast("Results published successfully");
  };

  const questionKeys = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"];

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Reports", href: "/admin/reports" }, { label: "Result Report" }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Result Report</h1>
          <p className="text-sm text-gray-500 mt-1">View final marks for all students</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId ?? ""}
            onChange={(e) => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="">-- Select Exam --</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.subject})
              </option>
            ))}
          </select>
          {selectedExam && (
            <button onClick={() => showToast("Exporting to Excel")} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-excel-2-line text-sm"></i></span> Excel
            </button>
          )}
          {selectedExam && (
            <button onClick={() => showToast("Exporting to PDF")} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-file-pdf-2-line text-sm"></i></span> PDF
            </button>
          )}
          {selectedExam && (
            <button onClick={() => showToast("Opening print dialog")} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
              <span className="w-4 h-4 flex items-center justify-center"><i className="ri-printer-line text-sm"></i></span> Print
            </button>
          )}
        </div>
      </div>

      {isPublished && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6">
          <span className="w-5 h-5 flex items-center justify-center">
            <i className="ri-checkbox-circle-fill text-emerald-600 text-sm"></i>
          </span>
          <p className="text-sm font-medium text-emerald-700">Results published — marks are locked</p>
        </div>
      )}

      {selectedExam && !isPublished && (
        <div className="flex justify-end mb-6">
          <button onClick={() => setShowPublishModal(true)} className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-send-plane-line text-sm"></i></span> Publish Results
          </button>
        </div>
      )}
      {selectedExam && isPublished && (
        <div className="flex justify-end mb-6">
          <button disabled className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium whitespace-nowrap cursor-not-allowed flex items-center gap-2 opacity-90">
            <span className="w-4 h-4 flex items-center justify-center"><i className="ri-check-line text-sm"></i></span> Published ✓
          </button>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard label="Total Students" value={summary.total} icon="ri-team-line" color="bg-gray-50 text-gray-600" />
          <StatCard label="Class Average" value={`${summary.avg}%`} icon="ri-line-chart-line" color="bg-sky-50 text-sky-600" />
          <StatCard label="Highest Score" value={summary.highest} icon="ri-arrow-up-line" color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Lowest Score" value={summary.lowest} icon="ri-arrow-down-line" color="bg-rose-50 text-rose-600" />
          <StatCard label="Pass Count" value={summary.passCount} icon="ri-check-line" color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Fail Count" value={summary.failCount} icon="ri-close-line" color="bg-rose-50 text-rose-600" />
        </div>
      )}

      {selectedExamId && examResults.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                  {questionKeys.map((q) => (
                    <th key={q} className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{q}</th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">%</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {examResults.map((row, idx) => {
                  const pct = (row.totalMarks / row.maxMarks * 100).toFixed(1);
                  const isPass = Number(pct) >= 40;

                  return (
                    <tr key={row.sheetId} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{row.rollNo}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.studentName}</td>
                      {questionKeys.map((q) => (
                        <td key={q} className="px-2 py-3 text-center text-gray-600 whitespace-nowrap">
                          {row.questionTotals[q] !== undefined ? row.questionTotals[q] : "—"}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900 font-semibold whitespace-nowrap">{row.totalMarks}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{pct}%</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={isPass ? "completed" : "uploaded"} className={isPass ? "!bg-emerald-100 !text-emerald-700" : "!bg-rose-100 !text-rose-700"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedExamId && examResults.length === 0 && (
        <EmptyState icon="ri-file-search-line" title="No results found" description="Select an exam to view results." />
      )}

      {!selectedExamId && (
        <EmptyState icon="ri-bar-chart-2-line" title="Select an exam" description="Select an exam to view results." />
      )}

      {showPublishModal && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPublishModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Publish Results</h2>
            <p className="text-sm text-gray-600 mb-4">
              Publish results for <strong>{selectedExam.name}</strong>? This will lock all marks.
            </p>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 mb-4">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-amber-600 text-sm"></i>
              </span>
              <p className="text-xs text-amber-700">Once published, marks cannot be modified.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer">Cancel</button>
              <button onClick={handlePublish} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer">Confirm Publish</button>
            </div>
          </div>
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