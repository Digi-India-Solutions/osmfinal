// // import type { ModalType } from "../MarkingView";

// // interface ConfirmModalProps {
// //   type: ModalType;
// //   totalAwarded: number;
// //   totalMax: number;
// //   onConfirm: () => void;
// //   onCancel: () => void;
// // }

// // const modalConfig: Record<string, { title: string; headerBg: string; headerBorder: string; iconBg: string; iconColor: string; icon: string; btnBg: string; btnHover: string }> = {
// //   escalate: {
// //     title: "Escalate for Review",
// //     headerBg: "bg-sky-50",
// //     headerBorder: "border-sky-100",
// //     iconBg: "bg-sky-100",
// //     iconColor: "text-sky-600",
// //     icon: "ri-alert-line",
// //     btnBg: "bg-sky-600",
// //     btnHover: "hover:bg-sky-500",
// //   },
// //   submitContinue: {
// //     title: "Submit and Continue",
// //     headerBg: "bg-emerald-50",
// //     headerBorder: "border-emerald-100",
// //     iconBg: "bg-emerald-100",
// //     iconColor: "text-emerald-600",
// //     icon: "ri-check-double-line",
// //     btnBg: "bg-emerald-600",
// //     btnHover: "hover:bg-emerald-500",
// //   },
// //   submitExit: {
// //     title: "Submit and Exit",
// //     headerBg: "bg-rose-50",
// //     headerBorder: "border-rose-100",
// //     iconBg: "bg-rose-100",
// //     iconColor: "text-rose-600",
// //     icon: "ri-logout-box-line",
// //     btnBg: "bg-rose-600",
// //     btnHover: "hover:bg-rose-500",
// //   },
// // };

// // export default function ConfirmModal({
// //   type,
// //   totalAwarded,
// //   totalMax,
// //   onConfirm,
// //   onCancel,
// // }: ConfirmModalProps) {
// //   if (!type) return null;

// //   const config = modalConfig[type];

// //   return (
// //     <div className="fixed inset-0 z-50 flex items-center justify-center">
// //       <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
// //       <div className="relative bg-white rounded-xl w-[380px] overflow-hidden shadow-2xl">
// //         <div className={`px-5 py-4 ${config.headerBg} border-b ${config.headerBorder}`}>
// //           <div className="flex items-center gap-3">
// //             <div className={`w-9 h-9 rounded-full ${config.iconBg} flex items-center justify-center`}>
// //               <i className={`${config.icon} ${config.iconColor}`}></i>
// //             </div>
// //             <div>
// //               <h3 className="text-sm font-semibold text-slate-800">{config.title}</h3>
// //               <p className="text-[11px] text-slate-500">Please confirm your action</p>
// //             </div>
// //           </div>
// //         </div>

// //         <div className="px-5 py-4 space-y-3">
// //           <div className="grid grid-cols-2 gap-3 text-xs">
// //             <div>
// //               <span className="text-slate-500">Student Name</span>
// //               <p className="font-semibold text-slate-800 mt-0.5">Priya Singh</p>
// //             </div>
// //             <div>
// //               <span className="text-slate-500">Roll Number</span>
// //               <p className="font-semibold text-slate-800 mt-0.5">102</p>
// //             </div>
// //             <div>
// //               <span className="text-slate-500">Exam</span>
// //               <p className="font-semibold text-slate-800 mt-0.5">Mathematics Mid-Term</p>
// //             </div>
// //             <div>
// //               <span className="text-slate-500">Sheet ID</span>
// //               <p className="font-semibold text-slate-800 mt-0.5">#002</p>
// //             </div>
// //           </div>

// //           <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
// //             <span className="text-xs text-slate-600">Total Marks Awarded</span>
// //             <span className="text-base font-bold text-slate-900">
// //               {totalAwarded}
// //               <span className="text-xs font-normal text-slate-400"> / {totalMax}</span>
// //             </span>
// //           </div>
// //         </div>

