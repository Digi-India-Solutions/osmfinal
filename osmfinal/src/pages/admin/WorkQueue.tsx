// src/pages/admin/WorkQueue.tsx

import { useState, useMemo, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { usePageLoading } from '@/hooks/usePageLoading';
import workQueueService, { Sheet, RecheckUser } from '@/api/workQueue';
import { examApi, ExamResponse } from '@/api/exam';

type TabKey = 'all' | 'pending' | 'checking' | 'rechecking' | 'completed';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'checking', label: 'Checking' },
  { key: 'rechecking', label: 'Rechecking' },
  { key: 'completed', label: 'Completed' },
];

function getDraftTimestamp(sheetId: number): string | null {
  try {
    const raw = localStorage.getItem(`osm_draft_sheet_${sheetId}`);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.marks && draft.marks.length > 0 && draft.savedAt) {
      const savedTime = new Date(draft.savedAt);
      return savedTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return null;
  } catch {
    return null;
  }
}

export default function WorkQueue() {
  const loading = usePageLoading();

  // ─── STATE ──────────────────────────────────────────────────

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [stats, setStats] = useState({
    all: 0,
    pending: 0,
    checking: 0,
    rechecking: 0,
    completed: 0,
  });

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [filterExam, setFilterExam] = useState<number | ''>('');
  const [searchName, setSearchName] = useState('');

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  // ─── RECHECK MODAL STATE ──────────────────────────────────

  const [flagModal, setFlagModal] = useState<{
    open: boolean;
    sheetId: number | null;
  }>({
    open: false,
    sheetId: null,
  });
  const [flagOption, setFlagOption] = useState<'single' | 'entire'>('single');
  const [flagEvaluator, setFlagEvaluator] = useState<string>('');
  const [flagReason, setFlagReason] = useState('');
  const [flagError, setFlagError] = useState('');

  const [recheckers, setRecheckers] = useState<RecheckUser[]>([]);
  const [recheckersLoading, setRecheckersLoading] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── TOAST ──────────────────────────────────────────────────

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

  // ─── FETCH EXAMS ────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExams(res.data || []);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH SHEETS ────────────────────────────────────────────

  const fetchSheets = useCallback(async () => {
    setSheetsLoading(true);
    try {
      const params: any = { limit: 1000 };

      if (filterExam) params.examId = filterExam;
      if (searchName) params.search = searchName;

      if (activeTab !== 'all') {
        const statusMap: Record<TabKey, string> = {
          all: '',
          pending: 'uploaded,assigned',
          checking: 'checking',
          rechecking: 'recheck',
          completed: 'checked,rechecked',
        };
        params.status = statusMap[activeTab];
      }

      const response = await workQueueService.getSheets(params);
      if (response.success) {
        setSheets(response.data.items || []);
        setStats(
          response.data.stats || {
            all: 0,
            pending: 0,
            checking: 0,
            rechecking: 0,
            completed: 0,
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
  }, [activeTab, filterExam, searchName]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // ─── FETCH RECHECKERS ──────────────────────────────────────

  const fetchRecheckers = useCallback(async () => {
    setRecheckersLoading(true);
    try {
      const response = await workQueueService.getRecheckUsers();
      if (response.success) {
        setRecheckers(response.data || []);
      }
    } catch (error) {
      console.error('Fetch recheckers error:', error);
    } finally {
      setRecheckersLoading(false);
    }
  }, []);

  // ─── OPEN FLAG MODAL ────────────────────────────────────────

  const openFlagModal = (sheetId: number) => {
    setFlagModal({ open: true, sheetId });
    setFlagOption('single');
    setFlagEvaluator('');
    setFlagReason('');
    setFlagError('');
    fetchRecheckers();
  };

  // ─── HANDLE FLAG SUBMIT ─────────────────────────────────────

  const handleFlagSubmit = async () => {
    setFlagError('');

    if (!flagEvaluator) {
      setFlagError('Please select an evaluator');
      return;
    }

    if (!flagReason.trim() || flagReason.trim().length < 5) {
      setFlagError('Please enter at least 5 characters for the reason');
      return;
    }

    if (!flagModal.sheetId) return;

    setIsSubmitting(true);
    try {
      const response = await workQueueService.flagForRecheck(
        flagModal.sheetId,
        {
          scope: flagOption,
          assignTo: flagEvaluator,
          reason: flagReason.trim(),
        },
      );

      if (response.success) {
        setSuccessMessage(
          response.message || 'Flagged for recheck successfully',
        );
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setFlagModal({ open: false, sheetId: null });
        await fetchSheets();
      } else {
        showToast(response.message || 'Failed to flag for recheck', 'error');
      }
    } catch (error: any) {
      console.error('Flag recheck error:', error);
      showToast(error.message || 'Failed to flag for recheck', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── GET TAB COUNT ──────────────────────────────────────────

  const getTabCount = (key: TabKey): number => {
    const map: Record<TabKey, number> = {
      all: stats.all,
      pending: stats.pending,
      checking: stats.checking,
      rechecking: stats.rechecking,
      completed: stats.completed,
    };
    return map[key] || 0;
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Work Queue' }]}
      />

      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line"></i>
          </span>
          {successMessage}
        </div>
      )}

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

      <div>
        <h3 className="text-lg font-semibold text-gray-900">Work Queue</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitor and manage all answer sheet workflows
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] text-gray-400">
                  {getTabCount(tab.key)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center text-gray-400">
                <i className="ri-search-line text-xs"></i>
              </span>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Search student..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent w-48 placeholder:text-gray-400"
              />
            </div>
            <select
              value={filterExam}
              onChange={(e) =>
                setFilterExam(e.target.value ? Number(e.target.value) : '')
              }
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
              disabled={examsLoading}
            >
              <option value="">All Exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {sheetsLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-400 mt-3">Loading sheets...</p>
            </div>
          ) : sheets.length === 0 ? (
            <EmptyState
              icon="ri-file-search-line"
              title="No sheets found"
              description="No sheets found. Try changing the filter."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Sheet ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Roll No
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Student
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Exam
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Assigned To
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Last Saved
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => {
                  const draftTime = getDraftTimestamp(sheet.id);
                  const hasPendingRecheck = sheet.pending_recheck_count > 0;
                  const isRecheckDisabled =
                    sheet.status === 'recheck' || sheet.status === 'rechecked';

                  return (
                    <tr
                      key={sheet.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                        #{sheet.id}
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {sheet.roll_no || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                        {sheet.student_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {sheet.exam_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {sheet.assigned_to_name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={sheet.status} />
                        {hasPendingRecheck && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-700">
                            {sheet.pending_recheck_count} recheck
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {draftTime ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                            {draftTime}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openFlagModal(sheet.id)}
                          disabled={isRecheckDisabled}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                            isRecheckDisabled
                              ? 'text-gray-300 bg-gray-100 cursor-not-allowed'
                              : 'text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100'
                          }`}
                          title={
                            isRecheckDisabled
                              ? 'Already in recheck'
                              : 'Flag for recheck'
                          }
                        >
                          Flag for Recheck
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── FLAG MODAL ────────────────────────────────────────── */}

      {flagModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                Flag for Recheck
                <span className="text-sm font-normal text-gray-400 ml-2">
                  Sheet #{flagModal.sheetId}
                </span>
              </h4>
              <button
                onClick={() => setFlagModal({ open: false, sheetId: null })}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scope
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFlagOption('single')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      flagOption === 'single'
                        ? 'border-gray-900 bg-gray-50 text-gray-900'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-file-line"></i>
                      </span>
                      This sheet only
                    </div>
                  </button>
                  <button
                    onClick={() => setFlagOption('entire')}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      flagOption === 'entire'
                        ? 'border-gray-900 bg-gray-50 text-gray-900'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-center">
                      <span className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-stack-line"></i>
                      </span>
                      Entire exam
                    </div>
                  </button>
                </div>
                {flagOption === 'entire' && (
                  <p className="text-xs text-amber-600 mt-2">
                    <i className="ri-information-line mr-1"></i>
                    All sheets for this exam will be flagged for recheck
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Assign Recheck Evaluator
                </label>
                {recheckersLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></span>
                    Loading recheckers...
                  </div>
                ) : recheckers.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                    <i className="ri-information-line mr-1"></i>
                    No recheckers available. Please add users with "rechecking"
                    role.
                  </p>
                ) : (
                  <select
                    value={flagEvaluator}
                    onChange={(e) => {
                      setFlagEvaluator(e.target.value);
                      if (flagError) setFlagError('');
                    }}
                    className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  >
                    <option value="">Select evaluator...</option>
                    {recheckers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.subject ? `(${r.subject})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason for Recheck
                </label>
                <textarea
                  value={flagReason}
                  onChange={(e) => {
                    setFlagReason(e.target.value);
                    if (flagError && e.target.value.trim().length >= 5)
                      setFlagError('');
                  }}
                  placeholder="Describe why this needs rechecking..."
                  maxLength={500}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 min-h-[80px] resize-none ${
                    flagError && flagReason.trim().length < 5
                      ? 'border-rose-400'
                      : 'border-gray-200'
                  }`}
                ></textarea>
                {flagError && (
                  <p className="text-xs text-rose-500 mt-1">{flagError}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {flagReason.length}/500
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setFlagModal({ open: false, sheetId: null })}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagSubmit}
                disabled={!flagEvaluator || !flagReason.trim() || isSubmitting}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Submitting...
                  </>
                ) : (
                  'Confirm Flag'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
