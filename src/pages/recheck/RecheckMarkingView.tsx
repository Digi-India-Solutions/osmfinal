import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ThumbnailPanel from "@/pages/checker/components/ThumbnailPanel";
import SheetViewer from "@/pages/checker/components/SheetViewer";
import EscalateModal from "@/pages/checker/components/EscalateModal";
import RecheckRightPanel from "./components/RecheckRightPanel";
import RecheckConfirmModal from "./components/RecheckConfirmModal";
import type { RecheckTab, RecheckMarkEntry, RecheckStamp } from "./components/RecheckRightPanel";
import { mockRecheckRequests, mockRecheckMarks, sheets, exams, modelAnswerSheets } from "@/mock/mockData";
import type { AnnotationTool, Annotation, MarksStamp } from "@/pages/checker/MarkingView";

type RecheckModalType = "escalate" | "submit" | null;

const TOTAL_PAGES = 18;
let annotationIdCounter = 1;
const QUESTIONS_PER_PAGE = 4;
const STAMP_COLOR = "#7C3AED";
const PULSE_ANIM = "recheckStampPulse";

function buildInitialMarks(sheetId: number): RecheckMarkEntry[] {
  const sheetMarks = mockRecheckMarks.filter((m) => m.sheetId === sheetId);
  if (sheetMarks.length > 0) {
    return sheetMarks.map((m) => ({
      id: m.questionName,
      criterion: m.questionName.replace("Qn", "").replace("_", ""),
      max: m.max,
      round1: m.originalMarks,
      round2: m.recheckMarks,
      remark: "",
    }));
  }
  return [
    { id: "Qn1_i", criterion: "1(i)", max: 3, round1: 2, round2: null, remark: "" },
    { id: "Qn1_ii", criterion: "1(ii)", max: 3, round1: 1, round2: null, remark: "" },
    { id: "Qn1_iii", criterion: "1(iii)", max: 3, round1: 2, round2: null, remark: "" },
    { id: "Qn1_iv", criterion: "1(iv)", max: 3, round1: 3, round2: null, remark: "" },
  ];
}

function buildInitialStamps(marks: RecheckMarkEntry[]): RecheckStamp[] {
  return marks.map((m) => ({
    markId: m.id,
    placed: false,
    x: 0,
    y: 0,
    page: 0,
    value: null,
  }));
}

