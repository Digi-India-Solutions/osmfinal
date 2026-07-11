// // src/pages/checker/components/EscalateModal.tsx

// import { useState, useCallback } from 'react';

// interface EscalateModalProps {
//   totalAwarded: number;
//   totalMax: number;
//   onEscalate: (data: {
//     reason: string;
//     escalateType: string;
//     remarks: string;
//   }) => void;
//   onCancel: () => void;
// }

// const REASON_OPTIONS = [
//   { value: '', label: 'Select a reason...' },
//   {
//     value: 'wrong-scanning',
//     label: 'Wrong scanning — sheet is blurred or unreadable',
//   },
//   {
//     value: 'wrong-subject',
//     label: 'Wrong subject — sheet belongs to different subject',
//   },
//   { value: 'wrong-student', label: 'Wrong student — roll number mismatch' },
//   { value: 'incomplete', label: 'Incomplete sheet — pages are missing' },
//   { value: 'damaged', label: 'Damaged sheet — sheet is torn or unreadable' },
//   {
//     value: 'double-answer',
//     label: 'Double answer — student wrote two answers for same question',
//   },
//   { value: 'other', label: 'Other — specify in remarks below' },
// ];

// export default function EscalateModal({
//   totalAwarded,
//   totalMax,
//   onEscalate,
//   onCancel,
// }: EscalateModalProps) {
//   const [reason, setReason] = useState('');
//   const [remarks, setRemarks] = useState('');
//   const [reasonError, setReasonError] = useState('');
//   const [remarksError, setRemarksError] = useState('');

//   const isOther = reason === 'other';
//   const canEscalate = reason !== '' && (!isOther || remarks.trim() !== '');

//   const handleEscalate = useCallback(() => {
//     setReasonError('');
//     setRemarksError('');

//     if (!reason) {
//       setReasonError('Please select a reason');
//       return;
//     }

//     if (isOther && remarks.trim() === '') {
//       setRemarksError('Please add remarks for Other reason');
//       return;
//     }

//     // ✅ Pass data to parent
//     const reasonLabel =
//       REASON_OPTIONS.find((r) => r.value === reason)?.label || reason;

//     onEscalate({
//       reason: reasonLabel,
//       escalateType: reason,
//       remarks: remarks.trim(),
//     });
//   }, [reason, isOther, remarks, onEscalate]);

//   const handleReasonChange = useCallback(
//     (e: React.ChangeEvent<HTMLSelectElement>) => {
//       setReason(e.target.value);
//       setReasonError('');
//       if (e.target.value !== 'other') {
//         setRemarksError('');
//       }
//     },
//     [],
//   );

//   const handleRemarksChange = useCallback(
//     (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//       const val = e.target.value;
//       if (val.length <= 500) {
//         setRemarks(val);
//         if (val.trim() !== '') {
//           setRemarksError('');
//         }
//       }
//     },
//     [],
//   );

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center">
//       {/* Overlay */}
//       <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

//       {/* Modal */}
//       <div className="relative bg-white rounded-xl w-[420px] overflow-hidden shadow-2xl">
//         {/* Header */}
//         <div className="px-5 pt-4 pb-3">
//           <div className="flex items-start justify-between">
//             <div>
//               <h3 className="text-sm font-semibold text-slate-800">
//                 Escalate Sheet
//               </h3>
//               <p className="text-[11px] text-slate-400 mt-0.5">
//                 Sheet #002 — Priya Singh (Roll No. 102)
//               </p>
//             </div>
//             <button
//               onClick={onCancel}
//               className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
//             >
//               <i className="ri-close-line"></i>
//             </button>
//           </div>
//         </div>

//         <div className="border-t border-slate-100" />

