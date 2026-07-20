// src/pages/checker/CheckerWorkQueue.tsx

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import assignmentService, {
  IAssignedSheet,
  ICheckerStats,
} from '@/api/assignment';

function hasDraftForSheet(sheetId: number): boolean {
  try {
    const raw = localStorage.getItem(`osm_draft_sheet_${sheetId}`);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    return draft.marks && draft.marks.length > 0;
  } catch {
    return false;
  }
}

export default function CheckerWorkQueue() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [sheets, setSheets] = useState<IAssignedSheet[]>([]);
  const [stats, setStats] = useState<ICheckerStats>({
    pending: 0,
    checking: 0,
    completed: 0,
    recheck: 0,
  });
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── FETCH ASSIGNED SHEETS ──────────────────────────────────

  const fetchSheets = useCallback(async () => {
    setSheetsLoading(true);
    try {
      const response = await assignmentService.getMyAssignedSheets();
      if (response.success) {
        setSheets(response.data.items.filter((sheet) => sheet?.status !== 'checked') || []);
        setStats(
          response.data.stats || {
            pending: 0,
            checking: 0,
            completed: 0,
            recheck: 0,
          },
        );
      } else {
        showToast(response.message || 'Failed to load sheets', 'error');
      }
    } catch (error) {
      console.error('Fetch sheets error:', error);
      showToast('Failed to load sheets', 'error');
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // ─── HANDLERS ─────────────────────────────────────────────────

  const handleStartMarking = (sheetId: number) => {
    navigate(`/checker/marking/${sheetId}`);
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || sheetsLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  if (sheets.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">My Queue</h2>
          <p className="text-sm text-gray-500 mt-1">
            No sheets assigned to you yet
          </p>
        </div>
        <EmptyState
          icon="ri-inbox-line"
          title="No sheets assigned yet"
          description="No sheets assigned yet. Check back later."
        />
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
            }`}
        >
          <i
            className={
              toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'
            }
          ></i>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">My Queue</h2>
            <p className="text-sm text-gray-500 mt-1">
              {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} assigned to
              you
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="bg-amber-50 px-3 py-1.5 rounded-full">
              Pending:{' '}
              <span className="font-semibold text-amber-600">
                {stats.pending}
              </span>
            </span>
            <span className="bg-blue-50 px-3 py-1.5 rounded-full">
              Checking:{' '}
              <span className="font-semibold text-blue-600">
                {stats.checking}
              </span>
            </span>
            <span className="bg-emerald-50 px-3 py-1.5 rounded-full">
              Completed:{' '}
              <span className="font-semibold text-emerald-600">
                {stats.completed}
              </span>
            </span>
            {stats.recheck > 0 && (
              <span className="bg-violet-50 px-3 py-1.5 rounded-full">
                Recheck:{' '}
                <span className="font-semibold text-violet-600">
                  {stats.recheck}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sheets.map((sheet) => {
          const examName = sheet.exam_name || 'Unknown Exam';
          const hasDraft = hasDraftForSheet(sheet.id);
          const isChecking = sheet.status === 'checking';
          const isChecked = sheet.status === 'checked';
          const isPending =
            sheet.status === 'assigned' || sheet.status === 'uploaded';
          const isRecheck = sheet.status === 'recheck';
          const isRechecked = sheet.status === 'rechecked';
          const isEscalated = sheet.status === 'escalated';

          // Determine status display
          let statusDisplay = sheet.status;
          if (isRecheck) statusDisplay = 'recheck';
          else if (isRechecked) statusDisplay = 'rechecked';
          else if (isEscalated) statusDisplay = 'escalated';

          return (
            <div
              key={sheet.id}
              className="bg-white rounded-lg border border-gray-100 p-5 hover:border-gray-200 transition-colors duration-150 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {sheet.student_name || 'Unknown Student'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Roll No: {sheet.roll_no || '—'}
                  </p>
                </div>
                <StatusBadge status={statusDisplay} />
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                  Exam
                </p>
                <p className="text-sm text-gray-700 font-medium">{examName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sheet.exam_subject || ''}
                </p>
                {/* ✅ Show Minimum Time to Spend */}
                {sheet.exam_spent_time && sheet.exam_spent_time > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-100">
                    <i className="ri-timer-line text-amber-500 text-xs"></i>
                    <span className="text-[10px] text-amber-700 font-medium">
                      Min time spent: {sheet.exam_spent_time} min
                    </span>
                  </div>
                )}
              </div>

              {/* Draft indicator */}
              {hasDraft && isChecking && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-[11px] text-amber-600 font-medium">
                    Draft saved
                  </span>
                </div>
              )}

              {/* Recheck indicator */}
              {isRecheck && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>
                  <span className="text-[11px] text-violet-600 font-medium">
                    {sheet.pending_recheck_count || 0} recheck request
                    {sheet.pending_recheck_count !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* ✅ Escalated indicator */}
              {isEscalated && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                  <span className="text-[11px] text-red-600 font-medium">
                    Escalated
                    {sheet.escalate_reason && (
                      <span className="text-red-400 ml-1">
                        ({sheet.escalate_reason})
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Sheet #{sheet.id}</span>
                {isChecking ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-edit-line text-base"></i>
                    Continue
                  </button>
                ) : isPending ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-play-line text-base"></i>
                    Start
                  </button>
                ) : isChecked ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-eye-line text-base"></i>
                    View
                  </button>
                ) : isRecheck ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-violet-50 text-violet-700 text-sm font-medium hover:bg-violet-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-refresh-line text-base"></i>
                    Recheck
                  </button>
                ) : isRechecked ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-50 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-eye-line text-base"></i>
                    View
                  </button>
                ) : isEscalated ? (
                  <button
                    onClick={() => handleStartMarking(sheet.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-eye-line text-base"></i>
                    View
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
