// // src/pages/checker/components/SheetViewer.tsx

// import {
//   forwardRef,
//   useImperativeHandle,
//   useCallback,
//   useEffect,
//   useRef,
//   useState,
//   useMemo,
// } from 'react';
// import type { AnnotationTool, Annotation, MarksStamp } from '../MarkingView';

// // ✅ PDF.js imports
// import * as pdfjsLib from 'pdfjs-dist';

// // ✅ Set worker source - FIXED for production
// if (import.meta.env.PROD) {
//   // Production: Use CDN or local path
//  pdfjsLib.GlobalWorkerOptions.workerSrc =
//    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
// } else {
//   // Development: Use local worker
//   pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
//     'pdfjs-dist/build/pdf.worker.min.mjs',
//     import.meta.url,
//   ).toString();
// }

// // ... rest of the component code

// interface SheetViewerProps {
//   currentPage: number;
//   totalPages: number;
//   blankPages: Set<number>;
//   onPageChange: (page: number) => void;
//   zoom: number;
//   activeTool: AnnotationTool;
//   annotations: Annotation[];
//   stamps: MarksStamp[];
//   activeMarkId: string | null;
//   placingMarkId: string | null;
//   instructionBanner: string | null;
//   stampColor?: string;
//   pulseAnimationName?: string;
//   onAnnotationAdd: (
//     tool: AnnotationTool,
//     x: number,
//     y: number,
//     page: number,
//     width?: number,
//     height?: number,
//   ) => void;
//   onAnnotationDelete: (id: number) => void;
//   onEraserNoHit: () => void;
//   onPencilStroke: () => void;
//   onSheetClickForPlacement: (
//     page: number,
//     xPercent: number,
//     yPercent: number,
//   ) => void;
//   onStampReposition: (
//     markId: string,
//     page: number,
//     xPercent: number,
//     yPercent: number,
//   ) => void;
//   onDismissBanner: () => void;
//   pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
//   scrollToPage: (page: number) => void;
//   pdfUrl?: string | null;
//   onPageRender?: (pageNum: number, imageData: string) => void; // ✅ ADD
//   onPageCount?: (count: number) => void;
// }

// export interface SheetViewerHandle {
//   undoPencil: () => void;
//   clearPencil: () => void;
//   hasPencilMarks: () => boolean;
// }

// const SheetViewer = forwardRef<SheetViewerHandle, SheetViewerProps>(
//   function SheetViewer(
//     {
//       currentPage,
//       totalPages,
//       blankPages,
//       onPageChange,
//       zoom,
//       activeTool,
//       annotations,
//       stamps,
//       activeMarkId,
//       placingMarkId,
//       instructionBanner,
//       stampColor = '#4338CA',
//       pulseAnimationName = 'stampPulse',
//       onAnnotationAdd,
//       onAnnotationDelete,
//       onEraserNoHit,
//       onPencilStroke,
//       onSheetClickForPlacement,
//       onStampReposition,
//       onDismissBanner,
//       pageRefs,
//       scrollToPage,
//       pdfUrl,
//       onPageRender, // ✅ ADD THIS
//       onPageCount,
//     },
//     ref,
//   ) {
//     const scrollContainerRef = useRef<HTMLDivElement>(null);
//     const canvasRef = useRef<HTMLCanvasElement>(null);
//     const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
//     const isDrawingRef = useRef(false);
//     const canvasHistoryRef = useRef<string[]>([]);

//     const onPencilStrokeRef = useRef(onPencilStroke);
//     useEffect(() => {
//       onPencilStrokeRef.current = onPencilStroke;
//     }, [onPencilStroke]);

//     // ─── Highlight drag state ───
//     const [highlightPreview, setHighlightPreview] = useState<{
//       x: number;
//       y: number;
//       width: number;
//       height: number;
//       page: number;
//     } | null>(null);
//     const highlightDragRef = useRef<{
//       startX: number;
//       startY: number;
//       page: number;
//     } | null>(null);

//     // ─── Stamp drag reposition state ───
//     const [dragStamp, setDragStamp] = useState<{
//       markId: string;
//       page: number;
//       x: number;
//       y: number;
//     } | null>(null);

//     // ─── Build page-stamps lookup ───
//     const stampsByPage = useMemo(() => {
//       const map: Record<number, MarksStamp[]> = {};
//       stamps.forEach((s) => {
//         if (!map[s.page]) map[s.page] = [];
//         map[s.page].push(s);
//       });
//       return map;
//     }, [stamps]);

//     // ─── PDF STATE ────────────────────────────────────────────

//     const [pdfLoading, setPdfLoading] = useState(false);
//     const [pdfError, setPdfError] = useState<string | null>(null);
//     const [pdfDocument, setPdfDocument] = useState<any>(null);
//     const [pdfPageCount, setPdfPageCount] = useState(0);
//     const [pdfRenderedPages, setPdfRenderedPages] = useState<Set<number>>(
//       new Set(),
//     );
//     const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
//     const pdfCanvasContainerRef = useRef<HTMLDivElement | null>(null);

//     // ─── LOAD PDF ─────────────────────────────────────────────

//     useEffect(() => {
//       if (!pdfUrl) {
//         setPdfDocument(null);
//         setPdfPageCount(0);
//         setPdfRenderedPages(new Set());
//         setPdfError(null);
//         return;
//       }

//       const loadPdf = async () => {
//         setPdfLoading(true);
//         setPdfError(null);
//         try {
//           const loadingTask = pdfjsLib.getDocument(pdfUrl);
//           const pdf = await loadingTask.promise;
//           setPdfDocument(pdf);
//           setPdfPageCount(pdf.numPages);
//           setPdfRenderedPages(new Set());
//         } catch (err) {
//           console.error('PDF load error:', err);
//           setPdfError('Failed to load PDF document');
//         } finally {
//           setPdfLoading(false);
//         }
//       };

//       loadPdf();
//     }, [pdfUrl]);

//     // ─── RENDER PDF PAGE TO CANVAS ────────────────────────────

//     // SheetViewer.tsx

//     // ─── RENDER PDF PAGE TO CANVAS ────────────────────────────

//     useEffect(() => {
//       const renderPage = async (pageNum: number) => {
//         if (!pdfDocument || pdfRenderedPages.has(pageNum)) return;

//         const canvas = pdfCanvasRef.current;
//         if (!canvas) return;

//         try {
//           const page = await pdfDocument.getPage(pageNum);
//           const viewport = page.getViewport({ scale: 1.5 });

//           const context = canvas.getContext('2d');
//           if (!context) return;

//           canvas.width = viewport.width;
//           canvas.height = viewport.height;

//           const renderContext = {
//             canvasContext: context,
//             viewport: viewport,
//           };

//           await page.render(renderContext).promise;

//           // ✅ Get image data for thumbnail
//           const imageData = canvas.toDataURL();

//           // ✅ Send to parent component
//           onPageRender?.(pageNum, imageData);
//           onPageCount?.(pdfPageCount);

//           setPdfRenderedPages((prev) => new Set([...prev, pageNum]));
//         } catch (err) {
//           console.error(`Error rendering page ${pageNum}:`, err);
//         }
//       };

//       if (
//         pdfDocument &&
//         pdfCanvasRef.current &&
//         !pdfRenderedPages.has(currentPage)
//       ) {
//         renderPage(currentPage);
//       }
//     }, [
//       pdfDocument,
//       currentPage,
//       pdfRenderedPages,
//       onPageRender,
//       onPageCount,
//       pdfPageCount,
//     ]);

//     // ─── Page overlay handlers (tick, cross, highlight, eraser) ───

//     const getCanvasCoordinates = useCallback(
//       (e: React.MouseEvent<HTMLDivElement>) => {
//         const canvas = pdfCanvasRef.current;
//         if (!canvas) return { x: 0, y: 0 };

//         const rect = canvas.getBoundingClientRect();
//         const scaleX = canvas.width / rect.width;
//         const scaleY = canvas.height / rect.height;

//         return {
//           x: (e.clientX - rect.left) * scaleX,
//           y: (e.clientY - rect.top) * scaleY,
//         };
//       },
//       [],
//     );

//     const handleOverlayMouseDown = useCallback(
//       (e: React.MouseEvent<HTMLDivElement>) => {
//         if (placingMarkId) return;
//         if (activeTool === 'highlight') {
//           const { x, y } = getCanvasCoordinates(e);
//           highlightDragRef.current = {
//             startX: x,
//             startY: y,
//             page: currentPage,
//           };
//         }
//       },
//       [activeTool, placingMarkId, getCanvasCoordinates, currentPage],
//     );

//     const handleOverlayMouseMove = useCallback(
//       (e: React.MouseEvent<HTMLDivElement>) => {
//         if (placingMarkId) return;
//         if (activeTool !== 'highlight' || !highlightDragRef.current) return;
//         if (highlightDragRef.current.page !== currentPage) return;

//         const { x, y } = getCanvasCoordinates(e);
//         const startX = highlightDragRef.current.startX;
//         const startY = highlightDragRef.current.startY;

//         setHighlightPreview({
//           x: Math.min(startX, x),
//           y: Math.min(startY, y),
//           width: Math.abs(x - startX),
//           height: Math.abs(y - startY),
//           page: currentPage,
//         });
//       },
//       [activeTool, placingMarkId, getCanvasCoordinates, currentPage],
//     );

//     const handleOverlayMouseUp = useCallback(
//       (e: React.MouseEvent<HTMLDivElement>) => {
//         if (placingMarkId) return;

//         const { x, y } = getCanvasCoordinates(e);

//         if (activeTool === 'eraser') {
//           const pageAnnotations = annotations.filter(
//             (ann) => ann.page === currentPage,
//           );

//           for (const ann of pageAnnotations) {
//             if (ann.tool === 'highlight' && ann.width && ann.height) {
//               if (
//                 x >= ann.x &&
//                 x <= ann.x + ann.width &&
//                 y >= ann.y &&
//                 y <= ann.y + ann.height
//               ) {
//                 onAnnotationDelete(ann.id);
//                 return;
//               }
//             }
//           }

//           for (const ann of pageAnnotations) {
//             if (ann.tool === 'tick' || ann.tool === 'cross') {
//               const dx = x - ann.x;
//               const dy = y - ann.y;
//               if (Math.sqrt(dx * dx + dy * dy) < 20) {
//                 onAnnotationDelete(ann.id);
//                 return;
//               }
//             }
//           }