//         {/* Body */}
//         <div className="px-5 py-4 space-y-4">
//           {/* Reason dropdown */}
//           <div>
//             <label
//               htmlFor="escalate-reason"
//               className="block text-xs font-medium text-slate-700 mb-1.5"
//             >
//               Reason for escalation *
//             </label>
//             <select
//               id="escalate-reason"
//               value={reason}
//               onChange={handleReasonChange}
//               className={`w-full h-9 px-2.5 text-xs rounded-lg border bg-white text-slate-700 outline-none cursor-pointer transition-colors ${
//                 reasonError
//                   ? 'border-red-400 focus:ring-1 focus:ring-red-400'
//                   : 'border-slate-200 focus:ring-1 focus:ring-sky-400 focus:border-sky-400'
//               }`}
//             >
//               {REASON_OPTIONS.map((opt) => (
//                 <option
//                   key={opt.value}
//                   value={opt.value}
//                   disabled={opt.value === ''}
//                 >
//                   {opt.label}
//                 </option>
//               ))}
//             </select>
//             {reasonError && (
//               <p className="text-[10px] text-red-500 mt-1">{reasonError}</p>
//             )}
//           </div>

//           {/* Remarks */}
//           <div>
//             <label
//               htmlFor="escalate-remarks"
//               className="block text-xs font-medium text-slate-700 mb-1.5"
//             >
//               {isOther ? (
//                 <>
//                   Remarks <span className="text-red-500">*</span>
//                 </>
//               ) : (
//                 'Remarks (optional)'
//               )}
//             </label>
//             <textarea
//               id="escalate-remarks"
//               value={remarks}
//               onChange={handleRemarksChange}
//               rows={3}
//               maxLength={500}
//               placeholder="Add any additional notes for the admin..."
//               className={`w-full px-2.5 py-2 text-xs rounded-lg border bg-white text-slate-700 outline-none resize-none transition-colors placeholder:text-slate-400 ${
//                 remarksError
//                   ? 'border-red-400 focus:ring-1 focus:ring-red-400'
//                   : 'border-slate-200 focus:ring-1 focus:ring-sky-400 focus:border-sky-400'
//               }`}
//             />
//             {remarksError && (
//               <p className="text-[10px] text-red-500 mt-1">{remarksError}</p>
//             )}
//           </div>

//           {/* Total marks display */}
//           <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
//             <span className="text-xs text-slate-500">Total marks awarded</span>
//             <span className="text-sm font-bold text-slate-800 tabular-nums">
//               {totalAwarded}
//               <span className="text-xs font-normal text-slate-400">
//                 {' '}
//                 / {totalMax}
//               </span>
//             </span>
//           </div>
//         </div>

//         {/* Footer buttons */}
//         <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
//           <button
//             onClick={onCancel}
//             className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={handleEscalate}
//             disabled={!canEscalate}
//             className="px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500"
//           >
//             Escalate and Next →
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// src/pages/checker/components/EscalateModal.tsx

import { useState, useCallback } from 'react';

interface EscalateModalProps {
  totalAwarded: number;
  totalMax: number;
  // ✅ Real data props — no more hardcoded values
  studentName?: string;
  rollNo?: string | number;
  sheetId?: string | number;
  onEscalate: (data: {
    reason: string;
    escalateType: string;
    remarks: string;
  }) => void;
  onCancel: () => void;
}

const REASON_OPTIONS = [
  { value: '', label: 'Select a reason...' },
  {
    value: 'wrong-scanning',
    label: 'Wrong scanning — sheet is blurred or unreadable',
  },
  {
    value: 'wrong-subject',
    label: 'Wrong subject — sheet belongs to different subject',
  },
  { value: 'wrong-student', label: 'Wrong student — roll number mismatch' },
  { value: 'incomplete', label: 'Incomplete sheet — pages are missing' },
  { value: 'damaged', label: 'Damaged sheet — sheet is torn or unreadable' },
  {
    value: 'double-answer',
    label: 'Double answer — student wrote two answers for same question',
  },
  { value: 'other', label: 'Other — specify in remarks below' },
];

