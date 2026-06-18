import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { sheets, exams } from "@/mock/mockData";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

function hasDraftForSheet(sheetId: number): boolean {
  try {
    const raw = localStorage.getItem(`osm_draft_sheet_${sheetId}`);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    return draft.marks && draft.marks.length > 0;
  } catch {
    return false;
  }
}

export default function CheckerWorkQueue() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const mySheets = sheets.filter((s) => s.assignedTo === Number(currentUser?.id));

  const getExamName = (examId: number) => exams.find((e) => e.id === examId)?.name ?? "Unknown Exam";

  if (loading) return <LoadingSpinner fullPage />;

  if (mySheets.length === 0) {
    return (
      <EmptyState
        icon="ri-inbox-line"
        title="No sheets assigned yet"
        description="No sheets assigned yet. Check back later."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">My Queue</h2>
        <p className="text-sm text-gray-500 mt-1">
          {mySheets.length} sheet{mySheets.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mySheets.map((sheet) => {
          const examName = getExamName(sheet.examId);
          const hasDraft = hasDraftForSheet(sheet.id);

          return (
            <div key={sheet.id} className="bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition-colors duration-150">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{sheet.studentName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Roll No: {sheet.rollNo}</p>
                </div>
                <StatusBadge status={sheet.status} />
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Exam</p>
                <p className="text-sm text-gray-700 font-medium">{examName}</p>
              </div>

              {/* Draft indicator */}
              {hasDraft && sheet.status === "checking" && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-[11px] text-amber-600 font-medium">Draft saved</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Sheet #{sheet.id}</span>
                {sheet.status === "checking" ? (
                  <button
                    onClick={() => navigate(`/checker/marking/${sheet.id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-edit-line text-base"></i>
                    Start Marking
                  </button>
                ) : sheet.status === "checked" ? (
                  <button
                    onClick={() => navigate(`/checker/marking/${sheet.id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-eye-line text-base"></i>
                    View
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}