//           onEraserNoHit();
//           return;
//         }

//         if (activeTool === 'highlight' && highlightDragRef.current) {
//           const startX = highlightDragRef.current.startX;
//           const startY = highlightDragRef.current.startY;
//           const w = Math.abs(x - startX);
//           const h = Math.abs(y - startY);

//           highlightDragRef.current = null;
//           setHighlightPreview(null);

//           if (w >= 10 && h >= 10) {
//             onAnnotationAdd(
//               'highlight',
//               Math.min(startX, x),
//               Math.min(startY, y),
//               currentPage,
//               w,
//               h,
//             );
//           }
//         } else if (activeTool === 'tick' || activeTool === 'cross') {
//           onAnnotationAdd(activeTool, x, y, currentPage);
//         }
//       },
//       [
//         activeTool,
//         placingMarkId,
//         getCanvasCoordinates,
//         currentPage,
//         annotations,
//         onAnnotationAdd,
//         onAnnotationDelete,
//         onEraserNoHit,
//       ],
//     );

//     // ─── Click-to-place handler ───
//     const handlePlaceClick = useCallback(
//       (e: React.MouseEvent<HTMLDivElement>) => {
//         if (!placingMarkId) return;
//         const canvas = pdfCanvasRef.current;
//         if (!canvas) return;

//         const rect = canvas.getBoundingClientRect();
//         const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
//         const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

//         onSheetClickForPlacement(currentPage, xPercent, yPercent);
//       },
//       [placingMarkId, currentPage, onSheetClickForPlacement],
//     );

//     // ─── Stamp right-click → start drag ───
//     const handleStampRightClick = useCallback(
//       (
//         e: React.MouseEvent,
//         markId: string,
//         page: number,
//         x: number,
//         y: number,
//       ) => {
//         e.preventDefault();
//         e.stopPropagation();
//         setDragStamp({ markId, page, x, y });
//       },
//       [],
//     );

//     // ─── Stamp drag mouse move / release (document-level) ───
//     useEffect(() => {
//       if (!dragStamp) return;

//       const handleMouseMove = (e: MouseEvent) => {
//         const canvas = pdfCanvasRef.current;
//         if (!canvas) return;

//         const rect = canvas.getBoundingClientRect();
//         const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
//         const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

//         setDragStamp((prev) =>
//           prev ? { ...prev, x: xPercent, y: yPercent } : null,
//         );
//       };

//       const handleMouseUp = () => {
//         if (dragStamp) {
//           onStampReposition(
//             dragStamp.markId,
//             dragStamp.page,
//             dragStamp.x,
//             dragStamp.y,
//           );
//         }
//         setDragStamp(null);
//       };

//       document.addEventListener('mousemove', handleMouseMove);
//       document.addEventListener('mouseup', handleMouseUp);

//       return () => {
//         document.removeEventListener('mousemove', handleMouseMove);
//         document.removeEventListener('mouseup', handleMouseUp);
//       };
//     }, [dragStamp, onStampReposition]);

//     // ─── IntersectionObserver ───
//     useEffect(() => {
//       const container = scrollContainerRef.current;
//       if (!container) return;

//       const observer = new IntersectionObserver(
//         (entries) => {
//           let bestPage = currentPage;
//           let bestRatio = 0;
//           entries.forEach((entry) => {
//             if (entry.intersectionRatio > bestRatio) {
//               bestRatio = entry.intersectionRatio;
//               const pageNum = parseInt(
//                 entry.target.getAttribute('data-page') || '1',
//                 10,
//               );
//               bestPage = pageNum;
//             }
//           });
//           if (bestRatio > 0 && bestPage !== currentPage) {
//             onPageChange(bestPage);
//           }
//         },
//         {
//           root: container,
//           threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
//         },
//       );

//       for (let i = 1; i <= totalPages; i++) {
//         const el = pageRefs.current[i];
//         if (el) observer.observe(el);
//       }

//       return () => observer.disconnect();
//     }, [currentPage, totalPages, onPageChange, pageRefs]);

//     const isPencilActive = activeTool === 'pencil';
//     const isPlacing = !!placingMarkId;

//     // ─── Hex to rgba converter for stamp shadows ───
//     const stampRgba = useCallback(
//       (alpha: number) => {
//         const r = parseInt(stampColor.slice(1, 3), 16);
//         const g = parseInt(stampColor.slice(3, 5), 16);
//         const b = parseInt(stampColor.slice(5, 7), 16);
//         return `rgba(${r}, ${g}, ${b}, ${alpha})`;
//       },
//       [stampColor],
//     );

//     // ─── ✅ IF PDF URL EXISTS, SHOW PDF WITH OVERLAY ──────────────────────

//     if (pdfUrl) {
//       const pageStamps = stampsByPage[currentPage] || [];

//       return (
//         <div className="flex-1 flex flex-col bg-[#0f172a] min-w-0">
//           {/* Instruction banner */}
//           {instructionBanner && (
//             <div
//               className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2"
//               style={{
//                 backgroundColor: '#FFFBEB',
//                 border: '1px solid #F59E0B',
//               }}
//             >
//               <div className="w-4 h-4 flex items-center justify-center shrink-0">
//                 <i
//                   className="ri-information-line text-sm"
//                   style={{ color: '#D97706' }}
//                 ></i>
//               </div>
//               <span
//                 className="text-[11px] font-medium flex-1"
//                 style={{ color: '#92400E' }}
//               >
//                 {instructionBanner}
//               </span>
//               <button
//                 onClick={onDismissBanner}
//                 className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
//                 style={{ color: '#92400E' }}
//               >
//                 <i className="ri-close-line text-xs"></i>
//               </button>
//             </div>
//           )}

//           {/* PDF Viewer with overlay */}
//           <div
//             className="flex-1 overflow-y-auto flex justify-center p-4 relative"
//             ref={scrollContainerRef}
//           >
//             {pdfLoading ? (
//               <div className="flex items-center justify-center w-full h-full">
//                 <div className="text-center">
//                   <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
//                   <p className="text-slate-400 mt-3 text-sm">Loading PDF...</p>
//                 </div>
//               </div>
//             ) : pdfError ? (
//               <div className="flex items-center justify-center w-full h-full">
//                 <div className="text-center">
//                   <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
//                     <i className="ri-error-warning-line text-red-400 text-3xl"></i>
//                   </div>
//                   <p className="text-red-400 text-sm">{pdfError}</p>
//                   <button
//                     onClick={() => window.location.reload()}
//                     className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
//                   >
//                     Reload
//                   </button>
//                 </div>
//               </div>
//             ) : (
//               <div
//                 className="relative w-full max-w-4xl"
//                 ref={pdfCanvasContainerRef}
//               >
//                 {/* PDF Canvas */}
//                 <canvas
//                   ref={pdfCanvasRef}
//                   className="mx-auto shadow-lg rounded-lg"
//                   style={{
//                     width: '100%',
//                     height: 'auto',
//                     backgroundColor: 'white',
//                     display: 'block',
//                   }}
//                 />

//                 {/* ✅ Overlay for annotations and stamps */}
//                 <div
//                   className="absolute inset-0 z-10"
//                   style={{ pointerEvents: 'none' }}
//                 >
//                   {/* Annotation overlay (tick, cross, highlight) + click-to-place */}
//                   <div
//                     className="absolute inset-0 z-20"
//                     style={{
//                       pointerEvents:
//                         isPlacing || activeTool !== 'pencil' ? 'auto' : 'none',
//                       cursor: isPlacing
//                         ? 'crosshair'
//                         : activeTool === 'eraser'
//                           ? 'not-allowed'
//                           : activeTool === 'highlight' ||
//                               activeTool === 'tick' ||
//                               activeTool === 'cross'
//                             ? 'crosshair'
//                             : 'default',
//                     }}
//                     onClick={isPlacing ? handlePlaceClick : undefined}
//                     onMouseDown={isPlacing ? undefined : handleOverlayMouseDown}
//                     onMouseMove={isPlacing ? undefined : handleOverlayMouseMove}
//                     onMouseUp={isPlacing ? undefined : handleOverlayMouseUp}
//                   />

//                   {/* Highlight preview */}
//                   {highlightPreview &&
//                     highlightPreview.page === currentPage && (
//                       <div
//                         className="absolute z-15 pointer-events-none"
//                         style={{
//                           left: highlightPreview.x,
//                           top: highlightPreview.y,
//                           width: highlightPreview.width,
//                           height: highlightPreview.height,
//                           backgroundColor: 'rgba(255, 235, 59, 0.4)',
//                           border: '1px dashed #D97706',
//                         }}
//                       />
//                     )}

//                   {/* STAMPS for this page */}
//                   {pageStamps.map((stamp) => {
//                     const isActive = stamp.markId === activeMarkId;
//                     const hasValue =
//                       stamp.value !== null && stamp.value !== undefined;
//                     const isDragging = dragStamp?.markId === stamp.markId;
//                     const canvas = pdfCanvasRef.current;
//                     if (!canvas) return null;

//                     const rect = canvas.getBoundingClientRect();
//                     const canvasWidth = canvas.width;
//                     const canvasHeight = canvas.height;

//                     const xPos = (stamp.x / 100) * rect.width;
//                     const yPos = (stamp.y / 100) * rect.height;
//                     const size = isActive ? 38 : 34;
//                     const fontSize = isActive ? 15 : 14;

//                     return (
//                       <div
//                         key={stamp.markId}
//                         className={`absolute rounded-full flex items-center justify-center font-bold select-none ${
//                           isDragging
//                             ? 'cursor-grabbing z-30'
//                             : 'cursor-pointer z-5'
//                         }`}
//                         style={{
//                           width: `${size}px`,
//                           height: `${size}px`,
//                           border: hasValue
//                             ? `2px solid ${stampColor}`
//                             : `2px dashed ${stampColor}`,
//                           color: hasValue ? stampColor : '#94a3b8',
//                           fontSize: `${fontSize}px`,
//                           backgroundColor: 'white',
//                           top: `${yPos - size / 2}px`,
//                           left: `${xPos - size / 2}px`,
//                           boxShadow: isActive
//                             ? `0 0 0 4px ${stampRgba(0.25)}`
//                             : undefined,
//                           animation: isActive
//                             ? `${pulseAnimationName} 1.5s ease-in-out infinite`
//                             : undefined,
//                           pointerEvents: 'auto',
//                         }}
//                         onContextMenu={
//                           !isDragging
//                             ? (e) =>
//                                 handleStampRightClick(
//                                   e,
//                                   stamp.markId,
//                                   stamp.page,
//                                   stamp.x,
//                                   stamp.y,
//                                 )
//                             : undefined
//                         }
//                         title={
//                           hasValue
//                             ? `${stamp.markId}: ${stamp.value}`
//                             : `${stamp.markId}: not yet marked`
//                         }
//                       >
//                         {hasValue ? stamp.value : '—'}
//                       </div>
//                     );
//                   })}

