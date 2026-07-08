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

export interface MarkEntry {
  id: string;
  criterion: string;
  max: number;
  awarded: number;
  remark: string;
}

export type AnnotationTool =
  | 'tick'
  | 'cross'
  | 'pencil'
  | 'highlight'
  | 'eraser';

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

type ActionType = 'pencil' | 'annotation';

const TOTAL_PAGES = 18;
let annotationIdCounter = 1;
const QUESTIONS_PER_PAGE = 4;

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

  // ─── API DATA STATE ──────────────────────────────────────────

  const [sheetData, setSheetData] = useState<any>(null);
  const [examData, setExamData] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
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

  // ─── MINIMUM TIME STATE ──────────────────────────────────────

  const [minTimeRequired, setMinTimeRequired] = useState(0);
  const [isTimeRequirementMet, setIsTimeRequirementMet] = useState(true);

  // ─── BUILD MARKS FROM MARK SCHEME ────────────────────────────

  const initialMarks = useMemo(() => {
    return buildInitialMarksFromScheme(markSchemeData);
  }, [markSchemeData]);

  // ─── FETCH DATA ──────────────────────────────────────────────

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
            if (path.startsWith('http://') || path.startsWith('https://'))
              return path;
            return `${API_URL}${path}`;
          };

          setSheetData({
            ...data.sheet,
            file_url: toFullUrl(data.sheet?.file_url),
            is_submitted: data.sheet?.is_submitted || false,
          });
          setExamData(data.exam);
          setMarkSchemeData(data.markScheme || {});
          setPdfsData({
            model_answer: toFullUrl(data.pdfs?.model_answer),
            question_paper: toFullUrl(data.pdfs?.question_paper),
          });

          // ✅ Set minimum time requirement
          const spentTime = data.exam?.spentTime || 0;
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

  // ─── CHECK TIME REQUIREMENT ──────────────────────────────────

  useEffect(() => {
    if (minTimeRequired > 0) {
      const requiredSeconds = minTimeRequired * 60;
      const met = elapsed >= requiredSeconds;
      setIsTimeRequirementMet(met);
    }
  }, [elapsed, minTimeRequired]);

  // ─── State ───

  const [currentPage, setCurrentPage] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('tick');
  const [thumbnailOpen, setThumbnailOpen] = useState(true);
  const [blankPages, setBlankPages] = useState<Set<number>>(new Set([]));
  const [pdfPageImages, setPdfPageImages] = useState<Record<number, string>>(
    {},
  );
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [selectedThumbnails, setSelectedThumbnails] = useState<Set<number>>(
    new Set(),
  );
  const [marks, setMarks] = useState<MarkEntry[]>([]);

  // ─── INITIALIZE MARKS FROM MARK SCHEME ──────────────────────

  useEffect(() => {
    if (initialMarks.length > 0) {
      console.log(
        '📋 Initializing marks from mark scheme:',
        initialMarks.length,
      );
      setMarks(initialMarks);
    }
  }, [initialMarks]);

  // ─── Click-to-place stamp state ───

  const initialStamps = useMemo(() => {
    return buildInitialStampsFromMarks(initialMarks);
  }, [initialMarks]);

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

  // ─── LOAD DRAFT OR SUBMITTED DATA ─────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      if (!sheetIdNum || marks.length === 0) {
        console.log('⏳ Skipping data load - marks not initialized:', {
          sheetIdNum,
          marksLength: marks.length,
        });
        return;
      }

      console.log(
        '📥 Loading data for sheet:',
        sheetIdNum,
        'readOnly:',
        isReadOnly,
      );

      try {
        let response;

        if (isReadOnly) {
          console.log('📥 Fetching submitted marks (readonly mode)...');
          response = await checkerApi.getSubmittedMarks(sheetIdNum);
          console.log('📥 Submitted marks response:', response);
        } else {
          console.log('📥 Fetching draft (edit mode)...');
          response = await checkerApi.getDraft(sheetIdNum);
          console.log('📥 Draft response:', response);
        }

        if (response.success && response.data) {
          const data = response.data;
          console.log('📊 Data loaded:', data);

          if (data.marks_data && Object.keys(data.marks_data).length > 0) {
            console.log('📊 Marks data:', data.marks_data);

            const restoredMarks = marks.map((m) => {
              const draftValue = data.marks_data[m.id];
              return {
                ...m,
                awarded: draftValue !== undefined ? draftValue : 0,
              };
            });

            console.log('📊 Restored marks:', restoredMarks);
            setMarks(restoredMarks);

            Object.keys(data.marks_data).forEach((id) => {
              if (data.marks_data[id] !== undefined) {
                manuallySetMarksRef.current.add(id);
              }
            });
            console.log('✅ manuallySetMarksRef:', manuallySetMarksRef.current);
          }

          if (data.stamps_data && data.stamps_data.length > 0) {
            console.log('📌 Stamps data:', data.stamps_data);
            setStamps(data.stamps_data);
          }

          if (data.annotations_data && data.annotations_data.length > 0) {
            console.log('✏️ Annotations data:', data.annotations_data);
            setAnnotations(data.annotations_data);

            const maxId = Math.max(
              ...data.annotations_data.map((a: Annotation) => a.id),
              0,
            );
            annotationIdCounter = maxId + 1;
            console.log(
              '🔢 annotationIdCounter reset to:',
              annotationIdCounter,
            );
          }

          console.log('✅ Data loaded successfully');
        } else {
          console.log('⚠️ No data found');
        }
      } catch (error) {
        console.error('❌ Load data error:', error);
      }
    };

    loadData();
  }, [sheetIdNum, isReadOnly, marks.length]);

  const marksRef = useRef(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Track which marks have been explicitly entered
  const manuallySetMarksRef = useRef<Set<string>>(new Set());

  // Visible stamps (only placed ones)
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
  const [totalActions, setTotalActions] = useState(1);

  const [zoom, setZoom] = useState(100);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);

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
    pendingType: 'submitContinue' | 'submitExit';
  } | null>(null);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current[page];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ─── SAVE DRAFT TO API ───────────────────────────────────────

  const handleSaveDraft = useCallback(async () => {
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

    const payload = {
      marksData,
      annotationsData,
      stampsData,
      totalMarks: totalAwarded,
      remarks: '',
    };

    try {
      const response = await checkerApi.saveDraft(sheetIdNum, payload);
      if (response.success) {
        setSaveIndicatorText('Draft saved');
        setSaveIndicatorFresh(true);
        setTimeout(() => {
          setSaveIndicatorFresh(false);
          setSaveIndicatorText('Auto-saves every 30s');
        }, 3000);
      }
    } catch (error) {
      console.error('Save draft error:', error);
    }
  }, [sheetIdNum, isReadOnly, marks, stamps, annotations, totalAwarded]);

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

      const payload = {
        marksData,
        annotationsData,
        stampsData,
        totalMarks: totalAwarded,
        remarks: '',
      };

      try {
        const response = await checkerApi.submitMarks(sheetIdNum, payload);
        if (response.success) {
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

  // ─── INTERNAL: persist draft to localStorage ───
  const persistDraft = useCallback(
    (
      mks: MarkEntry[],
      stps: MarksStamp[],
      sid: number,
      manualSet: Set<string>,
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

  const saveDraft = useCallback(() => {
    if (!sheetIdNum) return;
    persistDraft(
      marksRef.current,
      stampsRef.current,
      sheetIdNum,
      manuallySetMarksRef.current,
    );
  }, [sheetIdNum, persistDraft]);

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  // ─── AUTO-SAVE: 30-second interval + beforeunload + API sync ───
  useEffect(() => {
    if (isReadOnly) return;

    const interval = setInterval(() => {
      const isAlreadySubmitted = sheetData?.is_submitted || false;
      if (!isAlreadySubmitted) {
        saveDraftRef.current();
        handleSaveDraft();
      }
    }, 30000);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (manuallySetMarksRef.current.size > 0) {
        saveDraftRef.current();
        handleSaveDraft();
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isReadOnly, handleSaveDraft, sheetData]);

  // ─── RESUME: check localStorage on mount ───
  useEffect(() => {
    const key = `osm_draft_sheet_${sheetIdNum}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
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
        setResumeBanner({ savedAt: timeLabel });
        setToastMessage('You have an unsaved draft — use Resume to continue');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch {
      // Corrupt draft — ignore
    }
  }, [sheetIdNum]);

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
  }, [sheetIdNum, marks, stamps]);

  const handleStartFresh = useCallback(() => {
    localStorage.removeItem(`osm_draft_sheet_${sheetIdNum}`);
    setResumeBanner(null);
    manuallySetMarksRef.current = new Set();
  }, [sheetIdNum]);

  // ─── Timer ───
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
      setPlacingMarkId(null);
      setInstructionBanner(null);
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
  }, []);

  const handleRequestAddMark = useCallback(
    (markId: string, value: number) => {
      console.log('🔵 handleRequestAddMark called:', markId, value);
      const stamp = stampsRef.current.find((s) => s.markId === markId);
      if (!stamp || !stamp.placed) {
        setToastMessage('Please click on sheet to place position first');
        setTimeout(() => setToastMessage(null), 2500);
        return;
      }

      console.log('✅ Stamp found, updating marks...');

      setStamps((prev) =>
        prev.map((s) => (s.markId === markId ? { ...s, value } : s)),
      );
      setMarks((prev) =>
        prev.map((m) => (m.id === markId ? { ...m, awarded: value } : m)),
      );

      manuallySetMarksRef.current.add(markId);

      console.log(
        '✅ manuallySetMarksRef after add:',
        manuallySetMarksRef.current,
      );

      setTimeout(() => {
        saveDraftRef.current();
        handleSaveDraft();
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
    [marks, handleSaveDraft],
  );

  const handleMarkUpdate = useCallback((id: string, awarded: number) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, awarded } : m)));

    if (awarded > 0) {
      manuallySetMarksRef.current.add(id);
    }
  }, []);

  const handleRemarkUpdate = useCallback((id: string, remark: string) => {
    setMarks((prev) => prev.map((m) => (m.id === id ? { ...m, remark } : m)));
  }, []);

  const checkIncomplete = useCallback((): string[] => {
    console.log('🔍 Marks:', marks);
    console.log('🔍 manuallySetMarksRef:', manuallySetMarksRef.current);

    const incomplete = marks
      .filter((m) => {
        const isSet = manuallySetMarksRef.current.has(m.id);
        console.log(`🔍 ${m.id}: awarded=${m.awarded}, isSet=${isSet}`);
        return !isSet;
      })
      .map((m) => m.criterion);

    console.log('🔍 Incomplete:', incomplete);
    return incomplete;
  }, [marks]);

  // ─── ✅ SUBMIT CLICK WITH TIME CHECK ──────────────

  const handleSubmitClick = useCallback(
    (type: 'submitContinue' | 'submitExit') => {
      // ✅ Convert minutes to seconds
      const requiredSeconds = minTimeRequired * 60;

      // ✅ Check minimum time requirement
      if (minTimeRequired > 0 && elapsed < requiredSeconds) {
        const remaining = requiredSeconds - elapsed;
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
      handleSubmitMarks(type === 'submitContinue' ? 'continue' : 'exit');
    },
    [checkIncomplete, handleSubmitMarks, minTimeRequired, elapsed],
  );

  // ─── ✅ ESCALATE CLICK WITH TIME CHECK ─────────────

  const handleEscalateClick = useCallback(() => {
    // ✅ Convert minutes to seconds
    const requiredSeconds = minTimeRequired * 60;

    // ✅ Check minimum time requirement before escalating
    if (minTimeRequired > 0 && elapsed < requiredSeconds) {
      const remaining = requiredSeconds - elapsed;
      const remainingMinutes = Math.ceil(remaining / 60);
      setToastMessage(
        `⚠️ Please spend at least ${minTimeRequired} minutes before escalating. ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} remaining.`,
      );
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    setModalType('escalate');
  }, [minTimeRequired, elapsed]);

  // ─── INCOMPLETE SUBMISSION HANDLERS ──────────────────────────

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

  // ─── CONFIRM MODAL HANDLER ──────────────────────────────────

  const handleModalConfirm = useCallback(() => {
    setModalType(null);
    localStorage.removeItem(`osm_draft_sheet_${sheetIdNum}`);
    if (modalType === 'submitExit') {
      navigate('/checker');
    }
  }, [modalType, navigate, sheetIdNum]);

  // ─── ESCALATE CONFIRM HANDLER ───────────────────────────────

  const handleEscalateConfirm = useCallback(
    async (data: { reason: string; escalateType: string; remarks: string }) => {
      if (!sheetIdNum) {
        setToastMessage('Sheet ID not found');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      try {
        console.log('📤 Escalating sheet:', sheetIdNum, data);

        const response = await checkerApi.escalateSheet(sheetIdNum, {
          reason: data.reason,
          escalateType: data.escalateType,
          remarks: data.remarks,
        });

        if (response.success) {
          setModalType(null);
          setToastMessage('✅ Sheet escalated successfully');
          setTimeout(() => setToastMessage(null), 2500);

          setTimeout(() => {
            navigate('/checker/queue');
          }, 1500);
        } else {
          setToastMessage(response.message || 'Failed to escalate sheet');
          setTimeout(() => setToastMessage(null), 3000);
        }
      } catch (error: any) {
        console.error('❌ Escalate error:', error);
        setToastMessage(error.message || 'Failed to escalate sheet');
        setTimeout(() => setToastMessage(null), 3000);
      }
    },
    [sheetIdNum, navigate],
  );

  const handleRightTabChange = useCallback((tab: RightTab) => {
    setRightTab(tab);
  }, []);

  // ─── HAS MODEL ANSWER ───
  const hasModelAnswer = !!pdfsData.model_answer;

  const toolbarTools: { tool: AnnotationTool; icon: string; label: string }[] =
    [
      { tool: 'tick', icon: 'ri-check-line', label: 'Tick' },
      { tool: 'cross', icon: 'ri-close-line', label: 'Cross' },
      { tool: 'pencil', icon: 'ri-pencil-line', label: 'Pencil' },
      { tool: 'highlight', icon: 'ri-mark-pen-line', label: 'Highlight' },
      { tool: 'eraser', icon: 'ri-eraser-line', label: 'Eraser' },
    ];

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <LoadingSpinner fullPage />
      </div>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────

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
            of {TOTAL_PAGES}
          </span>
          {/* ✅ Show minimum time requirement in top bar */}
          {minTimeRequired > 0 && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                elapsed >= minTimeRequired * 60
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <i
                className={`${
                  elapsed >= minTimeRequired * 60
                    ? 'ri-check-line'
                    : 'ri-timer-line'
                } text-xs`}
              ></i>
              {elapsed >= minTimeRequired * 60
                ? `✅ Min time ${minTimeRequired}m met`
                : `⏱️ ${Math.floor(elapsed / 60)}/${minTimeRequired}m required`}
            </span>
          )}
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
                        : 'bg-sky-500/25 text-sky-400'
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
          stamps={visibleStamps}
          activeMarkId={activeMarkId}
          placingMarkId={placingMarkId}
          instructionBanner={instructionBanner}
          onAnnotationAdd={handleAnnotationAdd}
          onAnnotationDelete={handleAnnotationDelete}
          onEraserNoHit={handleEraserNoHit}
          onPencilStroke={handlePencilStroke}
          onSheetClickForPlacement={handleSheetClickForPlacement}
          onStampReposition={handleStampReposition}
          onDismissBanner={handleDismissBanner}
          pageRefs={pageRefs}
          scrollToPage={scrollToPage}
          pdfUrl={sheetData?.file_url || null}
          onPageRender={(pageNum: number, imageData: string) => {
            setPdfPageImages((prev) => ({
              ...prev,
              [pageNum]: imageData,
            }));
          }}
          onPageCount={(count: number) => {
            setPdfPageCount(count);
          }}
        />

        {/* ─── RIGHT SIDE: Resume banner + Mark Panel ─── */}
        <div className="w-[255px] shrink-0 flex flex-col">
          {/* ─── RESUME BANNER ─── */}
          {resumeBanner && (
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

          {/* ─── RIGHT MARK PANEL ─── */}
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
            minTimeRequired={minTimeRequired}
            isTimeRequirementMet={isTimeRequirementMet}
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

      {/* ─── CONFIRM MODAL (submit actions) ─── */}
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
          onEscalate={handleEscalateConfirm}
          onCancel={() => setModalType(null)}
        />
      )}
    </div>
  );
}
