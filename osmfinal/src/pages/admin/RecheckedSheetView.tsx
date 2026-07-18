// src/pages/admin/RecheckedSheetView.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '@/api/axios';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import recheckQueueService from '@/api/recheckQueue';

interface RecheckedSheetData {
  id: number;
  sheet_id: number;
  exam_id: string;
  reason: string;
  assign_to: string;
  status: string;
  requested_by: string;
  resolved_by: string;
  resolved_at: string;
  remarks: string;
  created_at: string;
  updated_at: string;
  time_spent: number;
  student_name: string;
  roll_no: string;
  barcode: string;
  file_name: string;
  file_url: string;
  current_marks: number;
  exam_name: string;
  exam_subject: string;
  requested_by_name: string;
  resolved_by_name: string;
  marks_data: Record<string, number>;
  finalMarksRule: string;
  recheckMarks?: Record<string, number>;
  recheckAnnotations?: Array<{
    id: number;
    tool: string;
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  }>;
  recheckStamps?: Array<{
    markId: string;
    placed: boolean;
    x: number;
    y: number;
    page: number;
    value: number | null;
  }>;
  originalMarks?: Record<string, number>;
  originalAnnotations?: Array<{
    id: number;
    tool: string;
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  }>;
  originalStamps?: Array<{
    markId: string;
    placed: boolean;
    x: number;
    y: number;
    page: number;
    value: number | null;
  }>;
  summary?: {
    student: string;
    roll_no: string;
    exam: string;
    subject: string;
    status: string;
    original_total: number;
    recheck_total: number;
    final_marks: number;
  };
}

// ⚠️ IMPORTANT: Checker/Rechecker side pe jab tick/stamp lagaya gaya tha,
// PDF page jis width:height ratio pe render hua tha, wahi ratio yaha daalo.
// A4 default rakha hai (210mm x 297mm). Agar Letter size use hota hai to
// 8.5/11 kar dena.
const PAGE_ASPECT_RATIO = 210 / 297; // width / height

