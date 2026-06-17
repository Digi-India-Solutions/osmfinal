import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { exams, sheets, mockRecheckRequests, getFinalMarksRuleBadge } from "@/mock/mockData";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function ResultsView() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();
  const subject = currentUser?.subject ?? "";

  const completedExams = exams.filter((e) => e.subject === subject && e.status === "completed");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const examSheets = useMemo(() => {
    if (!selectedExamId) return [];
    return sheets.filter((s) => s.examId === selectedExamId && s.totalMarks !== null);
  }, [selectedExamId]);

  const summary = useMemo(() => {
    if (examSheets.length === 0 || !selectedExam) {
      return { students: 0, avg: "0.0", highest: 0, lowest: 0, passCount: 0, failCount: 0 };
    }
    const totalMarksArr = examSheets.map((s) => s.totalMarks as number);
    const sum = totalMarksArr.reduce((a, b) => a + b, 0);
    const avgRaw = sum / examSheets.length;
    const avgPct = ((avgRaw / selectedExam.maxMarks) * 100).toFixed(1);
    const highest = Math.max(...totalMarksArr);
    const lowest = Math.min(...totalMarksArr);
    const passCount = examSheets.filter((s) => ((s.totalMarks as number) / selectedExam.maxMarks) * 100 >= 40).length;
    const failCount = examSheets.length - passCount;
    return { students: examSheets.length, avg: avgPct, highest, lowest, passCount, failCount };
  }, [examSheets, selectedExam]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg">
          <i className="ri-check-line mr-2"></i>
          {toastMsg}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">Results View</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
          {subject} &middot; Completed Exams Only
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Completed Exam</label>
        <select
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
          value={selectedExamId ?? ""}
          onChange={(e) => { const val = e.target.value; setSelectedExamId(val ? Number(val) : null); }}
        >
          <option value="" disabled>Select a completed exam...</option>
          {completedExams.map((exam) => (
            <option key={exam.id} value={exam.id}>{exam.name} ({exam.date})</option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Students", value: summary.students, icon: "ri-group-line", color: "bg-gray-100 text-gray-700" },
              { label: "Class Average", value: `${summary.avg}%`, icon: "ri-bar-chart-line", color: "bg-emerald-50 text-emerald-600" },
              { label: "Highest", value: summary.highest, icon: "ri-arrow-up-line", color: "bg-sky-50 text-sky-600" },
              { label: "Lowest", value: summary.lowest, icon: "ri-arrow-down-line", color: "bg-amber-50 text-amber-600" },
              { label: "Pass Count", value: summary.passCount, icon: "ri-check-line", color: "bg-emerald-50 text-emerald-600" },
              { label: "Fail Count", value: summary.failCount, icon: "ri-close-line", color: "bg-rose-50 text-rose-600" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
                    <i className={`${card.icon} text-sm`}></i>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{card.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{selectedExam.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedExam.date} &middot; {selectedExam.maxMarks} marks &middot; Pass: 40%</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => showToast("Exporting to Excel — feature coming soon")} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                <i className="ri-file-excel-2-line mr-1.5"></i> Export
              </button>
              <button onClick={() => showToast("Opening print dialog")} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap cursor-pointer">
                <i className="ri-printer-line mr-1.5"></i> Print
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 overflow-x-auto">
            {examSheets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No checked sheets found for this exam.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Total Marks</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Max Marks</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Percentage</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {examSheets.map((sheet) => {
                    const totalMarks = sheet.totalMarks as number;
                    const percentage = ((totalMarks / selectedExam.maxMarks) * 100).toFixed(1);
                    const passed = (totalMarks / selectedExam.maxMarks) * 100 >= 40;

                    return (
                      <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors duration-100">
                        <td className="py-3 px-3">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{sheet.rollNo}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-gray-700 whitespace-nowrap">{sheet.studentName}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{totalMarks}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm text-gray-500 whitespace-nowrap">{selectedExam.maxMarks}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{percentage}%</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge status={passed ? "completed" : "pending"} className={passed ? "!bg-emerald-100 !text-emerald-600" : "!bg-rose-100 !text-rose-600"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {!selectedExam && completedExams.length > 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-bar-chart-box-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">Select a completed exam above to view results.</p>
        </div>
      )}

      {completedExams.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-folder-open-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">No completed exams found for {subject || "your subject"}.</p>
        </div>
      )}
    </div>
  );
}