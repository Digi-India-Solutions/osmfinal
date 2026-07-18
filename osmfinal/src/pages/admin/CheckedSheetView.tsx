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
  remarks: string;
  submitted_at: string;
}

// A4 page ratio — checker side jis size pe page render karta tha wahi ratio
// yaha bhi use karo. A4 = 210mm x 297mm => width:height = 210:297
const PAGE_ASPECT_RATIO = 210 / 297; // width / height

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
        const response = await workQueueService.getCheckedSheetById(
          parseInt(sheetId),
        );
        console.log('📥 Checked sheet response:', response);

        if (response.success && response.data) {
          const data = response.data;
          setSheetData(data);

          let fullUrl: string | null = null;
          if (data.file_url) {
            if (
              data.file_url.startsWith('http://') ||
              data.file_url.startsWith('https://')
            ) {
              fullUrl = data.file_url;
            } else if (
              data.file_url.startsWith('/uploads') ||
              data.file_url.startsWith('/checked-sheets')
            ) {
              fullUrl = `${API_URL}${data.file_url}`;
            } else if (data.file_url.startsWith('checked-sheets')) {
              fullUrl = `${API_URL}/${data.file_url}`;
            } else {
              fullUrl = `${API_URL}/uploads/${data.file_url}`;
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

  const getStampsForPage = (page: number) =>
    sheetData?.stamps_data?.filter((s) => s.placed && s.page === page) || [];

  const getAnnotationsForPage = (page: number) =>
    sheetData?.annotations_data?.filter((a) => a.page === page) || [];

  const getPagesWithContent = (): number[] => {
    const pages = new Set<number>();
    sheetData?.stamps_data
      ?.filter((s) => s.placed)
      .forEach((s) => pages.add(s.page));
    sheetData?.annotations_data?.forEach((a) => pages.add(a.page));
    return Array.from(pages).sort((a, b) => a - b);
  };
  const pagesWithContent = getPagesWithContent();

  const renderStamps = () => {
    const stamps = getStampsForPage(currentPage);
    return stamps.map((stamp) => {
      const value = stamp.value ?? 0;
      let bgColor = 'bg-purple-600';
      if (value === 0) bgColor = 'bg-red-500';
      else if (value >= 2) bgColor = 'bg-green-500';
      else if (value >= 1) bgColor = 'bg-blue-500';

      return (
        <div
          key={stamp.markId}
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

  const renderAnnotations = () => {
    const annotations = getAnnotationsForPage(currentPage);
    return annotations.map((ann) => {
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
          key={ann.id}
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
              Page {currentPage} of {pagesWithContent.length || 1}
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
                Ye wrapper hamesha A4 ratio maintain karta hai (height ke basis par width nikalta hai)
                Isse iframe aur overlay dono hamesha SAME size/shape mein rahenge,
                chahe window resize ho ya kuch bhi ho — % coordinates kabhi galat nahi honge.
              */}
              <div
                className="relative bg-white shadow-2xl"
                style={{
                  height: '100%',
                  maxHeight: '100%',
                  aspectRatio: `${PAGE_ASPECT_RATIO}`,
                }}
              >
                {/* PDF iframe — scrollbar/toolbar/navpanes sab OFF,
                    view=FitH taaki page hamesha same fixed zoom/position pe render ho.
                    pointer-events: none taaki user isko khud scroll/pan/zoom na kar sake —
                    warna overlay ke saath mismatch ho jayega. */}
                <iframe
                  key={currentPage} // page badalte hi fresh reload -> koi stale scroll position nahi bachegi
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=${currentPage}`}
                  className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                  title="Checked Sheet"
                />

                {/* ─── OVERLAY — same wrapper ke andar, same size ───
                    Ab overlay aur PDF ek hi fixed-ratio box ke andar hain,
                    isliye scroll/resize kuch bhi ho, dono sath sync rahenge */}
                <div className="absolute inset-0 pointer-events-none">
                  {renderStamps()}
                  {renderAnnotations()}
                </div>
              </div>

              {/* Page Navigation — bahar, iframe se bilkul alag */}
              {pagesWithContent.length > 1 && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <button
                    onClick={() => {
                      const idx = pagesWithContent.indexOf(currentPage);
                      if (idx > 0) setCurrentPage(pagesWithContent[idx - 1]);
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
                      const idx = pagesWithContent.indexOf(currentPage);
                      if (idx < pagesWithContent.length - 1)
                        setCurrentPage(pagesWithContent[idx + 1]);
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

        {/* ─── RIGHT SIDEBAR ─── (unchanged, apna existing JSX yahan rakho) */}
        <div className="w-64 shrink-0 bg-[#1e293b] border-l border-slate-700 overflow-y-auto">
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
                        className={`text-xs font-medium ${value > 0 ? 'text-emerald-400' : 'text-red-400'}`}
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
                  Submitted: {new Date(sheetData.submitted_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