// //         <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
// //           <button
// //             onClick={onCancel}
// //             className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
// //           >
// //             Cancel
// //           </button>
// //           <button
// //             onClick={onConfirm}
// //             className={`px-4 py-2 text-xs font-semibold text-white ${config.btnBg} ${config.btnHover} rounded-lg cursor-pointer transition-colors whitespace-nowrap`}
// //           >
// //             Confirm
// //           </button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // src/pages/checker/components/ConfirmModal.tsx

// import type { ModalType } from '../MarkingView';

// interface ConfirmModalProps {
//   type: ModalType;
//   totalAwarded: number;
//   totalMax: number;
//   // ✅ Real data — no more hardcoded values
//   studentName?: string;
//   rollNo?: string | number;
//   examName?: string;
//   sheetId?: string | number;
//   onConfirm: () => void;
//   onCancel: () => void;
// }

// const modalConfig: Record<
//   string,
//   {
//     title: string;
//     headerBg: string;
//     headerBorder: string;
//     iconBg: string;
//     iconColor: string;
//     icon: string;
//     btnBg: string;
//     btnHover: string;
//   }
// > = {
//   submitContinue: {
//     title: 'Submit and Continue',
//     headerBg: 'bg-emerald-50',
//     headerBorder: 'border-emerald-100',
//     iconBg: 'bg-emerald-100',
//     iconColor: 'text-emerald-600',
//     icon: 'ri-check-double-line',
//     btnBg: 'bg-emerald-600',
//     btnHover: 'hover:bg-emerald-500',
//   },
//   submitExit: {
//     title: 'Submit and Exit',
//     headerBg: 'bg-rose-50',
//     headerBorder: 'border-rose-100',
//     iconBg: 'bg-rose-100',
//     iconColor: 'text-rose-600',
//     icon: 'ri-logout-box-line',
//     btnBg: 'bg-rose-600',
//     btnHover: 'hover:bg-rose-500',
//   },
// };

// export default function ConfirmModal({
//   type,
//   totalAwarded,
//   totalMax,
//   studentName = '—',
//   rollNo = '—',
//   examName = '—',
//   sheetId = '—',
//   onConfirm,
//   onCancel,
// }: ConfirmModalProps) {
//   // ✅ Only handles submitContinue and submitExit — escalate uses EscalateModal
//   if (!type || type === 'escalate') return null;

//   const config = modalConfig[type];
//   if (!config) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center">
//       <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
//       <div className="relative bg-white rounded-xl w-[380px] overflow-hidden shadow-2xl">
//         {/* Header */}
//         <div
//           className={`px-5 py-4 ${config.headerBg} border-b ${config.headerBorder}`}
//         >
//           <div className="flex items-center gap-3">
//             <div
//               className={`w-9 h-9 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}
//             >
//               <i className={`${config.icon} ${config.iconColor}`}></i>
//             </div>
//             <div>
//               <h3 className="text-sm font-semibold text-slate-800">
//                 {config.title}
//               </h3>
//               <p className="text-[11px] text-slate-500">
//                 Please confirm your action
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Body */}
//         <div className="px-5 py-4 space-y-3">
//           {/* ✅ Real student/exam data */}
//           <div className="grid grid-cols-2 gap-3 text-xs">
//             <div>
//               <span className="text-slate-500">Student Name</span>
//               <p className="font-semibold text-slate-800 mt-0.5 truncate">
//                 {studentName}
//               </p>
//             </div>
//             <div>
//               <span className="text-slate-500">Roll Number</span>
//               <p className="font-semibold text-slate-800 mt-0.5">{rollNo}</p>
//             </div>
//             <div>
//               <span className="text-slate-500">Exam</span>
//               <p className="font-semibold text-slate-800 mt-0.5 truncate">
//                 {examName}
//               </p>
//             </div>
//             <div>
//               <span className="text-slate-500">Sheet ID</span>
//               <p className="font-semibold text-slate-800 mt-0.5">
//                 #{sheetId}
//               </p>
//             </div>
//           </div>

