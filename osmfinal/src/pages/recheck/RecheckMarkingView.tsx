// src/pages/recheck/RecheckMarkingView.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ThumbnailPanel from '@/pages/checker/components/ThumbnailPanel';
import SheetViewer from '@/pages/checker/components/SheetViewer';
import EscalateModal from '@/pages/checker/components/EscalateModal';
import RecheckRightPanel from './components/RecheckRightPanel';
import RecheckConfirmModal from './components/RecheckConfirmModal';
import type {
  RecheckTab,
  RecheckMarkEntry,
  RecheckStamp,
} from './components/RecheckRightPanel';
import type {
  AnnotationTool,
  Annotation,
  MarksStamp,
} from '@/pages/checker/MarkingView';
import recheckQueueService from '@/api/recheckQueue';
import { API_URL } from '@/api/axios';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

type RecheckModalType = 'escalate' | 'submit' | null;

const TOTAL_PAGES = 18;
let annotationIdCounter = 1;
const QUESTIONS_PER_PAGE = 4;
const STAMP_COLOR = '#7C3AED';
const PULSE_ANIM = 'recheckStampPulse';

// ─── Helper functions ───

function computeFinalMarks(
  round1Total: number,
  round2Total: number,
  rule: 'higher' | 'recheck_marks' | 'average',
): number {
  switch (rule) {
    case 'higher':
      return Math.max(round1Total, round2Total);
    case 'recheck_marks':
      return round2Total;
    case 'average':
      return Math.round((round1Total + round2Total) / 2);
    default:
      return round2Total;
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toFullUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads')) return `${API_URL}${path}`;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

type ActionType = 'pencil' | 'annotation';

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

  // ─── API DATA STATE ──────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [sheetData, setSheetData] = useState<any>(null);
  const [examData, setExamData] = useState<any>(null);
  const [previousMarksData, setPreviousMarksData] = useState<
    Record<string, number>
  >({});
  const [markSchemeData, setMarkSchemeData] = useState<
    Record<string, { maxMarks: number; guidelines: string }>
  >({});
  const [pdfsData, setPdfsData] = useState<{
    model_answer: string | null;
    question_paper: string | null;
  }>({
    model_answer: null,
    question_paper: null,
  });
  const [recheckMarksData, setRecheckMarksData] = useState<
    Record<string, number>
  >({});
  const [recheckAnnotationsData, setRecheckAnnotationsData] = useState<
    Annotation[]
  >([]);
  const [recheckStampsData, setRecheckStampsData] = useState<RecheckStamp[]>(
    [],
  );

  // ─── PDF PAGE STATE ──────────────────────────────────────────

  const [pdfPageImages, setPdfPageImages] = useState<Record<number, string>>(
    {},
  );
  const [pdfPageCount, setPdfPageCount] = useState(0);

  // ─── FETCH DATA ──────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!requestIdNum) {
        setLoading(false);
        setError('Invalid request ID');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await recheckQueueService.startMarking(requestIdNum);

        console.log('📥 API Response:', response);

        if (response.success) {
          const data = response.data;

          setRequestData({
            ...data.request,
            isReadOnly: data.request?.isReadOnly || false,
          });

          setSheetData({
            ...data.sheet,
            file_url: toFullUrl(data.sheet?.file_url),
          });

          setExamData(data.exam);
          setMarkSchemeData(data.markScheme || {});
          setPreviousMarksData(data.previousMarks || {});
          setPdfsData({
            model_answer: toFullUrl(data.pdfs?.model_answer),
            question_paper: toFullUrl(data.pdfs?.question_paper),
          });

          if (data.request?.isReadOnly && data.recheckMarks) {
            setRecheckMarksData(data.recheckMarks || {});
            setRecheckAnnotationsData(data.recheckAnnotations || []);
            setRecheckStampsData(data.recheckStamps || []);
          }
        } else {
          setError(response.message || 'Failed to load recheck data');
        }
      } catch (err: any) {
        console.error('Fetch recheck data error:', err);
        setError(err.message || 'Failed to load recheck data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestIdNum]);

  // ─── BUILD MARKS FROM MARK SCHEME ────────────────────────────

  const initialMarks = useMemo((): RecheckMarkEntry[] => {
    if (!markSchemeData || Object.keys(markSchemeData).length === 0) {
      return [];
    }

    return Object.entries(markSchemeData).map(([questionName, details]) => {
      const displayName = questionName.replace('Qn', '').replace('_', '');
      return {
        id: questionName,
        criterion: displayName,
        max: details.maxMarks || 0,
        round1: previousMarksData[questionName] ?? 0,
        round2: null,
        remark: '',
      };
    });
  }, [markSchemeData, previousMarksData]);

  // ─── State ───
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('tick');
  const [thumbnailOpen, setThumbnailOpen] = useState(true);
  const [blankPages, setBlankPages] = useState<Set<number>>(new Set([]));
  const [selectedThumbnails, setSelectedThumbnails] = useState<Set<number>>(
    new Set(),
  );
  const [elapsed, setElapsed] = useState(0);

  const [marks, setMarks] = useState<RecheckMarkEntry[]>([]);

  // ─── Initialize marks when data loads ────────────────────────

  useEffect(() => {
    if (initialMarks.length > 0) {
      let updatedMarks = initialMarks.map((m) => ({
        ...m,
        round1: previousMarksData[m.id] || 0,
      }));

      if (requestData?.isReadOnly && recheckMarksData) {
        updatedMarks = updatedMarks.map((m) => ({
          ...m,
          round2:
            recheckMarksData[m.id] !== undefined
              ? recheckMarksData[m.id]
              : null,
        }));

        updatedMarks.forEach((m) => {
          if (m.round2 !== null) {
            manuallySetMarksRef.current.add(m.id);
          }
        });
      }

      setMarks(updatedMarks);
    }
  }, [
    initialMarks,
    previousMarksData,
    requestData?.isReadOnly,
    recheckMarksData,
  ]);

  // Refs for auto-save
  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Track which marks have been explicitly entered
  const manuallySetMarksRef = useRef<Set<string>>(new Set());

  // ─── LOAD RECHECK DRAFT FROM API ─────────────────────────────

  useEffect(() => {
    const loadDraft = async () => {
      if (!requestIdNum || marks.length === 0 || requestData?.isReadOnly)
        return;

      try {
        const response = await recheckQueueService.getDraft(requestIdNum);
        if (response.success && response.data) {
          const data = response.data;

          if (data.marks_data && Object.keys(data.marks_data).length > 0) {
            const restoredMarks = marks.map((m) => {
              const draftValue = data.marks_data[m.id];
              return {
                ...m,
                round2: draftValue !== undefined ? draftValue : null,
              };
            });
            setMarks(restoredMarks);

            Object.keys(data.marks_data).forEach((id) => {
              if (
                data.marks_data[id] !== undefined &&
                data.marks_data[id] !== null
              ) {
                manuallySetMarksRef.current.add(id);
              }
            });
          }

          if (data.stamps_data && data.stamps_data.length > 0) {
            setStamps(data.stamps_data);
          }

          if (data.annotations_data && data.annotations_data.length > 0) {
            setAnnotations(data.annotations_data);
            const maxId = Math.max(
              ...data.annotations_data.map((a: Annotation) => a.id),
              0,
            );
            annotationIdCounter = maxId + 1;
          }
        }
      } catch (error) {
        console.error('Load recheck draft error:', error);
      }
    };

    loadDraft();
  }, [requestIdNum, marks.length, requestData?.isReadOnly]);

  // ─── Click-to-place stamp state ───

  const [stamps, setStamps] = useState<RecheckStamp[]>([]);

  useEffect(() => {
    if (marks.length > 0) {
      let initialStamps = marks.map((m) => ({
        markId: m.id,
        placed: false,
        x: 0,
        y: 0,
        page: 0,
        value: null,
      }));

      if (requestData?.isReadOnly && recheckStampsData.length > 0) {
        initialStamps = recheckStampsData;
      }

      setStamps(initialStamps);
    }
  }, [marks, requestData?.isReadOnly, recheckStampsData]);

  const [placingMarkId, setPlacingMarkId] = useState<string | null>(null);
  const [instructionBanner, setInstructionBanner] = useState<string | null>(
    null,
  );
  const stampsRef = useRef(stamps);
  useEffect(() => {
    stampsRef.current = stamps;
  }, [stamps]);

  const visibleStamps = useMemo(() => stamps.filter((s) => s.placed), [stamps]);

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
  const [rightTab, setRightTab] = useState<RecheckTab>('recheckMarks');
  const [activeMarkId, setActiveMarkId] = useState<string | null>(
    marks.length > 0 ? marks[0].id : null,
  );
  const [hasPencilMarks, setHasPencilMarks] = useState(false);
  const [totalActions, setTotalActions] = useState(1);

  const [zoom, setZoom] = useState(100);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    if (requestData?.isReadOnly && recheckAnnotationsData.length > 0) {
      setAnnotations(recheckAnnotationsData);
      const maxId = Math.max(
        ...recheckAnnotationsData.map((a: Annotation) => a.id),
        0,
      );
      annotationIdCounter = maxId + 1;
    }
  }, [requestData?.isReadOnly, recheckAnnotationsData]);

  const actionHistoryRef = useRef<ActionType[]>([]);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sheetViewerRef = useRef<{
    undoPencil: () => void;
    clearPencil: () => void;
    hasPencilMarks: () => boolean;
  } | null>(null);

  // ─── AUTO-SAVE: save indicator ───
  const [saveIndicatorText, setSaveIndicatorText] = useState(
    'Auto-saves every 30s',
  );
  const [saveIndicatorFresh, setSaveIndicatorFresh] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── RESUME: banner state ───
  const [resumeBanner, setResumeBanner] = useState<{ savedAt: string } | null>(
    null,
  );

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
    requestData?.finalMarksRule || 'higher',
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
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
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
      localStorage.setItem(
        `osm_recheck_draft_request_${rid}`,
        JSON.stringify(draftData),
      );

      setSaveIndicatorText(`Saved at ${timeStr}`);
      setSaveIndicatorFresh(true);

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setSaveIndicatorFresh(false);
        setSaveIndicatorText('Auto-saves every 30s');
      }, 3000);
    },
    [],
  );

  const saveDraft = useCallback(() => {
    if (!requestIdNum || requestData?.isReadOnly) return;
    persistDraft(
      marksRef.current,
      stampsRef.current,
      requestIdNum,
      sheetData?.id || 0,
      manuallySetMarksRef.current,
    );
  }, [requestIdNum, sheetData?.id, requestData?.isReadOnly, persistDraft]);

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  // ─── SAVE RECHECK DRAFT TO API ────────────────────────────────

  const handleSaveDraft = useCallback(async () => {
    if (!requestIdNum || requestData?.isReadOnly) return;

    const marksData: Record<string, number> = {};
    marks.forEach((m) => {
      if (m.round2 !== null) marksData[m.id] = m.round2;
    });

    const stampsData = stamps.map((s) => ({
      markId: s.markId,
      placed: s.placed,
      x: s.x,
      y: s.y,
      page: s.page,
      value: s.value,
    }));

    const annotationsData = annotations.map((a) => ({
      id: a.id,
      tool: a.tool,
      x: a.x,
      y: a.y,
      page: a.page,
      width: a.width,
      height: a.height,
    }));

    const payload = {
      marksData,
      annotationsData,
      stampsData,
      totalMarks: round2Total,
      remarks: '',
    };

    try {
      await recheckQueueService.saveDraft(requestIdNum, payload);
    } catch (error) {
      console.error('Save recheck draft error:', error);
    }
  }, [
    requestIdNum,
    requestData?.isReadOnly,
    marks,
    stamps,
    annotations,
    round2Total,
  ]);

  const handleSaveDraftRef = useRef(handleSaveDraft);
  useEffect(() => {
    handleSaveDraftRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  // ─── AUTO-SAVE: 30-second interval + beforeunload ───

  useEffect(() => {
    if (requestData?.isReadOnly) return;

    const interval = setInterval(() => {
      saveDraftRef.current();
      handleSaveDraftRef.current();
    }, 30000);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (manuallySetMarksRef.current.size > 0) {
        saveDraftRef.current();
        handleSaveDraftRef.current();
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [requestData?.isReadOnly]);

  // ─── RESUME: check localStorage on mount ───

  useEffect(() => {
    const key = `osm_recheck_draft_request_${requestIdNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft: RecheckDraftStorageData = JSON.parse(raw);
      if (draft.marks && draft.marks.length > 0) {
        const savedTime = new Date(draft.savedAt);
        const timeLabel = savedTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setResumeBanner({ savedAt: timeLabel });
        setToastMessage('You have an unsaved draft — use Resume to continue');
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
        if (
          d &&
          d.stampX !== null &&
          d.stampY !== null &&
          d.stampPage !== null
        ) {
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
      const timeLabel = savedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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
    actionHistoryRef.current.push('pencil');
    setHasPencilMarks(true);
    setTotalActions((prev) => prev + 1);
  }, []);

  const handleAnnotationAdd = useCallback(
    (
      tool: AnnotationTool,
      x: number,
      y: number,
      page: number,
      width?: number,
      height?: number,
    ) => {
      annotationIdCounter += 1;
      const ann: Annotation = { id: annotationIdCounter, tool, x, y, page };
      if (width !== undefined) ann.width = width;
      if (height !== undefined) ann.height = height;
      setAnnotations((prev) => [...prev, ann]);
      actionHistoryRef.current.push('annotation');
      setTotalActions((prev) => prev + 1);
    },
    [],
  );

  const handleAnnotationDelete = useCallback((id: number) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setToastMessage('Annotation removed');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleEraserNoHit = useCallback(() => {
    setToastMessage('Nothing to erase here');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleUndoAnnotation = useCallback(() => {
    const lastAction = actionHistoryRef.current.pop();
    if (lastAction === 'pencil' && sheetViewerRef.current) {
      sheetViewerRef.current.undoPencil();
      setTotalActions((prev) => Math.max(0, prev - 1));
      if (!sheetViewerRef.current.hasPencilMarks()) {
        setHasPencilMarks(false);
      }
    } else if (lastAction === 'annotation') {
      setAnnotations((prev) => {
        if (prev.length === 0) {
          actionHistoryRef.current.push('annotation');
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
    setToastMessage(`Marked ${count} page${count > 1 ? 's' : ''} as blank`);
    setTimeout(() => setToastMessage(null), 2500);
  }, [selectedThumbnails]);

  // ─── Active mark change ───

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
      if (!placingMarkId || requestData?.isReadOnly) return;
      setStamps((prev) =>
        prev.map((s) =>
          s.markId === placingMarkId
            ? {
                ...s,
                placed: true,
                x: xPercent,
                y: yPercent,
                page,
                value: null,
              }
            : s,
        ),
      );
      setPlacingMarkId(null);
      setInstructionBanner(null);
    },
    [placingMarkId, requestData?.isReadOnly],
  );

  const handleDismissBanner = useCallback(() => {
    setPlacingMarkId(null);
    setInstructionBanner(null);
  }, []);

  // ─── Stamp reposition ───

  const handleStampReposition = useCallback(
    (markId: string, page: number, xPercent: number, yPercent: number) => {
      if (requestData?.isReadOnly) return;
      setStamps((prev) =>
        prev.map((s) =>
          s.markId === markId ? { ...s, page, x: xPercent, y: yPercent } : s,
        ),
      );
    },
    [requestData?.isReadOnly],
  );

  // ─── Clear stamp value ───

  const handleClearStampValue = useCallback(
    (markId: string) => {
      if (requestData?.isReadOnly) return;
      setStamps((prev) =>
        prev.map((s) => (s.markId === markId ? { ...s, value: null } : s)),
      );
      setMarks((prev) =>
        prev.map((m) => (m.id === markId ? { ...m, round2: null } : m)),
      );
    },
    [requestData?.isReadOnly],
  );

  // ─── Round 2 update ───

  const handleRound2Update = useCallback(
    (id: string, value: number | null) => {
      if (requestData?.isReadOnly) return;
      setMarks((prev) =>
        prev.map((m) => (m.id === id ? { ...m, round2: value } : m)),
      );
      if (value !== null) {
        manuallySetMarksRef.current.add(id);
      }
    },
    [requestData?.isReadOnly],
  );

  // ─── Request add mark ───

  const handleRequestAddMark = useCallback(
    (markId: string, value: number) => {
      if (requestData?.isReadOnly) return;
      const stamp = stampsRef.current.find((s) => s.markId === markId);
      if (!stamp || !stamp.placed) {
        setToastMessage('Please click on sheet to place position first');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }

      setStamps((prev) =>
        prev.map((s) => (s.markId === markId ? { ...s, value } : s)),
      );

      manuallySetMarksRef.current.add(markId);

      setTimeout(() => {
        saveDraftRef.current();
        handleSaveDraftRef.current();
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
    [marks, requestData?.isReadOnly],
  );

  const handleRemarkUpdate = useCallback(
    (id: string, remark: string) => {
      if (requestData?.isReadOnly) return;
      setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, remark } : m)));
    },
    [requestData?.isReadOnly],
  );

  // ─── INCOMPLETE CHECK ───

  const checkIncomplete = useCallback((): string[] => {
    return marks
      .filter((m) => !manuallySetMarksRef.current.has(m.id))
      .map((m) => m.criterion);
  }, [marks]);

  // ─── Submit recheck ───

  const handleSubmitRecheck = useCallback(() => {
    if (requestData?.isReadOnly) return;
    const incomplete = checkIncomplete();
    if (incomplete.length > 0) {
      setIncompleteWarning({ questions: incomplete });
      return;
    }
    setModalType('submit');
  }, [checkIncomplete, requestData?.isReadOnly]);

  const handleIncompleteGoBack = useCallback(() => {
    setIncompleteWarning(null);
  }, []);

  const handleIncompleteSubmitAnyway = useCallback(() => {
    setIncompleteWarning(null);
    setModalType('submit');
  }, []);

  const handleSubmitConfirm = useCallback(async () => {
    setModalType(null);
    try {
      const marksData: Record<string, number> = {};
      marks.forEach((m) => {
        if (m.round2 !== null) marksData[m.id] = m.round2;
      });

      const stampsData = stamps.map((s) => ({
        markId: s.markId,
        placed: s.placed,
        x: s.x,
        y: s.y,
        page: s.page,
        value: s.value,
      }));

      const annotationsData = annotations.map((a) => ({
        id: a.id,
        tool: a.tool,
        x: a.x,
        y: a.y,
        page: a.page,
        width: a.width,
        height: a.height,
      }));

      const response = await recheckQueueService.completeRecheck(requestIdNum, {
        marks: finalMarks,
        remarks: 'Recheck completed',
        marksData,
        annotationsData,
        stampsData,
      });

      if (response.success) {
        localStorage.removeItem(`osm_recheck_draft_request_${requestIdNum}`);
        setToastMessage('Recheck submitted successfully');
        setTimeout(() => {
          navigate('/recheck/queue');
        }, 1500);
      } else {
        setToastMessage(response.message || 'Failed to submit recheck');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (error: any) {
      console.error('Submit recheck error:', error);
      setToastMessage(error.message || 'Failed to submit recheck');
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [requestIdNum, finalMarks, marks, stamps, annotations, navigate]);

  const handleEscalateConfirm = useCallback(async () => {
    setModalType(null);
    try {
      const response = await recheckQueueService.updateStatus(
        requestIdNum,
        'escalated',
        'Escalated for further review',
      );
      if (response.success) {
        setToastMessage('Sheet escalated successfully');
        setTimeout(() => {
          navigate('/recheck/queue');
        }, 1500);
      } else {
        setToastMessage(response.message || 'Failed to escalate');
        setTimeout(() => setToastMessage(null), 2500);
      }
    } catch (error: any) {
      console.error('Escalate error:', error);
      setToastMessage(error.message || 'Failed to escalate');
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [requestIdNum, navigate]);

  const hasModelAnswer = !!pdfsData.model_answer;

  const toolbarTools: { tool: AnnotationTool; icon: string; label: string }[] =
    [
      { tool: 'tick', icon: 'ri-check-line', label: 'Tick' },
      { tool: 'cross', icon: 'ri-close-line', label: 'Cross' },
      { tool: 'pencil', icon: 'ri-pencil-line', label: 'Pencil' },
      { tool: 'highlight', icon: 'ri-mark-pen-line', label: 'Highlight' },
      { tool: 'eraser', icon: 'ri-eraser-line', label: 'Eraser' },
    ];

  // ─── LOADING STATE ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 mt-4 text-sm">Loading recheck data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-red-400 text-3xl"></i>
          </div>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => navigate('/recheck/queue')}
            className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors"
          >
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  if (!requestData || !sheetData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <p className="text-slate-400">No data available</p>
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────

  const examName = examData
    ? `${examData.name} — ${examData.subject}`
    : 'Recheck';
  const studentName = sheetData?.student_name || 'Unknown';
  const studentRoll = sheetData?.roll_no || '—';
  const isReadOnly = requestData?.isReadOnly || false;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f172a]">
      {/* ─── TOP BAR ─── */}
      <header className="h-11 shrink-0 bg-[#0f172a] text-white flex items-center justify-between px-4 text-[13px] select-none">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-tight">{examName}</span>
          <span className="text-[10px] font-bold text-white bg-violet-600 px-2 py-0.5 rounded whitespace-nowrap">
            RECHECK MODE
          </span>
          {isReadOnly && (
            <span className="text-[10px] font-bold text-white bg-slate-600 px-2 py-0.5 rounded whitespace-nowrap">
              READ ONLY
            </span>
          )}
          <span className="text-slate-400">
            Page <span className="text-white font-medium">{currentPage}</span>{' '}
            of {TOTAL_PAGES}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 flex items-center justify-center text-emerald-400">
              <i className="ri-timer-line text-xs"></i>
            </span>
            <span className="font-mono text-emerald-400 tabular-nums">
              {formatTime(elapsed)}
            </span>
          </div>
          <span className="text-slate-400">
            Student:{' '}
            <span className="text-white font-semibold">{studentName}</span>
          </span>
          <span className="text-slate-400">
            Roll:{' '}
            <span className="text-white font-semibold">{studentRoll}</span>
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
                ? 'bg-amber-500/25 text-amber-400'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
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

          {!isReadOnly && (
            <>
              <div className="w-5 h-px bg-slate-600 my-1.5" />

              {toolbarTools.map(({ tool, icon, label }) => (
                <button
                  key={tool}
                  onClick={() => handleToolSelect(tool)}
                  className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    activeTool === tool
                      ? tool === 'eraser'
                        ? 'bg-rose-500/25 text-rose-400'
                        : 'bg-violet-500/25 text-violet-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
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
            </>
          )}
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
            pdfPageImages={pdfPageImages}
            pdfPageCount={pdfPageCount}
            isPdfMode={!!sheetData?.file_url}
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
          pdfUrl={sheetData?.file_url || pdfsData.question_paper || null}
          onPageRender={(pageNum: number, imageData: string) => {
            setPdfPageImages((prev) => ({ ...prev, [pageNum]: imageData }));
          }}
          onPageCount={(count: number) => {
            setPdfPageCount(count);
          }}
        />

        {/* ─── RIGHT SIDE ─── */}
        <div className="w-[255px] shrink-0 flex flex-col">
          {/* ─── RESUME BANNER ─── */}
          {resumeBanner && !isReadOnly && (
            <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2.5">
              <p className="text-[11px] text-amber-300 leading-relaxed mb-2">
                You have unsaved progress from {resumeBanner.savedAt}. Resume
                from where you left off?
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
            readOnly={isReadOnly}
            totalRound2={round2Total}
            totalMax={totalMax}
            finalMarks={finalMarks}
            finalMarksRule={requestData?.finalMarksRule || 'higher'}
            rightTab={rightTab}
            hasModelAnswer={hasModelAnswer}
            questionPaperUrl={pdfsData.question_paper || null}
            modelAnswerUrl={pdfsData.model_answer || null}
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
            onEscalateFurther={() => setModalType('escalate')}
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
                <h3 className="text-base font-semibold text-white">
                  Incomplete recheck evaluation
                </h3>
              </div>
              <p className="text-sm text-slate-300 mb-3">
                You have not entered marks for all questions. Questions without
                marks:
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
                <p className="text-sm text-amber-300 font-mono">
                  {incompleteWarning.questions.join(', ')}
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
      {modalType === 'submit' && (
        <RecheckConfirmModal
          round1Total={round1Total}
          round2Total={round2Total}
          finalMarks={finalMarks}
          finalMarksRule={requestData?.finalMarksRule || 'higher'}
          totalMax={totalMax}
          studentName={studentName}
          rollNo={studentRoll}
          onConfirm={handleSubmitConfirm}
          onCancel={() => setModalType(null)}
        />
      )}

      {/* ─── ESCALATE MODAL ─── */}
      {modalType === 'escalate' && (
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
