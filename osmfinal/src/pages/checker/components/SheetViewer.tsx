// src/pages/checker/components/SheetViewer.tsx

import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import type { AnnotationTool, Annotation, MarksStamp } from '../MarkingView';

// ✅ PDF.js imports
import * as pdfjsLib from 'pdfjs-dist';
import { GlobalWorkerOptions } from 'pdfjs-dist';

// ✅ Set worker
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface SheetViewerProps {
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
  onSheetClickForPlacement: (
    page: number,
    xPercent: number,
    yPercent: number,
  ) => void;
  onStampReposition: (
    markId: string,
    page: number,
    xPercent: number,
    yPercent: number,
  ) => void;
  onDismissBanner: () => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollToPage: (page: number) => void;
  pdfUrl?: string | null;
  onPageRender?: (pageNum: number, imageData: string) => void; // ✅ ADD
  onPageCount?: (count: number) => void;
}

export interface SheetViewerHandle {
  undoPencil: () => void;
  clearPencil: () => void;
  hasPencilMarks: () => boolean;
}

const SheetViewer = forwardRef<SheetViewerHandle, SheetViewerProps>(
  function SheetViewer(
    {
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
      stampColor = '#4338CA',
      pulseAnimationName = 'stampPulse',
      onAnnotationAdd,
      onAnnotationDelete,
      onEraserNoHit,
      onPencilStroke,
      onSheetClickForPlacement,
      onStampReposition,
      onDismissBanner,
      pageRefs,
      scrollToPage,
      pdfUrl,
      onPageRender, // ✅ ADD THIS
      onPageCount,
    },
    ref,
  ) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const canvasHistoryRef = useRef<string[]>([]);

    const onPencilStrokeRef = useRef(onPencilStroke);
    useEffect(() => {
      onPencilStrokeRef.current = onPencilStroke;
    }, [onPencilStroke]);

    // ─── Highlight drag state ───
    const [highlightPreview, setHighlightPreview] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
      page: number;
    } | null>(null);
    const highlightDragRef = useRef<{
      startX: number;
      startY: number;
      page: number;
    } | null>(null);

    // ─── Stamp drag reposition state ───
    const [dragStamp, setDragStamp] = useState<{
      markId: string;
      page: number;
      x: number;
      y: number;
    } | null>(null);

    // ─── Build page-stamps lookup ───
    const stampsByPage = useMemo(() => {
      const map: Record<number, MarksStamp[]> = {};
      stamps.forEach((s) => {
        if (!map[s.page]) map[s.page] = [];
        map[s.page].push(s);
      });
      return map;
    }, [stamps]);

    // ─── PDF STATE ────────────────────────────────────────────

    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [pdfDocument, setPdfDocument] = useState<any>(null);
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pdfRenderedPages, setPdfRenderedPages] = useState<Set<number>>(
      new Set(),
    );
    const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const pdfCanvasContainerRef = useRef<HTMLDivElement | null>(null);

    // ─── LOAD PDF ─────────────────────────────────────────────

    useEffect(() => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setPdfPageCount(0);
        setPdfRenderedPages(new Set());
        setPdfError(null);
        return;
      }

      const loadPdf = async () => {
        setPdfLoading(true);
        setPdfError(null);
        try {
          const loadingTask = pdfjsLib.getDocument(pdfUrl);
          const pdf = await loadingTask.promise;
          setPdfDocument(pdf);
          setPdfPageCount(pdf.numPages);
          setPdfRenderedPages(new Set());
        } catch (err) {
          console.error('PDF load error:', err);
          setPdfError('Failed to load PDF document');
        } finally {
          setPdfLoading(false);
        }
      };

      loadPdf();
    }, [pdfUrl]);

    // ─── RENDER PDF PAGE TO CANVAS ────────────────────────────

    // SheetViewer.tsx

    // ─── RENDER PDF PAGE TO CANVAS ────────────────────────────

    useEffect(() => {
      const renderPage = async (pageNum: number) => {
        if (!pdfDocument || pdfRenderedPages.has(pageNum)) return;

        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        try {
          const page = await pdfDocument.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          const context = canvas.getContext('2d');
          if (!context) return;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;

          // ✅ Get image data for thumbnail
          const imageData = canvas.toDataURL();

          // ✅ Send to parent component
          onPageRender?.(pageNum, imageData);
          onPageCount?.(pdfPageCount);

          setPdfRenderedPages((prev) => new Set([...prev, pageNum]));
        } catch (err) {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      };

      if (
        pdfDocument &&
        pdfCanvasRef.current &&
        !pdfRenderedPages.has(currentPage)
      ) {
        renderPage(currentPage);
      }
    }, [
      pdfDocument,
      currentPage,
      pdfRenderedPages,
      onPageRender,
      onPageCount,
      pdfPageCount,
    ]);

    // ─── Page overlay handlers (tick, cross, highlight, eraser) ───

    const getCanvasCoordinates = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const canvas = pdfCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY,
        };
      },
      [],
    );

    const handleOverlayMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;
        if (activeTool === 'highlight') {
          const { x, y } = getCanvasCoordinates(e);
          highlightDragRef.current = {
            startX: x,
            startY: y,
            page: currentPage,
          };
        }
      },
      [activeTool, placingMarkId, getCanvasCoordinates, currentPage],
    );

    const handleOverlayMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;
        if (activeTool !== 'highlight' || !highlightDragRef.current) return;
        if (highlightDragRef.current.page !== currentPage) return;

        const { x, y } = getCanvasCoordinates(e);
        const startX = highlightDragRef.current.startX;
        const startY = highlightDragRef.current.startY;

        setHighlightPreview({
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          width: Math.abs(x - startX),
          height: Math.abs(y - startY),
          page: currentPage,
        });
      },
      [activeTool, placingMarkId, getCanvasCoordinates, currentPage],
    );

    const handleOverlayMouseUp = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;

        const { x, y } = getCanvasCoordinates(e);

        if (activeTool === 'eraser') {
          const pageAnnotations = annotations.filter(
            (ann) => ann.page === currentPage,
          );

          for (const ann of pageAnnotations) {
            if (ann.tool === 'highlight' && ann.width && ann.height) {
              if (
                x >= ann.x &&
                x <= ann.x + ann.width &&
                y >= ann.y &&
                y <= ann.y + ann.height
              ) {
                onAnnotationDelete(ann.id);
                return;
              }
            }
          }

          for (const ann of pageAnnotations) {
            if (ann.tool === 'tick' || ann.tool === 'cross') {
              const dx = x - ann.x;
              const dy = y - ann.y;
              if (Math.sqrt(dx * dx + dy * dy) < 20) {
                onAnnotationDelete(ann.id);
                return;
              }
            }
          }

          onEraserNoHit();
          return;
        }

        if (activeTool === 'highlight' && highlightDragRef.current) {
          const startX = highlightDragRef.current.startX;
          const startY = highlightDragRef.current.startY;
          const w = Math.abs(x - startX);
          const h = Math.abs(y - startY);

          highlightDragRef.current = null;
          setHighlightPreview(null);

          if (w >= 10 && h >= 10) {
            onAnnotationAdd(
              'highlight',
              Math.min(startX, x),
              Math.min(startY, y),
              currentPage,
              w,
              h,
            );
          }
        } else if (activeTool === 'tick' || activeTool === 'cross') {
          onAnnotationAdd(activeTool, x, y, currentPage);
        }
      },
      [
        activeTool,
        placingMarkId,
        getCanvasCoordinates,
        currentPage,
        annotations,
        onAnnotationAdd,
        onAnnotationDelete,
        onEraserNoHit,
      ],
    );

    // ─── Click-to-place handler ───
    const handlePlaceClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!placingMarkId) return;
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        onSheetClickForPlacement(currentPage, xPercent, yPercent);
      },
      [placingMarkId, currentPage, onSheetClickForPlacement],
    );

    // ─── Stamp right-click → start drag ───
    const handleStampRightClick = useCallback(
      (
        e: React.MouseEvent,
        markId: string,
        page: number,
        x: number,
        y: number,
      ) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStamp({ markId, page, x, y });
      },
      [],
    );

    // ─── Stamp drag mouse move / release (document-level) ───
    useEffect(() => {
      if (!dragStamp) return;

      const handleMouseMove = (e: MouseEvent) => {
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        setDragStamp((prev) =>
          prev ? { ...prev, x: xPercent, y: yPercent } : null,
        );
      };

      const handleMouseUp = () => {
        if (dragStamp) {
          onStampReposition(
            dragStamp.markId,
            dragStamp.page,
            dragStamp.x,
            dragStamp.y,
          );
        }
        setDragStamp(null);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [dragStamp, onStampReposition]);

    // ─── IntersectionObserver ───
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const observer = new IntersectionObserver(
        (entries) => {
          let bestPage = currentPage;
          let bestRatio = 0;
          entries.forEach((entry) => {
            if (entry.intersectionRatio > bestRatio) {
              bestRatio = entry.intersectionRatio;
              const pageNum = parseInt(
                entry.target.getAttribute('data-page') || '1',
                10,
              );
              bestPage = pageNum;
            }
          });
          if (bestRatio > 0 && bestPage !== currentPage) {
            onPageChange(bestPage);
          }
        },
        {
          root: container,
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        },
      );

      for (let i = 1; i <= totalPages; i++) {
        const el = pageRefs.current[i];
        if (el) observer.observe(el);
      }

      return () => observer.disconnect();
    }, [currentPage, totalPages, onPageChange, pageRefs]);

    const isPencilActive = activeTool === 'pencil';
    const isPlacing = !!placingMarkId;

    // ─── Hex to rgba converter for stamp shadows ───
    const stampRgba = useCallback(
      (alpha: number) => {
        const r = parseInt(stampColor.slice(1, 3), 16);
        const g = parseInt(stampColor.slice(3, 5), 16);
        const b = parseInt(stampColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      },
      [stampColor],
    );

    // ─── ✅ IF PDF URL EXISTS, SHOW PDF WITH OVERLAY ──────────────────────

    if (pdfUrl) {
      const pageStamps = stampsByPage[currentPage] || [];

      return (
        <div className="flex-1 flex flex-col bg-[#0f172a] min-w-0">
          {/* Instruction banner */}
          {instructionBanner && (
            <div
              className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2"
              style={{
                backgroundColor: '#FFFBEB',
                border: '1px solid #F59E0B',
              }}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <i
                  className="ri-information-line text-sm"
                  style={{ color: '#D97706' }}
                ></i>
              </div>
              <span
                className="text-[11px] font-medium flex-1"
                style={{ color: '#92400E' }}
              >
                {instructionBanner}
              </span>
              <button
                onClick={onDismissBanner}
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
                style={{ color: '#92400E' }}
              >
                <i className="ri-close-line text-xs"></i>
              </button>
            </div>
          )}

          {/* PDF Viewer with overlay */}
          <div
            className="flex-1 overflow-y-auto flex justify-center p-4 relative"
            ref={scrollContainerRef}
          >
            {pdfLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-slate-400 mt-3 text-sm">Loading PDF...</p>
                </div>
              </div>
            ) : pdfError ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-error-warning-line text-red-400 text-3xl"></i>
                  </div>
                  <p className="text-red-400 text-sm">{pdfError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
                  >
                    Reload
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="relative w-full max-w-4xl"
                ref={pdfCanvasContainerRef}
              >
                {/* PDF Canvas */}
                <canvas
                  ref={pdfCanvasRef}
                  className="mx-auto shadow-lg rounded-lg"
                  style={{
                    width: '100%',
                    height: 'auto',
                    backgroundColor: 'white',
                    display: 'block',
                  }}
                />

                {/* ✅ Overlay for annotations and stamps */}
                <div
                  className="absolute inset-0 z-10"
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Annotation overlay (tick, cross, highlight) + click-to-place */}
                  <div
                    className="absolute inset-0 z-20"
                    style={{
                      pointerEvents:
                        isPlacing || activeTool !== 'pencil' ? 'auto' : 'none',
                      cursor: isPlacing
                        ? 'crosshair'
                        : activeTool === 'eraser'
                          ? 'not-allowed'
                          : activeTool === 'highlight' ||
                              activeTool === 'tick' ||
                              activeTool === 'cross'
                            ? 'crosshair'
                            : 'default',
                    }}
                    onClick={isPlacing ? handlePlaceClick : undefined}
                    onMouseDown={isPlacing ? undefined : handleOverlayMouseDown}
                    onMouseMove={isPlacing ? undefined : handleOverlayMouseMove}
                    onMouseUp={isPlacing ? undefined : handleOverlayMouseUp}
                  />

                  {/* Highlight preview */}
                  {highlightPreview &&
                    highlightPreview.page === currentPage && (
                      <div
                        className="absolute z-15 pointer-events-none"
                        style={{
                          left: highlightPreview.x,
                          top: highlightPreview.y,
                          width: highlightPreview.width,
                          height: highlightPreview.height,
                          backgroundColor: 'rgba(255, 235, 59, 0.4)',
                          border: '1px dashed #D97706',
                        }}
                      />
                    )}

                  {/* STAMPS for this page */}
                  {pageStamps.map((stamp) => {
                    const isActive = stamp.markId === activeMarkId;
                    const hasValue =
                      stamp.value !== null && stamp.value !== undefined;
                    const isDragging = dragStamp?.markId === stamp.markId;
                    const canvas = pdfCanvasRef.current;
                    if (!canvas) return null;

                    const rect = canvas.getBoundingClientRect();
                    const canvasWidth = canvas.width;
                    const canvasHeight = canvas.height;

                    const xPos = (stamp.x / 100) * rect.width;
                    const yPos = (stamp.y / 100) * rect.height;
                    const size = isActive ? 38 : 34;
                    const fontSize = isActive ? 15 : 14;

                    return (
                      <div
                        key={stamp.markId}
                        className={`absolute rounded-full flex items-center justify-center font-bold select-none ${
                          isDragging
                            ? 'cursor-grabbing z-30'
                            : 'cursor-pointer z-5'
                        }`}
                        style={{
                          width: `${size}px`,
                          height: `${size}px`,
                          border: hasValue
                            ? `2px solid ${stampColor}`
                            : `2px dashed ${stampColor}`,
                          color: hasValue ? stampColor : '#94a3b8',
                          fontSize: `${fontSize}px`,
                          backgroundColor: 'white',
                          top: `${yPos - size / 2}px`,
                          left: `${xPos - size / 2}px`,
                          boxShadow: isActive
                            ? `0 0 0 4px ${stampRgba(0.25)}`
                            : undefined,
                          animation: isActive
                            ? `${pulseAnimationName} 1.5s ease-in-out infinite`
                            : undefined,
                          pointerEvents: 'auto',
                        }}
                        onContextMenu={
                          !isDragging
                            ? (e) =>
                                handleStampRightClick(
                                  e,
                                  stamp.markId,
                                  stamp.page,
                                  stamp.x,
                                  stamp.y,
                                )
                            : undefined
                        }
                        title={
                          hasValue
                            ? `${stamp.markId}: ${stamp.value}`
                            : `${stamp.markId}: not yet marked`
                        }
                      >
                        {hasValue ? stamp.value : '—'}
                      </div>
                    );
                  })}

                  {/* Rendered annotations for this page */}
                  {annotations
                    .filter((ann) => ann.page === currentPage)
                    .map((ann) => {
                      const canvas = pdfCanvasRef.current;
                      if (!canvas) return null;

                      const rect = canvas.getBoundingClientRect();
                      const scaleX = rect.width / canvas.width;
                      const scaleY = rect.height / canvas.height;

                      const xPos = ann.x * scaleX;
                      const yPos = ann.y * scaleY;

                      return (
                        <div
                          key={ann.id}
                          className="absolute z-10 pointer-events-none"
                          style={{ left: xPos, top: yPos }}
                        >
                          {ann.tool === 'tick' && (
                            <span
                              className="font-bold select-none leading-none inline-block"
                              style={{
                                fontSize: `${24 * scaleX}px`,
                                color: '#27500A',
                                fontFamily: 'serif',
                                transform: 'translate(-6px, -12px)',
                              }}
                            >
                              ✓
                            </span>
                          )}
                          {ann.tool === 'cross' && (
                            <span
                              className="font-bold select-none leading-none inline-block"
                              style={{
                                fontSize: `${28 * scaleX}px`,
                                color: '#E24B4A',
                                fontFamily: 'serif',
                                transform: 'translate(-7px, -14px)',
                              }}
                            >
                              ✗
                            </span>
                          )}
                          {ann.tool === 'highlight' && (
                            <div
                              className="rounded-sm"
                              style={{
                                width: (ann.width ?? 80) * scaleX,
                                height: (ann.height ?? 20) * scaleY,
                                backgroundColor: 'rgba(250, 204, 21, 0.45)',
                                transform: 'translate(-2px, -3px)',
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

          {/* Bottom page navigation */}
          <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-1 px-3 overflow-x-auto">
            {pdfPageCount > 0 && (
              <>
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ri-arrow-left-s-line"></i>
                </button>
                <span className="text-xs text-slate-400 px-2">
                  Page {currentPage} of {pdfPageCount}
                </span>
                <button
                  onClick={() =>
                    onPageChange(Math.min(pdfPageCount, currentPage + 1))
                  }
                  disabled={currentPage >= pdfPageCount}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="ri-arrow-right-s-line"></i>
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    // ─── FALLBACK: Static pages (when no PDF URL) ──────────────────────

    return (
      <div className="flex-1 flex flex-col bg-slate-200 min-w-0">
        {/* ─── INSTRUCTION BANNER ─── */}
        {instructionBanner && (
          <div
            className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2"
            style={{ backgroundColor: '#FFFBEB', border: '1px solid #F59E0B' }}
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <i
                className="ri-information-line text-sm"
                style={{ color: '#D97706' }}
              ></i>
            </div>
            <span
              className="text-[11px] font-medium flex-1"
              style={{ color: '#92400E' }}
            >
              {instructionBanner}
            </span>
            <button
              onClick={onDismissBanner}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
              style={{ color: '#92400E' }}
            >
              <i className="ri-close-line text-xs"></i>
            </button>
          </div>
        )}

        {/* ─── SCROLLABLE SHEET VIEW ─── */}
        <div className="flex-1 overflow-y-auto">
          <div
            ref={(el) => {
              scrollContainerRef.current = el;
            }}
            className="flex-1 overflow-y-auto flex justify-center"
          >
            <div
              className="relative py-4 flex flex-col items-center gap-2"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top center',
              }}
            >
              {/* ─── PENCIL CANVAS OVERLAY ─── */}
              <canvas
                ref={canvasRef}
                width={720}
                height={8000}
                className="absolute top-0 left-0 z-10"
                style={{
                  pointerEvents: isPencilActive && !isPlacing ? 'auto' : 'none',
                  cursor:
                    isPencilActive && !isPlacing ? 'crosshair' : undefined,
                  width: '720px',
                  height: '8000px',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
              />

              {/* ─── HIGHLIGHT LIVE PREVIEW ─── */}
              {highlightPreview && (
                <div
                  className="absolute z-15 pointer-events-none"
                  style={{
                    left: highlightPreview.x,
                    top: highlightPreview.y,
                    width: highlightPreview.width,
                    height: highlightPreview.height,
                    backgroundColor: 'rgba(255, 235, 59, 0.4)',
                    border: '1px dashed #D97706',
                  }}
                />
              )}

              {/* ─── PAGES ─── */}
              {Array.from({ length: totalPages }, (_, i) => {
                const page = i + 1;
                const isBlank = blankPages.has(page);
                const pageAnnotations = annotations.filter(
                  (ann) => ann.page === page,
                );
                const pageStamps = stampsByPage[page] || [];
                const lines = getPageLines(page);
                const showOverlay =
                  !isBlank && (activeTool !== 'pencil' || isPlacing);
                const cursorClass = isPlacing
                  ? 'cursor-crosshair'
                  : activeTool === 'eraser'
                    ? 'cursor-not-allowed'
                    : activeTool === 'highlight' ||
                        activeTool === 'tick' ||
                        activeTool === 'cross'
                      ? 'cursor-crosshair'
                      : 'cursor-default';

                return (
                  <div
                    key={page}
                    ref={(el) => {
                      pageRefs.current[page] = el;
                    }}
                    data-page={page}
                    className="relative bg-white shadow-sm rounded-sm shrink-0"
                    style={{ width: '720px' }}
                  >
                    {/* Annotation overlay */}
                    {showOverlay && (
                      <div
                        className={`absolute inset-0 z-20 ${cursorClass}`}
                        style={{ background: 'transparent' }}
                        onClick={
                          isPlacing
                            ? (e) => handlePlaceClick(page, e)
                            : undefined
                        }
                        onMouseDown={
                          isPlacing
                            ? undefined
                            : (e) => handleOverlayMouseDown(page, e)
                        }
                        onMouseMove={
                          isPlacing
                            ? undefined
                            : (e) => handleOverlayMouseMove(page, e)
                        }
                        onMouseUp={
                          isPlacing
                            ? undefined
                            : (e) => handleOverlayMouseUp(page, e)
                        }
                      />
                    )}

                    {/* STAMPS */}
                    {!isBlank &&
                      pageStamps.map((stamp) => {
                        const isActive = stamp.markId === activeMarkId;
                        const hasValue =
                          stamp.value !== null && stamp.value !== undefined;
                        const isDragging = dragStamp?.markId === stamp.markId;
                        const stampX = isDragging ? dragStamp.x : stamp.x;
                        const stampY = isDragging ? dragStamp.y : stamp.y;
                        const size = isActive ? 38 : 34;
                        const fontSize = isActive ? 15 : 14;

                        return (
                          <div
                            key={stamp.markId}
                            className={`absolute rounded-full flex items-center justify-center font-bold select-none ${
                              isDragging
                                ? 'cursor-grabbing z-30'
                                : 'pointer-events-auto cursor-pointer z-5'
                            }`}
                            style={{
                              width: `${size}px`,
                              height: `${size}px`,
                              border: hasValue
                                ? `2px solid ${stampColor}`
                                : `2px dashed ${stampColor}`,
                              color: hasValue ? stampColor : '#94a3b8',
                              fontSize: `${fontSize}px`,
                              backgroundColor: 'white',
                              top: `${stampY}%`,
                              left: `${stampX}%`,
                              transform: 'translate(-50%, -50%)',
                              boxShadow: isActive
                                ? `0 0 0 4px ${stampRgba(0.25)}`
                                : undefined,
                              animation: isActive
                                ? `${pulseAnimationName} 1.5s ease-in-out infinite`
                                : undefined,
                            }}
                            onContextMenu={
                              !isDragging
                                ? (e) =>
                                    handleStampRightClick(
                                      e,
                                      stamp.markId,
                                      stamp.page,
                                      stamp.x,
                                      stamp.y,
                                    )
                                : undefined
                            }
                            title={
                              hasValue
                                ? `${stamp.markId}: ${stamp.value}`
                                : `${stamp.markId}: not yet marked`
                            }
                          >
                            {hasValue ? stamp.value : '—'}
                          </div>
                        );
                      })}

                    {/* Rendered annotations */}
                    {!isBlank &&
                      pageAnnotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="absolute z-10 pointer-events-none"
                          style={{ left: ann.x, top: ann.y }}
                        >
                          {ann.tool === 'tick' && (
                            <span
                              className="font-bold select-none leading-none inline-block"
                              style={{
                                fontSize: '24px',
                                color: '#27500A',
                                fontFamily: 'serif',
                                transform: 'translate(-6px, -12px)',
                              }}
                            >
                              ✓
                            </span>
                          )}
                          {ann.tool === 'cross' && (
                            <span
                              className="font-bold select-none leading-none inline-block"
                              style={{
                                fontSize: '28px',
                                color: '#E24B4A',
                                fontFamily: 'serif',
                                transform: 'translate(-7px, -14px)',
                              }}
                            >
                              ✗
                            </span>
                          )}
                          {ann.tool === 'highlight' && (
                            <div
                              className="rounded-sm"
                              style={{
                                width: ann.width ?? 80,
                                height: ann.height ?? 20,
                                backgroundColor: 'rgba(250, 204, 21, 0.45)',
                                transform: 'translate(-2px, -3px)',
                              }}
                            />
                          )}
                        </div>
                      ))}

                    {/* Content */}
                    <div className="px-6 py-4 min-h-[280px] relative">
                      {isBlank ? (
                        <div className="flex items-center justify-center min-h-[240px]">
                          <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
                              <i className="ri-file-reduce-line text-amber-500 text-xl"></i>
                            </div>
                            <span className="inline-block text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                              Blank Page
                            </span>
                            <p className="text-xs text-slate-400 mt-2">
                              This page has been marked as blank
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {page > 1 && (
                            <div className="text-xs font-semibold text-slate-800 mb-3">
                              Answer Sheet — Page {page}
                            </div>
                          )}
                          {page === 1 && (
                            <div className="text-xs font-semibold text-slate-800 mb-3">
                              Answer Sheet — Page {page}
                            </div>
                          )}
                          {lines.map((line, idx) => (
                            <p
                              key={idx}
                              className="text-[13px] leading-relaxed text-slate-600"
                              style={{
                                fontFamily: "'Caveat', cursive",
                                fontSize: idx === 0 ? '15px' : '14px',
                              }}
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Roll No: 102
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Page {page}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Bottom spacer */}
              <div className="h-6 shrink-0" />
            </div>
          </div>

          {/* Bottom page grid */}
          <div className="h-11 shrink-0 bg-[#1e293b] flex items-center justify-center gap-1 px-3 overflow-x-auto">
            {Array.from({ length: totalPages }, (_, i) => {
              const p = i + 1;
              const isBlankP = blankPages.has(p);
              let btnClass =
                'w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap shrink-0 ';
              if (p === currentPage) {
                btnClass += 'bg-sky-500 text-white font-semibold';
              } else if (isBlankP) {
                btnClass += 'bg-amber-500/20 text-amber-400';
              } else {
                btnClass += 'text-slate-400 hover:text-white hover:bg-white/10';
              }
              return (
                <button
                  key={p}
                  onClick={() => scrollToPage(p)}
                  className={btnClass}
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

// ─── Helper function for static pages ───
function getPageLines(page: number): string[] {
  const answerLines: Record<number, string[]> = {
    1: [
      'Explain the working principle of a single-phase transformer with a neat diagram.',
      'A single-phase transformer operates on the principle of mutual induction between two coils wound on a common magnetic core.',
      'When an alternating voltage V₁ is applied to the primary winding, it produces an alternating flux Φ in the core.',
      "This flux links with the secondary winding and induces an EMF E₂ according to Faraday's law of electromagnetic induction.",
      'The magnitude of the induced EMF depends on the turns ratio N₂/N₁.',
      'For a step-down transformer, N₂ &lt; N₁, and for a step-up transformer, N₂ &gt; N₁.',
      'The core is made of laminated silicon steel to minimize eddy current losses.',
      'Hysteresis loss is minimized by using high-grade CRGO (Cold Rolled Grain Oriented) steel.',
      'The efficiency of a well-designed transformer typically ranges from 95% to 99%.',
      'Applications include power distribution, impedance matching, and electrical isolation.',
    ],
    2: [
      'The EMF equation of a transformer is given by:',
      'E = 4.44 × f × N × Φₘ × 10⁻⁸ volts',
      'Where: f = supply frequency in Hz',
      'N = number of turns in the winding',
      'Φₘ = maximum flux in the core in Maxwells',
      'This equation is fundamental to transformer design and analysis.',
      'For a given core cross-section A and flux density Bₘ:',
      'Φₘ = Bₘ × A',
      'Substituting: E = 4.44 × f × N × Bₘ × A × 10⁻⁸',
      'This shows that the induced EMF is directly proportional to frequency, turns, flux density, and core area.',
    ],
    3: [
      'Explain the concept of voltage regulation in transformers.',
      'Voltage regulation is defined as the change in secondary terminal voltage from no-load to full-load.',
      'It is expressed as a percentage of the full-load voltage.',
      'Regulation (%) = (V₂₍ₙₗ₎ - V₂₍ꜰₗ₎) / V₂₍ꜰₗ₎ × 100',
      'Good transformers have regulation less than 5%.',
      'The regulation depends on the load power factor and the equivalent impedance of the transformer.',
      'For leading power factor loads, the regulation can be negative (voltage rise).',
      'For lagging power factor loads, the regulation is always positive (voltage drop).',
      'The phasor diagram helps visualize the voltage drops due to resistance and leakage reactance.',
      'Proper design of winding geometry minimizes leakage reactance and improves regulation.',
    ],
    4: [
      'Discuss the various losses in a transformer and methods to minimize them.',
      'Transformer losses are broadly classified into two categories:',
      '1. Core Losses (Iron Losses): These include hysteresis loss and eddy current loss.',
      'Hysteresis loss: Pₕ = Kₕ × f × Bₘ¹·⁶ — minimized by using silicon steel with narrow hysteresis loop.',
      'Eddy current loss: Pₑ = Kₑ × f² × Bₘ² × t² — minimized by laminating the core.',
      '2. Copper Losses (I²R Losses): Due to resistance of windings.',
      'Copper loss varies with the square of the load current.',
      'These can be minimized by using conductors with larger cross-sectional area.',
      'Stray losses occur due to leakage flux linking with structural parts.',
      'Dielectric losses occur in insulating materials, especially at high voltages.',
      'Overall, transformer efficiency = Output / (Output + Total Losses) × 100%.',
    ],
  };

  const defaultLines = [
    "The analysis of this circuit requires applying Kirchhoff's voltage law to each loop.",
    'Consider the mesh currents I₁, I₂, and I₃ flowing in the clockwise direction.',
    'For mesh 1: 10I₁ - 4I₂ - 2I₃ = 12 volts',
    'For mesh 2: -4I₁ + 8I₂ - 3I₃ = 0',
    'For mesh 3: -2I₁ - 3I₂ + 6I₃ = -6',
    "Solving these simultaneous equations using Cramer's rule yields the mesh currents.",
    'The determinant of the coefficient matrix Δ = 10(48-9) - (-4)(-24+6) + (-2)(12-16) = 312.',
    'I₁ = Δ₁/Δ = 1.5 A, I₂ = 0.8 A, I₃ = 0.3 A',
    "The voltage across each component can now be calculated using Ohm's law.",
    'Power dissipated in each resistor: P = I²R watts.',
  ];

  return answerLines[page] || defaultLines;
}

export default SheetViewer;
