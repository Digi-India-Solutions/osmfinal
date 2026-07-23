// src/pages/admin/CheckedSheetView.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import workQueueService from '@/api/workQueue';
import { API_URL } from '@/api/axios';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CheckedSheetData {
  id: number;
  student_name: string;
  roll_no: string;
  barcode: string;
  marks: string;
  checking_time_spent: number;
  archived_folder: string;
  file_url: string;
  checked_at: string;
  exam_name: string;
  exam_subject: string;
  total_marks: number;
  checker_name: string;
  marks_data: Record<string, number>;
  annotations_data: Array<{
    id: number;
    tool: string;
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  }>;
  stamps_data: Array<{
    markId: string;
    placed: boolean;
    x: number;
    y: number;
    page: number;
    value: number | null;
  }>;
  notes_data?: Array<{
    id: number;
    page: number;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    width: number;
    height: number;
  }>;
  remarks: string;
  submitted_at: string;
}

// A4 aspect ratio
const PAGE_ASPECT_RATIO = 210 / 297;

export default function CheckedSheetView() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetData, setSheetData] = useState<CheckedSheetData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      if (!sheetId) return;
      setLoading(true);
      setError(null);
      try {
        // ✅ Use workQueueService for admin access
        const response = await workQueueService.getCheckedSheetById(
          parseInt(sheetId),
        );
        console.log('📥 Checked sheet response:==>', response);

        if (response.success && response.data) {
          const data = response.data;

          setSheetData({
            id: data.id || 0,
            student_name: data.student_name || 'Unknown',
            roll_no: data.roll_no || '—',
            barcode: data.barcode || '—',
            marks: data.marks || '0',
            checking_time_spent: data.checking_time_spent || 0,
            archived_folder: data.archived_folder || '',
            file_url: data.file_url || '',
            checked_at: data.checked_at || '',
            exam_name: data.exam_name || 'Unknown',
            exam_subject: data.exam_subject || '—',
            total_marks: data.total_marks || 0,
            checker_name: data.checker_name || '—',
            marks_data: data.marks_data || {},
            annotations_data: data.annotations_data || [],
            stamps_data: data.stamps_data || [],
            notes_data: data.notes_data || [], // ✅ Notes will come from backend
            remarks: data.remarks || '',
            submitted_at: data.submitted_at || '',
          });

          // ─── BUILD PDF URL ───
          let fullUrl: string | null = null;
          if (data.file_url) {
            const fileUrl = data.file_url;
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
          setPdfUrl(fullUrl);
          if (!fullUrl) setError('PDF URL not found');
        } else {
          setError(response.message || 'Failed to load checked sheet');
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.message || 'Failed to load checked sheet');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [sheetId]);

  // ─── GET ALL PAGES ───
  const getAllPages = (): number[] => {
    if (!sheetData) return [1];

    const pages = new Set<number>();

    // Add all pages from stamps
    const allStamps = sheetData.stamps_data || [];
    allStamps.filter((s) => s.placed).forEach((s) => pages.add(s.page));

    // Add all pages from annotations
    const allAnnotations = sheetData.annotations_data || [];
    allAnnotations.forEach((a) => pages.add(a.page));

    // Add all pages from notes
    const allNotes = sheetData.notes_data || [];
    allNotes.forEach((n) => pages.add(n.page));

    // If no content found, at least show page 1
    if (pages.size === 0) {
      pages.add(1);
    }

    // Get max page
    const maxPage = Math.max(...Array.from(pages), 1);

    // Generate all pages from 1 to maxPage
    const allPages: number[] = [];
    for (let i = 1; i <= maxPage; i++) {
      allPages.push(i);
    }

    return allPages;
  };

  const allPages = getAllPages();

  // ─── Get stamps for current page ───
  const getStampsForPage = (page: number) => {
    if (!sheetData) return [];
    return (
      sheetData.stamps_data?.filter((s) => s.placed && s.page === page) || []
    );
  };

  // ─── Get annotations for current page ───
  const getAnnotationsForPage = (page: number) => {
    if (!sheetData) return [];
    return sheetData.annotations_data?.filter((a) => a.page === page) || [];
  };

  // ─── Get notes for current page ───
  const getNotesForPage = (page: number) => {
    if (!sheetData) return [];
    return sheetData.notes_data?.filter((n) => n.page === page) || [];
  };

  // ─── Render stamps ───
  const renderStamps = () => {
    const stamps = getStampsForPage(currentPage);
    if (stamps.length === 0) return null;

    return stamps.map((stamp, idx) => {
      const value = stamp.value ?? 0;
      let bgColor = 'bg-purple-600';
      if (value === 0) bgColor = 'bg-red-500';
      else if (value >= 2) bgColor = 'bg-green-500';
      else if (value >= 1) bgColor = 'bg-blue-500';

      return (
        <div
          key={`${stamp.markId}-${idx}`}
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
            title={`${stamp.markId}: ${value} marks`}
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

      let bgColor = 'transparent';
      let icon = null;

      if (isTick) {
        bgColor = 'rgba(34, 197, 94, 0.4)';
        icon = (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
            ✓
          </div>
        );
      } else if (isCross) {
        bgColor = 'rgba(239, 68, 68, 0.4)';
        icon = (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold shadow-lg border-2 border-white">
            ✕
          </div>
        );
      } else if (isHighlight) {
        bgColor = 'rgba(251, 191, 36, 0.3)';
      }

      return (
        <div
          key={`${ann.id}-${idx}`}
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

  // ─── Render notes ───
  const renderNotes = () => {
    const notes = getNotesForPage(currentPage);
    if (notes.length === 0) return null;

    return notes.map((note, idx) => {
      const hasText = note.text && note.text.trim().length > 0;
      const accentColor = '#F59E0B'; // amber-500
      const borderColor = '#FCD34D'; // amber-300
      const openBelow = note.y < 25;

      return (
        <div
          key={`${note.id}-${idx}`}
          className="absolute group"
          style={{
            left: `${note.x}%`,
            top: `${note.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: 40,
            pointerEvents: 'auto',
          }}
        >
          {/* ─── PIN ─── */}
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shadow-md cursor-default transition-transform duration-150 group-hover:scale-125"
            style={{
              backgroundColor: accentColor,
              border: '2px solid white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            }}
            title={hasText ? note.text : 'Empty note'}
          >
            <i className="ri-sticky-note-fill text-white text-[10px]" />
          </div>

          {/* ─── POPOVER ─── */}
          <div
            className={`absolute hidden group-hover:block left-1/2 -translate-x-1/2 w-60 ${
              openBelow ? 'top-full mt-2' : 'bottom-full mb-2'
            }`}
            style={{ zIndex: 50 }}
          >
            <div
              className="rounded-lg overflow-hidden shadow-2xl"
              style={{ border: `1px solid ${borderColor}` }}
            >
              <div
                className="px-2.5 py-1.5 flex items-center gap-1.5"
                style={{ backgroundColor: accentColor }}
              >
                <i className="ri-sticky-note-line text-white text-[11px]" />
                <span className="text-white text-[10px] font-semibold uppercase tracking-wide">
                  Checker Note
                </span>
              </div>
              <div className="bg-white px-2.5 py-2 max-h-32 overflow-y-auto">
                {hasText ? (
                  <p className="text-slate-700 text-xs leading-relaxed break-words whitespace-pre-wrap">
                    {note.text}
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs italic">Empty note</p>
                )}
              </div>
            </div>
            <div
              className={`w-2.5 h-2.5 rotate-45 absolute left-1/2 -translate-x-1/2 ${
                openBelow ? '-top-1' : '-bottom-1'
              }`}
              style={{ backgroundColor: accentColor }}
            />
          </div>
        </div>
      );
    });
  };

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

  // ─── Get page content indicator ───
  const hasContentOnPage = (page: number): boolean => {
    if (!sheetData) return false;

    const stamps = getStampsForPage(page);
    const annotations = getAnnotationsForPage(page);
    const notes = getNotesForPage(page);

    return stamps.length > 0 || annotations.length > 0 || notes.length > 0;
  };

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
          <span className="font-semibold">Checked Sheet</span>
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
              Page {currentPage} of {allPages.length}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <span className="text-xs text-slate-400">Marks:</span>
            <span className="text-sm font-bold text-emerald-400">
              {parseFloat(sheetData.marks).toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">
              / {sheetData.total_marks}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-full">
            <i className="ri-user-line text-slate-400 text-xs"></i>
            <span className="text-xs text-slate-300">
              {sheetData.checker_name}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-full">
            <i className="ri-time-line text-slate-400 text-xs"></i>
            <span className="text-xs text-slate-300">
              {formatTime(sheetData.checking_time_spent)}
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
              <div
                className="relative bg-white shadow-2xl"
                style={{
                  height: '100%',
                  maxHeight: '100%',
                  aspectRatio: `${PAGE_ASPECT_RATIO}`,
                }}
              >
                <iframe
                  key={currentPage}
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=${currentPage}`}
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                  title="Checked Sheet"
                />

                {/* ─── OVERLAY ─── */}
                <div className="absolute inset-0 pointer-events-none">
                  {renderStamps()}
                  {renderAnnotations()}
                  {renderNotes()}
                </div>
              </div>

              {/* ─── PAGE NAVIGATION ─── */}
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <button
                  onClick={() => {
                    const currentIndex = allPages.indexOf(currentPage);
                    if (currentIndex > 0) {
                      setCurrentPage(allPages[currentIndex - 1]);
                    }
                  }}
                  disabled={allPages.indexOf(currentPage) <= 0}
                  className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line"></i>
                </button>

                {/* Page buttons with content indicators */}
                <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto px-1">
                  {allPages.map((page) => {
                    const hasContent = hasContentOnPage(page);
                    const isActive = page === currentPage;

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative w-7 h-7 rounded text-xs font-medium transition-colors cursor-pointer flex-shrink-0 ${
                          isActive
                            ? 'bg-violet-500 text-white'
                            : hasContent
                              ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                              : 'bg-slate-700/50 text-slate-500 hover:bg-slate-600/50'
                        }`}
                        title={hasContent ? 'Has content' : 'Empty page'}
                      >
                        {page}
                        {hasContent && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full shadow-sm"></span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    const currentIndex = allPages.indexOf(currentPage);
                    if (currentIndex < allPages.length - 1) {
                      setCurrentPage(allPages[currentIndex + 1]);
                    }
                  }}
                  disabled={
                    allPages.indexOf(currentPage) >= allPages.length - 1
                  }
                  className="px-2 py-1 text-white hover:bg-white/20 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-right-s-line"></i>
                </button>
              </div>
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

        {/* ─── RIGHT SIDEBAR ─── */}
        <div className="w-72 shrink-0 bg-[#1e293b] border-l border-slate-700 overflow-y-auto">
          <div className="p-3 border-b border-slate-700 sticky top-0 bg-[#1e293b] z-10">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Marks Summary
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
                const stamp = sheetData.stamps_data?.find(
                  (s) => s.markId === key,
                );
                const maxMarks =
                  stamp?.value !== undefined && stamp?.value !== null
                    ? Math.max(value, stamp.value)
                    : value;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1.5 border-b border-slate-700/30"
                  >
                    <span className="text-xs text-slate-300">
                      {displayName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          value > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {value}
                      </span>
                      <span className="text-xs text-slate-500">/</span>
                      <span className="text-xs text-slate-500">{maxMarks}</span>
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
                  Total
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {parseFloat(sheetData.marks).toFixed(1)}
                  <span className="text-xs text-slate-500 font-normal">
                    {' '}
                    / {sheetData.total_marks}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-500">
                Stamps:{' '}
                {sheetData.stamps_data?.filter((s) => s.placed).length || 0}
              </p>
              <p className="text-[10px] text-slate-500">
                Annotations: {sheetData.annotations_data?.length || 0}
              </p>
              <p className="text-[10px] text-slate-500">
                Notes: {sheetData.notes_data?.length || 0}
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

            {sheetData.submitted_at && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Checked: {new Date(sheetData.submitted_at).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Time Spent: {formatTime(sheetData.checking_time_spent)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
