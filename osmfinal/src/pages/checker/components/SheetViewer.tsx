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
  onSheetClickForPlacement: (page: number, xPercent: number, yPercent: number) => void;
  onStampReposition: (markId: string, page: number, xPercent: number, yPercent: number) => void;
  onDismissBanner: () => void;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  scrollToPage: (page: number) => void;
}

export interface SheetViewerHandle {
  undoPencil: () => void;
  clearPencil: () => void;
  hasPencilMarks: () => boolean;
}

const answerLines: Record<number, string[]> = {
  1: [
    "Explain the working principle of a single-phase transformer with a neat diagram.",
    "A single-phase transformer operates on the principle of mutual induction between two coils wound on a common magnetic core.",
    "When an alternating voltage V₁ is applied to the primary winding, it produces an alternating flux Φ in the core.",
    "This flux links with the secondary winding and induces an EMF E₂ according to Faraday's law of electromagnetic induction.",
    "The magnitude of the induced EMF depends on the turns ratio N₂/N₁.",
    "For a step-down transformer, N₂ &lt; N₁, and for a step-up transformer, N₂ &gt; N₁.",
    "The core is made of laminated silicon steel to minimize eddy current losses.",
    "Hysteresis loss is minimized by using high-grade CRGO (Cold Rolled Grain Oriented) steel.",
    "The efficiency of a well-designed transformer typically ranges from 95% to 99%.",
    "Applications include power distribution, impedance matching, and electrical isolation.",
  ],
  2: [
    "The EMF equation of a transformer is given by:",
    "E = 4.44 × f × N × Φₘ × 10⁻⁸ volts",
    "Where: f = supply frequency in Hz",
    "N = number of turns in the winding",
    "Φₘ = maximum flux in the core in Maxwells",
    "This equation is fundamental to transformer design and analysis.",
    "For a given core cross-section A and flux density Bₘ:",
    "Φₘ = Bₘ × A",
    "Substituting: E = 4.44 × f × N × Bₘ × A × 10⁻⁸",
    "This shows that the induced EMF is directly proportional to frequency, turns, flux density, and core area.",
  ],
  3: [
    "Explain the concept of voltage regulation in transformers.",
    "Voltage regulation is defined as the change in secondary terminal voltage from no-load to full-load.",
    "It is expressed as a percentage of the full-load voltage.",
    "Regulation (%) = (V₂₍ₙₗ₎ - V₂₍ꜰₗ₎) / V₂₍ꜰₗ₎ × 100",
    "Good transformers have regulation less than 5%.",
    "The regulation depends on the load power factor and the equivalent impedance of the transformer.",
    "For leading power factor loads, the regulation can be negative (voltage rise).",
    "For lagging power factor loads, the regulation is always positive (voltage drop).",
    "The phasor diagram helps visualize the voltage drops due to resistance and leakage reactance.",
    "Proper design of winding geometry minimizes leakage reactance and improves regulation.",
  ],
  4: [
    "Discuss the various losses in a transformer and methods to minimize them.",
    "Transformer losses are broadly classified into two categories:",
    "1. Core Losses (Iron Losses): These include hysteresis loss and eddy current loss.",
    "Hysteresis loss: Pₕ = Kₕ × f × Bₘ¹·⁶ — minimized by using silicon steel with narrow hysteresis loop.",
    "Eddy current loss: Pₑ = Kₑ × f² × Bₘ² × t² — minimized by laminating the core.",
    "2. Copper Losses (I²R Losses): Due to resistance of windings.",
    "Copper loss varies with the square of the load current.",
    "These can be minimized by using conductors with larger cross-sectional area.",
    "Stray losses occur due to leakage flux linking with structural parts.",
    "Dielectric losses occur in insulating materials, especially at high voltages.",
    "Overall, transformer efficiency = Output / (Output + Total Losses) × 100%.",
  ],
};

const defaultLines = [
  "The analysis of this circuit requires applying Kirchhoff's voltage law to each loop.",
  "Consider the mesh currents I₁, I₂, and I₃ flowing in the clockwise direction.",
  "For mesh 1: 10I₁ - 4I₂ - 2I₃ = 12 volts",
  "For mesh 2: -4I₁ + 8I₂ - 3I₃ = 0",
  "For mesh 3: -2I₁ - 3I₂ + 6I₃ = -6",
  "Solving these simultaneous equations using Cramer's rule yields the mesh currents.",
  "The determinant of the coefficient matrix Δ = 10(48-9) - (-4)(-24+6) + (-2)(12-16) = 312.",
  "I₁ = Δ₁/Δ = 1.5 A, I₂ = 0.8 A, I₃ = 0.3 A",
  "The voltage across each component can now be calculated using Ohm's law.",
  "Power dissipated in each resistor: P = I²R watts.",
];

