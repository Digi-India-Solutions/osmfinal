interface RecheckConfirmModalProps {
  round1Total: number;
  round2Total: number;
  finalMarks: number;
  finalMarksRule: string;
  totalMax: number;
  studentName: string;
  rollNo: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const RULE_LABELS: Record<string, string> = {
  higher: "Higher of two",
  recheck_marks: "Recheck Marks",
  average: "Average of two",
};

export default function RecheckConfirmModal({
  round1Total,
  round2Total,
  finalMarks,
  finalMarksRule,
  totalMax,
  studentName,
  rollNo,
  onConfirm,
  onCancel,
}: RecheckConfirmModalProps) {
  const ruleLabel = RULE_LABELS[finalMarksRule] || finalMarksRule;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white rounded-xl w-[400px] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 bg-emerald-50 border-b border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <i className="ri-check-double-line text-emerald-600"></i>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Submit Recheck
              </h3>
              <p className="text-[11px] text-slate-500">Review your evaluation before submitting</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Student info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500">Student Name</span>
              <p className="font-semibold text-slate-800 mt-0.5">{studentName}</p>
            </div>
            <div>
              <span className="text-slate-500">Roll Number</span>
              <p className="font-semibold text-slate-800 mt-0.5">{rollNo}</p>
            </div>
          </div>

          {/* Marks comparison */}
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 text-[10px] font-medium text-slate-500 bg-slate-50 px-3 py-2 border-b border-slate-100">
              <span></span>
              <span className="text-center">Marks</span>
              <span className="text-center">Out of</span>
            </div>
            <div className="grid grid-cols-3 text-xs px-3 py-2 border-b border-slate-50">
              <span className="text-slate-600">Round 1</span>
              <span className="text-center text-slate-500 font-mono tabular-nums">{round1Total}</span>
              <span className="text-center text-slate-400">{totalMax}</span>
            </div>
            <div className="grid grid-cols-3 text-xs px-3 py-2 border-b border-slate-50">
              <span className="text-slate-600">Round 2</span>
              <span className="text-center text-violet-600 font-bold font-mono tabular-nums">{round2Total}</span>
              <span className="text-center text-slate-400">{totalMax}</span>
            </div>
            <div className="grid grid-cols-3 text-xs px-3 py-2.5 bg-violet-50">
              <span className="text-violet-700 font-medium">
                Final ({ruleLabel})
              </span>
              <span className="text-center text-violet-700 font-bold font-mono tabular-nums text-sm">{finalMarks}</span>
              <span className="text-center text-violet-500">{totalMax}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            Submit Recheck
          </button>
        </div>
      </div>
    </div>
  );
}