function computeFinalMarks(
  round1Total: number,
  round2Total: number,
  rule: "higher" | "recheck_marks" | "average",
): number {
  switch (rule) {
    case "higher":
      return Math.max(round1Total, round2Total);
    case "recheck_marks":
      return round2Total;
    case "average":
      return Math.round((round1Total + round2Total) / 2);
    default:
      return round2Total;
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ActionType = "pencil" | "annotation";

// ─── Recheck draft storage interface ───
interface RecheckDraftStorageData {
  requestId: number;
  sheetId: number;
  marks: {
    questionName: string;
    round2: number | null;
    stampX: number | null;
    stampY: number | null;
    stampPage: number | null;
    isComplete: boolean;
  }[];
  savedAt: string;
}

export default function RecheckMarkingView() {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const requestIdNum = requestId ? parseInt(requestId, 10) : 0;

  // ─── Load recheck request & sheet data ───
  const request = useMemo(() => {
    if (!requestId) return null;
    return mockRecheckRequests.find((r) => r.id === parseInt(requestId, 10)) || null;
  }, [requestId]);

  const sheet = useMemo(() => {
    if (!request?.sheetId) return null;
    return sheets.find((s) => s.id === request.sheetId) || null;
  }, [request]);

  const exam = useMemo(() => {
    if (!request) return null;
    return exams.find((e) => e.id === request.examId) || null;
  }, [request]);

  // ─── State ───
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("tick");
  const [thumbnailOpen, setThumbnailOpen] = useState(true);
  const [blankPages, setBlankPages] = useState<Set<number>>(new Set([1, 2, 3]));
  const [selectedThumbnails, setSelectedThumbnails] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  const initialMarks = useMemo(
    () => buildInitialMarks(request?.sheetId || 3),
    [request?.sheetId],
  );

  const [marks, setMarks] = useState<RecheckMarkEntry[]>(initialMarks);

  useEffect(() => {
    setMarks(buildInitialMarks(request?.sheetId || 3));
  }, [request?.sheetId]);

  // Refs for auto-save
  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Track which marks have been explicitly entered (for incomplete check + beforeunload)
  const manuallySetMarksRef = useRef<Set<string>>(new Set());

  // ─── Click-to-place stamp state ───
  const [stamps, setStamps] = useState<RecheckStamp[]>(() =>
    buildInitialStamps(initialMarks),
  );
  useEffect(() => {
    setStamps(buildInitialStamps(buildInitialMarks(request?.sheetId || 3)));
  }, [request?.sheetId]);

  const [placingMarkId, setPlacingMarkId] = useState<string | null>(null);
  const [instructionBanner, setInstructionBanner] = useState<string | null>(null);
  const stampsRef = useRef(stamps);
  useEffect(() => {
    stampsRef.current = stamps;
  }, [stamps]);

  const visibleStamps = useMemo(
    () => stamps.filter((s) => s.placed),
    [stamps],
  );

  const sheetViewerStamps: MarksStamp[] = useMemo(
    () =>
      visibleStamps.map((s) => ({
        markId: s.markId,
        placed: s.placed,
        x: s.x,
        y: s.y,
        page: s.page,
        value: s.value,
      })),
    [visibleStamps],
  );

  const [modalType, setModalType] = useState<RecheckModalType>(null);
  const [questionPage, setQuestionPage] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RecheckTab>("recheckMarks");
  const [activeMarkId, setActiveMarkId] = useState<string | null>(
    initialMarks.length > 0 ? initialMarks[0].id : null,
  );
  const [hasPencilMarks, setHasPencilMarks] = useState(false);
  const [totalActions, setTotalActions] = useState(1);

  const [zoom, setZoom] = useState(100);

  const [annotations, setAnnotations] = useState<Annotation[]>([
    { id: 1, tool: "cross", x: 420, y: 240, page: 4 },
  ]);

  const actionHistoryRef = useRef<ActionType[]>(["annotation"]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sheetViewerRef = useRef<{
    undoPencil: () => void;
    clearPencil: () => void;
    hasPencilMarks: () => boolean;
  } | null>(null);

  // ─── AUTO-SAVE: save indicator ───
  const [saveIndicatorText, setSaveIndicatorText] = useState("Auto-saves every 30s");
  const [saveIndicatorFresh, setSaveIndicatorFresh] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── RESUME: banner state ───
  const [resumeBanner, setResumeBanner] = useState<{ savedAt: string } | null>(null);

  // ─── INCOMPLETE SUBMISSION WARNING ───
  const [incompleteWarning, setIncompleteWarning] = useState<{
    questions: string[];
  } | null>(null);

  // ─── Computed values ───
  const round1Total = marks.reduce((sum, m) => sum + m.round1, 0);
  const round2Total = marks.reduce((sum, m) => sum + (m.round2 ?? 0), 0);
  const totalMax = marks.reduce((sum, m) => sum + m.max, 0);
  const finalMarks = computeFinalMarks(
    round1Total,
    round2Total,
    request?.finalMarksRule || "higher",
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current[page];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ─── INTERNAL: persist draft to localStorage ───
  const persistDraft = useCallback(
    (
      mks: RecheckMarkEntry[],
      stps: RecheckStamp[],
      rid: number,
      sid: number,
      manualSet: Set<string>,
    ) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour12: false });
      const draftData: RecheckDraftStorageData = {
        requestId: rid,
        sheetId: sid,
        marks: mks.map((m) => {
          const stamp = stps.find((s) => s.markId === m.id);
          return {
            questionName: m.id,
            round2: m.round2,
            stampX: stamp?.placed ? stamp.x : null,
            stampY: stamp?.placed ? stamp.y : null,
            stampPage: stamp?.placed ? stamp.page : null,
            isComplete: manualSet.has(m.id),
          };
        }),
        savedAt: now.toISOString(),
      };
      localStorage.setItem(`osm_recheck_draft_request_${rid}`, JSON.stringify(draftData));

      setSaveIndicatorText(`Saved at ${timeStr}`);
      setSaveIndicatorFresh(true);

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setSaveIndicatorFresh(false);
        setSaveIndicatorText("Auto-saves every 30s");
      }, 3000);
    },
    [],
  );

  const saveDraft = useCallback(() => {
    if (!requestIdNum) return;
    persistDraft(
      marksRef.current,
      stampsRef.current,
      requestIdNum,
      request?.sheetId || 0,
      manuallySetMarksRef.current,
    );
  }, [requestIdNum, request?.sheetId, persistDraft]);

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  // ─── AUTO-SAVE: 30-second interval + beforeunload ───
  useEffect(() => {
    const interval = setInterval(() => {
      saveDraftRef.current();
    }, 30000);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (manuallySetMarksRef.current.size > 0) {
        saveDraftRef.current();
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // ─── RESUME: check localStorage on mount ───
  useEffect(() => {
    const key = `osm_recheck_draft_request_${requestIdNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft: RecheckDraftStorageData = JSON.parse(raw);
      if (draft.marks && draft.marks.length > 0) {
        const savedTime = new Date(draft.savedAt);
        const timeLabel = savedTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        setResumeBanner({ savedAt: timeLabel });
        // Also show proactive toast
        setToastMessage("You have an unsaved draft — use Resume to continue");
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch {
      // Corrupt draft — ignore
    }
  }, [requestIdNum]);

  const handleResume = useCallback(() => {
    const key = `osm_recheck_draft_request_${requestIdNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft: RecheckDraftStorageData = JSON.parse(raw);
      const restoredMarks = marks.map((m) => {
        const d = draft.marks.find((dm) => dm.questionName === m.id);
        if (d && d.round2 !== null) {
          return { ...m, round2: d.round2 };
        }
        return m;
      });
      const restoredStamps = stamps.map((s) => {
        const d = draft.marks.find((dm) => dm.questionName === s.markId);
        if (d && d.stampX !== null && d.stampY !== null && d.stampPage !== null) {
          return {
            ...s,
            placed: true,
            x: d.stampX,
            y: d.stampY,
            page: d.stampPage,
            value: d.round2,
          };
        }
        return s;
      });

      const manualSet = new Set<string>();
      draft.marks.forEach((d) => {
        if (d.isComplete) manualSet.add(d.questionName);
      });
      manuallySetMarksRef.current = manualSet;

      setMarks(restoredMarks);
      setStamps(restoredStamps);
      setResumeBanner(null);

      const savedTime = new Date(draft.savedAt);
      const timeLabel = savedTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setToastMessage(`Resumed from last save at ${timeLabel}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setResumeBanner(null);
    }
  }, [requestIdNum, marks, stamps]);

  const handleStartFresh = useCallback(() => {
    localStorage.removeItem(`osm_recheck_draft_request_${requestIdNum}`);
    setResumeBanner(null);
    manuallySetMarksRef.current = new Set();
  }, [requestIdNum]);

  // ─── Toolbar handlers ───
  const handleToolSelect = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 15, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 15, 50));
  }, []);

  const handleFitWidth = useCallback(() => {
    setZoom(100);
  }, []);

  const handlePencilStroke = useCallback(() => {
    actionHistoryRef.current.push("pencil");
    setHasPencilMarks(true);
    setTotalActions((prev) => prev + 1);
  }, []);

  const handleAnnotationAdd = useCallback(
    (tool: AnnotationTool, x: number, y: number, page: number, width?: number, height?: number) => {
      annotationIdCounter += 1;
      const ann: Annotation = { id: annotationIdCounter, tool, x, y, page };
      if (width !== undefined) ann.width = width;
      if (height !== undefined) ann.height = height;
      setAnnotations((prev) => [...prev, ann]);
      actionHistoryRef.current.push("annotation");
      setTotalActions((prev) => prev + 1);
    },
    [],
  );

  const handleAnnotationDelete = useCallback(
    (id: number) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      setToastMessage("Annotation removed");
      setTimeout(() => setToastMessage(null), 2500);
    },
    [],
  );

  const handleEraserNoHit = useCallback(() => {
    setToastMessage("Nothing to erase here");
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleUndoAnnotation = useCallback(() => {
    const lastAction = actionHistoryRef.current.pop();
    if (lastAction === "pencil" && sheetViewerRef.current) {
      sheetViewerRef.current.undoPencil();
      setTotalActions((prev) => Math.max(0, prev - 1));
      if (!sheetViewerRef.current.hasPencilMarks()) {
        setHasPencilMarks(false);
      }
    } else if (lastAction === "annotation") {
      setAnnotations((prev) => {
        if (prev.length === 0) {
          actionHistoryRef.current.push("annotation");
          return prev;
        }
        return prev.slice(0, -1);
      });
    }
  }, []);

  const handleDeleteAnnotations = useCallback(() => {
    if (sheetViewerRef.current) {
      sheetViewerRef.current.clearPencil();
    }
    setAnnotations([]);
    setHasPencilMarks(false);
    setTotalActions(0);
    actionHistoryRef.current = [];
  }, []);

  const handleThumbnailClick = useCallback(
    (page: number) => {
      scrollToPage(page);
    },
    [scrollToPage],
  );

  const handleBlankToggle = useCallback((page: number) => {
    setSelectedThumbnails((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  }, []);

  const handleApplyBlank = useCallback(() => {
    if (selectedThumbnails.size === 0) return;
    setBlankPages((prev) => {
      const next = new Set(prev);
      selectedThumbnails.forEach((p) => next.add(p));
      return next;
    });
    const count = selectedThumbnails.size;
    setSelectedThumbnails(new Set());
    setToastMessage(`Marked ${count} page${count > 1 ? "s" : ""} as blank`);
    setTimeout(() => setToastMessage(null), 2500);
  }, [selectedThumbnails]);

  // ─── Active mark change — enters placing mode if stamp not placed ───
  const handleActiveMarkChange = useCallback((id: string) => {
    setActiveMarkId(id);
    const stamp = stampsRef.current.find((s) => s.markId === id);
    if (stamp && !stamp.placed) {
      setPlacingMarkId(id);
      setInstructionBanner(`Click on sheet to place mark position for ${id}`);
    } else {
      setPlacingMarkId(null);
      setInstructionBanner(null);
    }
  }, []);

  // ─── Sheet click for stamp placement ───
  const handleSheetClickForPlacement = useCallback(
    (page: number, xPercent: number, yPercent: number) => {
      if (!placingMarkId) return;
      setStamps((prev) =>
        prev.map((s) =>
          s.markId === placingMarkId
            ? { ...s, placed: true, x: xPercent, y: yPercent, page, value: null }
            : s,
        ),
      );
      setPlacingMarkId(null);
      setInstructionBanner(null);
    },
    [placingMarkId],
  );

  const handleDismissBanner = useCallback(() => {
    setPlacingMarkId(null);
    setInstructionBanner(null);
  }, []);

  // ─── Stamp reposition via drag ───
  const handleStampReposition = useCallback(
    (markId: string, page: number, xPercent: number, yPercent: number) => {
      setStamps((prev) =>
        prev.map((s) =>
          s.markId === markId ? { ...s, page, x: xPercent, y: yPercent } : s,
        ),
      );
    },
    [],
  );

  // ─── Clear stamp value ───
  const handleClearStampValue = useCallback((markId: string) => {
    setStamps((prev) =>
      prev.map((s) => (s.markId === markId ? { ...s, value: null } : s)),
    );
    setMarks((prev) =>
      prev.map((m) => (m.id === markId ? { ...m, round2: null } : m)),
    );
  }, []);

  // ─── Round 2 update (from numpad Add Mark) ───
  const handleRound2Update = useCallback((id: string, value: number | null) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, round2: value } : m)));
  }, []);

  // ─── Request add mark ───
  const handleRequestAddMark = useCallback(
    (markId: string, value: number) => {
      const stamp = stampsRef.current.find((s) => s.markId === markId);
      if (!stamp || !stamp.placed) {
        setToastMessage("Please click on sheet to place position first");
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }

      setStamps((prev) =>
        prev.map((s) => (s.markId === markId ? { ...s, value } : s)),
      );

      // Track this mark as manually entered
      manuallySetMarksRef.current.add(markId);

      // Auto-save after mark entry
      setTimeout(() => {
        saveDraftRef.current();
      }, 100);

      const idx = marks.findIndex((m) => m.id === markId);
      if (idx >= 0 && idx < marks.length - 1) {
        const nextId = marks[idx + 1].id;
        setActiveMarkId(nextId);
        setQuestionPage((prev) => {
          const newPage = Math.floor((idx + 1) / QUESTIONS_PER_PAGE);
          return newPage !== prev ? newPage : prev;
        });
        const nextStamp = stampsRef.current.find((s) => s.markId === nextId);
        if (nextStamp && !nextStamp.placed) {
          setPlacingMarkId(nextId);
          setInstructionBanner(
            `Click on sheet to place mark position for ${nextId}`,
          );
        } else {
          setPlacingMarkId(null);
          setInstructionBanner(null);
        }
      }
    },
    [marks],
  );

  const handleRemarkUpdate = useCallback((id: string, remark: string) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, remark } : m)));
  }, []);

  // ─── INCOMPLETE CHECK ───
  const checkIncomplete = useCallback((): string[] => {
    return marks
      .filter((m) => !manuallySetMarksRef.current.has(m.id))
      .map((m) => m.criterion);
  }, [marks]);

  // ─── Modal handlers ───
  const handleSubmitRecheck = useCallback(() => {
    const incomplete = checkIncomplete();
    if (incomplete.length > 0) {
      setIncompleteWarning({ questions: incomplete });
      return;
    }
    setModalType("submit");
  }, [checkIncomplete]);

  const handleIncompleteGoBack = useCallback(() => {
    setIncompleteWarning(null);
  }, []);

  const handleIncompleteSubmitAnyway = useCallback(() => {
    setIncompleteWarning(null);
    setModalType("submit");
  }, []);

  const handleSubmitConfirm = useCallback(() => {
    setModalType(null);
    // Clear draft on successful submit
    localStorage.removeItem(`osm_recheck_draft_request_${requestIdNum}`);
    setToastMessage("Recheck submitted successfully");
    setTimeout(() => {
      navigate("/recheck/queue");
    }, 1500);
  }, [navigate, requestIdNum]);

  const handleEscalateConfirm = useCallback(() => {
    setModalType(null);
    setToastMessage("Sheet escalated successfully");
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const hasModelAnswer = modelAnswerSheets.some((m) => m.examId === (request?.examId || 1));

  const toolbarTools: { tool: AnnotationTool; icon: string; label: string }[] = [
    { tool: "tick", icon: "ri-check-line", label: "Tick" },
    { tool: "cross", icon: "ri-close-line", label: "Cross" },
    { tool: "pencil", icon: "ri-pencil-line", label: "Pencil" },
    { tool: "highlight", icon: "ri-mark-pen-line", label: "Highlight" },
    { tool: "eraser", icon: "ri-eraser-line", label: "Eraser" },
  ];

  const examName = exam ? `${exam.name} — ${exam.subject}` : "Mathematics Mid-Term";
  const studentName = sheet?.studentName || "Amit Kumar";
  const studentRoll = sheet?.rollNo || "103";
  const sheetIdDisplay = sheet ? `#${String(sheet.id).padStart(3, "0")}` : "#003";

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f172a]">
      {/* ─── TOP BAR ─── */}
      <header className="h-11 shrink-0 bg-[#0f172a] text-white flex items-center justify-between px-4 text-[13px] select-none">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight">{examName}</span>
          <span className="text-[10px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded whitespace-nowrap">
            RECHECK MODE
          </span>
          <span className="text-slate-400">
            Page <span className="text-white font-medium">{currentPage}</span> of {TOTAL_PAGES}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 flex items-center justify-center text-emerald-400">
              <i className="ri-timer-line text-xs"></i>
            </span>
            <span className="font-mono text-emerald-400 tabular-nums">{formatTime(elapsed)}</span>
          </div>
          <span className="text-slate-400">
            Student: <span className="text-white font-semibold">{studentName}</span>
          </span>
          <span className="text-slate-400">
            Roll: <span className="text-white font-semibold">{studentRoll}</span>
          </span>
        </div>
      </header>

      {/* ─── MAIN ROW ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── ANNOTATION TOOLBAR ─── */}
        <aside className="w-9 shrink-0 bg-[#1e293b] flex flex-col items-center py-2 gap-1 border-r border-slate-700">
          <button
            onClick={() => setThumbnailOpen(!thumbnailOpen)}
            className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
              thumbnailOpen
                ? "bg-amber-500/25 text-amber-400"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Toggle thumbnails"
          >
            <i className="ri-layout-grid-line text-sm"></i>
          </button>

          <div className="w-5 h-px bg-slate-600 my-1.5" />

          <button
            onClick={handleZoomIn}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Zoom In"
          >
            <i className="ri-zoom-in-line text-sm"></i>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <i className="ri-zoom-out-line text-sm"></i>
          </button>
          <button
            onClick={handleFitWidth}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            title="Fit Width"
          >
            <i className="ri-aspect-ratio-line text-sm"></i>
          </button>

          <span className="text-[10px] text-slate-400 font-mono tabular-nums leading-none mt-0.5">
            {zoom}%
          </span>

          <div className="w-5 h-px bg-slate-600 my-1.5" />

          {toolbarTools.map(({ tool, icon, label }) => (
            <button
              key={tool}
              onClick={() => handleToolSelect(tool)}
              className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                activeTool === tool
                  ? tool === "eraser"
                    ? "bg-rose-500/25 text-rose-400"
                    : "bg-violet-500/25 text-violet-400"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              title={label}
            >
              <i className={`${icon} text-sm`}></i>
            </button>
          ))}

          <div className="w-5 h-px bg-slate-600 my-1.5" />

          <button
            onClick={handleUndoAnnotation}
            disabled={totalActions === 0}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Undo"
          >
            <i className="ri-arrow-go-back-line text-sm"></i>
          </button>
          <button
            onClick={handleDeleteAnnotations}
            disabled={annotations.length === 0 && !hasPencilMarks}
            className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Delete All"
          >
            <i className="ri-delete-bin-line text-sm"></i>
          </button>
        </aside>

        {/* ─── THUMBNAIL PANEL ─── */}
        {thumbnailOpen && (
          <ThumbnailPanel
            currentPage={currentPage}
            blankPages={blankPages}
            selectedThumbnails={selectedThumbnails}
            onThumbnailClick={handleThumbnailClick}
            onBlankToggle={handleBlankToggle}
            onApplyBlank={handleApplyBlank}
            totalPages={TOTAL_PAGES}
          />
        )}

        {/* ─── SHEET VIEWER ─── */}
        <SheetViewer
          ref={sheetViewerRef}
          currentPage={currentPage}
          totalPages={TOTAL_PAGES}
          blankPages={blankPages}
          onPageChange={setCurrentPage}
          zoom={zoom}
          activeTool={activeTool}
          annotations={annotations}
          stamps={sheetViewerStamps}
          activeMarkId={activeMarkId}
          placingMarkId={placingMarkId}
          instructionBanner={instructionBanner}
          stampColor={STAMP_COLOR}
          pulseAnimationName={PULSE_ANIM}
          onAnnotationAdd={handleAnnotationAdd}
          onAnnotationDelete={handleAnnotationDelete}
          onEraserNoHit={handleEraserNoHit}
          onPencilStroke={handlePencilStroke}
          onSheetClickForPlacement={handleSheetClickForPlacement}
          onStampReposition={handleStampReposition}
          onDismissBanner={handleDismissBanner}
          pageRefs={pageRefs}
          scrollToPage={scrollToPage}
        />

        {/* ─── RIGHT SIDE: Resume banner + Recheck Right Panel ─── */}
        <div className="w-[255px] shrink-0 flex flex-col">
          {/* ─── RESUME BANNER ─── */}
          {resumeBanner && (
            <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2.5">
              <p className="text-[11px] text-amber-300 leading-relaxed mb-2">
                You have unsaved progress from {resumeBanner.savedAt}. Resume from where you left off?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleResume}
                  className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-amber-500 text-amber-950 hover:bg-amber-400 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Resume
                </button>
                <button
                  onClick={handleStartFresh}
                  className="flex-1 py-1.5 rounded text-[11px] font-medium bg-slate-600 text-slate-300 hover:bg-slate-500 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Start fresh
                </button>
              </div>
            </div>
          )}

          {/* ─── RECHECK RIGHT PANEL ─── */}
          <RecheckRightPanel
            marks={marks}
            stamps={stamps}
            activeMarkId={activeMarkId}
            questionPage={questionPage}
            totalRound2={round2Total}
            totalMax={totalMax}
            finalMarks={finalMarks}
            finalMarksRule={request?.finalMarksRule || "higher"}
            rightTab={rightTab}
            hasModelAnswer={hasModelAnswer}
            saveIndicatorText={saveIndicatorText}
            saveIndicatorFresh={saveIndicatorFresh}
            onActiveMarkChange={handleActiveMarkChange}
            onQuestionPageChange={setQuestionPage}
            onRound2Update={handleRound2Update}
            onRemarkUpdate={handleRemarkUpdate}
            onRequestAddMark={handleRequestAddMark}
            onClearStampValue={handleClearStampValue}
            onRightTabChange={setRightTab}
            onSubmitRecheck={handleSubmitRecheck}
            onEscalateFurther={() => setModalType("escalate")}
          />
        </div>
      </div>

      {/* ─── TOAST ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-sm px-5 py-2.5 rounded-lg shadow-lg z-50 animate-bounce whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* ─── INCOMPLETE WARNING MODAL ─── */}
      {incompleteWarning && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
          <div className="bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl w-[400px] max-w-[95vw] overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <i className="ri-error-warning-line text-amber-400 text-lg"></i>
                </div>
                <h3 className="text-base font-semibold text-white">Incomplete recheck evaluation</h3>
              </div>
              <p className="text-sm text-slate-300 mb-3">
                You have not entered marks for all questions. Questions without marks:
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
                <p className="text-sm text-amber-300 font-mono">
                  {incompleteWarning.questions.join(", ")}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleIncompleteGoBack}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Go back and complete
                </button>
                <button
                  onClick={handleIncompleteSubmitAnyway}
                  className="px-5 py-2 rounded-lg text-sm font-semibold border-2 border-rose-500 text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Submit anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUBMIT CONFIRM MODAL ─── */}
      {modalType === "submit" && (
        <RecheckConfirmModal
          round1Total={round1Total}
          round2Total={round2Total}
          finalMarks={finalMarks}
          finalMarksRule={request?.finalMarksRule || "higher"}
          totalMax={totalMax}
          studentName={studentName}
          rollNo={studentRoll}
          onConfirm={handleSubmitConfirm}
          onCancel={() => setModalType(null)}
        />
      )}

      {/* ─── ESCALATE MODAL ─── */}
      {modalType === "escalate" && (
        <EscalateModal
          totalAwarded={round2Total}
          totalMax={totalMax}
          onEscalate={handleEscalateConfirm}
          onCancel={() => setModalType(null)}
        />
      )}
    </div>
  );
}