function getPageLines(page: number): string[] {
  return answerLines[page] || defaultLines;
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
      stampColor = "#4338CA",
      pulseAnimationName = "stampPulse",
      onAnnotationAdd,
      onAnnotationDelete,
      onEraserNoHit,
      onPencilStroke,
      onSheetClickForPlacement,
      onStampReposition,
      onDismissBanner,
      pageRefs,
      scrollToPage,
    },
    ref,
  ) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const canvasHistoryRef = useRef<string[]>([]);

    // Keep onPencilStroke callback ref
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

    // ─── Stamp drag mouse move / release (document-level) ───
    const sheetContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!dragStamp) return;
      const handleMouseMove = (e: MouseEvent) => {
        const container = sheetContainerRef.current;
        if (!container) return;
        const pageEl = document.querySelector(
          `[data-page="${dragStamp.page}"]`,
        ) as HTMLElement | null;
        if (!pageEl) return;
        const rect = pageEl.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        setDragStamp((prev) =>
          prev ? { ...prev, x: xPercent, y: yPercent } : null,
        );
      };
      const handleMouseUp = () => {
        if (dragStamp) {
          onStampReposition(dragStamp.markId, dragStamp.page, dragStamp.x, dragStamp.y);
        }
        setDragStamp(null);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [dragStamp, onStampReposition]);

    // ─── Expose pencil undo/clear/hasPencilMarks via ref ───
    useImperativeHandle(
      ref,
      () => ({
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
          canvasHistoryRef.current = [];
          canvasHistoryRef.current.push(canvas.toDataURL());
        },
        hasPencilMarks() {
          return canvasHistoryRef.current.length > 1;
        },
      }),
      [],
    );

    // ─── Init canvas context ───
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

    // ─── Canvas drawing handlers ───
    const getCanvasCoords = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
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

    const handleCanvasMouseDown = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool !== "pencil" || placingMarkId) return;
        const ctx = ctxRef.current;
        if (!ctx) return;
        const { x, y } = getCanvasCoords(e);
        isDrawingRef.current = true;
        ctx.beginPath();
        ctx.moveTo(x, y);
      },
      [activeTool, placingMarkId, getCanvasCoords],
    );

    const handleCanvasMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (activeTool !== "pencil" || !isDrawingRef.current || placingMarkId) return;
        const ctx = ctxRef.current;
        if (!ctx) return;
        const { x, y } = getCanvasCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
      },
      [activeTool, placingMarkId, getCanvasCoords],
    );

    const handleCanvasMouseUp = useCallback(() => {
      if (activeTool !== "pencil" || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL();
      const history = canvasHistoryRef.current;
      if (history.length >= 20) {
        history.shift();
      }
      history.push(dataUrl);
      onPencilStrokeRef.current();
    }, [activeTool]);

    const handleCanvasMouseLeave = useCallback(() => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL();
      const history = canvasHistoryRef.current;
      if (history.length >= 20) {
        history.shift();
      }
      history.push(dataUrl);
      onPencilStrokeRef.current();
    }, []);

    // ─── Click-to-place handler ───
    const handlePlaceClick = useCallback(
      (page: number, e: React.MouseEvent<HTMLDivElement>) => {
        if (!placingMarkId) return;
        e.stopPropagation();
        const target = e.currentTarget;
        const rect = target.getBoundingClientRect();
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
        onSheetClickForPlacement(page, xPercent, yPercent);
      },
      [placingMarkId, onSheetClickForPlacement],
    );

    // ─── Page overlay handlers (tick, cross, highlight, eraser) ───
    const handleOverlayMouseDown = useCallback(
      (page: number, e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;
        if (activeTool === "highlight") {
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const scale = zoom / 100;
          const x = (e.clientX - rect.left) / scale;
          const y = (e.clientY - rect.top) / scale;
          highlightDragRef.current = { startX: x, startY: y, page };
        }
      },
      [activeTool, zoom, placingMarkId],
    );

    const handleOverlayMouseMove = useCallback(
      (page: number, e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;
        if (activeTool !== "highlight" || !highlightDragRef.current) return;
        if (highlightDragRef.current.page !== page) return;
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const scale = zoom / 100;
        const currentX = (e.clientX - rect.left) / scale;
        const currentY = (e.clientY - rect.top) / scale;
        const startX = highlightDragRef.current.startX;
        const startY = highlightDragRef.current.startY;

        setHighlightPreview({
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
          page,
        });
      },
      [activeTool, zoom, placingMarkId],
    );

    const handleOverlayMouseUp = useCallback(
      (page: number, e: React.MouseEvent<HTMLDivElement>) => {
        if (placingMarkId) return;
        if (activeTool === "eraser") {
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const scaleVal = zoom / 100;
          const x = (e.clientX - rect.left) / scaleVal;
          const y = (e.clientY - rect.top) / scaleVal;

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

        if (activeTool === "highlight" && highlightDragRef.current) {
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const scale = zoom / 100;
          const currentX = (e.clientX - rect.left) / scale;
          const currentY = (e.clientY - rect.top) / scale;
          const startX = highlightDragRef.current.startX;
          const startY = highlightDragRef.current.startY;
          const w = Math.abs(currentX - startX);
          const h = Math.abs(currentY - startY);

          highlightDragRef.current = null;
          setHighlightPreview(null);

          if (w >= 10 && h >= 10) {
            onAnnotationAdd(
              "highlight",
              Math.min(startX, currentX),
              Math.min(startY, currentY),
              page,
              w,
              h,
            );
          }
        } else if (activeTool === "tick" || activeTool === "cross") {
          const target = e.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const scaleVal = zoom / 100;
          const x = (e.clientX - rect.left) / scaleVal;
          const y = (e.clientY - rect.top) / scaleVal;
          onAnnotationAdd(activeTool, x, y, page);
        }
      },
      [activeTool, zoom, placingMarkId, annotations, onAnnotationAdd, onAnnotationDelete, onEraserNoHit],
    );

    // ─── Stamp right-click → start drag ───
    const handleStampRightClick = useCallback(
      (e: React.MouseEvent, markId: string, page: number, x: number, y: number) => {
        e.preventDefault();
        e.stopPropagation();
        setDragStamp({ markId, page, x, y });
      },
      [],
    );

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
                entry.target.getAttribute("data-page") || "1",
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

    const isPencilActive = activeTool === "pencil";
    const isPlacing = !!placingMarkId;

    // Hex to rgba converter for stamp shadows
    const stampRgba = useCallback(
      (alpha: number) => {
        const r = parseInt(stampColor.slice(1, 3), 16);
        const g = parseInt(stampColor.slice(3, 5), 16);
        const b = parseInt(stampColor.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      },
      [stampColor],
    );

    return (
      <div className="flex-1 flex flex-col bg-slate-200 min-w-0">
        {/* ─── INSTRUCTION BANNER ─── */}
        {instructionBanner && (
          <div className="shrink-0 mx-3 mt-2 px-3 py-2 rounded flex items-center gap-2" style={{ backgroundColor: "#FFFBEB", border: "1px solid #F59E0B" }}>
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              <i className="ri-information-line text-sm" style={{ color: "#D97706" }}></i>
            </div>
            <span className="text-[11px] font-medium flex-1" style={{ color: "#92400E" }}>
              {instructionBanner}
            </span>
            <button
              onClick={onDismissBanner}
              className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-amber-200 cursor-pointer shrink-0 transition-colors"
              style={{ color: "#92400E" }}
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
                (sheetContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              }}
              className="flex-1 overflow-y-auto flex justify-center"
            >
              <div
                className="relative py-4 flex flex-col items-center gap-2"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                }}
              >
                {/* ─── PENCIL CANVAS OVERLAY ─── */}
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

                {/* ─── HIGHLIGHT LIVE PREVIEW ─── */}
                {highlightPreview && (
                  <div
                    className="absolute z-15 pointer-events-none"
                    style={{
                      left: highlightPreview.x,
                      top: highlightPreview.y,
                      width: highlightPreview.width,
                      height: highlightPreview.height,
                      backgroundColor: "rgba(255, 235, 59, 0.4)",
                      border: "1px dashed #D97706",
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
                  const showOverlay = !isBlank && (activeTool !== "pencil" || isPlacing);
                  const cursorClass =
                    isPlacing
                      ? "cursor-crosshair"
                      : activeTool === "eraser"
                        ? "cursor-not-allowed"
                        : activeTool === "highlight"
                          ? "cursor-crosshair"
                          : activeTool === "tick" || activeTool === "cross"
                            ? "cursor-crosshair"
                            : "cursor-default";

                  return (
                    <div
                      key={page}
                      ref={(el) => {
                        pageRefs.current[page] = el;
                      }}
                      data-page={page}
                      className="relative bg-white shadow-sm rounded-sm shrink-0"
                      style={{ width: "720px" }}
                    >
                      {/* Annotation overlay (tick, cross, highlight) + click-to-place */}
                      {showOverlay && (
                        <div
                          className={`absolute inset-0 z-20 ${cursorClass}`}
                          style={{ background: "transparent" }}
                          onClick={isPlacing ? (e) => handlePlaceClick(page, e) : undefined}
                          onMouseDown={isPlacing ? undefined : (e) => handleOverlayMouseDown(page, e)}
                          onMouseMove={isPlacing ? undefined : (e) => handleOverlayMouseMove(page, e)}
                          onMouseUp={isPlacing ? undefined : (e) => handleOverlayMouseUp(page, e)}
                        />
                      )}

                      {/* ─── STAMPS for this page ─── */}
                      {!isBlank &&
                        pageStamps.map((stamp) => {
                          const isActive = stamp.markId === activeMarkId;
                          const hasValue = stamp.value !== null && stamp.value !== undefined;
                          const isDragging = dragStamp?.markId === stamp.markId;
                          const stampX = isDragging ? dragStamp.x : stamp.x;
                          const stampY = isDragging ? dragStamp.y : stamp.y;
                          const size = isActive ? 38 : 34;
                          const fontSize = isActive ? 15 : 14;

                          return (
                            <div
                              key={stamp.markId}
                              className={`absolute rounded-full flex items-center justify-center font-bold select-none ${
                                isDragging ? "cursor-grabbing z-30" : "pointer-events-auto cursor-pointer z-5"
                              }`}
                              style={{
                                width: `${size}px`,
                                height: `${size}px`,
                                border: hasValue
                                  ? `2px solid ${stampColor}`
                                  : `2px dashed ${stampColor}`,
                                color: hasValue ? stampColor : "#94a3b8",
                                fontSize: `${fontSize}px`,
                                backgroundColor: "white",
                                top: `${stampY}%`,
                                left: `${stampX}%`,
                                transform: "translate(-50%, -50%)",
                                boxShadow: isActive
                                  ? `0 0 0 4px ${stampRgba(0.25)}`
                                  : undefined,
                                animation: isActive ? `${pulseAnimationName} 1.5s ease-in-out infinite` : undefined,
                              }}
                              onContextMenu={
                                !isDragging
                                  ? (e) => handleStampRightClick(e, stamp.markId, stamp.page, stamp.x, stamp.y)
                                  : undefined
                              }
                              title={
                                hasValue
                                  ? `${stamp.markId}: ${stamp.value}`
                                  : `${stamp.markId}: not yet marked`
                              }
                            >
                              {hasValue ? stamp.value : "—"}
                            </div>
                          );
                        })}

                      {/* ─── DRAG PREVIEW for cross-page stamps ─── */}
                      {dragStamp && dragStamp.page !== page && stampsByPage[dragStamp.page]?.some((s) => s.markId === dragStamp.markId) ? null : null}

                      {/* Rendered annotations for this page */}
                      {!isBlank &&
                        pageAnnotations.map((ann) => (
                          <div
                            key={ann.id}
                            className="absolute z-10 pointer-events-none"
                            style={{ left: ann.x, top: ann.y }}
                          >
                            {ann.tool === "tick" && (
                              <span
                                className="font-bold select-none leading-none inline-block"
                                style={{
                                  fontSize: "24px",
                                  color: "#27500A",
                                  fontFamily: "serif",
                                  transform: "translate(-6px, -12px)",
                                }}
                              >
                                ✓
                              </span>
                            )}
                            {ann.tool === "cross" && (
                              <span
                                className="font-bold select-none leading-none inline-block"
                                style={{
                                  fontSize: "28px",
                                  color: "#E24B4A",
                                  fontFamily: "serif",
                                  transform: "translate(-7px, -14px)",
                                }}
                              >
                                ✗
                              </span>
                            )}
                            {ann.tool === "highlight" && (
                              <div
                                className="rounded-sm"
                                style={{
                                  width: ann.width ?? 80,
                                  height: ann.height ?? 20,
                                  backgroundColor: "rgba(250, 204, 21, 0.45)",
                                  transform: "translate(-2px, -3px)",
                                }}
                              />
                            )}
                          </div>
                        ))}

                      {/* University header — page 1 only */}
                      {page === 1 && (
                        <div className="px-6 pt-5 pb-3 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                                University of Engineering &amp; Technology
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                B.Tech — Semester IV — Mid-Term Examination 2025
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                NAAC A+
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Content */}
                      <div className="px-6 py-4 min-h-[280px] relative">
                        {!isBlank && page === 4 && (
                          <div className="absolute top-4 right-6 w-5 h-5 flex items-center justify-center">
                            <i className="ri-close-line text-red-500 text-lg font-bold"></i>
                          </div>
                        )}

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
                                  fontSize: idx === 0 ? "15px" : "14px",
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
                  "w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-colors whitespace-nowrap shrink-0 ";
                if (p === currentPage) {
                  btnClass += "bg-sky-500 text-white font-semibold";
                } else if (isBlankP) {
                  btnClass += "bg-amber-500/20 text-amber-400";
                } else {
                  btnClass +=
                    "text-slate-400 hover:text-white hover:bg-white/10";
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

export default SheetViewer;