// // // src/pages/checker/components/ThumbnailPanel.tsx

// // interface ThumbnailPanelProps {
// //   currentPage: number;
// //   blankPages: Set<number>;
// //   selectedThumbnails: Set<number>;
// //   onThumbnailClick: (page: number) => void;
// //   onBlankToggle: (page: number) => void;
// //   onApplyBlank: () => void;
// //   totalPages: number;
// //   pdfPageImages?: Record<number, string>;
// //   pdfPageCount?: number;
// //   isPdfMode?: boolean;
// // }

// // const pageLines: Record<number, number[]> = {};
// // for (let i = 1; i <= 18; i++) {
// //   const count = 6 + (i % 5);
// //   pageLines[i] = Array.from({ length: count }, () => Math.random() * 60 + 20);
// // }

// // export default function ThumbnailPanel({
// //   currentPage,
// //   blankPages,
// //   selectedThumbnails,
// //   onThumbnailClick,
// //   onBlankToggle,
// //   onApplyBlank,
// //   totalPages,
// //   pdfPageImages = {},
// //   pdfPageCount = 0,
// //   isPdfMode = false,
// // }: ThumbnailPanelProps) {
// //   const selectedCount = selectedThumbnails.size;
// //   const actualTotalPages = isPdfMode ? pdfPageCount : totalPages;

// //   return (
// //     <aside className="w-[130px] shrink-0 bg-[#1e293b] flex flex-col border-r border-slate-700">
// //       <div className="p-2">
// //         <button
// //           onClick={onApplyBlank}
// //           disabled={selectedCount === 0}
// //           className="w-full py-1.5 text-xs font-medium rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
// //         >
// //           {selectedCount > 0
// //             ? `Apply Blank Mark (${selectedCount})`
// //             : 'Apply Blank Mark'}
// //         </button>
// //       </div>

// //       <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
// //         {Array.from(
// //           { length: actualTotalPages || totalPages },
// //           (_, i) => i + 1,
// //         ).map((page) => {
// //           const isCurrent = page === currentPage;
// //           const isBlank = blankPages.has(page);
// //           const isSelected = selectedThumbnails.has(page);
// //           const hasImage = !!pdfPageImages[page];

// //           let borderColor = 'border-transparent';
// //           if (isCurrent) borderColor = 'border-sky-500';
// //           else if (isSelected) borderColor = 'border-amber-500';

// //           return (
// //             <div
// //               key={page}
// //               className={`relative border-2 ${borderColor} rounded cursor-pointer transition-colors ${
// //                 isBlank ? 'opacity-50' : ''
// //               }`}
// //             >
// //               <div
// //                 onClick={() => onThumbnailClick(page)}
// //                 className="bg-white/90 p-1 rounded-sm"
// //               >
// //                 {isPdfMode && hasImage ? (
// //                   <img
// //                     src={pdfPageImages[page]}
// //                     alt={`Page ${page}`}
// //                     className="w-full h-auto rounded-sm"
// //                   />
// //                 ) : (
// //                   <div className="space-y-[2px] py-0.5">
// //                     {pageLines[page]?.map((w, j) => (
// //                       <div
// //                         key={j}
// //                         className="h-[3px] bg-slate-300 rounded-full"
// //                         style={{ width: `${w}%` }}
// //                       />
// //                     ))}
// //                   </div>
// //                 )}
// //               </div>

// //               <label
// //                 className="absolute top-0.5 left-0.5 flex items-center gap-1 cursor-pointer"
// //                 onClick={(e) => e.stopPropagation()}
// //               >
// //                 <input
// //                   type="checkbox"
// //                   checked={isSelected}
// //                   onChange={() => onBlankToggle(page)}
// //                   className="w-3 h-3 rounded border-slate-500 bg-slate-700 accent-amber-500 cursor-pointer"
// //                 />
// //               </label>

// //               <div className="flex items-center justify-between px-1 py-0.5">
// //                 <span className="text-[10px] text-slate-400">Page {page}</span>
// //                 {isBlank && (
// //                   <span className="text-[9px] font-medium text-amber-400 bg-amber-500/15 px-1 rounded">
// //                     Blank
// //                   </span>
// //                 )}
// //               </div>
// //             </div>
// //           );
// //         })}
// //       </div>
// //     </aside>
// //   );
// // }

// // src/pages/checker/components/ThumbnailPanel.tsx

// import { useMemo } from 'react';

// interface ThumbnailPanelProps {
//   currentPage: number;
//   blankPages: Set<number>;
//   selectedThumbnails: Set<number>;
//   onThumbnailClick: (page: number) => void;
//   onBlankToggle: (page: number) => void;
//   onApplyBlank: () => void;
//   totalPages: number;
//   pdfPageImages?: Record<number, string>;
//   pdfPageCount?: number;
//   isPdfMode?: boolean;
// }

// // ✅ FIX: Math.random() in module scope runs once but is non-deterministic.
// // Replaced with a seeded deterministic pattern using page number.
// function getPageLines(pageNum: number): number[] {
//   const count = 6 + (pageNum % 5);
//   return Array.from({ length: count }, (_, i) => {
//     // Deterministic pseudo-random width based on page + line index
//     const seed = (pageNum * 31 + i * 17) % 100;
//     return 20 + (seed % 60);
//   });
// }

