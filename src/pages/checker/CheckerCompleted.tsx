import { useAuth } from "@/context/AuthContext";
import { sheets, exams } from "@/mock/mockData";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function CheckerCompleted() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();

  const myCompleted = sheets.filter(
    (s) => s.assignedTo === Number(currentUser?.id) && s.status === "checked"
  );

  const getExamName = (examId: number) => exams.find((e) => e.id === examId)?.name ?? "Unknown Exam";

  const totalCompleted = myCompleted.length;
  const averageMarks = totalCompleted > 0
    ? (myCompleted.reduce((sum, s) => sum + (s.totalMarks ?? 0), 0) / totalCompleted).toFixed(1)
    : "0.0";

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Completed Evaluations</h2>
        <p className="text-sm text-gray-500 mt-1">Sheets you have finished marking</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <i className="ri-check-double-line text-lg text-emerald-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCompleted}</p>
              <p className="text-xs text-gray-400">Total Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <i className="ri-bar-chart-2-line text-lg text-amber-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{averageMarks}</p>
              <p className="text-xs text-gray-400">Average Marks Given</p>
            </div>
          </div>
        </div>
      </div>

      {totalCompleted === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <i className="ri-checkbox-circle-line text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 text-base font-medium">No completed evaluations yet</p>
          <p className="text-gray-400 text-sm mt-1">Finished sheets will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sheet ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Exam</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Roll No</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Marks</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {myCompleted.map((sheet) => (
                <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors duration-150">
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">#{sheet.id}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">{getExamName(sheet.examId)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-900 font-medium">{sheet.studentName}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{sheet.rollNo}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-900 font-semibold">{sheet.totalMarks ?? "-"}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={sheet.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}