//                   {/* Rendered annotations for this page */}
//                   {annotations
//                     .filter((ann) => ann.page === currentPage)
//                     .map((ann) => {
//                       const canvas = pdfCanvasRef.current;
//                       if (!canvas) return null;

//                       const rect = canvas.getBoundingClientRect();
//                       const scaleX = rect.width / canvas.width;
//                       const scaleY = rect.height / canvas.height;

//                       const xPos = ann.x * scaleX;
//                       const yPos = ann.y * scaleY;

//                       return (
//                         <div
//                           key={ann.id}
//                           className="absolute z-10 pointer-events-none"
//                           style={{ left: xPos, top: yPos }}
//                         >
//                           {ann.tool === 'tick' && (
//                             <span
//                               className="font-bold select-none leading-none inline-block"
//                               style={{
//                                 fontSize: `${24 * scaleX}px`,
//                                 color: '#27500A',
//                                 fontFamily: 'serif',
//                                 transform: 'translate(-6px, -12px)',
//                               }}
//                             >
//                               ✓
//                             </span>
//                           )}
//                           {ann.tool === 'cross' && (
//                             <span
//                               className="font-bold select-none leading-none inline-block"
//                               style={{
//                                 fontSize: `${28 * scaleX}px`,
//                                 color: '#E24B4A',
//                                 fontFamily: 'serif',
//                                 transform: 'translate(-7px, -14px)',
//                               }}
//                             >
//                               ✗
//                             </span>
//                           )}
//                           {ann.tool === 'highlight' && (
//                             <div
//                               className="rounded-sm"
//                               style={{
//                                 width: (ann.width ?? 80) * scaleX,
//                                 height: (ann.height ?? 20) * scaleY,
//                                 backgroundColor: 'rgba(250, 204, 21, 0.45)',
//                                 transform: 'translate(-2px, -3px)',
//                               }}
//                             />
//                           )}
//                         </div>
//                       );
//                     })}
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Bottom page navigation */}
//           <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-1 px-3 overflow-x-auto">
//             {pdfPageCount > 0 && (
//               <>
//                 <button
//                   onClick={() => onPageChange(Math.max(1, currentPage - 1))}
//                   disabled={currentPage <= 1}
//                   className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                 >
//                   <i className="ri-arrow-left-s-line"></i>
//                 </button>
//                 <span className="text-xs text-slate-400 px-2">
//                   Page {currentPage} of {pdfPageCount}
//                 </span>
//                 <button
//                   onClick={() =>
//                     onPageChange(Math.min(pdfPageCount, currentPage + 1))
//                   }
//                   disabled={currentPage >= pdfPageCount}
//                   className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                 >
//                   <i className="ri-arrow-right-s-line"></i>
//                 </button>
//               </>
//             )}
//           </div>
//         </div>
//       );
//     }

//     // ─── FALLBACK: Static pages (when no PDF URL) ──────────────────────

//     return (
//       <div className="flex-1 flex flex-col bg-slate-200 min-w-0">
//         {/* ─── INSTRUCTION BANNER ─── */}
//         {instructionBanner && (
//           <div
//             className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2"
//             style={{ backgroundColor: '#FFFBEB', border: '1px solid #F59E0B' }}
//           >
//             <div className="w-4 h-4 flex items-center justify-center shrink-0">
//               <i
//                 className="ri-information-line text-sm"
//                 style={{ color: '#D97706' }}
//               ></i>
//             </div>
//             <span
//               className="text-[11px] font-medium flex-1"
//               style={{ color: '#92400E' }}
//             >
//               {instructionBanner}
//             </span>
//             <button
//               onClick={onDismissBanner}
//               className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
//               style={{ color: '#92400E' }}
//             >
//               <i className="ri-close-line text-xs"></i>
//             </button>
//           </div>
//         )}

//         {/* ─── SCROLLABLE SHEET VIEW ─── */}
//         <div className="flex-1 overflow-y-auto">
//           <div
//             ref={(el) => {
//               scrollContainerRef.current = el;
//             }}
//             className="flex-1 overflow-y-auto flex justify-center"
//           >
//             <div
//               className="relative py-4 flex flex-col items-center gap-2"
//               style={{
//                 transform: `scale(${zoom / 100})`,
//                 transformOrigin: 'top center',
//               }}
//             >
//               {/* ─── PENCIL CANVAS OVERLAY ─── */}
//               <canvas
//                 ref={canvasRef}
//                 width={720}
//                 height={8000}
//                 className="absolute top-0 left-0 z-10"
//                 style={{
//                   pointerEvents: isPencilActive && !isPlacing ? 'auto' : 'none',
//                   cursor:
//                     isPencilActive && !isPlacing ? 'crosshair' : undefined,
//                   width: '720px',
//                   height: '8000px',
//                 }}
//                 onMouseDown={handleCanvasMouseDown}
//                 onMouseMove={handleCanvasMouseMove}
//                 onMouseUp={handleCanvasMouseUp}
//                 onMouseLeave={handleCanvasMouseLeave}
//               />

//               {/* ─── HIGHLIGHT LIVE PREVIEW ─── */}
//               {highlightPreview && (
//                 <div
//                   className="absolute z-15 pointer-events-none"
//                   style={{
//                     left: highlightPreview.x,
//                     top: highlightPreview.y,
//                     width: highlightPreview.width,
//                     height: highlightPreview.height,
//                     backgroundColor: 'rgba(255, 235, 59, 0.4)',
//                     border: '1px dashed #D97706',
//                   }}
//                 />
//               )}

//               {/* ─── PAGES ─── */}
//               {Array.from({ length: totalPages }, (_, i) => {
//                 const page = i + 1;
//                 const isBlank = blankPages.has(page);
//                 const pageAnnotations = annotations.filter(
//                   (ann) => ann.page === page,
//                 );
//                 const pageStamps = stampsByPage[page] || [];
//                 const lines = getPageLines(page);
//                 const showOverlay =
//                   !isBlank && (activeTool !== 'pencil' || isPlacing);
//                 const cursorClass = isPlacing
//                   ? 'cursor-crosshair'
//                   : activeTool === 'eraser'
//                     ? 'cursor-not-allowed'
//                     : activeTool === 'highlight' ||
//                         activeTool === 'tick' ||
//                         activeTool === 'cross'
//                       ? 'cursor-crosshair'
//                       : 'cursor-default';

//                 return (
//                   <div
//                     key={page}
//                     ref={(el) => {
//                       pageRefs.current[page] = el;
//                     }}
//                     data-page={page}
//                     className="relative bg-white shadow-sm rounded-sm shrink-0"
//                     style={{ width: '720px' }}
//                   >
//                     {/* Annotation overlay */}
//                     {showOverlay && (
//                       <div
//                         className={`absolute inset-0 z-20 ${cursorClass}`}
//                         style={{ background: 'transparent' }}
//                         onClick={
//                           isPlacing
//                             ? (e) => handlePlaceClick(page, e)
//                             : undefined
//                         }
//                         onMouseDown={
//                           isPlacing
//                             ? undefined
//                             : (e) => handleOverlayMouseDown(page, e)
//                         }
//                         onMouseMove={
//                           isPlacing
//                             ? undefined
//                             : (e) => handleOverlayMouseMove(page, e)
//                         }
//                         onMouseUp={
//                           isPlacing
//                             ? undefined
//                             : (e) => handleOverlayMouseUp(page, e)
//                         }
//                       />
//                     )}

//                     {/* STAMPS */}
//                     {!isBlank &&
//                       pageStamps.map((stamp) => {
//                         const isActive = stamp.markId === activeMarkId;
//                         const hasValue =
//                           stamp.value !== null && stamp.value !== undefined;
//                         const isDragging = dragStamp?.markId === stamp.markId;
//                         const stampX = isDragging ? dragStamp.x : stamp.x;
//                         const stampY = isDragging ? dragStamp.y : stamp.y;
//                         const size = isActive ? 38 : 34;
//                         const fontSize = isActive ? 15 : 14;

//                         return (
//                           <div
//                             key={stamp.markId}
//                             className={`absolute rounded-full flex items-center justify-center font-bold select-none ${
//                               isDragging
//                                 ? 'cursor-grabbing z-30'
//                                 : 'pointer-events-auto cursor-pointer z-5'
//                             }`}
//                             style={{
//                               width: `${size}px`,
//                               height: `${size}px`,
//                               border: hasValue
//                                 ? `2px solid ${stampColor}`
//                                 : `2px dashed ${stampColor}`,
//                               color: hasValue ? stampColor : '#94a3b8',
//                               fontSize: `${fontSize}px`,
//                               backgroundColor: 'white',
//                               top: `${stampY}%`,
//                               left: `${stampX}%`,
//                               transform: 'translate(-50%, -50%)',
//                               boxShadow: isActive
//                                 ? `0 0 0 4px ${stampRgba(0.25)}`
//                                 : undefined,
//                               animation: isActive
//                                 ? `${pulseAnimationName} 1.5s ease-in-out infinite`
//                                 : undefined,
//                             }}
//                             onContextMenu={
//                               !isDragging
//                                 ? (e) =>
//                                     handleStampRightClick(
//                                       e,
//                                       stamp.markId,
//                                       stamp.page,
//                                       stamp.x,
//                                       stamp.y,
//                                     )
//                                 : undefined
//                             }
//                             title={
//                               hasValue
//                                 ? `${stamp.markId}: ${stamp.value}`
//                                 : `${stamp.markId}: not yet marked`
//                             }
//                           >
//                             {hasValue ? stamp.value : '—'}
//                           </div>
//                         );
//                       })}

