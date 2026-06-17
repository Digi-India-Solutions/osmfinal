import { useState, useMemo } from "react";
import { sheets, exams, users } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { usePageLoading } from "@/hooks/usePageLoading";

type TabKey = "all" | "pending" | "checking" | "rechecking" | "completed";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "checking", label: "Checking" },
  { key: "rechecking", label: "Rechecking" },
  { key: "completed", label: "Completed" },
];

function getDraftTimestamp(sheetId: number): string | null {
  try {
    const raw = localStorage.getItem(`osm_draft_sheet_${sheetId}`);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.marks && draft.marks.length > 0 && draft.savedAt) {
      const savedTime = new Date(draft.savedAt);
      return savedTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    return null;
  } catch {
    return null;
  }
}

export default function WorkQueue() {
  const loading = usePageLoading();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [filterExam, setFilterExam] = useState<number | "">("");
  const [searchName, setSearchName] = useState("");
  const [flagModal, setFlagModal] = useState<{ open: boolean; sheetId: number | null }>({ open: false, sheetId: null });
  const [flagOption, setFlagOption] = useState<"single" | "entire">("single");
  const [flagEvaluator, setFlagEvaluator] = useState<number | "">("");
  const [flagReason, setFlagReason] = useState("");
  const [flagError, setFlagError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const recheckers = users.filter((u) => u.role === "rechecking" && u.status === "active");

  const filteredSheets = useMemo(() => {
    let result = sheets;

    if (filterExam) {
      result = result.filter((s) => s.examId === filterExam);
    }

    if (searchName) {
      result = result.filter((s) => s.studentName.toLowerCase().includes(searchName.toLowerCase()));
    }

    switch (activeTab) {
      case "pending":
        result = result.filter((s) => s.status === "uploaded" || s.status === "assigned");
        break;
      case "checking":
        result = result.filter((s) => s.status === "checking");
        break;
      case "rechecking":
        result = result.filter((s) => s.status === "recheck");
        break;
      case "completed":
        result = result.filter((s) => s.status === "checked" || s.status === "rechecked");
        break;
    }

    return result;
  }, [activeTab, filterExam, searchName]);

  const getExamName = (examId: number) => exams.find((e) => e.id === examId)?.name || "Unknown";
  const getUserName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    return users.find((u) => u.id === userId)?.name || "Unknown";
  };

  const getTabCount = (key: TabKey): number => {
    let result = sheets;
    if (filterExam) result = result.filter((s) => s.examId === filterExam);
    if (searchName) result = result.filter((s) => s.studentName.toLowerCase().includes(searchName.toLowerCase()));
    switch (key) {
      case "all": return result.length;
      case "pending": return result.filter((s) => s.status === "uploaded" || s.status === "assigned").length;
      case "checking": return result.filter((s) => s.status === "checking").length;
      case "rechecking": return result.filter((s) => s.status === "recheck").length;
      case "completed": return result.filter((s) => s.status === "checked" || s.status === "rechecked").length;
    }
  };

  const openFlagModal = (sheetId: number) => {
    setFlagModal({ open: true, sheetId });
    setFlagOption("single");
    setFlagEvaluator("");
    setFlagReason("");
    setFlagError("");
  };

  const handleFlagSubmit = () => {
    setFlagError("");
    if (!flagEvaluator) {
      setFlagError("Please select an evaluator");
      return;
    }
    if (!flagReason.trim() || flagReason.trim().length < 5) {
      setFlagError("Please enter at least 5 characters for the reason");
      return;
    }
    setFlagModal({ open: false, sheetId: null });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Work Queue" }]} />

      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line"></i>
          </span>
          Flagged for recheck successfully
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900">Work Queue</h3>
        <p className="text-sm text-gray-500 mt-0.5">Monitor and manage all answer sheet workflows</p>
      </div>

      <div className="bg-white rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] text-gray-400">
                  {getTabCount(tab.key)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center text-gray-400">
                <i className="ri-search-line text-xs"></i>
              </span>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search student..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent w-48 placeholder:text-gray-400 text-sm"
              />
            </div>
            <select
              value={filterExam}
              onChange={(e) => setFilterExam(e.target.value ? Number(e.target.value) : "")}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer text-sm"
            >
              <option value="">All Exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {filteredSheets.length === 0 ? (
            <EmptyState
              icon="ri-file-search-line"
              title="No sheets found"
              description="No sheets found. Try changing the filter."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sheet ID</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Student</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Exam</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Assigned To</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Last Saved</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSheets.map((sheet) => {
                  const draftTime = getDraftTimestamp(sheet.id);
                  return (
                  <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">#{sheet.id}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{sheet.rollNo}</td>
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{sheet.studentName}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{getExamName(sheet.examId)}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{getUserName(sheet.assignedTo)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={sheet.status} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {draftTime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          {draftTime}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openFlagModal(sheet.id)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Flag for Recheck
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {flagModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">Flag for Recheck</h4>
              <button
                onClick={() => setFlagModal({ open: false, sheetId: null })}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFlagOption("single")}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      flagOption === "single"
                        ? "border-gray-900 bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-file-line"></i>
                      </span>
                      This sheet only (#{flagModal.sheetId})
                    </div>
                  </button>
                  <button
                    onClick={() => setFlagOption("entire")}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      flagOption === "entire"
                        ? "border-gray-900 bg-gray-50 text-gray-900"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-stack-line"></i>
                      </span>
                      Entire exam
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assign Recheck Evaluator</label>
                <select
                  value={flagEvaluator}
                  onChange={(e) => { setFlagEvaluator(e.target.value ? Number(e.target.value) : ""); if (flagError) setFlagError(""); }}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer ${flagError && !flagEvaluator ? "border-rose-400" : "border-gray-200"}`}
                >
                  <option value="">Select evaluator...</option>
                  {recheckers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for Recheck</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => { setFlagReason(e.target.value); if (flagError && e.target.value.trim().length >= 5) setFlagError(""); }}
                  placeholder="Describe why this needs rechecking..."
                  maxLength={500}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 min-h-[80px] resize-none ${flagError && flagReason.trim().length < 5 ? "border-rose-400" : "border-gray-200"}`}
                ></textarea>
                {flagError && <p className="text-xs text-rose-500 mt-1">{flagError}</p>}
                <p className="text-xs text-gray-400 mt-1">{flagReason.length}/500</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setFlagModal({ open: false, sheetId: null })}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                disabled={!flagEvaluator || !flagReason.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}