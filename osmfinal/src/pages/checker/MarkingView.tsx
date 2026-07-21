// src/pages/checker/MarkingView.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import ThumbnailPanel from './components/ThumbnailPanel';
import SheetViewer from './components/SheetViewer';
import RightMarkPanel from './components/RightMarkPanel';
import ConfirmModal from './components/ConfirmModal';
import EscalateModal from './components/EscalateModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import assignmentService from '@/api/assignment';
import { API_URL } from '@/api/axios';
import { checkerApi } from '@/api/checker';

export type RightTab = 'marks' | 'questions' | 'answerSheet';

export interface SheetNote {
  id: number;
  page: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  width: number;
  height: number;
}

export interface MarkEntry {
  id: string;
  criterion: string;
  max: number;
  awarded: number;
  remark: string;
}

export type AnnotationTool =
  | 'handSelect'
  | 'tick'
  | 'cross'
  | 'pencil'
  | 'highlight'
  | 'eraser'
  | 'textNote'; // ✅ Fixed: semicolon removed, pipe added

export interface Annotation {
  id: number;
  tool: AnnotationTool;
  x: number;
  y: number;
  page: number;
  width?: number;
  height?: number;
}

export interface MarksStamp {
  markId: string;
  placed: boolean;
  x: number;
  y: number;
  page: number;
  value: number | null;
}

export type ModalType = 'escalate' | 'submitContinue' | 'submitExit' | null;

// ✅ DEFAULT BLANK PAGES - First 2 pages blank by default
const DEFAULT_BLANK_PAGES = new Set([1, 2]);

type ActionType = 'pencil' | 'annotation';

let annotationIdCounter = 1;
const QUESTIONS_PER_PAGE = 4;
const FALLBACK_TOTAL_PAGES = 1;

function buildInitialMarksFromScheme(
  markScheme: Record<string, { maxMarks: number; guidelines: string }>,
): MarkEntry[] {
  if (!markScheme || Object.keys(markScheme).length === 0) {
    return [];
  }

  return Object.entries(markScheme).map(([questionName, details]) => {
    const displayName = questionName.replace('Qn', '').replace('_', '');
    return {
      id: questionName,
      criterion: displayName,
      max: details.maxMarks || 0,
      awarded: 0,
      remark: '',
    };
  });
}

function buildInitialStampsFromMarks(marks: MarkEntry[]): MarksStamp[] {
  return marks.map((m) => ({
    markId: m.id,
    placed: false,
    x: 0,
    y: 0,
    page: 0,
    value: null,
  }));
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface DraftStorageData {
  sheetId: number;
  marks: {
    questionName: string;
    marks: number | null;
    stampX: number | null;
    stampY: number | null;
    stampPage: number | null;
    isComplete: boolean;
  }[];
  annotations: {
    id: number;
    tool: AnnotationTool;
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  }[];
  timerSeconds: number;
  savedAt: string;
}

export default function MarkingView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sheetId: sheetIdParam } = useParams<{ sheetId: string }>();
  const sheetIdNum = sheetIdParam ? parseInt(sheetIdParam, 10) : 0;
  const isReadOnly = searchParams.get('mode') === 'readonly';

  // ─── LOADING STATE ──────────────────────────────────────────
  const [loading, setLoading] = useState(true);

  // ─── API DATA STATE ─────────────────────────────────────────
  const [sheetData, setSheetData] = useState<any>(null);
  const [examData, setExamData] = useState<any>(null);
  const [markSchemeData, setMarkSchemeData] = useState<
    Record<string, { maxMarks: number; guidelines: string }>
  >({});
  const [pdfsData, setPdfsData] = useState<{
    model_answer: string | null;
    question_paper: string | null;
  }>({ model_answer: null, question_paper: null });

  // ─── MINIMUM TIME STATE ─────────────────────────────────────
  const [minTimeRequired, setMinTimeRequired] = useState(0); // minutes
  const [isTimeRequirementMet, setIsTimeRequirementMet] = useState(true);

  // ─── NOTES STATE ──────────────────────────────────────────────
  const [notes, setNotes] = useState<SheetNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