//                     {/* Rendered annotations */}
//                     {!isBlank &&
//                       pageAnnotations.map((ann) => (
//                         <div
//                           key={ann.id}
//                           className="absolute z-10 pointer-events-none"
//                           style={{ left: ann.x, top: ann.y }}
//                         >
//                           {ann.tool === 'tick' && (
//                             <span
//                               className="font-bold select-none leading-none inline-block"
//                               style={{
//                                 fontSize: '24px',
//                                 color: '#27500A',
//                                 fontFamily: 'serif',
//                                 transform: 'translate(-6px, -12px)',
//                               }}
//                             >
//                               ✓
//                             </span>
//                           )}
//                           {ann.tool === 'cross' && (
//                             <span
//                               className="font-bold select-none leading-none inline-block"
//                               style={{
//                                 fontSize: '28px',
//                                 color: '#E24B4A',
//                                 fontFamily: 'serif',
//                                 transform: 'translate(-7px, -14px)',
//                               }}
//                             >
//                               ✗
//                             </span>
//                           )}
//                           {ann.tool === 'highlight' && (
//                             <div
//                               className="rounded-sm"
//                               style={{
//                                 width: ann.width ?? 80,
//                                 height: ann.height ?? 20,
//                                 backgroundColor: 'rgba(250, 204, 21, 0.45)',
//                                 transform: 'translate(-2px, -3px)',
//                               }}
//                             />
//                           )}
//                         </div>
//                       ))}

//                     {/* Content */}
//                     <div className="px-6 py-4 min-h-[280px] relative">
//                       {isBlank ? (
//                         <div className="flex items-center justify-center min-h-[240px]">
//                           <div className="text-center">
//                             <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
//                               <i className="ri-file-reduce-line text-amber-500 text-xl"></i>
//                             </div>
//                             <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
//                               Blank Page
//                             </span>
//                             <p className="text-xs text-slate-400 mt-2">
//                               This page has been marked as blank
//                             </p>
//                           </div>
//                         </div>
//                       ) : (
//                         <div className="space-y-2.5">
//                           {page > 1 && (
//                             <div className="text-xs font-semibold text-slate-800 mb-3">
//                               Answer Sheet — Page {page}
//                             </div>
//                           )}
//                           {page === 1 && (
//                             <div className="text-xs font-semibold text-slate-800 mb-3">
//                               Answer Sheet — Page {page}
//                             </div>
//                           )}
//                           {lines.map((line, idx) => (
//                             <p
//                               key={idx}
//                               className="text-[13px] leading-relaxed text-slate-600"
//                               style={{
//                                 fontFamily: "'Caveat', cursive",
//                                 fontSize: idx === 0 ? '15px' : '14px',
//                               }}
//                             >
//                               {line}
//                             </p>
//                           ))}
//                         </div>
//                       )}
//                     </div>

//                     {/* Footer */}
//                     <div className="px-6 py-2 border-t border-slate-100 flex items-center justify-between">
//                       <span className="text-[10px] text-slate-400">
//                         Roll No: 102
//                       </span>
//                       <span className="text-[10px] text-slate-400">
//                         Page {page}
//                       </span>
//                     </div>
//                   </div>
//                 );
//               })}

//               {/* Bottom spacer */}
//               <div className="h-6 shrink-0" />
//             </div>
//           </div>

//           {/* Bottom page grid */}
//           <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-1 px-3 overflow-x-auto">
//             {Array.from({ length: totalPages }, (_, i) => {
//               const p = i + 1;
//               const isBlankP = blankPages.has(p);
//               let btnClass =
//                 'w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap shrink-0 ';
//               if (p === currentPage) {
//                 btnClass += 'bg-sky-500 text-white font-semibold';
//               } else if (isBlankP) {
//                 btnClass += 'bg-amber-500/20 text-amber-400';
//               } else {
//                 btnClass += 'text-slate-400 hover:text-white hover:bg-white/10';
//               }
//               return (
//                 <button
//                   key={p}
//                   onClick={() => scrollToPage(p)}
//                   className={btnClass}
//                 >
//                   {p}
//                 </button>
//               );
//             })}
//           </div>
//         </div>
//       </div>
//     );
//   },
// );

// // ─── Helper function for static pages ───
// function getPageLines(page: number): string[] {
//   const answerLines: Record<number, string[]> = {
//     1: [
//       'Explain the working principle of a single-phase transformer with a neat diagram.',
//       'A single-phase transformer operates on the principle of mutual induction between two coils wound on a common magnetic core.',
//       'When an alternating voltage V₁ is applied to the primary winding, it produces an alternating flux Φ in the core.',
//       "This flux links with the secondary winding and induces an EMF E₂ according to Faraday's law of electromagnetic induction.",
//       'The magnitude of the induced EMF depends on the turns ratio N₂/N₁.',
//       'For a step-down transformer, N₂ &lt; N₁, and for a step-up transformer, N₂ &gt; N₁.',
//       'The core is made of laminated silicon steel to minimize eddy current losses.',
//       'Hysteresis loss is minimized by using high-grade CRGO (Cold Rolled Grain Oriented) steel.',
//       'The efficiency of a well-designed transformer typically ranges from 95% to 99%.',
//       'Applications include power distribution, impedance matching, and electrical isolation.',
//     ],
//     2: [
//       'The EMF equation of a transformer is given by:',
//       'E = 4.44 × f × N × Φₘ × 10⁻⁸ volts',
//       'Where: f = supply frequency in Hz',
//       'N = number of turns in the winding',
//       'Φₘ = maximum flux in the core in Maxwells',
//       'This equation is fundamental to transformer design and analysis.',
//       'For a given core cross-section A and flux density Bₘ:',
//       'Φₘ = Bₘ × A',
//       'Substituting: E = 4.44 × f × N × Bₘ × A × 10⁻⁸',
//       'This shows that the induced EMF is directly proportional to frequency, turns, flux density, and core area.',
//     ],
//     3: [
//       'Explain the concept of voltage regulation in transformers.',
//       'Voltage regulation is defined as the change in secondary terminal voltage from no-load to full-load.',
//       'It is expressed as a percentage of the full-load voltage.',
//       'Regulation (%) = (V₂₍ₙₗ₎ - V₂₍ꜰₗ₎) / V₂₍ꜰₗ₎ × 100',
//       'Good transformers have regulation less than 5%.',
//       'The regulation depends on the load power factor and the equivalent impedance of the transformer.',
//       'For leading power factor loads, the regulation can be negative (voltage rise).',
//       'For lagging power factor loads, the regulation is always positive (voltage drop).',
//       'The phasor diagram helps visualize the voltage drops due to resistance and leakage reactance.',
//       'Proper design of winding geometry minimizes leakage reactance and improves regulation.',
//     ],
//     4: [
//       'Discuss the various losses in a transformer and methods to minimize them.',
//       'Transformer losses are broadly classified into two categories:',
//       '1. Core Losses (Iron Losses): These include hysteresis loss and eddy current loss.',
//       'Hysteresis loss: Pₕ = Kₕ × f × Bₘ¹·⁶ — minimized by using silicon steel with narrow hysteresis loop.',
//       'Eddy current loss: Pₑ = Kₑ × f² × Bₘ² × t² — minimized by laminating the core.',
//       '2. Copper Losses (I²R Losses): Due to resistance of windings.',
//       'Copper loss varies with the square of the load current.',
//       'These can be minimized by using conductors with larger cross-sectional area.',
//       'Stray losses occur due to leakage flux linking with structural parts.',
//       'Dielectric losses occur in insulating materials, especially at high voltages.',
//       'Overall, transformer efficiency = Output / (Output + Total Losses) × 100%.',
//     ],
//   };

//   const defaultLines = [
//     "The analysis of this circuit requires applying Kirchhoff's voltage law to each loop.",
//     'Consider the mesh currents I₁, I₂, and I₃ flowing in the clockwise direction.',
//     'For mesh 1: 10I₁ - 4I₂ - 2I₃ = 12 volts',
//     'For mesh 2: -4I₁ + 8I₂ - 3I₃ = 0',
//     'For mesh 3: -2I₁ - 3I₂ + 6I₃ = -6',
//     "Solving these simultaneous equations using Cramer's rule yields the mesh currents.",
//     'The determinant of the coefficient matrix Δ = 10(48-9) - (-4)(-24+6) + (-2)(12-16) = 312.',
//     'I₁ = Δ₁/Δ = 1.5 A, I₂ = 0.8 A, I₃ = 0.3 A',
//     "The voltage across each component can now be calculated using Ohm's law.",
//     'Power dissipated in each resistor: P = I²R watts.',
//   ];

//   return answerLines[page] || defaultLines;
// }

// export default SheetViewer;

// src/pages/checker/components/SheetViewer.tsx
import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import type { AnnotationTool, Annotation, MarksStamp } from "../MarkingView";
import * as pdfjsLib from "pdfjs-dist";

if (import.meta.env.PROD) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

// ─── API layer ──────────────────────────────────────────────────────────────

interface SheetApiData {
  pdfUrl: string | null;
  studentName: string;
  rollNo: string | number;
  totalPages: number;
  pageContents?: Record<number, string[]>;
}