export default function EscalateModal({
  totalAwarded,
  totalMax,
  studentName = '—',
  rollNo = '—',
  sheetId = '—',
  onEscalate,
  onCancel,
}: EscalateModalProps) {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [remarksError, setRemarksError] = useState('');

  const isOther = reason === 'other';
  const canEscalate = reason !== '' && (!isOther || remarks.trim() !== '');

  const handleEscalate = useCallback(() => {
    setReasonError('');
    setRemarksError('');

    if (!reason) {
      setReasonError('Please select a reason');
      return;
    }

    if (isOther && remarks.trim() === '') {
      setRemarksError('Please add remarks for Other reason');
      return;
    }

    // ✅ Pass full data to parent — matches MarkingView's handleEscalateConfirm signature
    const reasonLabel =
      REASON_OPTIONS.find((r) => r.value === reason)?.label || reason;

    onEscalate({
      reason: reasonLabel,
      escalateType: reason,
      remarks: remarks.trim(),
    });
  }, [reason, isOther, remarks, onEscalate]);

  const handleReasonChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setReason(e.target.value);
      setReasonError('');
      if (e.target.value !== 'other') {
        setRemarksError('');
      }
    },
    [],
  );

  const handleRemarksChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (val.length <= 500) {
        setRemarks(val);
        if (val.trim() !== '') setRemarksError('');
      }
    },
    [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl w-[420px] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Escalate Sheet
              </h3>
              {/* ✅ Real student data */}
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sheet #{sheetId} — {studentName} (Roll No. {rollNo})
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
              aria-label="Close"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Reason dropdown */}
          <div>
            <label
              htmlFor="escalate-reason"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Reason for escalation *
            </label>
            <select
              id="escalate-reason"
              value={reason}
              onChange={handleReasonChange}
              className={`w-full h-9 px-2.5 text-xs rounded-lg border bg-white text-slate-700 outline-none cursor-pointer transition-colors ${
                reasonError
                  ? 'border-red-400 focus:ring-1 focus:ring-red-400'
                  : 'border-slate-200 focus:ring-1 focus:ring-sky-400 focus:border-sky-400'
              }`}
            >
              {REASON_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.value === ''}
                >
                  {opt.label}
                </option>
              ))}
            </select>
            {reasonError && (
              <p className="text-[10px] text-red-500 mt-1">{reasonError}</p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label
              htmlFor="escalate-remarks"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              {isOther ? (
                <>
                  Remarks <span className="text-red-500">*</span>
                </>
              ) : (
                'Remarks (optional)'
              )}
            </label>
            <textarea
              id="escalate-remarks"
              value={remarks}
              onChange={handleRemarksChange}
              rows={3}
              maxLength={500}
              placeholder="Add any additional notes for the admin..."
              className={`w-full px-2.5 py-2 text-xs rounded-lg border bg-white text-slate-700 outline-none resize-none transition-colors placeholder:text-slate-400 ${
                remarksError
                  ? 'border-red-400 focus:ring-1 focus:ring-red-400'
                  : 'border-slate-200 focus:ring-1 focus:ring-sky-400 focus:border-sky-400'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {remarksError ? (
                <p className="text-[10px] text-red-500">{remarksError}</p>
              ) : (
                <span />
              )}
              <span className="text-[10px] text-slate-400 ml-auto">
                {remarks.length}/500
              </span>
            </div>
          </div>

          {/* Total marks display */}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
            <span className="text-xs text-slate-500">Total marks awarded</span>
            <span className="text-sm font-bold text-slate-800 tabular-nums">
              {totalAwarded}
              <span className="text-xs font-normal text-slate-400">
                {' '}
                / {totalMax}
              </span>
            </span>
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
            onClick={handleEscalate}
            disabled={!canEscalate}
            className="px-4 py-2 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed bg-sky-600 hover:bg-sky-500"
          >
            Escalate and Next →
          </button>
        </div>
      </div>
    </div>
  );
}