// export default function ThumbnailPanel({
//   currentPage,
//   blankPages,
//   selectedThumbnails,
//   onThumbnailClick,
//   onBlankToggle,
//   onApplyBlank,
//   totalPages,
//   pdfPageImages = {},
//   pdfPageCount = 0,
//   isPdfMode = false,
// }: ThumbnailPanelProps) {
//   const selectedCount = selectedThumbnails.size;

//   // ✅ Use actual PDF page count when in PDF mode, fallback to totalPages
//   const actualTotalPages = isPdfMode && pdfPageCount > 0 ? pdfPageCount : totalPages;

//   // ✅ Memoize page lines so they don't recalculate on every render
//   const pageLineMap = useMemo(() => {
//     const map: Record<number, number[]> = {};
//     for (let i = 1; i <= actualTotalPages; i++) {
//       map[i] = getPageLines(i);
//     }
//     return map;
//   }, [actualTotalPages]);

//   return (
//     <aside className="w-[130px] shrink-0 bg-[#1e293b] flex flex-col border-r border-slate-700">
//       {/* Apply Blank Mark button */}
//       <div className="p-2 shrink-0">
//         <button
//           onClick={onApplyBlank}
//           disabled={selectedCount === 0}
//           className="w-full py-1.5 text-xs font-medium rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
//         >
//           {selectedCount > 0
//             ? `Apply Blank (${selectedCount})`
//             : 'Apply Blank Mark'}
//         </button>
//       </div>

//       {/* Page count indicator */}
//       <div className="px-2 pb-1 shrink-0">
//         <p className="text-[9px] text-slate-500 text-center tabular-nums">
//           {actualTotalPages} page{actualTotalPages !== 1 ? 's' : ''}
//         </p>
//       </div>

//       {/* Thumbnails list */}
//       <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
//         {Array.from({ length: actualTotalPages }, (_, i) => i + 1).map(
//           (page) => {
//             const isCurrent = page === currentPage;
//             const isBlank = blankPages.has(page);
//             const isSelected = selectedThumbnails.has(page);
//             const hasImage = isPdfMode && !!pdfPageImages[page];

//             let borderColor = 'border-transparent';
//             if (isCurrent) borderColor = 'border-sky-500';
//             else if (isSelected) borderColor = 'border-amber-500';

//             return (
//               <div
//                 key={page}
//                 data-thumbnail-page={page}
//                 className={`relative border-2 ${borderColor} rounded cursor-pointer transition-all ${
//                   isBlank ? 'opacity-40' : ''
//                 } ${isCurrent ? 'shadow-md shadow-sky-500/20' : ''}`}
//               >
//                 {/* Page content */}
//                 <div
//                   onClick={() => onThumbnailClick(page)}
//                   className="bg-white/90 p-1 rounded-sm select-none"
//                 >
//                   {hasImage ? (
//                     // ✅ Real PDF page thumbnail
//                     <img
//                       src={pdfPageImages[page]}
//                       alt={`Page ${page}`}
//                       className="w-full h-auto rounded-sm"
//                       draggable={false}
//                     />
//                   ) : isPdfMode ? (
//                     // PDF mode but image not loaded yet — skeleton
//                     <div className="h-16 bg-slate-200 rounded-sm animate-pulse flex items-center justify-center">
//                       <i className="ri-file-pdf-line text-slate-400 text-xs"></i>
//                     </div>
//                   ) : (
//                     // Mock lined paper for non-PDF mode
//                     <div className="space-y-[2px] py-0.5">
//                       {(pageLineMap[page] || getPageLines(page)).map((w, j) => (
//                         <div
//                           key={j}
//                           className="h-[3px] bg-slate-300 rounded-full"
//                           style={{ width: `${w}%` }}
//                         />
//                       ))}
//                     </div>
//                   )}
//                 </div>

//                 {/* Blank checkbox */}
//                 <label
//                   className="absolute top-0.5 left-0.5 flex items-center gap-1 cursor-pointer"
//                   onClick={(e) => e.stopPropagation()}
//                 >
//                   <input
//                     type="checkbox"
//                     checked={isSelected}
//                     onChange={() => onBlankToggle(page)}
//                     className="w-3 h-3 rounded border-slate-500 bg-slate-700 accent-amber-500 cursor-pointer"
//                   />
//                 </label>

//                 {/* Page label + blank badge */}
//                 <div className="flex items-center justify-between px-1 py-0.5">
//                   <span
//                     className={`text-[10px] tabular-nums ${
//                       isCurrent ? 'text-sky-400 font-semibold' : 'text-slate-400'
//                     }`}
//                   >
//                     {page}
//                   </span>
//                   {isBlank && (
//                     <span className="text-[9px] font-medium text-amber-400 bg-amber-500/15 px-1 rounded">
//                       Blank
//                     </span>
//                   )}
//                   {isCurrent && !isBlank && (
//                     <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
//                   )}
//                 </div>
//               </div>
//             );
//           },
//         )}
//       </div>
//     </aside>
//   );
// }