async function fetchSheetData(sheetId: string | number): Promise<SheetApiData> {
  const res = await fetch(`/api/sheets/${sheetId}`);
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "Sheet not found."
        : "Failed to load sheet data. Please try again.",
    );
  }
  return res.json();
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface SheetViewerProps {
  sheetId?: string | number;
  pdfUrl?: string | null;
  studentName?: string;
  rollNo?: string | number;

  currentPage: number;
  totalPages: number;
  blankPages: Set<number>;
  onPageChange: (page: number) => void;
  zoom: number;
  activeTool: AnnotationTool;
  annotations: Annotation[];
  stamps: MarksStamp[];
  activeMarkId: string | null;
  placingMarkId: string | null;
  instructionBanner: string | null;
  stampColor?: string;
  pulseAnimationName?: string;
  selectedStampId?: string | null;
  dragStampId?: string | null;
  selectedAnnotationId?: number | null;
  annotationDragId?: number | null;

  onAnnotationAdd: (
    tool: AnnotationTool,
    x: number,
    y: number,
    page: number,
    width?: number,
    height?: number,
  ) => void;
  onAnnotationDelete: (id: number) => void;
  onEraserNoHit: () => void;
  onPencilStroke: () => void;
  onSheetClickForPlacement: (page: number, xPercent: number, yPercent: number) => void;
  onStampReposition: (markId: string, page: number, xPercent: number, yPercent: number) => void;
  onDismissBanner: () => void;
  onStampSelect?: (stampId: string) => void;
  onStampDeselect?: () => void;
  onStampDoubleClick?: (stampId: string) => void;
  onStampRemove?: (stampId: string) => void;
  onStampDragStart?: (stampId: string) => void;
  onStampDragEnd?: (stampId: string) => void;
  onSheetBackgroundClick?: () => void;
  onStampContextMenu?: (stampId: string, clientX: number, clientY: number) => void;
  onAnnotationSelect?: (id: number) => void;
  onAnnotationDeselect?: () => void;
  onAnnotationReposition?: (id: number, page: number, x: number, y: number) => void;
  onAnnotationDragStart?: (id: number) => void;
  onAnnotationDragEnd?: (id: number) => void;
  onAnnotationContextMenu?: (annotationId: number, clientX: number, clientY: number) => void;
  onAnnotationDeleteRequest?: (id: number) => void;
  onMoveItemToPage?: (type: "stamp" | "annotation", id: string | number, targetPage: number) => void;
  onDragOverThumbnailChange?: (page: number | null) => void;
  onPageCount?: (count: number) => void;
  onPageRender?: (pageNum: number, imageData: string) => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollToPage: (page: number) => void;
}

export interface SheetViewerHandle {
  undoPencil: () => void;
  clearPencil: () => void;
  hasPencilMarks: () => boolean;
}

const DEFAULT_LINES = ["No content available for this page."];