export default function RecheckedSheetView() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetData, setSheetData] = useState<RecheckedSheetData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      if (!requestId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await recheckQueueService.getRecheckedSheetForAdmin(
          parseInt(requestId),
        );

        console.log('📥 Rechecked sheet response:', response);

        if (response.success && response.data) {
          const data = response.data;

          const combinedMarks = {
            ...data.originalMarks,
            ...data.recheckMarks,
          };

          setSheetData({
            id: data.request?.id || 0,
            sheet_id: data.request?.sheet_id || 0,
            exam_id: data.request?.exam_id || '',
            reason: data.request?.reason || '',
            assign_to: data.request?.assign_to || '',
            status: data.request?.status || '',
            requested_by: data.request?.requested_by || '',
            resolved_by: data.request?.resolved_by || '',
            resolved_at: data.request?.resolved_at || '',
            remarks: data.request?.remarks || '',
            created_at: data.request?.created_at || '',
            updated_at: data.request?.updated_at || '',
            time_spent: data.request?.time_spent || 0,
            student_name: data.sheet?.student_name || 'Unknown',
            roll_no: data.sheet?.roll_no || '—',
            barcode: data.sheet?.barcode || '—',
            file_name: data.sheet?.file_name || '',
            file_url: data.sheet?.file_url || '',
            current_marks: data.sheet?.current_marks || 0,
            exam_name: data.exam?.name || 'Unknown',
            exam_subject: data.exam?.subject || '—',
            requested_by_name: data.request?.requested_by_name || 'Unknown',
            resolved_by_name: data.request?.resolved_by_name || '—',
            marks_data: combinedMarks,
            recheckMarks: data.recheckMarks || {},
            recheckAnnotations: data.recheckAnnotations || [],
            recheckStamps: data.recheckStamps || [],
            originalMarks: data.originalMarks || {},
            originalAnnotations: data.originalAnnotations || [],
            originalStamps: data.originalStamps || [],
            finalMarksRule: data.request?.finalMarksRule || 'higher',
            summary: data.summary || {},
          });

          const fileUrl = data.sheet?.file_url;
          let fullUrl: string | null = null;
          if (fileUrl) {
            if (
              fileUrl.startsWith('http://') ||
              fileUrl.startsWith('https://')
            ) {
              fullUrl = fileUrl;
            } else if (
              fileUrl.startsWith('/uploads') ||
              fileUrl.startsWith('/checked-sheets')
            ) {
              fullUrl = `${API_URL}${fileUrl}`;
            } else if (fileUrl.startsWith('checked-sheets')) {
              fullUrl = `${API_URL}/${fileUrl}`;
            } else {
              fullUrl = `${API_URL}/uploads/${fileUrl}`;
            }
          }

          console.log('📄 Full PDF URL:', fullUrl);
          setPdfUrl(fullUrl);

          if (!fullUrl) {
            setError('PDF URL not found');
          }
        } else {
          setError(response.message || 'Failed to load rechecked sheet');
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || 'Failed to load rechecked sheet');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  // ─── Get stamps for current page ───
  const getStampsForPage = (page: number) => {
    if (!sheetData) return [];
    const originalStamps = sheetData.originalStamps || [];
    const recheckStamps = sheetData.recheckStamps || [];
    const allStamps = [...originalStamps, ...recheckStamps];
    return allStamps.filter((s) => s.placed && s.page === page);
  };

  // ─── Get annotations for current page ───
  const getAnnotationsForPage = (page: number) => {
    if (!sheetData) return [];
    const originalAnnotations = sheetData.originalAnnotations || [];
    const recheckAnnotations = sheetData.recheckAnnotations || [];
    const allAnnotations = [...originalAnnotations, ...recheckAnnotations];
    return allAnnotations.filter((a) => a.page === page);
  };

  // ─── Render stamps ───
  const renderStamps = () => {
    const stamps = getStampsForPage(currentPage);
    if (stamps.length === 0) return null;

    return stamps.map((stamp, idx) => {
      const value = stamp.value ?? 0;
      const isRecheck = sheetData?.recheckStamps?.some(
        (s) => s.markId === stamp.markId && s.value === value,
      );

      let bgColor = 'bg-purple-600';
      if (isRecheck) bgColor = 'bg-orange-500';
      else if (value === 0) bgColor = 'bg-red-500';
      else if (value >= 2) bgColor = 'bg-green-500';
      else if (value >= 1) bgColor = 'bg-blue-500';

      return (
        <div
          key={`${stamp.markId}-${isRecheck ? 'recheck' : 'original'}-${idx}`}
          className="absolute flex items-center justify-center"
          style={{
            left: `${stamp.x}%`,
            top: `${stamp.y}%`,
            transform: 'translate(-50%, -50%)',
            width: '36px',
            height: '36px',
          }}
        >
          <div
            className={`${bgColor} text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white`}
            title={`${stamp.markId}: ${value} marks${isRecheck ? ' (Recheck)' : ''}`}
          >
            {value}
          </div>
        </div>
      );
    });
  };

  // ─── Render annotations ───
  const renderAnnotations = () => {
    const annotations = getAnnotationsForPage(currentPage);
    if (annotations.length === 0) return null;

    return annotations.map((ann, idx) => {
      const isTick = ann.tool === 'tick';
      const isCross = ann.tool === 'cross';
      const isHighlight = ann.tool === 'highlight';
      const isRecheck = sheetData?.recheckAnnotations?.some(
        (a) => a.id === ann.id,
      );

      let bgColor = 'transparent';
      let icon = null;
      const borderColor = isRecheck ? 'border-orange-400' : 'border-white';

      if (isTick) {
        bgColor = isRecheck
          ? 'rgba(251, 146, 60, 0.4)'
          : 'rgba(34, 197, 94, 0.4)';
        icon = (
          <div
            className={`w-8 h-8 rounded-full ${isRecheck ? 'bg-orange-500' : 'bg-green-500'} flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 ${borderColor}`}
          >
            ✓
          </div>
        );
      } else if (isCross) {
        bgColor = isRecheck
          ? 'rgba(251, 146, 60, 0.4)'
          : 'rgba(239, 68, 68, 0.4)';
        icon = (
          <div
            className={`w-8 h-8 rounded-full ${isRecheck ? 'bg-orange-500' : 'bg-red-500'} flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 ${borderColor}`}
          >
            ✕
          </div>
        );
      } else if (isHighlight) {
        bgColor = isRecheck
          ? 'rgba(251, 146, 60, 0.3)'
          : 'rgba(251, 191, 36, 0.3)';
      }

      return (
        <div
          key={`${ann.id}-${isRecheck ? 'recheck' : 'original'}-${idx}`}
          className="absolute flex items-center justify-center"
          style={{
            left: `${ann.x}%`,
            top: `${ann.y}%`,
            transform: 'translate(-50%, -50%)',
            width: ann.width ? `${ann.width}%` : 'auto',
            height: ann.height ? `${ann.height}%` : 'auto',
            backgroundColor: bgColor,
            borderRadius: isTick || isCross ? '50%' : '4px',
            minWidth: isTick || isCross ? '32px' : 'auto',
            minHeight: isTick || isCross ? '32px' : 'auto',
          }}
        >
          {icon}
        </div>
      );
    });
  };

  // ─── Get pages with content ───
  const getPagesWithContent = (): number[] => {
    const pages = new Set<number>();
    const allStamps = [
      ...(sheetData?.originalStamps || []),
      ...(sheetData?.recheckStamps || []),
    ];
    const allAnnotations = [
      ...(sheetData?.originalAnnotations || []),
      ...(sheetData?.recheckAnnotations || []),
    ];

    allStamps.filter((s) => s.placed).forEach((s) => pages.add(s.page));
    allAnnotations.forEach((a) => pages.add(a.page));

    return Array.from(pages).sort((a, b) => a - b);
  };

  const pagesWithContent = getPagesWithContent();

  // ─── Helper: Format Time ──────────────────────────────────────
  function formatTime(seconds: number | null | undefined): string {
    if (!seconds || seconds === 0) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <LoadingSpinner fullPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-red-400 text-3xl"></i>
          </div>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => navigate('/admin/queue')}
            className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors cursor-pointer"
          >
            Back to Work Queue
          </button>
        </div>
      </div>
    );
  }

  if (!sheetData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f172a]">
        <p className="text-slate-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f172a]">
      {/* ─── TOP BAR ─── */}
      <header className="h-12 shrink-0 bg-[#1e293b] text-white flex items-center justify-between px-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/queue')}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line text-xl"></i>
          </button>
          <span className="font-semibold">Rechecked Sheet</span>
          <span className="text-sm text-slate-400">|</span>
          <span className="text-sm text-slate-300">
            {sheetData.student_name} ({sheetData.roll_no})
          </span>
          <span className="text-sm text-slate-400">|</span>
          <span className="text-sm text-slate-400">{sheetData.exam_name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-full">
            <i className="ri-file-pdf-line text-slate-400 text-xs"></i>
            <span className="text-xs text-slate-300">
              Page {currentPage} of {pagesWithContent.length || 1}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            <span className="text-xs text-slate-400">Original:</span>
            <span className="text-sm font-bold text-blue-400">
              {Object.values(sheetData.originalMarks || {}).reduce(
                (a, b) => a + b,
                0,
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
            <span className="text-xs text-slate-400">Recheck:</span>
            <span className="text-sm font-bold text-orange-400">
              {Object.values(sheetData.recheckMarks || {}).reduce(
                (a, b) => a + b,
                0,
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <span className="text-xs text-slate-400">Final:</span>
            <span className="text-sm font-bold text-emerald-400">
              {sheetData.current_marks}
            </span>
            <span className="text-xs text-slate-400">
              / {Object.values(sheetData.marks_data || {}).length * 3}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-full">
            <i className="ri-user-line text-slate-400 text-xs"></i>
            <span className="text-xs text-slate-300">
              {sheetData.resolved_by_name || '—'}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <i className="ri-lock-line text-amber-400 text-xs"></i>
            <span className="text-xs text-amber-400 font-medium">
              Read Only
            </span>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── PDF VIEWER ─── */}
        <div className="flex-1 bg-slate-800 flex items-center justify-center overflow-hidden p-4">
          {pdfUrl ? (
            <div className="relative flex flex-col items-center gap-3 h-full">
              {/*
                ─── FIXED-RATIO PAGE WRAPPER ───
                Page hamesha ek fixed aspect ratio (A4 ya jo bhi actual size hai) maintain karta hai.
                Isse iframe aur overlay dono hamesha same shape mein sync rahenge —
                window resize ho, kuch bhi ho, % coordinates kabhi galat nahi honge.
              */}
              <div
                className="relative bg-white shadow-2xl"
                style={{
                  height: '100%',
                  maxHeight: '100%',
                  aspectRatio: `${PAGE_ASPECT_RATIO}`,
                }}
              >
                {/*
                  toolbar/navpanes/scrollbar = 0 -> koi bhi extra UI/scroll nahi
                  view=FitH -> hamesha same fixed zoom pe render hoga (43% jaisa random zoom nahi aayega)
                  pointer-events: none -> user khud is iframe ko scroll/zoom/drag nahi kar payega,
                  warna overlay turant misalign ho jayega
                */}
                <iframe
                  key={currentPage} // page change hote hi fresh reload, purani scroll state carry nahi hogi
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=${currentPage}`}
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                  title="Rechecked Sheet"
                />

                {/* ─── OVERLAY — same fixed-ratio box ke andar, same size ─── */}
                <div className="absolute inset-0 pointer-events-none">
                  {renderStamps()}
                  {renderAnnotations()}
                </div>
              </div>

              {/* Page Navigation — box ke bahar, alag se */}
              {pagesWithContent.length > 1 && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <button
                    onClick={() => {
                      const currentIndex =
                        pagesWithContent.indexOf(currentPage);
                      if (currentIndex > 0) {
                        setCurrentPage(pagesWithContent[currentIndex - 1]);
                      }
                    }}
                    disabled={pagesWithContent.indexOf(currentPage) <= 0}
                    className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  <span className="text-xs text-white">
                    {pagesWithContent.indexOf(currentPage) + 1} /{' '}
                    {pagesWithContent.length}
                  </span>
                  <button
                    onClick={() => {
                      const currentIndex =
                        pagesWithContent.indexOf(currentPage);
                      if (currentIndex < pagesWithContent.length - 1) {
                        setCurrentPage(pagesWithContent[currentIndex + 1]);
                      }
                    }}
                    disabled={
                      pagesWithContent.indexOf(currentPage) >=
                      pagesWithContent.length - 1
                    }
                    className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                <i className="ri-file-pdf-line text-slate-400 text-3xl"></i>
              </div>
              <p className="text-slate-400">No PDF available</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT SIDEBAR ─── (unchanged) */}
        <div className="w-72 shrink-0 bg-[#1e293b] border-l border-slate-700 overflow-y-auto">
          <div className="p-3 border-b border-slate-700 sticky top-0 bg-[#1e293b] z-10">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Marks Comparison
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {Object.keys(sheetData.marks_data || {}).length} questions
            </p>
          </div>

          <div className="p-3 space-y-2">
            {sheetData.marks_data &&
            Object.keys(sheetData.marks_data).length > 0 ? (
              Object.entries(sheetData.marks_data).map(([key, value]) => {
                const displayName = key.replace('Qn', '').replace('_', '');
                const originalValue = sheetData.originalMarks?.[key] ?? 0;
                const recheckValue = sheetData.recheckMarks?.[key] ?? 0;
                const isChanged = originalValue !== recheckValue;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1.5 border-b border-slate-700/30"
                  >
                    <span className="text-xs text-slate-300">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-blue-400 font-medium w-6 text-center">
                        {originalValue}
                      </span>
                      <span className="text-xs text-slate-500">→</span>
                      <span
                        className={`text-xs font-medium w-6 text-center ${isChanged ? 'text-orange-400' : 'text-emerald-400'}`}
                      >
                        {recheckValue}
                      </span>
                      {isChanged && (
                        <span className="text-[10px] text-yellow-400">✦</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                No mark data available
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">
                  Original Total
                </span>
                <span className="text-sm font-bold text-blue-400">
                  {Object.values(sheetData.originalMarks || {}).reduce(
                    (a, b) => a + b,
                    0,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-semibold text-slate-300">
                  Recheck Total
                </span>
                <span className="text-sm font-bold text-orange-400">
                  {Object.values(sheetData.recheckMarks || {}).reduce(
                    (a, b) => a + b,
                    0,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-700/50">
                <span className="text-sm font-semibold text-slate-300">
                  Final Total
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {sheetData.current_marks}
                  <span className="text-xs text-slate-500 font-normal">
                    {' '}
                    / {Object.values(sheetData.marks_data || {}).length * 3}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-500">Rule</span>
                <span className="text-xs text-slate-400 font-medium">
                  {sheetData.finalMarksRule || 'higher'}
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-500">
                Total Stamps:{' '}
                {
                  [
                    ...(sheetData.originalStamps || []),
                    ...(sheetData.recheckStamps || []),
                  ].filter((s) => s.placed).length
                }
              </p>
              <p className="text-[10px] text-slate-500">
                Original Stamps:{' '}
                {sheetData.originalStamps?.filter((s) => s.placed).length || 0}
              </p>
              <p className="text-[10px] text-slate-500">
                Recheck Stamps:{' '}
                {sheetData.recheckStamps?.filter((s) => s.placed).length || 0}
              </p>
              <p className="text-[10px] text-slate-500">
                Annotations:{' '}
                {
                  [
                    ...(sheetData.originalAnnotations || []),
                    ...(sheetData.recheckAnnotations || []),
                  ].length
                }
              </p>
            </div>

            {sheetData.remarks && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">Remarks:</p>
                <p className="text-xs text-slate-300 mt-1 bg-slate-700/30 p-2 rounded">
                  {sheetData.remarks}
                </p>
              </div>
            )}

            {sheetData.resolved_at && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Rechecked: {new Date(sheetData.resolved_at).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Time Spent: {formatTime(sheetData.time_spent)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