//           {/* Marks summary */}
//           <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
//             <span className="text-xs text-slate-600">Total Marks Awarded</span>
//             <span className="text-base font-bold text-slate-900">
//               {totalAwarded}
//               <span className="text-xs font-normal text-slate-400">
//                 {' '}
//                 / {totalMax}
//               </span>
//             </span>
//           </div>

//           {/* ✅ Warning if 0 marks */}
//           {totalAwarded === 0 && (
//             <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
//               <i className="ri-alert-line text-amber-500 text-sm shrink-0"></i>
//               <p className="text-[11px] text-amber-700">
//                 You are submitting with 0 marks awarded.
//               </p>
//             </div>
//           )}
//         </div>

//         {/* Footer */}
//         <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
//           <button
//             onClick={onCancel}
//             className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={onConfirm}
//             className={`px-4 py-2 text-xs font-semibold text-white ${config.btnBg} ${config.btnHover} rounded-lg cursor-pointer transition-colors whitespace-nowrap`}
//           >
//             Confirm
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


import type { ModalType } from "../MarkingView";

interface ConfirmModalProps {
  type: ModalType;
  totalAwarded: number;
  totalMax: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const modalConfig: Record<string, { title: string; headerBg: string; headerBorder: string; iconBg: string; iconColor: string; icon: string; btnBg: string; btnHover: string }> = {
  escalate: {
    title: "Escalate for Review",
    headerBg: "bg-sky-50",
    headerBorder: "border-sky-100",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    icon: "ri-alert-line",
    btnBg: "bg-sky-600",
    btnHover: "hover:bg-sky-500",
  },
  submitContinue: {
    title: "Submit and Continue",
    headerBg: "bg-emerald-50",
    headerBorder: "border-emerald-100",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: "ri-check-double-line",
    btnBg: "bg-emerald-600",
    btnHover: "hover:bg-emerald-500",
  },
  submitExit: {
    title: "Submit and Exit",
    headerBg: "bg-rose-50",
    headerBorder: "border-rose-100",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    icon: "ri-logout-box-line",
    btnBg: "bg-rose-600",
    btnHover: "hover:bg-rose-500",
  },
};

export default function ConfirmModal({
  type,
  totalAwarded,
  totalMax,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!type) return null;

  const config = modalConfig[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-white rounded-xl w-[380px] overflow-hidden shadow-2xl">
        <div className={`px-5 py-4 ${config.headerBg} border-b ${config.headerBorder}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${config.iconBg} flex items-center justify-center`}>
              <i className={`${config.icon} ${config.iconColor}`}></i>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{config.title}</h3>
              <p className="text-[11px] text-slate-500">Please confirm your action</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* <div>
              <span className="text-slate-500">Student Name</span>
              <p className="font-semibold text-slate-800 mt-0.5">Priya Singh</p>
            </div>
            <div>
              <span className="text-slate-500">Roll Number</span>
              <p className="font-semibold text-slate-800 mt-0.5">102</p>
            </div> */}
            <div>
              <span className="text-slate-500">Exam</span>
              <p className="font-semibold text-slate-800 mt-0.5">Mathematics Mid-Term</p>
            </div>
            <div>
              <span className="text-slate-500">Sheet ID</span>
              <p className="font-semibold text-slate-800 mt-0.5">#002</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
            <span className="text-xs text-slate-600">Total Marks Awarded</span>
            <span className="text-base font-bold text-slate-900">
              {totalAwarded}
              <span className="text-xs font-normal text-slate-400"> / {totalMax}</span>
            </span>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold text-white ${config.btnBg} ${config.btnHover} rounded-lg cursor-pointer transition-colors whitespace-nowrap`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}