const SheetViewer = forwardRef<SheetViewerHandle, SheetViewerProps>(
  function SheetViewer(
    {
      sheetId,
      pdfUrl: pdfUrlProp,
      studentName: studentNameProp,
      rollNo: rollNoProp,
      currentPage,
      totalPages,
      blankPages,
      onPageChange,
      zoom,
      activeTool,
      annotations,
      stamps,
      activeMarkId,
      placingMarkId,
      instructionBanner,
      stampColor = "#4338CA",
      pulseAnimationName = "stampPulse",
      selectedStampId = null,
      dragStampId = null,
      selectedAnnotationId = null,
      onAnnotationAdd,
      onAnnotationDelete,
      onEraserNoHit,
      onPencilStroke,
      onSheetClickForPlacement,
      onStampReposition,
      onDismissBanner,
      onStampSelect,
      onStampDeselect,
      onStampDoubleClick,
      onStampRemove,
      onStampDragStart,
      onStampDragEnd,
      onSheetBackgroundClick,
      onStampContextMenu,
      onAnnotationSelect,
      onAnnotationDeselect,
      onAnnotationReposition,
      onAnnotationDragStart,
      onAnnotationDragEnd,
      onAnnotationContextMenu,
      onAnnotationDeleteRequest,
      onMoveItemToPage,
      onDragOverThumbnailChange,
      onPageCount,
      onPageRender,
      pageRefs,
      scrollToPage,
    },
    ref,
  ) {
    // ─── API-fetched sheet data ─────────────────────────────────────────────
    const [sheetData, setSheetData] = useState<SheetApiData | null>(null);
    const [sheetLoading, setSheetLoading] = useState(false);
    const [sheetError, setSheetError] = useState<string | null>(null);

    // ─── Stable refs for callback props ─────────────────────────────────────
    // These props are frequently passed as inline / non-memoized functions by
    // the parent. If they were used directly as effect dependencies below,
    // every parent re-render would create a new function identity, rerun the
    // effect, and cancel the in-flight PDF/sheet load before it resolved —
    // which is what caused the "Loading PDF..." spinner to hang forever.
    const onPageCountRef = useRef(onPageCount);
    useEffect(() => { onPageCountRef.current = onPageCount; }, [onPageCount]);
    const onPageRenderRef = useRef(onPageRender);
    useEffect(() => { onPageRenderRef.current = onPageRender; }, [onPageRender]);

    useEffect(() => {
      if (!sheetId || (pdfUrlProp !== undefined && rollNoProp && studentNameProp)) {
        return;
      }
      let cancelled = false;
      setSheetLoading(true);
      setSheetError(null);
      fetchSheetData(sheetId)
        .then((data) => {
          if (!cancelled) {
            setSheetData(data);
            onPageCountRef.current?.(data.totalPages);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setSheetError(err instanceof Error ? err.message : "Failed to load sheet.");
          }
        })
        .finally(() => {
          if (!cancelled) setSheetLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [sheetId, pdfUrlProp, rollNoProp, studentNameProp]);

    const pdfUrl = pdfUrlProp !== undefined ? pdfUrlProp : sheetData?.pdfUrl ?? null;
    const rollNo = rollNoProp ?? sheetData?.rollNo ?? "—";
    const studentName = studentNameProp ?? sheetData?.studentName ?? "—";
    const pageContents = sheetData?.pageContents;

    const getPageLines = useCallback(
      (page: number): string[] => pageContents?.[page] || DEFAULT_LINES,
      [pageContents],
    );

    // ─── Refs ────────────────────────────────────────────────────────────────
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const canvasHistoryRef = useRef<string[]>([]);

    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const dragPageRef = useRef(0);
    const dragJustEndedRef = useRef(false);
    const stampDragIdRef = useRef<string | null>(null);

    const isAnnotDraggingRef = useRef(false);
    const annotDragOffsetRef = useRef({ x: 0, y: 0 });
    const annotDragPageRef = useRef(0);
    const annotDragIdRef = useRef<number | null>(null);

    const annotationsRef = useRef(annotations);
    useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

    const onStampRepositionRef = useRef(onStampReposition);
    useEffect(() => { onStampRepositionRef.current = onStampReposition; }, [onStampReposition]);
    const onStampDragEndRef = useRef(onStampDragEnd);
    useEffect(() => { onStampDragEndRef.current = onStampDragEnd; }, [onStampDragEnd]);
    const onAnnotationRepositionRef = useRef(onAnnotationReposition);
    useEffect(() => { onAnnotationRepositionRef.current = onAnnotationReposition; }, [onAnnotationReposition]);
    const onAnnotationDragEndRef = useRef(onAnnotationDragEnd);
    useEffect(() => { onAnnotationDragEndRef.current = onAnnotationDragEnd; }, [onAnnotationDragEnd]);
    const onMoveItemToPageRef = useRef(onMoveItemToPage);
    useEffect(() => { onMoveItemToPageRef.current = onMoveItemToPage; }, [onMoveItemToPage]);
    const onDragOverThumbnailChangeRef = useRef(onDragOverThumbnailChange);
    useEffect(() => { onDragOverThumbnailChangeRef.current = onDragOverThumbnailChange; }, [onDragOverThumbnailChange]);
    const onPencilStrokeRef = useRef(onPencilStroke);
    useEffect(() => { onPencilStrokeRef.current = onPencilStroke; }, [onPencilStroke]);

    // ─── PDF state ───────────────────────────────────────────────────────────
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [pdfDocument, setPdfDocument] = useState<any>(null);
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pdfRenderedPages, setPdfRenderedPages] = useState<Set<number>>(new Set());
    const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setPdfPageCount(0);
        setPdfRenderedPages(new Set());
        setPdfError(null);
        return;
      }
      let cancelled = false;
      const loadPdf = async () => {
        setPdfLoading(true);
        setPdfError(null);
        try {
          const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
          if (cancelled) return;
          setPdfDocument(pdf);
          setPdfPageCount(pdf.numPages);
          onPageCountRef.current?.(pdf.numPages);
          setPdfRenderedPages(new Set());
        } catch (err) {
          console.error("PDF load error:", err);
          if (!cancelled) setPdfError("Failed to load PDF. Please try reloading.");
        } finally {
          if (!cancelled) setPdfLoading(false);
        }
      };
      loadPdf();
      return () => { cancelled = true; };
    }, [pdfUrl]);

    useEffect(() => {
      if (!pdfDocument || !pdfCanvasRef.current) return;
      if (pdfRenderedPages.has(currentPage)) return;
      let cancelled = false;
      const renderPage = async () => {
        try {
          const page = await pdfDocument.getPage(currentPage);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = pdfCanvasRef.current!;
          const ctx = canvas.getContext("2d");
          if (!ctx || cancelled) return;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          const imageData = canvas.toDataURL("image/jpeg", 0.6);
          onPageRenderRef.current?.(currentPage, imageData);
          setPdfRenderedPages((prev) => new Set([...prev, currentPage]));
        } catch (err) {
          console.error(`Error rendering PDF page ${currentPage}:`, err);
        }
      };
      renderPage();
      return () => { cancelled = true; };
    }, [pdfDocument, currentPage, pdfRenderedPages]);

    // ─── Highlight drag preview ──────────────────────────────────────────────
    const [highlightPreview, setHighlightPreview] = useState<{
      x: number; y: number; width: number; height: number; page: number;
    } | null>(null);
    const highlightDragRef = useRef<{ startX: number; startY: number; page: number } | null>(null);

    const stampsByPage = useMemo(() => {
      const map: Record<number, MarksStamp[]> = {};
      stamps.forEach((s) => {
        if (!map[s.page]) map[s.page] = [];
        map[s.page].push(s);
      });
      return map;
    }, [stamps]);

    useEffect(() => {
      if (!dragStampId) isDraggingRef.current = false;
    }, [dragStampId]);

    useImperativeHandle(ref, () => ({
      undoPencil() {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        const history = canvasHistoryRef.current;
        if (history.length <= 1) return;
        history.pop();
        const prev = history[history.length - 1];
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = prev;
      },
      clearPencil() {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvasHistoryRef.current = [canvas.toDataURL()];
      },
      hasPencilMarks() {
        return canvasHistoryRef.current.length > 1;
      },
    }), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#1E40AF";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      if (canvasHistoryRef.current.length === 0) {
        canvasHistoryRef.current.push(canvas.toDataURL());
      }
    }, []);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }, []);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool !== "pencil" || placingMarkId) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const { x, y } = getCanvasCoords(e);
      isDrawingRef.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }, [activeTool, placingMarkId, getCanvasCoords]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool !== "pencil" || !isDrawingRef.current || placingMarkId) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const { x, y } = getCanvasCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }, [activeTool, placingMarkId, getCanvasCoords]);

    const saveCanvasSnapshot = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const history = canvasHistoryRef.current;
      if (history.length >= 20) history.shift();
      history.push(canvas.toDataURL());
      onPencilStrokeRef.current();
    }, []);

    const handleCanvasMouseUp = useCallback(() => {
      if (activeTool !== "pencil" || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      saveCanvasSnapshot();
    }, [activeTool, saveCanvasSnapshot]);

    const handleCanvasMouseLeave = useCallback(() => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      saveCanvasSnapshot();
    }, [saveCanvasSnapshot]);

    // ─── Window-level drag (stamps + annotations + thumbnail drop) ──────────
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isDraggingRef.current) {
          const activeStampId = dragStampId || stampDragIdRef.current;
          if (activeStampId) {
            const pageEl = document.getElementById(`page-${dragPageRef.current}`);
            if (!pageEl) return;
            const rect = pageEl.getBoundingClientRect();
            let newX = ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
            let newY = ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;
            newX = Math.min(Math.max(newX, 3), 90);
            newY = Math.min(Math.max(newY, 3), 95);
            onStampRepositionRef.current?.(activeStampId, dragPageRef.current, newX, newY);
          }
        }

        const annotId = annotDragIdRef.current;
        if (isAnnotDraggingRef.current && annotId !== null) {
          const pageEl = document.getElementById(`page-${annotDragPageRef.current}`);
          if (!pageEl) return;
          const rect = pageEl.getBoundingClientRect();
          const ann = annotationsRef.current.find((a) => a.id === annotId);
          if (ann && (ann.tool === "tick" || ann.tool === "cross")) {
            const newX = Math.min(Math.max(((e.clientX - rect.left - annotDragOffsetRef.current.x) / rect.width) * 100, 2), 95);
            const newY = Math.min(Math.max(((e.clientY - rect.top - annotDragOffsetRef.current.y) / rect.height) * 100, 2), 95);
            onAnnotationRepositionRef.current?.(annotId, annotDragPageRef.current, newX, newY);
          } else {
            const scale = zoom / 100;
            onAnnotationRepositionRef.current?.(
              annotId,
              annotDragPageRef.current,
              (e.clientX - rect.left - annotDragOffsetRef.current.x) / scale,
              (e.clientY - rect.top - annotDragOffsetRef.current.y) / scale,
            );
          }
        }

        if (isDraggingRef.current || isAnnotDraggingRef.current) {
          const els = document.elementsFromPoint(e.clientX, e.clientY);
          const thumbEl = els.find((el) => el.hasAttribute("data-thumbnail-page"));
          onDragOverThumbnailChangeRef.current?.(
            thumbEl ? parseInt(thumbEl.getAttribute("data-thumbnail-page") || "0", 10) : null,
          );
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        const els = document.elementsFromPoint(e.clientX, e.clientY);
        const thumbEl = els.find((el) => el.hasAttribute("data-thumbnail-page"));
        const dropPage = thumbEl ? parseInt(thumbEl.getAttribute("data-thumbnail-page") || "0", 10) : 0;

        if (dropPage > 0 && (isDraggingRef.current || isAnnotDraggingRef.current)) {
          const stampId = dragStampId || stampDragIdRef.current;
          if (isDraggingRef.current && stampId) {
            onMoveItemToPageRef.current?.("stamp", stampId, dropPage);
          } else if (isAnnotDraggingRef.current && annotDragIdRef.current !== null) {
            onMoveItemToPageRef.current?.("annotation", annotDragIdRef.current, dropPage);
          }
          onDragOverThumbnailChangeRef.current?.(null);
        }

        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          dragJustEndedRef.current = true;
          const stampId = dragStampId || stampDragIdRef.current;
          if (stampId) onStampDragEndRef.current?.(stampId);
          stampDragIdRef.current = null;
        }

        if (isAnnotDraggingRef.current) {
          isAnnotDraggingRef.current = false;
          const aid = annotDragIdRef.current;
          annotDragIdRef.current = null;
          if (aid !== null) onAnnotationDragEndRef.current?.(aid);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp, true);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp, true);
      };
    }, [dragStampId, zoom]);

    // ─── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.key === "Escape") {
          onStampDeselect?.();
          onAnnotationDeselect?.();
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedStampId) {
            onStampRemove?.(selectedStampId);
          } else if (selectedAnnotationId !== null) {
            onAnnotationDeleteRequest?.(selectedAnnotationId);
          }
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedStampId, selectedAnnotationId, onStampDeselect, onAnnotationDeselect, onStampRemove, onAnnotationDeleteRequest]);

    // ─── Stamp interaction ───────────────────────────────────────────────────
    const handleStampMouseDown = useCallback((e: React.MouseEvent, stamp: MarksStamp) => {
      if (activeTool === "handSelect") {
        e.preventDefault();
        e.stopPropagation();
        onStampSelect?.(stamp.markId);
        stampDragIdRef.current = stamp.markId;
        isDraggingRef.current = true;
        dragPageRef.current = stamp.page;
        const pageEl = document.getElementById(`page-${stamp.page}`);
        if (!pageEl) return;
        const rect = pageEl.getBoundingClientRect();
        dragOffsetRef.current = {
          x: e.clientX - rect.left - (stamp.x / 100) * rect.width,
          y: e.clientY - rect.top - (stamp.y / 100) * rect.height,
        };
        onStampDragStart?.(stamp.markId);
        return;
      }
      if (dragStampId !== stamp.markId) return;
      e.preventDefault();
      e.stopPropagation();
      stampDragIdRef.current = stamp.markId;
      isDraggingRef.current = true;
      dragPageRef.current = stamp.page;
      const pageEl = document.getElementById(`page-${stamp.page}`);
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left - (stamp.x / 100) * rect.width,
        y: e.clientY - rect.top - (stamp.y / 100) * rect.height,
      };
      onStampDragStart?.(stamp.markId);
    }, [activeTool, dragStampId, onStampSelect, onStampDragStart]);

    const handleStampClick = useCallback((e: React.MouseEvent, stamp: MarksStamp) => {
      if (dragStampId || activeTool === "handSelect") return;
      e.stopPropagation();
      onStampSelect?.(stamp.markId);
    }, [dragStampId, activeTool, onStampSelect]);

    const handleStampDoubleClick = useCallback((e: React.MouseEvent, stamp: MarksStamp) => {
      e.stopPropagation();
      onStampDoubleClick?.(stamp.markId);
    }, [onStampDoubleClick]);

    const handleStampRightClick = useCallback((e: React.MouseEvent, stamp: MarksStamp) => {
      e.preventDefault();
      e.stopPropagation();
      onStampContextMenu?.(stamp.markId, e.clientX, e.clientY);
    }, [onStampContextMenu]);

    // ─── Annotation interaction ──────────────────────────────────────────────
    const handleAnnotationClick = useCallback((e: React.MouseEvent, ann: Annotation) => {
      if (activeTool !== "handSelect") return;
      e.stopPropagation();
      onAnnotationSelect?.(ann.id);
      onStampDeselect?.();
    }, [activeTool, onAnnotationSelect, onStampDeselect]);

    const handleAnnotationMouseDown = useCallback((e: React.MouseEvent, ann: Annotation) => {
      if (activeTool !== "handSelect") return;
      e.preventDefault();
      e.stopPropagation();
      onAnnotationSelect?.(ann.id);
      onStampDeselect?.();
      isAnnotDraggingRef.current = true;
      annotDragIdRef.current = ann.id;
      annotDragPageRef.current = ann.page;
      const pageEl = document.getElementById(`page-${ann.page}`);
      if (!pageEl) return;
      const rect = pageEl.getBoundingClientRect();
      if (ann.tool === "tick" || ann.tool === "cross") {
        annotDragOffsetRef.current = {
          x: e.clientX - rect.left - (ann.x / 100) * rect.width,
          y: e.clientY - rect.top - (ann.y / 100) * rect.height,
        };
      } else {
        const scale = zoom / 100;
        annotDragOffsetRef.current = {
          x: e.clientX - rect.left - ann.x * scale,
          y: e.clientY - rect.top - ann.y * scale,
        };
      }
      onAnnotationDragStart?.(ann.id);
    }, [activeTool, zoom, onAnnotationSelect, onStampDeselect, onAnnotationDragStart]);

    const handleAnnotationRightClick = useCallback((e: React.MouseEvent, ann: Annotation) => {
      if (activeTool !== "handSelect") return;
      e.preventDefault();
      e.stopPropagation();
      onAnnotationContextMenu?.(ann.id, e.clientX, e.clientY);
    }, [activeTool, onAnnotationContextMenu]);

    // ─── Page overlay: highlight, eraser, tick, cross ───────────────────────
    const handleOverlayMouseDown = useCallback((page: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (placingMarkId || activeTool === "handSelect" || dragStampId) return;
      if (activeTool === "highlight") {
        const rect = e.currentTarget.getBoundingClientRect();
        const scale = zoom / 100;
        highlightDragRef.current = {
          startX: (e.clientX - rect.left) / scale,
          startY: (e.clientY - rect.top) / scale,
          page,
        };
      }
    }, [activeTool, zoom, placingMarkId, dragStampId]);

    const handleOverlayMouseMove = useCallback((page: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (placingMarkId || activeTool !== "highlight" || !highlightDragRef.current) return;
      if (highlightDragRef.current.page !== page) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scale = zoom / 100;
      const cx = (e.clientX - rect.left) / scale;
      const cy = (e.clientY - rect.top) / scale;
      const { startX, startY } = highlightDragRef.current;
      setHighlightPreview({
        x: Math.min(startX, cx), y: Math.min(startY, cy),
        width: Math.abs(cx - startX), height: Math.abs(cy - startY),
        page,
      });
    }, [activeTool, zoom, placingMarkId]);

    const handleOverlayMouseUp = useCallback((page: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (placingMarkId || activeTool === "handSelect") return;
      if (dragJustEndedRef.current) { dragJustEndedRef.current = false; return; }
      if (dragStampId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const scale = zoom / 100;
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      if (activeTool === "eraser") {
        const pageAnnotations = annotations.filter((ann) => ann.page === page);
        for (const ann of pageAnnotations) {
          if (ann.tool === "highlight" && ann.width && ann.height) {
            if (x >= ann.x && x <= ann.x + ann.width && y >= ann.y && y <= ann.y + ann.height) {
              onAnnotationDelete(ann.id);
              return;
            }
          }
        }
        for (const ann of pageAnnotations) {
          if (ann.tool === "tick" || ann.tool === "cross") {
            const ax = (ann.x / 100) * rect.width;
            const ay = (ann.y / 100) * rect.height;
            if (Math.hypot(x - ax, y - ay) < 20) {
              onAnnotationDelete(ann.id);
              return;
            }
          }
        }
        onEraserNoHit();
        return;
      }

      if (activeTool === "highlight" && highlightDragRef.current) {
        const { startX, startY } = highlightDragRef.current;
        highlightDragRef.current = null;
        setHighlightPreview(null);
        const w = Math.abs(x - startX);
        const h = Math.abs(y - startY);
        if (w >= 10 && h >= 10) {
          onAnnotationAdd("highlight", Math.min(startX, x), Math.min(startY, y), page, w, h);
        }
        return;
      }

      if (activeTool === "tick" || activeTool === "cross") {
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        onAnnotationAdd(activeTool, xPct, yPct, page);
      }
    }, [activeTool, zoom, placingMarkId, dragStampId, annotations, onAnnotationAdd, onAnnotationDelete, onEraserNoHit]);

    const handlePlaceClick = useCallback((page: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (!placingMarkId) return;
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      onSheetClickForPlacement(
        page,
        ((e.clientX - rect.left) / rect.width) * 100,
        ((e.clientY - rect.top) / rect.height) * 100,
      );
    }, [placingMarkId, onSheetClickForPlacement]);

    const handleSheetBackgroundClick = useCallback(() => {
      onSheetBackgroundClick?.();
    }, [onSheetBackgroundClick]);

    // ─── IntersectionObserver for page tracking (static mode) ───────────────
    useEffect(() => {
      if (pdfUrl) return;
      const container = scrollContainerRef.current;
      if (!container) return;
      const observer = new IntersectionObserver(
        (entries) => {
          let bestPage = currentPage;
          let bestRatio = 0;
          entries.forEach((entry) => {
            if (entry.intersectionRatio > bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestPage = parseInt(entry.target.getAttribute("data-page") || "1", 10);
            }
          });
          if (bestRatio > 0 && bestPage !== currentPage) onPageChange(bestPage);
        },
        { root: container, threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
      );
      for (let i = 1; i <= totalPages; i++) {
        const el = pageRefs.current[i];
        if (el) observer.observe(el);
      }
      return () => observer.disconnect();
    }, [pdfUrl, currentPage, totalPages, onPageChange, pageRefs]);

    const stampRgba = useCallback((alpha: number) => {
      const r = parseInt(stampColor.slice(1, 3), 16);
      const g = parseInt(stampColor.slice(3, 5), 16);
      const b = parseInt(stampColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }, [stampColor]);

    const isPencilActive = activeTool === "pencil";
    const isPlacing = !!placingMarkId;

    const InstructionBanner = () =>
      instructionBanner ? (
        <div
          className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2"
          style={{ backgroundColor: "#FFFBEB", border: "1px solid #F59E0B" }}
        >
          <i className="ri-information-line text-sm shrink-0" style={{ color: "#D97706" }} />
          <span className="text-[11px] font-medium flex-1" style={{ color: "#92400E" }}>
            {instructionBanner}
          </span>
          <button
            onClick={onDismissBanner}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
            style={{ color: "#92400E" }}
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      ) : null;

    // ─── Sheet-level loading / error ──────────────────────────────────────────
    if (sheetLoading) {
      return (
        <div className="flex-1 flex flex-col bg-slate-200 min-w-0 items-center justify-center">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 mt-3 text-sm">Loading sheet...</p>
        </div>
      );
    }
    if (sheetError) {
      return (
        <div className="flex-1 flex flex-col bg-slate-200 min-w-0 items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <i className="ri-error-warning-line text-red-500 text-2xl" />
          </div>
          <p className="text-red-600 text-sm mb-3">{sheetError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors text-sm"
          >
            Reload
          </button>
        </div>
      );
    }

    // ─── PDF MODE ─────────────────────────────────────────────────────────────
    if (pdfUrl) {
      const pageStamps = stampsByPage[currentPage] || [];

      return (
        <div className="flex-1 flex flex-col bg-[#0f172a] min-w-0">
          <InstructionBanner />

          <div className="flex-1 overflow-y-auto flex justify-center p-4" ref={scrollContainerRef}>
            {pdfLoading ? (
              <div className="flex items-center justify-center w-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-slate-400 mt-3 text-sm">Loading PDF...</p>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex items-center justify-center w-full">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-error-warning-line text-red-400 text-3xl" />
                  </div>
                  <p className="text-red-400 text-sm mb-4">{pdfError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors text-sm"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-4xl">
                <canvas
                  ref={pdfCanvasRef}
                  className="mx-auto shadow-lg rounded-lg"
                  style={{ width: "100%", height: "auto", backgroundColor: "white", display: "block" }}
                />
                <div className="absolute inset-0 z-10" style={{ pointerEvents: "none" }}>
                  <div
                    className="absolute inset-0 z-20"
                    style={{
                      pointerEvents: isPlacing || activeTool !== "pencil" ? "auto" : "none",
                      cursor: isPlacing ? "crosshair" : activeTool === "eraser" ? "not-allowed" : "crosshair",
                    }}
                    onClick={isPlacing ? (e) => handlePlaceClick(currentPage, e) : undefined}
                    onMouseDown={!isPlacing ? (e) => handleOverlayMouseDown(currentPage, e) : undefined}
                    onMouseMove={!isPlacing ? (e) => handleOverlayMouseMove(currentPage, e) : undefined}
                    onMouseUp={!isPlacing ? (e) => handleOverlayMouseUp(currentPage, e) : undefined}
                  />

                  {highlightPreview?.page === currentPage && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: highlightPreview.x,
                        top: highlightPreview.y,
                        width: highlightPreview.width,
                        height: highlightPreview.height,
                        backgroundColor: "rgba(255,235,59,0.4)",
                        border: "1px dashed #D97706",
                      }}
                    />
                  )}

                  {pageStamps.map((stamp) => {
                    const isSelected = stamp.markId === selectedStampId;
                    const isDragging = stamp.markId === dragStampId;
                    const hasValue = stamp.value !== null && stamp.value !== undefined;
                    const canvas = pdfCanvasRef.current;
                    if (!canvas) return null;
                    const rect = canvas.getBoundingClientRect();
                    const xPos = (stamp.x / 100) * rect.width;
                    const yPos = (stamp.y / 100) * rect.height;
                    const size = isSelected ? 38 : 34;

                    return (
                      <div key={stamp.markId}>
                        {isSelected && !isDragging && (
                          <div
                            className="absolute z-30 flex gap-1 p-1 rounded-lg"
                            style={{
                              left: xPos, top: yPos,
                              transform: "translate(-50%, calc(-100% - 44px))",
                              backgroundColor: "white",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                              pointerEvents: "auto",
                            }}
                          >
                            <button
                              className="w-7 h-7 rounded flex items-center justify-center text-xs"
                              style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
                              onClick={(e) => { e.stopPropagation(); onStampRemove?.(stamp.markId); }}
                              title="Remove stamp (Delete)"
                            >✕</button>
                            <button
                              className="w-7 h-7 rounded flex items-center justify-center text-xs"
                              style={{ backgroundColor: "#DBEAFE", color: "#1D4ED8" }}
                              onClick={(e) => { e.stopPropagation(); onStampDoubleClick?.(stamp.markId); }}
                              title="Reposition"
                            >⤢</button>
                          </div>
                        )}
                        <div
                          className="absolute rounded-full flex items-center justify-center font-bold select-none cursor-pointer z-25"
                          style={{
                            width: size, height: size,
                            border: hasValue ? `2px solid ${stampColor}` : `2px dashed ${stampColor}`,
                            color: hasValue ? stampColor : "#94a3b8",
                            fontSize: isSelected ? 15 : 14,
                            backgroundColor: "white",
                            top: yPos - size / 2,
                            left: xPos - size / 2,
                            opacity: isDragging ? 0.6 : 1,
                            boxShadow: isSelected ? `0 0 0 4px ${stampRgba(0.3)}` : undefined,
                            animation: isSelected ? `${pulseAnimationName} 1.5s ease-in-out infinite` : undefined,
                            pointerEvents: "auto",
                          }}
                          onClick={(e) => handleStampClick(e, stamp)}
                          onDoubleClick={(e) => handleStampDoubleClick(e, stamp)}
                          onMouseDown={(e) => handleStampMouseDown(e, stamp)}
                          onContextMenu={(e) => handleStampRightClick(e, stamp)}
                          title={hasValue ? `${stamp.markId}: ${stamp.value}` : `${stamp.markId}: not marked`}
                        >
                          {hasValue ? stamp.value : "—"}
                        </div>
                      </div>
                    );
                  })}

                  {annotations.filter((ann) => ann.page === currentPage).map((ann) => {
                    const canvas = pdfCanvasRef.current;
                    if (!canvas) return null;
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = rect.width / canvas.width;
                    const scaleY = rect.height / canvas.height;
                    const isTickCross = ann.tool === "tick" || ann.tool === "cross";

                    return (
                      <div
                        key={ann.id}
                        className="absolute z-10 pointer-events-none"
                        style={isTickCross
                          ? { top: `${ann.y}%`, left: `${ann.x}%`, transform: "translate(-50%,-50%)" }
                          : { left: ann.x * scaleX, top: ann.y * scaleY }}
                      >
                        {ann.tool === "tick" && (
                          <span style={{ fontSize: `${28 * scaleX}px`, color: "#166534", fontFamily: "serif", lineHeight: 1 }}>✓</span>
                        )}
                        {ann.tool === "cross" && (
                          <span style={{ fontSize: `${28 * scaleX}px`, color: "#DC2626", fontFamily: "serif", lineHeight: 1 }}>✗</span>
                        )}
                        {ann.tool === "highlight" && (
                          <div
                            className="rounded-sm"
                            style={{
                              width: (ann.width ?? 80) * scaleX,
                              height: (ann.height ?? 20) * scaleY,
                              backgroundColor: "rgba(250,204,21,0.45)",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-3 px-3">
            {pdfPageCount > 0 && (
              <>
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ri-arrow-left-s-line mr-1" />Prev
                </button>
                <span className="text-xs text-slate-400 tabular-nums">
                  Page <span className="text-white font-medium">{currentPage}</span> of {pdfPageCount}
                </span>
                <button
                  onClick={() => onPageChange(Math.min(pdfPageCount, currentPage + 1))}
                  disabled={currentPage >= pdfPageCount}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next<i className="ri-arrow-right-s-line ml-1" />
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    // ─── STATIC PAGES MODE (no PDF) ─────────────────────────────────────────
    return (
      <div className="flex-1 flex flex-col bg-slate-200 min-w-0">
        <InstructionBanner />

        <div className="flex-1 overflow-y-auto">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto flex justify-center"
            onClick={handleSheetBackgroundClick}
          >
            <div
              className="relative py-4 flex flex-col items-center gap-2"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <canvas
                ref={canvasRef}
                width={720}
                height={8000}
                className="absolute top-0 left-0 z-10"
                style={{
                  pointerEvents: isPencilActive && !isPlacing ? "auto" : "none",
                  cursor: isPencilActive && !isPlacing ? "crosshair" : undefined,
                  width: "720px",
                  height: "8000px",
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
              />

              {highlightPreview && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: highlightPreview.x, top: highlightPreview.y,
                    width: highlightPreview.width, height: highlightPreview.height,
                    backgroundColor: "rgba(255,235,59,0.4)",
                    border: "1px dashed #D97706",
                    zIndex: 15,
                  }}
                />
              )}

              {Array.from({ length: totalPages }, (_, i) => {
                const page = i + 1;
                const isBlank = blankPages.has(page);
                const pageAnnotations = annotations.filter((ann) => ann.page === page);
                const pageStamps = stampsByPage[page] || [];
                const lines = getPageLines(page);
                const isHandSelect = activeTool === "handSelect";
                const showOverlay = !isBlank && (activeTool !== "pencil" || isPlacing || !!dragStampId || isHandSelect);
                const cursorClass = isPlacing ? "cursor-crosshair"
                  : isHandSelect ? "cursor-default"
                  : dragStampId ? "cursor-default"
                  : activeTool === "eraser" ? "cursor-not-allowed"
                  : activeTool === "highlight" || activeTool === "tick" || activeTool === "cross" ? "cursor-crosshair"
                  : "cursor-default";

                return (
                  <div
                    key={page}
                    id={`page-${page}`}
                    ref={(el) => { pageRefs.current[page] = el; }}
                    data-page={page}
                    className="relative bg-white shadow-sm rounded-sm shrink-0"
                    style={{ width: "720px" }}
                  >
                    {showOverlay && (
                      <div
                        className={`absolute inset-0 z-20 ${cursorClass}`}
                        onClick={isPlacing ? (e) => handlePlaceClick(page, e) : undefined}
                        onMouseDown={!isPlacing ? (e) => handleOverlayMouseDown(page, e) : undefined}
                        onMouseMove={!isPlacing ? (e) => handleOverlayMouseMove(page, e) : undefined}
                        onMouseUp={!isPlacing ? (e) => handleOverlayMouseUp(page, e) : undefined}
                      />
                    )}

                    {!isBlank && pageStamps.map((stamp) => {
                      const isSelected = stamp.markId === selectedStampId;
                      const isDragging = stamp.markId === dragStampId;
                      const hasValue = stamp.value !== null && stamp.value !== undefined;
                      const size = isSelected ? 38 : 34;

                      return (
                        <div key={stamp.markId}>
                          {isSelected && !isDragging && (
                            <div
                              className="absolute z-30 flex gap-1 rounded-lg"
                              style={{
                                top: `${stamp.y}%`, left: `${stamp.x}%`,
                                transform: "translate(-50%, calc(-100% - 44px))",
                                backgroundColor: "white",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                                padding: "5px",
                                pointerEvents: "auto",
                              }}
                            >
                              <button
                                className="w-7 h-7 rounded flex items-center justify-center cursor-pointer"
                                style={{ backgroundColor: "#FEE2E2", color: "#991B1B", border: "none", fontSize: "14px" }}
                                title="Remove stamp (or press Delete)"
                                onClick={(e) => { e.stopPropagation(); onStampRemove?.(stamp.markId); }}
                              >✕</button>
                              <button
                                className="w-7 h-7 rounded flex items-center justify-center cursor-pointer"
                                style={{ backgroundColor: "#DBEAFE", color: "#1D4ED8", border: "none", fontSize: "14px" }}
                                title="Drag to reposition"
                                onClick={(e) => { e.stopPropagation(); onStampDoubleClick?.(stamp.markId); }}
                              >⤢</button>
                            </div>
                          )}

                          {isDragging && (
                            <div
                              className="absolute z-30 pointer-events-none rounded-md whitespace-nowrap"
                              style={{
                                top: `${stamp.y}%`, left: `${stamp.x}%`,
                                transform: "translate(-50%, calc(-100% - 48px))",
                                backgroundColor: "#1D4ED8", color: "white",
                                fontSize: "11px", padding: "4px 10px",
                              }}
                            >
                              Drag to new position — release to confirm
                            </div>
                          )}

                          <div
                            className={`absolute rounded-full flex items-center justify-center font-bold select-none transition-opacity ${
                              isDragging ? "cursor-grabbing z-30" : "cursor-pointer z-25"
                            }`}
                            style={{
                              width: `${size}px`, height: `${size}px`,
                              border: isDragging ? `2px dashed ${stampColor}` : hasValue ? `2px solid ${stampColor}` : `2px dashed ${stampColor}`,
                              color: hasValue ? stampColor : "#94a3b8",
                              fontSize: isSelected ? 15 : 14,
                              backgroundColor: "white",
                              top: `${stamp.y}%`, left: `${stamp.x}%`,
                              transform: "translate(-50%, -50%)",
                              opacity: isDragging ? 0.65 : 1,
                              boxShadow: isSelected ? `0 0 0 4px ${stampRgba(0.4)}, 0 0 0 8px ${stampRgba(0.15)}` : undefined,
                              animation: isSelected ? `${pulseAnimationName} 1.5s ease-in-out infinite` : undefined,
                            }}
                            onClick={(e) => handleStampClick(e, stamp)}
                            onDoubleClick={(e) => handleStampDoubleClick(e, stamp)}
                            onMouseDown={(e) => handleStampMouseDown(e, stamp)}
                            onContextMenu={(e) => handleStampRightClick(e, stamp)}
                            title={hasValue ? `${stamp.markId}: ${stamp.value}` : `${stamp.markId}: not yet marked`}
                          >
                            {hasValue ? stamp.value : "—"}
                          </div>
                        </div>
                      );
                    })}

                    {!isBlank && pageAnnotations.map((ann) => {
                      const isAnnotSelected = ann.id === selectedAnnotationId;
                      const isHandSelect2 = activeTool === "handSelect";
                      const isTickOrCross = ann.tool === "tick" || ann.tool === "cross";

                      return (
                        <div
                          key={ann.id}
                          className={`absolute z-10 ${isHandSelect2 ? "cursor-pointer z-25" : "pointer-events-none"}`}
                          style={isTickOrCross
                            ? { top: `${ann.y}%`, left: `${ann.x}%`, transform: "translate(-50%,-50%)", userSelect: "none" }
                            : { left: ann.x, top: ann.y }}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          onClick={(e) => handleAnnotationClick(e, ann)}
                          onMouseDown={(e) => handleAnnotationMouseDown(e, ann)}
                          onContextMenu={(e) => handleAnnotationRightClick(e, ann)}
                        >
                          {ann.tool === "tick" && (
                            <div style={{ boxShadow: isAnnotSelected ? "0 0 0 3px #93C5FD" : undefined, borderRadius: 4 }}>
                              <span style={{ fontSize: 28, color: "#166534", fontFamily: "serif", lineHeight: 1, display: "inline-block" }}>✓</span>
                            </div>
                          )}
                          {ann.tool === "cross" && (
                            <div style={{ boxShadow: isAnnotSelected ? "0 0 0 3px #93C5FD" : undefined, borderRadius: 4 }}>
                              <span style={{ fontSize: 28, color: "#DC2626", fontFamily: "serif", lineHeight: 1, display: "inline-block" }}>✗</span>
                            </div>
                          )}
                          {ann.tool === "highlight" && (
                            <div
                              className="rounded-sm"
                              style={{
                                width: ann.width ?? 80,
                                height: ann.height ?? 20,
                                backgroundColor: "rgba(250,204,21,0.45)",
                                boxShadow: isAnnotSelected ? "0 0 0 4px rgba(250,204,21,0.4)" : undefined,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}

                    {page === 1 && (
                      <div className="px-6 pt-5 pb-3 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                              {studentName !== "—" ? studentName : "Answer Sheet"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="px-6 py-4 min-h-[280px]">
                      {isBlank ? (
                        <div className="flex items-center justify-center min-h-[240px]">
                          <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                              <i className="ri-file-reduce-line text-amber-500 text-xl" />
                            </div>
                            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                              Blank Page
                            </span>
                            <p className="text-xs text-slate-400 mt-2">Marked as blank</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="text-xs font-semibold text-slate-800 mb-3">
                            Answer Sheet — Page {page}
                          </div>
                          {lines.map((line, idx) => (
                            <p
                              key={idx}
                              className="text-[13px] leading-relaxed text-slate-600"
                              style={{ fontFamily: "'Caveat', cursive", fontSize: idx === 0 ? "15px" : "14px" }}
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Roll No: {rollNo}</span>
                      <span className="text-[10px] text-slate-400">Page {page}</span>
                    </div>
                  </div>
                );
              })}

              <div className="h-6 shrink-0" />
            </div>
          </div>

          <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-1 px-3 overflow-x-auto">
            {Array.from({ length: totalPages }, (_, i) => {
              const p = i + 1;
              const isBlankP = blankPages.has(p);
              return (
                <button
                  key={p}
                  onClick={() => scrollToPage(p)}
                  className={`w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    p === currentPage
                      ? "bg-sky-500 text-white font-semibold"
                      : isBlankP
                        ? "bg-amber-500/20 text-amber-400"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

export default SheetViewer;