const noteIdCounterRef = useRef(1);

  // ─── BUILD MARKS FROM MARK SCHEME ───────────────────────────
  const initialMarks = useMemo(
    () => buildInitialMarksFromScheme(markSchemeData),
    [markSchemeData],
  );

  // ─── FETCH SHEET/EXAM/SCHEME/PDF DATA ───────────────────────
  useEffect(() => {
    const fetchData = async () => {
      if (!sheetIdNum) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await assignmentService.getSheetForMarking(sheetIdNum);

        if (response.success) {
          const data = response.data;

          const toFullUrl = (
            path: string | null | undefined,
          ): string | null => {
            if (!path) return null;
            if (path.startsWith('https://') || path.startsWith('http://'))
              return path;
            const cleanPath = path.startsWith('/') ? path : `/${path}`;
            return `${API_URL}${cleanPath}`;
          };

          setSheetData({
            ...data.sheet,
            file_url: toFullUrl(data.sheet?.file_url),
            is_submitted: data.sheet?.is_submitted || false,
          });
          setExamData(data.exam);
          setMarkSchemeData(data.markScheme || {});

          const modelAnswerPath = data.pdfs?.model_answer;
          const questionPaperPath = data.pdfs?.question_paper;

          console.log('📄 PDFs from API:', {
            model_answer: modelAnswerPath,
            question_paper: questionPaperPath,
          });

          setPdfsData({
            model_answer: toFullUrl(modelAnswerPath),
            question_paper: toFullUrl(questionPaperPath),
          });

          // ✅ FIX: spentTime already comes in minutes from backend
          const spentTime = data.exam?.spentTime || 0;
          console.log(`⏱️ Minimum time required: ${spentTime} minutes`);
          setMinTimeRequired(spentTime);
          setIsTimeRequirementMet(spentTime === 0);
        }
      } catch (error) {
        console.error('Fetch sheet error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sheetIdNum]);

  // ─── LOG PDF URLs AFTER SET ──────────────────────────────────
  useEffect(() => {
    console.log('📄 PDFs Data after set:', pdfsData);
  }, [pdfsData]);

  // ─── PAGE / TOOL / THUMBNAIL STATE ───────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('tick');
  const [thumbnailOpen, setThumbnailOpen] = useState(true);

  // ✅ FIXED: Only ONE declaration of blankPages with DEFAULT_BLANK_PAGES
  const [blankPages, setBlankPages] =
    useState<Set<number>>(DEFAULT_BLANK_PAGES);

  const [pdfPageImages, setPdfPageImages] = useState<Record<number, string>>(
    {},
  );
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [selectedThumbnails, setSelectedThumbnails] = useState<Set<number>>(
    new Set(),
  );
  const totalPages = pdfPageCount || FALLBACK_TOTAL_PAGES;

  // ─── RESET BLANK PAGES ────────────────────────────────────────
  const handleResetBlankPages = useCallback(() => {
    if (!window.confirm('Reset blank pages to default (first 2 pages)?')) {
      return;
    }
    setBlankPages(new Set([1, 2]));
    setToastMessage('Blank pages reset to default');
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  // ─── CLEAR ALL BLANK PAGES ───────────────────────────────────
  const handleClearAllBlank = useCallback(() => {
    if (!window.confirm('Clear all blank page markings?')) {
      return;
    }
    setBlankPages(new Set());
    setToastMessage('All blank page markings cleared');
    setTimeout(() => setToastMessage(null), 2000);
  }, []);

  // ─── MARKS ────────────────────────────────────────────────────
  const [marks, setMarks] = useState<MarkEntry[]>([]);
  useEffect(() => {
    if (initialMarks.length > 0) {
      setMarks(initialMarks);
    }
  }, [initialMarks]);

  // ─── STAMPS (click-to-place) ─────────────────────────────────
  const initialStamps = useMemo(
    () => buildInitialStampsFromMarks(initialMarks),
    [initialMarks],
  );
  const [stamps, setStamps] = useState<MarksStamp[]>([]);
  useEffect(() => {
    if (initialStamps.length > 0) {
      setStamps(initialStamps);
    }
  }, [initialStamps]);

  const [placingMarkId, setPlacingMarkId] = useState<string | null>(null);
  const [instructionBanner, setInstructionBanner] = useState<string | null>(
    null,
  );

  const stampsRef = useRef(stamps);
  useEffect(() => {
    stampsRef.current = stamps;
  }, [stamps]);

  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Track which marks have been explicitly entered
  const manuallySetMarksRef = useRef<Set<string>>(new Set());

  const visibleStamps = useMemo(() => stamps.filter((s) => s.placed), [stamps]);

  const totalAwarded = marks.reduce((sum, m) => sum + m.awarded, 0);
  const totalMax = marks.reduce((sum, m) => sum + m.max, 0);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [questionPage, setQuestionPage] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('marks');
  const [activeMarkId, setActiveMarkId] = useState<string | null>(
    initialMarks.length > 0 ? initialMarks[0].id : null,
  );
  const [hasPencilMarks, setHasPencilMarks] = useState(false);
  const [totalActions, setTotalActions] = useState(0);

  const [zoom, setZoom] = useState(100);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const annotationsRef = useRef(annotations);
  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

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

  // ─── RESUME: local-backup banner state (timer + offline safety net) ───
  const [resumeBanner, setResumeBanner] = useState<{ savedAt: string } | null>(
    null,
  );
  const [savedTimerSeconds, setSavedTimerSeconds] = useState(0);

  // ─── INCOMPLETE SUBMISSION WARNING ───
  const [incompleteWarning, setIncompleteWarning] = useState<{
    questions: string[];
    pendingType: 'submitContinue' | 'submitExit';
  } | null>(null);

  // ─── STAMP SELECTION / DRAG / CONTEXT MENU ───
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [dragStampId, setDragStampId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stampId?: string;
    annotationId?: number;
  } | null>(null);
  const isDraggingRef = useRef(false);

  // ─── ANNOTATION SELECTION / DRAG ───
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    number | null
  >(null);
  const [annotationDragId, setAnnotationDragId] = useState<number | null>(null);

  // ─── Eraser size ───
  const [eraserSize, setEraserSize] = useState(20);

  // ─── CROSS-PAGE MOVE ───
  const [pagePickerTarget, setPagePickerTarget] = useState<{
    type: 'stamp' | 'annotation';
    id: string | number;
  } | null>(null);
  const [dragOverThumbnailPage, setDragOverThumbnailPage] = useState<
    number | null
  >(null);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current[page];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ─── TIMER (persists across refresh via local backup) ────────
  const timerSecondsRef = useRef(0);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      timerSecondsRef.current += 1;
      setTimerDisplay(formatTime(timerSecondsRef.current));
      setElapsedSeconds(timerSecondsRef.current);
    }, 1000);
    setTimerStarted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── CHECK MINIMUM-TIME REQUIREMENT ──────────────────────────
  useEffect(() => {
    if (minTimeRequired > 0) {
      // minTimeRequired is in minutes, elapsedSeconds is in seconds
      const requiredSeconds = minTimeRequired * 60;
      setIsTimeRequirementMet(elapsedSeconds >= requiredSeconds);
    }
  }, [elapsedSeconds, minTimeRequired]);

  // ─── INTERNAL: persist a local backup (timer + offline safety net) ───
  const persistDraft = useCallback(
    (
      mks: MarkEntry[],
      stps: MarksStamp[],
      anns: Annotation[],
      sid: number,
      manualSet: Set<string>,
      timerSeconds: number,
    ) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const draftData: DraftStorageData = {
        sheetId: sid,
        marks: mks.map((m) => {
          const stamp = stps.find((s) => s.markId === m.id);
          return {
            questionName: m.id,
            marks: m.awarded,
            stampX: stamp?.placed ? stamp.x : null,
            stampY: stamp?.placed ? stamp.y : null,
            stampPage: stamp?.placed ? stamp.page : null,
            isComplete: manualSet.has(m.id),
          };
        }),
        annotations: anns.map((a) => ({
          id: a.id,
          tool: a.tool,
          x: a.x,
          y: a.y,
          page: a.page,
          width: a.width,
          height: a.height,
        })),
        timerSeconds,
        savedAt: now.toISOString(),
      };
      localStorage.setItem(`osm_draft_sheet_${sid}`, JSON.stringify(draftData));

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

  // ─── SAVE DRAFT: local backup first, then API sync ───────────
  const handleSaveDraft = useCallback(async () => {
    if (!sheetIdNum || isReadOnly) return;

    persistDraft(
      marksRef.current,
      stampsRef.current,
      annotationsRef.current,
      sheetIdNum,
      manuallySetMarksRef.current,
      timerSecondsRef.current,
    );

    const marksData: Record<string, number> = {};
    marksRef.current.forEach((m) => {
      marksData[m.id] = m.awarded;
    });

    const stampsData = stampsRef.current.map((s) => ({
      markId: s.markId,
      placed: s.placed,
      x: s.x,
      y: s.y,
      page: s.page,
      value: s.value,
    }));

    const annotationsData = annotationsRef.current.map((a) => ({
      id: a.id,
      tool: a.tool,
      x: a.x,
      y: a.y,
      page: a.page,
      width: a.width,
      height: a.height,
    }));

    const totalAwardedNow = marksRef.current.reduce(
      (sum, m) => sum + m.awarded,
      0,
    );

    try {
      const response = await checkerApi.saveDraft(sheetIdNum, {
        marksData,
        annotationsData,
        stampsData,
        totalMarks: totalAwardedNow,
        remarks: '',
      });
      if (!response?.success) {
        console.warn('Draft sync to server failed — local backup retained');
      }
    } catch (error) {
      console.error('Save draft (server) error:', error);
    }
  }, [sheetIdNum, isReadOnly, persistDraft]);

  const saveDraftRef = useRef(handleSaveDraft);
  useEffect(() => {
    saveDraftRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  // ─── SUBMIT MARKS TO API ─────────────────────────────────────
  const handleSubmitMarks = useCallback(
    async (type: 'continue' | 'exit') => {
      if (!sheetIdNum || isReadOnly) return;

      const marksData: Record<string, number> = {};
      marks.forEach((m) => {
        marksData[m.id] = m.awarded;
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

      const timeSpent = timerSecondsRef.current;

      const payload = {
        marksData,
        annotationsData,
        stampsData,
        totalMarks: totalAwarded,
        remarks: '',
        timeSpent,
      };

      try {
        const response = await checkerApi.submitMarks(sheetIdNum, payload);
        if (response.success) {
          localStorage.removeItem(`osm_draft_sheet_${sheetIdNum}`);
          setToastMessage('Marks submitted successfully!');
          setTimeout(() => {
            if (type === 'exit') {
              navigate('/checker');
            } else {
              navigate('/checker/queue');
            }
          }, 1500);
        } else {
          setToastMessage(response.message || 'Failed to submit marks');
          setTimeout(() => setToastMessage(null), 3000);
        }
      } catch (error) {
        console.error('Submit marks error:', error);
        setToastMessage('Failed to submit marks');
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [
      sheetIdNum,
      isReadOnly,
      marks,
      stamps,
      annotations,
      totalAwarded,
      navigate,
    ],
  );

  // ─── AUTO-SAVE: 30s interval + beforeunload ───
  useEffect(() => {
    if (isReadOnly) return;

    const interval = setInterval(() => {
      const isAlreadySubmitted = sheetData?.is_submitted || false;
      if (!isAlreadySubmitted) {
        saveDraftRef.current();
      }
    }, 30000);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (manuallySetMarksRef.current.size > 0) {
        saveDraftRef.current();
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isReadOnly, sheetData]);

  // ─── LOAD SERVER DRAFT / SUBMITTED MARKS ─────────────────────
  useEffect(() => {
    const loadServerData = async () => {
      if (!sheetIdNum || marks.length === 0) return;

      try {
        let response;
        if (isReadOnly) {
          response = await checkerApi.getSubmittedMarks(sheetIdNum);
        } else {
          response = await checkerApi.getDraft(sheetIdNum);
        }

        if (response?.success && response.data) {
          const data = response.data;

          if (data.marks_data && Object.keys(data.marks_data).length > 0) {
            const restoredMarks = marks.map((m) => {
              const draftValue = data.marks_data[m.id];
              return {
                ...m,
                awarded: draftValue !== undefined ? draftValue : 0,
              };
            });
            setMarks(restoredMarks);

            Object.keys(data.marks_data).forEach((id) => {
              if (data.marks_data[id] !== undefined) {
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
        console.error('Load server draft error:', error);
      } finally {
        checkLocalBackup();
      }
    };

    const checkLocalBackup = () => {
      if (timerStarted) return;
      const key = `osm_draft_sheet_${sheetIdNum}`;
      const raw = localStorage.getItem(key);
      if (!raw) {
        startTimer();
        return;
      }
      try {
        const draft: DraftStorageData = JSON.parse(raw);
        if (draft.marks && draft.marks.length > 0) {
          const savedTime = new Date(draft.savedAt);
          const timeLabel = savedTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
          setSavedTimerSeconds(draft.timerSeconds || 0);
          setResumeBanner({ savedAt: timeLabel });
          setToastMessage(
            'You have an unsaved local draft — use Resume to continue',
          );
          setTimeout(() => setToastMessage(null), 4000);
        } else {
          startTimer();
        }
      } catch {
        startTimer();
      }
    };

    loadServerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetIdNum, isReadOnly, marks.length]);

  const handleResume = useCallback(() => {
    const key = `osm_draft_sheet_${sheetIdNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const draft: DraftStorageData = JSON.parse(raw);
      const restoredMarks = marks.map((m) => {
        const d = draft.marks.find((dm) => dm.questionName === m.id);
        if (d && d.marks !== null) {
          return { ...m, awarded: d.marks };
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
            value: d.marks,
          };
        }
        return s;
      });

      const manualSet = new Set<string>();
      draft.marks.forEach((d) => {
        if (d.isComplete) manualSet.add(d.questionName);
      });
      manuallySetMarksRef.current = manualSet;

      if (draft.annotations && draft.annotations.length > 0) {
        setAnnotations(draft.annotations);
        const maxId = Math.max(...draft.annotations.map((a) => a.id), 0);
        annotationIdCounter = maxId + 1;
      }

      const savedSecs = draft.timerSeconds || 0;
      timerSecondsRef.current = savedSecs;

      setMarks(restoredMarks);
      setStamps(restoredStamps);
      setResumeBanner(null);

      startTimer();

      const savedTime = new Date(draft.savedAt);
      const timeLabel = savedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setToastMessage(
        `Resumed from last save at ${timeLabel} — Total time spent: ${formatTime(savedSecs)}`,
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setResumeBanner(null);
    }
  }, [sheetIdNum, marks, stamps, startTimer]);

  const handleStartFresh = useCallback(() => {
    localStorage.removeItem(`osm_draft_sheet_${sheetIdNum}`);
    setResumeBanner(null);
    manuallySetMarksRef.current = new Set();
    timerSecondsRef.current = 0;
    startTimer();
  }, [sheetIdNum, startTimer]);

  // ─── Stamp interaction handlers ───
  const handleSelectStamp = useCallback((stampId: string) => {
    setSelectedStampId(stampId);
    setContextMenu(null);
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedStampId(null);
    setSelectedAnnotationId(null);
    setContextMenu(null);
  }, []);

  const handleEnterDragMode = useCallback((stampId: string) => {
    setDragStampId(stampId);
    setSelectedStampId(stampId);
    setContextMenu(null);
    isDraggingRef.current = false;
  }, []);

  const handleStampDragStart = useCallback((_stampId: string) => {}, []);

  const handleStampDragEnd = useCallback((_stampId: string) => {
    isDraggingRef.current = false;
    setDragStampId(null);
    setToastMessage('Mark position updated');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleStampContextMenu = useCallback(
    (stampId: string, clientX: number, clientY: number) => {
      setContextMenu({ x: clientX, y: clientY, stampId });
      setSelectedStampId(stampId);
    },
    [],
  );

  const handleRemoveStamp = useCallback((id: string) => {
    setStamps((prev) =>
      prev.map((s) =>
        s.markId === id
          ? { ...s, placed: false, x: 0, y: 0, page: 0, value: null }
          : s,
      ),
    );
    setMarks((prev) =>
      prev.map((m) => (m.id === id ? { ...m, awarded: 0 } : m)),
    );
    manuallySetMarksRef.current.delete(id);
    setSelectedStampId(null);
    setContextMenu(null);
    setToastMessage('Mark removed — click on sheet to reposition');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // ─── Annotation interaction handlers ───
  const handleAnnotationSelect = useCallback((id: number) => {
    setSelectedAnnotationId(id);
    setSelectedStampId(null);
    setContextMenu(null);
  }, []);

  const handleAnnotationDeselect = useCallback(() => {
    setSelectedAnnotationId(null);
  }, []);

  const handleAnnotationDragStart = useCallback((_id: number) => {}, []);

  const handleAnnotationDragEnd = useCallback((_id: number) => {
    setAnnotationDragId(null);
    setToastMessage('Annotation moved');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleAnnotationReposition = useCallback(
    (id: number, page: number, x: number, y: number) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, page, x, y } : a)),
      );
    },
    [],
  );

  const handleAnnotationDelete = useCallback((id: number) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnnotationId(null);
    setContextMenu(null);
    setToastMessage('Annotation removed');
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleAnnotationContextMenu = useCallback(
    (annotationId: number, clientX: number, clientY: number) => {
      setContextMenu({ x: clientX, y: clientY, annotationId });
      setSelectedAnnotationId(annotationId);
      setSelectedStampId(null);
    },
    [],
  );

  // ─── Cross-page move handler ───
  const handleMoveItemToPage = useCallback(
    (type: 'stamp' | 'annotation', id: string | number, targetPage: number) => {
      if (type === 'stamp') {
        const stampId = id as string;
        setStamps((prev) =>
          prev.map((s) =>
            s.markId === stampId ? { ...s, page: targetPage, x: 50, y: 30 } : s,
          ),
        );
        setToastMessage(
          `Stamp moved to Page ${targetPage} — drag to reposition`,
        );
        scrollToPage(targetPage);
      } else {
        const annotId = id as number;
        setAnnotations((prev) =>
          prev.map((a) =>
            a.id === annotId ? { ...a, page: targetPage, x: 50, y: 30 } : a,
          ),
        );
        setToastMessage(`Annotation moved to Page ${targetPage}`);
        scrollToPage(targetPage);
      }
      setPagePickerTarget(null);
      setContextMenu(null);
      setTimeout(() => setToastMessage(null), 3000);
    },
    [scrollToPage],
  );

 const handleNoteAdd = useCallback((page: number, x: number, y: number) => {
   noteIdCounterRef.current += 1;
   const newNote: SheetNote = {
     id: noteIdCounterRef.current,
     page,
     x,
     y,
     text: '',
     fontSize: 12,
     width: 200,
     height: 100,
   };
   setNotes((prev) => [...prev, newNote]);
   setEditingNoteId(newNote.id);
 }, []);

const handleNoteUpdate = useCallback(
  (id: number, updates: Partial<SheetNote>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    );
  },
  [],
);
 const handleNoteDelete = useCallback(
   (id: number) => {
     setNotes((prev) => {
       const updated = prev.filter((n) => n.id !== id);
       // If we're editing the deleted note, clear editing state
       if (editingNoteId === id) {
         setEditingNoteId(null);
       }
       return updated;
     });
   },
   [editingNoteId],
 );

  // ─── Keyboard handler ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'h' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setActiveTool('handSelect');
        setToastMessage('Hand Select — click to select, drag to move');
        setTimeout(() => setToastMessage(null), 2000);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        if (selectedStampId) {
          e.preventDefault();
          const stamp = stampsRef.current.find(
            (s) => s.markId === selectedStampId,
          );
          if (stamp && stamp.placed) {
            handleRemoveStamp(selectedStampId);
          }
          return;
        }
        if (selectedAnnotationId) {
          e.preventDefault();
          handleAnnotationDelete(selectedAnnotationId);
          return;
        }
      }
      if (e.key === 'Escape') {
        setSelectedStampId(null);
        setDragStampId(null);
        setSelectedAnnotationId(null);
        setAnnotationDragId(null);
        setContextMenu(null);
        setPagePickerTarget(null);
        isDraggingRef.current = false;
        setPlacingMarkId(null);
        setInstructionBanner(null);
        if (editingNoteId !== null) {
          setEditingNoteId(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedStampId,
    selectedAnnotationId,
    handleRemoveStamp,
    handleAnnotationDelete,
    editingNoteId,
  ]);

  // ─── Close context menu on outside click ───
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // ─── Toolbar handlers ───
  const handleToolSelect = useCallback((tool: AnnotationTool) => {
    setActiveTool(tool);
    setPlacingMarkId(null);
    setInstructionBanner(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 15, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 15, 50));
  }, []);

  const FIT_PRESETS = [75, 100, 125, 150, 200];

  const handleFitWidth = useCallback(() => {
    setZoom((prev) => {
      const idx = FIT_PRESETS.indexOf(prev);
      return idx !== -1 ? FIT_PRESETS[(idx + 1) % FIT_PRESETS.length] : 100;
    });
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
      setCurrentPage(page);
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
    if (selectedThumbnails.size === 0) {
      setToastMessage('No pages selected');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    setBlankPages((prev) => {
      const next = new Set(prev);
      const newlyMarked: number[] = [];
      const unmarked: number[] = [];

      selectedThumbnails.forEach((p) => {
        if (next.has(p)) {
          next.delete(p);
          unmarked.push(p);
        } else {
          next.add(p);
          newlyMarked.push(p);
        }
      });

      if (newlyMarked.length > 0) {
        setToastMessage(
          `Marked ${newlyMarked.length} page${newlyMarked.length > 1 ? 's' : ''} as blank`,
        );
      } else if (unmarked.length > 0) {
        setToastMessage(
          `Unmarked ${unmarked.length} page${unmarked.length > 1 ? 's' : ''} as blank`,
        );
      }
      setTimeout(() => setToastMessage(null), 2500);
      return next;
    });

    setSelectedThumbnails(new Set());
  }, [selectedThumbnails]);

  const handleActiveMarkChange = useCallback((id: string) => {
    setActiveMarkId(id);
    setPlacingMarkId(id);
    setInstructionBanner(`Click on sheet to place mark position for ${id}`);
  }, []);

  const handleSheetClickForPlacement = useCallback(
    (page: number, xPercent: number, yPercent: number) => {
      if (isReadOnly || !placingMarkId) return;
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
    },
    [isReadOnly, placingMarkId],
  );

  const handleDismissBanner = useCallback(() => {
    setPlacingMarkId(null);
    setInstructionBanner(null);
  }, []);

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

const handleClearStampValue = useCallback((markId: string) => {
  setStamps((prev) =>
    prev.map((s) => (s.markId === markId ? { ...s, value: null } : s)),
  );
  setMarks((prev) =>
    prev.map((m) => (m.id === markId ? { ...m, awarded: 0 } : m)),
  );
  // ✅ Don't delete from manuallySetMarksRef - keep it as "touched"
  // manuallySetMarksRef.current.delete(markId); // ❌ Remove this line
}, []);

  const handleRequestAddMark = useCallback(
    (markId: string, value: number) => {
      const stamp = stampsRef.current.find((s) => s.markId === markId);
      if (!stamp || !stamp.placed) {
        setToastMessage('Please click on sheet to place position first');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }

      setStamps((prev) =>
        prev.map((s) => (s.markId === markId ? { ...s, value } : s)),
      );
      setMarks((prev) =>
        prev.map((m) => (m.id === markId ? { ...m, awarded: value } : m)),
      );

      manuallySetMarksRef.current.add(markId);

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

  const handleMarkUpdate = useCallback((id: string, awarded: number) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, awarded } : m)));
    // ✅ Mark as complete even if awarded is 0 (user has "touched" this question)
    manuallySetMarksRef.current.add(id);
  }, []);

  const handleRemarkUpdate = useCallback((id: string, remark: string) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, remark } : m)));
  }, []);

  const checkIncomplete = useCallback((): string[] => {
    return marks
      .filter((m) => !manuallySetMarksRef.current.has(m.id))
      .map((m) => m.criterion);
  }, [marks]);

  // ─── SUBMIT: min-time check → incomplete check → confirm modal ───
  const handleSubmitClick = useCallback(
    (type: 'submitContinue' | 'submitExit') => {
      const requiredSeconds = minTimeRequired * 60;
      if (minTimeRequired > 0 && timerSecondsRef.current < requiredSeconds) {
        const remaining = requiredSeconds - timerSecondsRef.current;
        const remainingMinutes = Math.ceil(remaining / 60);
        setToastMessage(
          `⚠️ Please spend at least ${minTimeRequired} minutes. ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} remaining.`,
        );
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }

      const incomplete = checkIncomplete();
      if (incomplete.length > 0) {
        setIncompleteWarning({ questions: incomplete, pendingType: type });
        return;
      }
      setModalType(type);
    },
    [checkIncomplete, minTimeRequired],
  );

  const handleEscalateClick = useCallback(() => {
    const requiredSeconds = minTimeRequired * 60;
    if (minTimeRequired > 0 && timerSecondsRef.current < requiredSeconds) {
      const remaining = requiredSeconds - timerSecondsRef.current;
      const remainingMinutes = Math.ceil(remaining / 60);
      setToastMessage(
        `⚠️ Please spend at least ${minTimeRequired} minutes before escalating. ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} remaining.`,
      );
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    setModalType('escalate');
  }, [minTimeRequired]);

  const handleIncompleteGoBack = useCallback(() => {
    setIncompleteWarning(null);
  }, []);

  const handleIncompleteSubmitAnyway = useCallback(() => {
    if (incompleteWarning) {
      const pending = incompleteWarning.pendingType;
      setIncompleteWarning(null);
      handleSubmitMarks(pending === 'submitContinue' ? 'continue' : 'exit');
    }
  }, [incompleteWarning, handleSubmitMarks]);

  const handleModalConfirm = useCallback(async () => {
    const pending = modalType;
    setModalType(null);
    if (pending === 'submitContinue' || pending === 'submitExit') {
      await handleSubmitMarks(
        pending === 'submitContinue' ? 'continue' : 'exit',
      );
    }
  }, [modalType, handleSubmitMarks]);

  const handleEscalateConfirm = useCallback(
    async (data: { reason: string; escalateType: string; remarks: string }) => {
      if (!sheetIdNum) {
        setToastMessage('Sheet ID not found');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      try {
        const response = await checkerApi.escalateSheet(sheetIdNum, {
          reason: data.reason,
          escalateType: data.escalateType,
          remarks: data.remarks,
        });

        if (response.success) {
          setModalType(null);
          setToastMessage('✅ Sheet escalated successfully');
          setTimeout(() => setToastMessage(null), 2500);
          setTimeout(() => navigate('/checker/queue'), 1500);
        } else {
          setToastMessage(response.message || 'Failed to escalate sheet');
          setTimeout(() => setToastMessage(null), 3000);
        }
      } catch (error: any) {
        console.error('Escalate error:', error);
        setToastMessage(error.message || 'Failed to escalate sheet');
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [sheetIdNum, navigate],
  );

  const handleRightTabChange = useCallback((tab: RightTab) => {
    setRightTab(tab);
  }, []);

  const hasModelAnswer = !!pdfsData.model_answer;

  const toolbarTools: { tool: AnnotationTool; icon: string; label: string }[] =
    [
      { tool: 'handSelect', icon: 'ri-hand', label: 'Select & Move (H)' },
      { tool: 'tick', icon: 'ri-check-line', label: 'Tick' },
      { tool: 'cross', icon: 'ri-close-line', label: 'Cross' },
      { tool: 'pencil', icon: 'ri-pencil-line', label: 'Pencil' },
      { tool: 'highlight', icon: 'ri-mark-pen-line', label: 'Highlight' },
      { tool: 'eraser', icon: 'ri-eraser-line', label: 'Eraser' },
      { tool: 'textNote', icon: 'ri-sticky-note-line', label: 'Note' }, // ✅ Added
    ];

  // ─── LOADING ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <LoadingSpinner fullPage />
      </div>
    );
  }

  // ─── PAGE ANNOTATION STATUS ───────────────────────────────────
  const isPageAnnotated = (page: number) => {
    if (blankPages.has(page)) return true;
    if (annotations.some((ann) => ann.page === page)) return true;
    if (stamps.some((stamp) => stamp.page === page && stamp.placed))
      return true;
    return false;
  };

  const annotatedPagesCount = Array.from(
    { length: totalPages },
    (_, i) => i + 1,
  ).filter(isPageAnnotated).length;

  const examName = examData
    ? `${examData.name} — ${examData.subject}`
    : 'Loading...';

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f172a]">
      {/* ─── TOP BAR ─── */}
      <header className="h-11 shrink-0 bg-[#0f172a] text-white flex items-center justify-between px-4 text-[13px] select-none">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">{examName}</span>
          <span className="text-slate-400">
            Page <span className="text-white font-medium">{currentPage}</span>{' '}
            of {totalPages}
          </span>
          {minTimeRequired > 0 && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                isTimeRequirementMet
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <i
                className={`${isTimeRequirementMet ? 'ri-check-line' : 'ri-timer-line'} text-xs`}
              ></i>
              {isTimeRequirementMet
                ? `✅ Min time ${minTimeRequired}m met`
                : `⏱️ ${Math.floor(elapsedSeconds / 60)}/${minTimeRequired}m required`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 flex items-center justify-center text-emerald-400">
              <i className="ri-timer-line text-xs"></i>
            </span>
            <span className="font-mono text-emerald-400 tabular-nums">
              {timerDisplay}
            </span>
          </div>
          <span className="text-slate-400">
            Maximum Marks:{' '}
            <span className="text-white font-semibold">{totalMax}</span>
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
            title={`Cycle Zoom — next: ${FIT_PRESETS[(FIT_PRESETS.indexOf(zoom) + 1) % FIT_PRESETS.length] ?? 100}%`}
          >
            <i className="ri-aspect-ratio-line text-sm"></i>
          </button>

          <span className="text-[10px] text-slate-400 font-mono tabular-nums leading-none mt-0.5">
            {zoom}%
          </span>

          {!isReadOnly && (
            <>
              <div className="w-5 h-px bg-slate-600 my-1.5" />

              {toolbarTools.map(({ tool, icon, label }) => {
                const isSelectedAnnotTool =
                  activeTool === 'handSelect' &&
                  selectedAnnotationId &&
                  annotations.find((a) => a.id === selectedAnnotationId)
                    ?.tool === tool;
                const isActive = activeTool === tool || isSelectedAnnotTool;
                return (
                  <button
                    key={tool}
                    onClick={() => handleToolSelect(tool)}
                    className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                      isActive
                        ? tool === 'eraser'
                          ? 'bg-rose-500/25 text-rose-400'
                          : 'bg-sky-500/25 text-sky-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={label}
                  >
                    <i className={`${icon} text-sm`}></i>
                  </button>
                );
              })}

              {/* ─── Eraser size controls ─── */}
              {activeTool === 'eraser' && (
                <>
                  <button
                    onClick={() =>
                      setEraserSize((prev) => Math.max(10, prev - 5))
                    }
                    className="w-7 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors text-[10px]"
                    title="Decrease eraser size"
                  >
                    −
                  </button>
                  <span className="text-[9px] text-rose-400 font-mono tabular-nums leading-none select-none">
                    {eraserSize}
                  </span>
                  <button
                    onClick={() =>
                      setEraserSize((prev) => Math.min(50, prev + 5))
                    }
                    className="w-7 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors text-[10px]"
                    title="Increase eraser size"
                  >
                    +
                  </button>
                </>
              )}

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
                onClick={() => {
                  if (selectedStampId) {
                    handleRemoveStamp(selectedStampId);
                    setSelectedStampId(null);
                    setToastMessage('Stamp removed');
                    setTimeout(() => setToastMessage(null), 2500);
                  } else if (selectedAnnotationId) {
                    setAnnotations((prev) =>
                      prev.filter((a) => a.id !== selectedAnnotationId),
                    );
                    setSelectedAnnotationId(null);
                    setToastMessage('Annotation removed');
                    setTimeout(() => setToastMessage(null), 2500);
                  }
                }}
                disabled={!selectedStampId && !selectedAnnotationId}
                className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                style={{
                  opacity: selectedStampId || selectedAnnotationId ? 1 : 0.3,
                  cursor:
                    selectedStampId || selectedAnnotationId
                      ? 'pointer'
                      : 'not-allowed',
                  pointerEvents:
                    selectedStampId || selectedAnnotationId ? 'auto' : 'none',
                  color:
                    selectedStampId || selectedAnnotationId
                      ? '#DC2626'
                      : undefined,
                  backgroundColor:
                    selectedStampId || selectedAnnotationId
                      ? '#FEE2E2'
                      : 'transparent',
                }}
                title={
                  selectedStampId || selectedAnnotationId
                    ? 'Delete selected item'
                    : 'Select a stamp, tick, or cross first'
                }
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
            onResetBlank={handleResetBlankPages}
            onClearAllBlank={handleClearAllBlank}
            totalPages={totalPages}
            pdfPageImages={pdfPageImages}
            pdfPageCount={pdfPageCount}
            isPdfMode={!!sheetData?.file_url}
            dragOverPage={dragOverThumbnailPage}
          />
        )}

        {/* ─── SHEET VIEWER ─── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <SheetViewer
            ref={sheetViewerRef}
            currentPage={currentPage}
            totalPages={totalPages}
            blankPages={blankPages}
            onPageChange={setCurrentPage}
            zoom={zoom}
            activeTool={activeTool}
            annotations={annotations}
            stamps={visibleStamps}
            activeMarkId={activeMarkId}
            placingMarkId={placingMarkId}
            instructionBanner={instructionBanner}
            selectedStampId={selectedStampId}
            dragStampId={dragStampId}
            selectedAnnotationId={selectedAnnotationId}
            annotationDragId={annotationDragId}
            pdfUrl={sheetData?.file_url || null}
            // ─── NOTES PROPS ─────────────────────────────────────────────
            notes={notes}
            editingNoteId={editingNoteId}
            onNoteAdd={handleNoteAdd}
            onNoteUpdate={handleNoteUpdate}
            onNoteDelete={handleNoteDelete}
            onEditingNoteChange={setEditingNoteId}
            // ─── REST OF PROPS ──────────────────────────────────────────
            onAnnotationAdd={handleAnnotationAdd}
            onAnnotationDelete={handleAnnotationDelete}
            onEraserNoHit={handleEraserNoHit}
            onPencilStroke={handlePencilStroke}
            onSheetClickForPlacement={handleSheetClickForPlacement}
            onStampReposition={handleStampReposition}
            onDismissBanner={handleDismissBanner}
            onStampSelect={handleSelectStamp}
            onStampDeselect={handleDeselectAll}
            onStampDoubleClick={handleEnterDragMode}
            onStampRemove={handleRemoveStamp}
            onStampDragStart={handleStampDragStart}
            onStampDragEnd={handleStampDragEnd}
            onSheetBackgroundClick={handleDeselectAll}
            onStampContextMenu={handleStampContextMenu}
            onAnnotationSelect={handleAnnotationSelect}
            onAnnotationDeselect={handleAnnotationDeselect}
            onAnnotationReposition={handleAnnotationReposition}
            onAnnotationDragStart={handleAnnotationDragStart}
            onAnnotationDragEnd={handleAnnotationDragEnd}
            onAnnotationContextMenu={handleAnnotationContextMenu}
            onAnnotationDeleteRequest={handleAnnotationDelete}
            onMoveItemToPage={handleMoveItemToPage}
            onDragOverThumbnailChange={setDragOverThumbnailPage}
            onPageRender={(pageNum: number, imageData: string) => {
              setPdfPageImages((prev) => ({ ...prev, [pageNum]: imageData }));
            }}
            onPageCount={(count: number) => {
              setPdfPageCount(count);
            }}
            pageRefs={pageRefs}
            scrollToPage={scrollToPage}
            eraserSize={eraserSize}
          />

          {/* ─── BOTTOM PAGINATION BAR ─── */}
          <div className="h-[60px] shrink-0 bg-[#1e293b] flex flex-col border-t border-slate-700 select-none z-[40]">
            <div className="flex-1 flex items-center overflow-x-auto overflow-y-hidden w-full custom-scrollbar">
              <div className="flex items-center gap-1.5 min-w-max px-3 mx-auto md:justify-center">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="flex items-center justify-center flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer mr-1"
                  title="Previous Page"
                >
                  <i className="ri-arrow-left-s-line text-lg" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    const annotated = isPageAnnotated(page);
                    const isActive = page === currentPage;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded text-xs sm:text-[13px] font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-sky-500 text-white shadow-sm'
                            : 'bg-[#334155] text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {page}
                        <span
                          className={`absolute bottom-1 right-1 w-1.5 h-1.5 sm:w-[5px] sm:h-[5px] rounded-full shadow-sm ${
                            annotated ? 'bg-emerald-400' : 'bg-amber-500'
                          }`}
                        />
                      </button>
                    );
                  },
                )}

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="flex items-center justify-center flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer ml-1"
                  title="Next Page"
                >
                  <i className="ri-arrow-right-s-line text-lg" />
                </button>
              </div>
            </div>
            <div className="h-6 shrink-0 flex items-center justify-center text-[10px] sm:text-[11px] font-medium text-amber-500/90 bg-[#151c28] border-t border-slate-700/50">
              <i className="ri-error-warning-fill mr-1.5 text-xs"></i>
              Pages annotated: {annotatedPagesCount} / {totalPages}
            </div>
          </div>
        </div>

        {/* ─── RIGHT SIDE: Resume banner + Mark Panel ─── */}
        <div className="w-[255px] shrink-0 flex flex-col">
          {resumeBanner && (
            <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-3 py-2.5">
              <p className="text-[11px] text-amber-300 leading-relaxed mb-2">
                You have unsaved local progress from {resumeBanner.savedAt}
                {savedTimerSeconds > 0 &&
                  ` — Total time spent: ${formatTime(savedTimerSeconds)}`}
                . Resume from where you left off?
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

          <RightMarkPanel
            marks={marks}
            activeMarkId={activeMarkId}
            questionPage={questionPage}
            totalAwarded={totalAwarded}
            totalMax={totalMax}
            rightTab={rightTab}
            hasModelAnswer={hasModelAnswer}
            readOnly={isReadOnly}
            saveIndicatorText={saveIndicatorText}
            saveIndicatorFresh={saveIndicatorFresh}
            questionPaperUrl={pdfsData.question_paper || null}
            modelAnswerUrl={pdfsData.model_answer || null}
            minTimeRequired={minTimeRequired}
            isTimeRequirementMet={isTimeRequirementMet}
            onActiveMarkChange={handleActiveMarkChange}
            onQuestionPageChange={setQuestionPage}
            onMarkUpdate={handleMarkUpdate}
            onRemarkUpdate={handleRemarkUpdate}
            onRequestAddMark={handleRequestAddMark}
            onClearStampValue={handleClearStampValue}
            onRightTabChange={handleRightTabChange}
            onEscalate={handleEscalateClick}
            onSubmitContinue={() => handleSubmitClick('submitContinue')}
            onSubmitExit={() => handleSubmitClick('submitExit')}
          />
        </div>
      </div>

      {/* ─── CONTEXT MENU ─── */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg overflow-hidden shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            minWidth: '180px',
          }}
        >
          {contextMenu.stampId && (
            <>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnterDragMode(contextMenu.stampId!);
                }}
              >
                <span className="text-blue-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-drag-move-line"></i>
                </span>
                <span className="text-gray-800">Move to new position</span>
              </div>
              <div
                style={{
                  height: '0.5px',
                  backgroundColor: '#E5E7EB',
                  margin: '0 14px',
                }}
              />
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveStamp(contextMenu.stampId!);
                }}
              >
                <span className="text-red-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-line"></i>
                </span>
                <span className="text-gray-800">Remove mark position</span>
              </div>
              <div
                style={{
                  height: '0.5px',
                  backgroundColor: '#E5E7EB',
                  margin: '0 14px',
                }}
              />
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu(null);
                  setSelectedStampId(contextMenu.stampId!);
                  setActiveMarkId(contextMenu.stampId!);
                }}
              >
                <span className="text-indigo-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-edit-line"></i>
                </span>
                <span className="text-gray-800">Change value</span>
              </div>
              <div
                style={{
                  height: '0.5px',
                  backgroundColor: '#E5E7EB',
                  margin: '0 14px',
                }}
              />
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPagePickerTarget({
                    type: 'stamp',
                    id: contextMenu.stampId!,
                  });
                }}
              >
                <span className="text-emerald-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-copy-line"></i>
                </span>
                <span className="text-gray-800">Move to different page</span>
              </div>
            </>
          )}

          {contextMenu.annotationId !== undefined && (
            <>
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAnnotationDragId(contextMenu.annotationId!);
                  setContextMenu(null);
                }}
              >
                <span className="text-blue-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-drag-move-line"></i>
                </span>
                <span className="text-gray-800">Move to new position</span>
              </div>
              <div
                style={{
                  height: '0.5px',
                  backgroundColor: '#E5E7EB',
                  margin: '0 14px',
                }}
              />
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnnotationDelete(contextMenu.annotationId!);
                }}
              >
                <span className="text-red-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-close-line"></i>
                </span>
                <span className="text-gray-800">Remove annotation</span>
              </div>
              <div
                style={{
                  height: '0.5px',
                  backgroundColor: '#E5E7EB',
                  margin: '0 14px',
                }}
              />
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ padding: '9px 14px', fontSize: '12px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPagePickerTarget({
                    type: 'annotation',
                    id: contextMenu.annotationId!,
                  });
                }}
              >
                <span className="text-emerald-600 w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-copy-line"></i>
                </span>
                <span className="text-gray-800">Move to different page</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── PAGE PICKER MODAL ─── */}
      {pagePickerTarget && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
          <div className="bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl w-[340px] max-w-[95vw] overflow-hidden">
            <div className="px-5 py-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Move{' '}
                {pagePickerTarget.type === 'stamp' ? 'stamp' : 'annotation'} to
                which page?
              </h3>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() =>
                        handleMoveItemToPage(
                          pagePickerTarget.type,
                          pagePickerTarget.id,
                          p,
                        )
                      }
                      className="w-11 h-8 rounded text-xs flex items-center justify-center text-slate-300 hover:bg-sky-500/20 hover:text-sky-400 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {p}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setPagePickerTarget(null)}
                  className="px-4 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Incomplete evaluation
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
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-500 cursor-pointer transition-colors whitespace-nowrap"
                >
                  Go back and complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM MODAL ─── */}
      {(modalType === 'submitContinue' || modalType === 'submitExit') && (
        <ConfirmModal
          type={modalType}
          totalAwarded={totalAwarded}
          totalMax={totalMax}
          onConfirm={handleModalConfirm}
          onCancel={() => setModalType(null)}
        />
      )}

      {/* ─── ESCALATE MODAL ─── */}
      {modalType === 'escalate' && (
        <EscalateModal
          totalAwarded={totalAwarded}
          totalMax={totalMax}
          studentName={sheetData?.student_name || '—'}
          rollNo={sheetData?.roll_no || '—'}
          sheetId={sheetIdNum}
          onEscalate={handleEscalateConfirm}
          onCancel={() => setModalType(null)}
        />
      )}
    </div>
  );
}
