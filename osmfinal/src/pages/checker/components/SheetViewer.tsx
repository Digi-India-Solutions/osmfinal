
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


// REPLACE with this single line:
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
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
  eraserSize?: number;
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
      eraserSize = 20,
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
    // Per-page pencil stroke storage (PDF mode: page N → dataURL)
    const pageCanvasDataRef = useRef<Record<number, string>>({});
    const prevPageRef = useRef<number>(-1);

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
    const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Tracks which page is currently drawn on the visible canvas (viewer)
    const canvasCurrentPageRef = useRef<number>(-1);
    // Tracks which pages have already been captured for thumbnails
    const thumbnailRenderedRef = useRef<Set<number>>(new Set());

    useEffect(() => {
      if (!pdfUrl) {
        setPdfDocument(null);
        setPdfPageCount(0);
        setPdfError(null);
        canvasCurrentPageRef.current = -1;
        thumbnailRenderedRef.current = new Set();
        return;
      }
      let cancelled = false;
      const loadPdf = async () => {
        setPdfLoading(true);
        setPdfError(null);
        try {
          const pdf = await pdfjsLib.getDocument({
            url: pdfUrl,
            withCredentials: false,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist/cmaps/',
            cMapPacked: true,
          }).promise;
          if (cancelled) return;
          setPdfDocument(pdf);
          setPdfPageCount(pdf.numPages);
          onPageCountRef.current?.(pdf.numPages);
          canvasCurrentPageRef.current = -1;
          thumbnailRenderedRef.current = new Set();
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

    // ─── Render current page into the visible canvas (viewer) ────────────────
    useEffect(() => {
      if (!pdfDocument || !pdfCanvasRef.current) return;
      // Skip if the canvas is already showing this exact page
      if (canvasCurrentPageRef.current === currentPage) return;
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
          canvasCurrentPageRef.current = currentPage;
          // Also capture as thumbnail if not already done
          if (!thumbnailRenderedRef.current.has(currentPage)) {
            const imageData = canvas.toDataURL("image/jpeg", 0.6);
            onPageRenderRef.current?.(currentPage, imageData);
            thumbnailRenderedRef.current.add(currentPage);
          }
        } catch (err) {
          console.error(`Error rendering PDF page ${currentPage}:`, err);
        }
      };
      renderPage();
      return () => { cancelled = true; };
    }, [pdfDocument, currentPage]);

    // ─── Background-render ALL pages for thumbnails ───────────────────────────
    useEffect(() => {
      if (!pdfDocument || pdfPageCount === 0) return;
      let cancelled = false;
      const offscreenCanvas = document.createElement("canvas");
      const renderAllPages = async () => {
        for (let pageNum = 1; pageNum <= pdfPageCount; pageNum++) {
          if (cancelled) return;
          if (thumbnailRenderedRef.current.has(pageNum)) continue;
          try {
            const page = await pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.5 });
            const ctx = offscreenCanvas.getContext("2d");
            if (!ctx || cancelled) return;
            offscreenCanvas.width = viewport.width;
            offscreenCanvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
            if (cancelled) return;
            const imageData = offscreenCanvas.toDataURL("image/jpeg", 0.5);
            onPageRenderRef.current?.(pageNum, imageData);
            thumbnailRenderedRef.current.add(pageNum);
          } catch (err) {
            console.error(`Error background-rendering PDF page ${pageNum}:`, err);
          }
        }
      };
      renderAllPages();
      return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDocument, pdfPageCount]);

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

    const setupPencilCanvas = useCallback(() => {
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

    // Initialize pencil canvas for non-PDF (static) mode — canvas is in DOM at mount
    useEffect(() => {
      if (!pdfUrl) setupPencilCanvas();
    }, [pdfUrl, setupPencilCanvas]);

    // In PDF mode, the pencil canvas mounts after the PDF loads.
    // After each page renders into pdfCanvasRef, resize the pencil canvas
    // to match and (re)initialize the 2D context.
    // We save/restore per-page stroke data so navigation doesn't lose pencil marks.
    useEffect(() => {
      if (!pdfDocument) return;
      const timer = setTimeout(() => {
        const pdfCanvas = pdfCanvasRef.current;
        const pencilCanvas = canvasRef.current;
        if (!pdfCanvas || !pencilCanvas) return;

        // 1. Save current page's pencil content before we resize (which clears it)
        const prev = prevPageRef.current;
        if (prev !== -1 && prev !== currentPage) {
          pageCanvasDataRef.current[prev] = pencilCanvas.toDataURL();
        }

        // 2. Resize pencil canvas to match the newly rendered PDF page (clears the canvas)
        pencilCanvas.width = pdfCanvas.width;
        pencilCanvas.height = pdfCanvas.height;

        // 3. Re-initialize the 2D context (resize resets it)
        setupPencilCanvas();

        // 4. Restore this page's previously drawn strokes (if any)
        const saved = pageCanvasDataRef.current[currentPage];
        if (saved && ctxRef.current) {
          const img = new Image();
          img.onload = () => {
            if (ctxRef.current && pencilCanvas) {
              ctxRef.current.drawImage(img, 0, 0, pencilCanvas.width, pencilCanvas.height);
            }
          };
          img.src = saved;
        }

        prevPageRef.current = currentPage;
      }, 150); // slightly more than PDF render time
      return () => clearTimeout(timer);
    }, [pdfDocument, currentPage, setupPencilCanvas]);

    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }, []);

    // Eraser cursor position (CSS pixels relative to canvas element)
    const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      if (activeTool === "eraser" && !placingMarkId) {
        const { x, y } = getCanvasCoords(e);
        isDrawingRef.current = true;
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = eraserSize * 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        return;
      }

      if (activeTool !== "pencil" || placingMarkId) return;
      const { x, y } = getCanvasCoords(e);
      isDrawingRef.current = true;
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
    }, [activeTool, placingMarkId, getCanvasCoords, eraserSize]);

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // Update visual eraser cursor position
      if (activeTool === "eraser") {
        const rect = canvas?.getBoundingClientRect();
        if (rect) setEraserCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setEraserCursor(null);
      }

      if (!isDrawingRef.current || !ctx) return;

      if (activeTool === "eraser" && !placingMarkId) {
        const { x, y } = getCanvasCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        return;
      }

      if (activeTool !== "pencil" || placingMarkId) return;
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
      // Only fire pencil stroke event for pencil (not eraser)
      if (ctxRef.current?.globalCompositeOperation === "source-over") {
        onPencilStrokeRef.current();
      }
      // Reset composite operation back to normal drawing
      if (ctxRef.current) {
        ctxRef.current.globalCompositeOperation = "source-over";
        ctxRef.current.lineWidth = 2;
      }
    }, []);

    const handleCanvasMouseUp = useCallback(() => {
      if (!isDrawingRef.current) return;
      if (activeTool !== "pencil" && activeTool !== "eraser") return;
      isDrawingRef.current = false;
      saveCanvasSnapshot();
    }, [activeTool, saveCanvasSnapshot]);

    const handleCanvasMouseLeave = useCallback(() => {
      setEraserCursor(null);
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
            const pageEl = document.getElementById(`page-${dragPageRef.current}`) || pdfCanvasRef.current?.parentElement || null;
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
          const pageEl = document.getElementById(`page-${annotDragPageRef.current}`) || pdfCanvasRef.current?.parentElement || null;
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
      const getPageRect = (page: number): DOMRect | null => {
        const byId = document.getElementById(`page-${page}`);
        if (byId) return byId.getBoundingClientRect();
        // PDF mode: single canvas container
        return pdfCanvasRef.current?.parentElement?.getBoundingClientRect() ?? null;
      };
      if (activeTool === "handSelect") {
        e.preventDefault();
        e.stopPropagation();
        onStampSelect?.(stamp.markId);
        stampDragIdRef.current = stamp.markId;
        isDraggingRef.current = true;
        dragPageRef.current = stamp.page;
        const rect = getPageRect(stamp.page);
        if (!rect) return;
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
      const rect = getPageRect(stamp.page);
      if (!rect) return;
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
      const pageEl = document.getElementById(`page-${ann.page}`) || pdfCanvasRef.current?.parentElement || null;
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
        // Eraser now works only on the pencil canvas via canvas events.
        // No annotation deletion on overlay click.
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
              <div
                style={{
                  width: `${zoom}%`,
                  maxWidth: `${zoom * 9}px`,
                  margin: "0 auto",
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease",
                }}
              >
                <div className="relative w-full" id={`page-${currentPage}`}>
                  <canvas
                    ref={pdfCanvasRef}
                    className="mx-auto shadow-lg rounded-lg"
                    style={{ width: "100%", height: "auto", backgroundColor: "white", display: "block" }}
                  />
                  {/* Pencil / eraser canvas — sits directly over the PDF canvas */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full z-10"
                    style={{
                      pointerEvents: (isPencilActive || activeTool === "eraser") && !isPlacing ? "auto" : "none",
                      cursor: activeTool === "eraser" ? "none" : isPencilActive && !isPlacing ? "crosshair" : undefined,
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                  />
                  {/* Eraser visual cursor */}
                  {activeTool === "eraser" && eraserCursor && (
                    <div
                      className="absolute pointer-events-none z-30"
                      style={{
                        left: eraserCursor.x,
                        top: eraserCursor.y,
                        width: eraserSize * 2,
                        height: eraserSize * 2,
                        borderRadius: "50%",
                        border: "2px solid #000",
                        backgroundColor: "rgba(255,255,255,0.15)",
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <div className="absolute inset-0 z-20" style={{ pointerEvents: "none" }}>
                    <div
                      className="absolute inset-0 z-30"
                      style={{
                        pointerEvents: isPlacing || (!isPencilActive && activeTool !== "eraser" && activeTool !== "handSelect") ? "auto" : "none",
                        cursor: isPlacing ? "crosshair" : activeTool === "handSelect" ? "default" : "crosshair",
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
                      const isAnnotSelected = ann.id === selectedAnnotationId;

                      return (
                        <div
                          key={ann.id}
                          className={`absolute z-10 ${activeTool === "handSelect" ? "cursor-pointer z-25" : "pointer-events-none"}`}
                          onMouseDown={(e) => handleAnnotationMouseDown(e, ann)}
                          onClick={(e) => handleAnnotationClick(e, ann)}
                          onContextMenu={(e) => handleAnnotationRightClick(e, ann)}
                          style={isTickCross
                            ? { top: `${ann.y}%`, left: `${ann.x}%`, transform: "translate(-50%,-50%)", userSelect: "none", pointerEvents: activeTool === "handSelect" ? "auto" : "none" }
                            : { left: ann.x * scaleX, top: ann.y * scaleY, pointerEvents: activeTool === "handSelect" ? "auto" : "none" }}
                        >
                          {ann.tool === "tick" && (
                            <div className="relative" style={{ borderRadius: "4px", boxShadow: isAnnotSelected ? "0 0 0 3px #93C5FD" : undefined }}>
                              <span style={{ fontSize: `${28 * scaleX}px`, color: "#166534", fontFamily: "serif", lineHeight: 1, display: "inline-block" }}>✓</span>
                            </div>
                          )}
                          {ann.tool === "cross" && (
                            <div className="relative" style={{ borderRadius: "4px", boxShadow: isAnnotSelected ? "0 0 0 3px #93C5FD" : undefined }}>
                              <span style={{ fontSize: `${28 * scaleX}px`, color: "#DC2626", fontFamily: "serif", lineHeight: 1, display: "inline-block" }}>✗</span>
                            </div>
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
                        style={{ pointerEvents: isPlacing || (!isPencilActive && activeTool !== "handSelect") ? "auto" : "none" }}
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
                            className={`absolute rounded-full flex items-center justify-center font-bold select-none transition-opacity ${isDragging ? "cursor-grabbing z-30" : "cursor-pointer z-25"
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
                  className={`w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap shrink-0 ${p === currentPage
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