// src/pages/checker/components/ThumbnailPanel.tsx

import { useMemo } from "react";

interface ThumbnailPanelProps {
  currentPage: number;
  blankPages: Set<number>;
  selectedThumbnails: Set<number>;
  onThumbnailClick: (page: number) => void;
  onBlankToggle: (page: number) => void;
  onApplyBlank: () => void;
  totalPages: number;
  pdfPageImages?: Record<number, string>;
  pdfPageCount?: number;
  isPdfMode?: boolean;
  dragOverPage?: number | null;
}

// Deterministic pseudo-random line widths based on page number — Math.random()
// at module scope is non-deterministic and regenerates a different mock layout
// on every hot reload / re-mount, which just looks like flicker to the user.
function getPageLines(pageNum: number): number[] {
  const count = 6 + (pageNum % 5);
  return Array.from({ length: count }, (_, i) => {
    const seed = (pageNum * 31 + i * 17) % 100;
    return 20 + (seed % 60);
  });
}

export default function ThumbnailPanel({
  currentPage,
  blankPages,
  selectedThumbnails,
  onThumbnailClick,
  onBlankToggle,
  onApplyBlank,
  totalPages,
  pdfPageImages = {},
  pdfPageCount = 0,
  isPdfMode = false,
  dragOverPage = null,
}: ThumbnailPanelProps) {
  const selectedCount = selectedThumbnails.size;

  // Use the real PDF page count when in PDF mode, fall back to totalPages
  const actualTotalPages = isPdfMode && pdfPageCount > 0 ? pdfPageCount : totalPages;

  // Memoize so the mock line pattern doesn't recompute on every render
  const pageLineMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (let i = 1; i <= actualTotalPages; i++) {
      map[i] = getPageLines(i);
    }
    return map;
  }, [actualTotalPages]);

  return (
    <aside className="w-[130px] shrink-0 bg-[#1e293b] flex flex-col border-r border-slate-700">
      {/* Apply Blank Mark button */}
      <div className="p-2 shrink-0">
        <button
          onClick={onApplyBlank}
          disabled={selectedCount === 0}
          className="w-full py-1.5 text-xs font-medium rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
        >
          {selectedCount > 0 ? `Apply Blank (${selectedCount})` : "Apply Blank Mark"}
        </button>
      </div>

      {/* Page count indicator */}
      <div className="px-2 pb-1 shrink-0">
        <p className="text-[9px] text-slate-500 text-center tabular-nums">
          {actualTotalPages} page{actualTotalPages !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Thumbnails list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {Array.from({ length: actualTotalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = page === currentPage;
          const isBlank = blankPages.has(page);
          const isSelected = selectedThumbnails.has(page);
          const hasImage = isPdfMode && !!pdfPageImages[page];
          const isDragOver = dragOverPage === page;

          let borderColor = "border-transparent";
          if (isCurrent) borderColor = "border-sky-500";
          else if (isSelected) borderColor = "border-amber-500";

          return (
            <div
              key={page}
              data-thumbnail-page={page}
              className={`relative border-2 ${borderColor} rounded cursor-pointer transition-all ${isBlank ? "opacity-40" : ""
                } ${isCurrent ? "shadow-md shadow-sky-500/20" : ""} ${isDragOver ? "border-sky-400 border-dashed bg-sky-500/10" : ""
                }`}
            >
              {/* Page content */}
              <div
                onClick={() => onThumbnailClick(page)}
                className="bg-white/90 p-1 rounded-sm select-none"
              >
                {hasImage ? (
                  // Real PDF page thumbnail
                  <img
                    src={pdfPageImages[page]}
                    alt={`Page ${page}`}
                    className="w-full h-auto rounded-sm"
                    draggable={false}
                  />
                ) : isPdfMode ? (
                  // PDF mode but this page's image hasn't rendered yet — skeleton
                  <div className="h-16 bg-slate-200 rounded-sm animate-pulse flex items-center justify-center">
                    <i className="ri-file-pdf-line text-slate-400 text-xs"></i>
                  </div>
                ) : (
                  // Mock lined paper for non-PDF mode
                  <div className="space-y-[2px] py-0.5">
                    {(pageLineMap[page] || getPageLines(page)).map((w, j) => (
                      <div
                        key={j}
                        className="h-[3px] bg-slate-300 rounded-full"
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Blank checkbox */}
              <label
                className="absolute top-0.5 left-0.5 flex items-center gap-1 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onBlankToggle(page)}
                  className="w-3 h-3 rounded border-slate-500 bg-slate-700 accent-amber-500 cursor-pointer"
                />
              </label>

              {/* Page label + blank badge */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <span
                  className={`text-[10px] tabular-nums ${isCurrent ? "text-sky-400 font-semibold" : "text-slate-400"
                    }`}
                >
                  Page {page}
                </span>
                {isBlank && (
                  <span className="text-[9px] font-medium text-amber-400 bg-amber-500/15 px-1 rounded">
                    Blank
                  </span>
                )}
                {isCurrent && !isBlank && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}