// src/pages/checker/CheckerDashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';
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

export default function CheckerDashboard() {
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
      console.log('📥 API Response:', response); // ✅ Debug log

      if (response.success) {
        const items = response.data.items || [];
        const statsData = response.data.stats || {
          pending: 0,
          checking: 0,
          completed: 0,
          recheck: 0,
        };

        console.log('📊 Stats from API:', statsData); // ✅ Debug log

        setSheets(items);
        setStats(statsData);
      } else {
        showToast(response.message || 'Failed to load sheets', 'error');
      }
    } catch (error) {
      console.error('❌ Fetch sheets error:', error);
      showToast('Failed to load sheets', 'error');
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // ─── CALCULATE STATS DYNAMICALLY FROM API ──────────────────

  // ✅ Use API stats directly instead of calculating from sheets
  // This ensures consistency with backend
  const totalAssigned = sheets.length;

  // ✅ Use stats from API response
  const pendingSheets = stats.pending || 0;
  const checkingSheets = stats.checking || 0;
  const completedSheets = stats.completed || 0;
  const recheckSheets = stats.recheck || 0;

  // ✅ Calculate escalated sheets from sheets data
  const escalatedSheets = sheets.filter((s) => s.status === 'escalated').length;

  // ✅ Calculate average marks for completed sheets from API data
  const averageMarks =
    completedSheets > 0
      ? (
          sheets
            .filter((s) => s.status === 'checked' || s.status === 'rechecked')
            .reduce((sum, s) => {
              const marks = parseFloat((s.marks as string) || '0');
              return sum + (isNaN(marks) ? 0 : marks);
            }, 0) / completedSheets
        ).toFixed(1)
      : '0.0';

  // ─── HANDLERS ─────────────────────────────────────────────────

  const handleStartMarking = (sheetId: number) => {
    navigate(`/checker/marking/${sheetId}`);
  };

  const handleViewCompleted = () => {
    navigate('/checker/completed');
  };

  const handleGoToQueue = () => {
    navigate('/checker/queue');
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || sheetsLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
            toast.type === 'error'
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

      {/* ─── WELCOME CARD ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name || 'Checker'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalAssigned} sheet{totalAssigned !== 1 ? 's' : ''} assigned to
              you
            </p>
          </div>
        </div>
      </div>

      {/* ─── STATS CARDS ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer border border-gray-100"
          onClick={handleGoToQueue}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">Pending</p>
              <p className="text-2xl font-bold text-amber-600">
                {pendingSheets}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="ri-time-line text-lg text-amber-600"></i>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer border border-gray-100"
          onClick={handleGoToQueue}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Checking
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {checkingSheets}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <i className="ri-edit-line text-lg text-blue-600"></i>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer border border-gray-100"
          onClick={handleViewCompleted}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Completed
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {completedSheets}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="ri-check-double-line text-lg text-emerald-600"></i>
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer border border-gray-100"
          onClick={handleGoToQueue}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">Recheck</p>
              <p className="text-2xl font-bold text-violet-600">
                {recheckSheets}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <i className="ri-refresh-line text-lg text-violet-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AVERAGE MARKS & ESCALATED ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="ri-bar-chart-2-line text-lg text-amber-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{averageMarks}</p>
              <p className="text-xs text-gray-400">
                Average Marks Given ({completedSheets} completed)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <i className="ri-alert-line text-lg text-red-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {escalatedSheets}
              </p>
              <p className="text-xs text-gray-400">Escalated Sheets</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RECENT SHEETS ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Recent Assigned Sheets
          </h4>
          <button
            onClick={handleGoToQueue}
            className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
          >
            View All →
          </button>
        </div>

        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <i className="ri-inbox-line text-xl text-gray-400"></i>
            </div>
            <p className="text-sm text-gray-500">No sheets assigned yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheets.slice(0, 5).map((sheet) => {
                  const hasDraft = hasDraftForSheet(sheet.id);
                  const isPending =
                    sheet.status === 'assigned' || sheet.status === 'uploaded';
                  const isChecking = sheet.status === 'checking';
                  const isCompleted =
                    sheet.status === 'checked' || sheet.status === 'rechecked';
                  const isRecheck = sheet.status === 'recheck';
                  const isEscalated = sheet.status === 'escalated';

                  let actionText = 'Start';
                  let actionColor =
                    'bg-blue-50 text-blue-700 hover:bg-blue-100';
                  let actionIcon = 'ri-play-line';

                  if (isChecking) {
                    actionText = 'Continue';
                    actionColor =
                      'bg-amber-50 text-amber-700 hover:bg-amber-100';
                    actionIcon = 'ri-edit-line';
                  } else if (isCompleted || isRecheck || isEscalated) {
                    actionText = 'View';
                    actionColor = 'bg-gray-50 text-gray-600 hover:bg-gray-100';
                    actionIcon = 'ri-eye-line';
                  }

                  return (
                    <tr
                      key={sheet.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="py-3 px-3">
                        <p className="text-sm font-medium text-gray-900">
                          {sheet.student_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Roll: {sheet.roll_no || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-sm text-gray-700">
                          {sheet.exam_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {sheet.exam_subject || ''}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={sheet.status} />
                        {hasDraft && isChecking && (
                          <span className="ml-1.5 text-[10px] text-amber-600 font-medium">
                            (Draft)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-500">
                        {sheet.exam_spent_time || 0} min
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleStartMarking(sheet.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${actionColor}`}
                        >
                          <i className={`${actionIcon} text-sm`}></i>
                          {actionText}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
