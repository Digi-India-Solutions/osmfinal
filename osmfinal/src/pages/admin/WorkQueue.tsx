import { useState, useMemo, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { usePageLoading } from '@/hooks/usePageLoading';
import workQueueService, { Sheet, RecheckUser } from '@/api/workQueue';
import { examApi, ExamResponse } from '@/api/exam';
import api from '@/api/axios';

type TabKey =
  | 'all'
  | 'pending'
  | 'checking'
  | 'rechecking'
  | 'completed'
  | 'escalated';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'checking', label: 'Checking' },
  { key: 'rechecking', label: 'Rechecking' },
  { key: 'completed', label: 'Completed' },
  { key: 'escalated', label: 'Escalated' },
];

// Format time spent in seconds to MM:SS or HH:MM:SS
function formatTimeSpent(seconds: number | null | undefined): string {
  if (!seconds || seconds === 0) return '—';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function WorkQueue() {
  const loading = usePageLoading();

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [stats, setStats] = useState({
    all: 0,
    pending: 0,
    checking: 0,
    rechecking: 0,
    completed: 0,
    escalated: 0,
  });

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [filterExam, setFilterExam] = useState<string | ''>('');
  const [searchName, setSearchName] = useState('');

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

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

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // States for reassign
  const [reassignModal, setReassignModal] = useState<{
    open: boolean;
    sheetId: number | null;
    currentCheckerId: string | null;
    sheetIds?: number[];
  }>({
    open: false,
    sheetId: null,
    currentCheckerId: null,
  });
  const [selectedReassigner, setSelectedReassigner] = useState<string>('');
  const [availableCheckers, setAvailableCheckers] = useState<any[]>([]);
  const [reassignLoading, setReassignLoading] = useState(false);
  const [reassignError, setReassignError] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedSheetIds, setSelectedSheetIds] = useState<number[]>([]);

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
        const res = await examApi.getAllExams({
          limit: 1000,
          excludeArchived: true,
        });
        const activeExams = res.data.filter(
          (exam) => exam.status !== 'archived',
        );
        setExams(activeExams);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH SHEETS ────────────────────────────────────────────

  // ─── FETCH SHEETS ────────────────────────────────────────────

  const fetchSheets = useCallback(async () => {
    setSheetsLoading(true);
    try {
      const params: any = { limit: 1000 };

      if (filterExam) params.examId = filterExam;
      if (searchName) params.search = searchName;

      if (activeTab !== 'all') {
        const statusMap: Record<Exclude<TabKey, 'all'>, string> = {
          pending: 'linked,uploaded,assigned',
          checking: 'checking',
          rechecking: 'recheck',
          completed: 'checked,rechecked',
          escalated: 'escalated',
        };
        params.status = statusMap[activeTab as Exclude<TabKey, 'all'>];
      } else {
        params.status =
          'checking,recheck,escalated,linked,uploaded,assigned,checked,rechecked';
      }

      console.log('📤 Fetching sheets with params:', params); // ✅ Debug log

      const response = await workQueueService.getSheets(params);

      console.log('📥 Sheets response:', response); // ✅ Debug log

      if (response.success) {
        let filteredSheets = response.data.items || [];
        console.log('📋 Filtered sheets:', filteredSheets); // ✅ Debug log

        filteredSheets = filteredSheets.filter(
          (sheet: Sheet) => sheet.status !== 'unlinked',
        );

        setSheets(filteredSheets);

        const statsData = response.data.stats || {};

        setStats({
          all: filteredSheets.length,
          pending: parseInt(statsData.pending || 0),
          checking: parseInt(statsData.checking || 0),
          rechecking: parseInt(statsData.rechecking || 0),
          completed: parseInt(statsData.completed || 0),
          escalated: parseInt(statsData.escalated || 0),
        });
      } else {
        console.error('❌ API returned error:', response.message); // ✅ Debug log
        showToast(response.message || 'Failed to load sheets', 'error');
      }
    } catch (error) {
      console.error('❌ Fetch sheets error:', error); // ✅ Debug log
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

  // ─── FETCH AVAILABLE CHECKERS ─────────────────────────────

  const fetchAvailableCheckers = async (examId: string | null) => {
    try {
      if (!examId) {
        console.log('⚠️ No examId provided, setting empty checkers');
        setAvailableCheckers([]);
        return;
      }

      console.log('🔍 Fetching checkers for exam:', examId);
      const response = await api.get(
        `/api/v1/assignments/exams/${examId}/checkers/available`,
      );
      console.log('✅ Checkers response:', response.data);

      if (response.data.success) {
        setAvailableCheckers(response.data.data || []);
      } else {
        setAvailableCheckers([]);
        showToast(response.data.message || 'Failed to fetch checkers', 'error');
      }
    } catch (error: any) {
      console.error('❌ Fetch available checkers error:', error);
      setAvailableCheckers([]);
      showToast(
        error.response?.data?.message || 'Failed to fetch checkers',
        'error',
      );
    }
  };

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
        setSelectedSheetIds([]);
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

  // ─── OPEN REASSIGN MODAL ─────────────────────────────────────

  const openReassignModal = (
    sheetId: number,
    currentCheckerId: string | null,
    examId: string | null,
  ) => {
    console.log(
      '📋 Opening reassign modal for sheet:',
      sheetId,
      'examId:',
      examId,
    );
    setReassignModal({
      open: true,
      sheetId,
      currentCheckerId,
    });
    setIsBulkMode(false);
    setSelectedReassigner('');
    setReassignError('');
    fetchAvailableCheckers(examId);
  };

  // ─── OPEN BULK REASSIGN MODAL ──────────────────────────────

  const openBulkReassignModal = (
    sheetIds: number[],
    currentCheckerId: string | null,
    examId: string | null,
  ) => {
    if (sheetIds.length === 0) {
      showToast('Please select at least one sheet', 'error');
      return;
    }

    // ✅ Verify all selected sheets have same exam_id
    const selectedSheets = sheets.filter((s) => sheetIds.includes(s.id));
    const examIds = selectedSheets.map((s) => s.exam_id).filter(Boolean);
    const uniqueExamIds = [...new Set(examIds)];

    if (uniqueExamIds.length > 1) {
      showToast('All selected sheets must belong to the same exam', 'error');
      setSelectedSheetIds([]);
      return;
    }

    const examIdToUse = uniqueExamIds[0] || examId;

    console.log(
      '📋 Opening bulk reassign modal for sheets:',
      sheetIds,
      'examId:',
      examIdToUse,
    );

    setReassignModal({
      open: true,
      sheetId: null,
      currentCheckerId,
      sheetIds,
    });
    setIsBulkMode(true);
    setSelectedReassigner('');
    setReassignError('');
    fetchAvailableCheckers(examIdToUse);
  };

  // ─── HANDLE REASSIGN SUBMIT ─────────────────────────────────

  const handleReassignSubmit = async () => {
    setReassignError('');

    if (!selectedReassigner) {
      setReassignError('Please select a checker');
      return;
    }

    if (!reassignModal.sheetId && !isBulkMode) {
      setReassignError('Invalid request');
      return;
    }

    setReassignLoading(true);
    try {
      let sheetIds: number[] = [];
      let examId: string | null = null;

      if (
        isBulkMode &&
        reassignModal.sheetIds &&
        reassignModal.sheetIds.length > 0
      ) {
        const selectedSheets = sheets.filter((s) =>
          reassignModal.sheetIds?.includes(s.id),
        );

        const examIds = selectedSheets.map((s) => s.exam_id).filter(Boolean);
        const uniqueExamIds = [...new Set(examIds)];

        if (uniqueExamIds.length > 1) {
          showToast(
            'All selected sheets must belong to the same exam',
            'error',
          );
          setReassignLoading(false);
          return;
        }

        examId = uniqueExamIds[0] || null;
        sheetIds = reassignModal.sheetIds;
      } else if (reassignModal.sheetId) {
        const sheet = sheets.find((s) => s.id === reassignModal.sheetId);
        if (!sheet) {
          showToast('Sheet not found', 'error');
          setReassignLoading(false);
          return;
        }
        examId = sheet.exam_id;
        sheetIds = [reassignModal.sheetId];
      }

      if (!examId) {
        showToast('Exam ID not found', 'error');
        setReassignLoading(false);
        return;
      }

      console.log(
        '📤 Reassigning sheets:',
        sheetIds,
        'to checker:',
        selectedReassigner,
        'examId:',
        examId,
      );

      const response = await api.post(
        `/api/v1/assignments/exams/${examId}/assign`,
        {
          checkerId: selectedReassigner,
          sheetIds: sheetIds,
        },
      );

      console.log('✅ Reassign response:', response.data);

      if (response.data.success) {
        setSuccessMessage(response.data.message || 'Reassigned successfully');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        setReassignModal({
          open: false,
          sheetId: null,
          currentCheckerId: null,
        });
        setIsBulkMode(false);
        setSelectedSheetIds([]);
        await fetchSheets();
      } else {
        showToast(response.data.message || 'Failed to reassign', 'error');
      }
    } catch (error: any) {
      console.error('❌ Reassign error:', error);
      showToast(error.response?.data?.message || 'Failed to reassign', 'error');
    } finally {
      setReassignLoading(false);
    }
  };

  // ─── GET TAB COUNT ──────────────────────────────────────────

  const getTabCount = (key: TabKey): number => {
    const map: Record<TabKey, number> = {
      all: sheets.length,
      pending: stats.pending,
      checking: stats.checking,
      rechecking: stats.rechecking,
      completed: stats.completed,
      escalated: stats.escalated || 0,
    };
    return map[key] || 0;
  };

  // ─── ESCALATION REASON DISPLAY ──────────────────────────────

  const getEscalationReasonDisplay = (sheet: Sheet): string => {
    if (sheet.escalate_type === 'wrong_subject') return 'Wrong subject';
    if (sheet.escalate_type === 'wrong_student') return 'Wrong student';
    if (sheet.escalate_type === 'incomplete_sheet') return 'Incomplete sheet';
    if (sheet.escalate_type === 'damaged_sheet') return 'Damaged sheet';
    if (sheet.escalate_type === 'double_answer') return 'Double answer';
    if (sheet.escalate_type === 'other') return 'Other';
    return sheet.escalate_reason || 'Escalated';
  };

  // ─── HANDLE SELECT ALL ──────────────────────────────────────

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const assignableSheets = sheets.filter((s) => s.status === 'assigned');
      setSelectedSheetIds(assignableSheets.map((s) => s.id));
    } else {
      setSelectedSheetIds([]);
    }
  };

  // ─── CALCULATE PERCENTAGE ───────────────────────────────────

  const calculatePercentage = (
    marks: string,
    totalMarks: number,
  ): number | null => {
    if (!marks || !totalMarks) return null;
    const obtained = parseFloat(marks);
    if (isNaN(obtained) || obtained === 0) return null;
    return (obtained / totalMarks) * 100;
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
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedSheetIds([]);
                }}
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
              onChange={(e) => setFilterExam(e.target.value)}
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
        {/* Bulk Actions Bar - ONLY in pending tab */}
        {activeTab === 'pending' && selectedSheetIds.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700">
                <i className="ri-checkbox-multiple-line mr-1"></i>
                {selectedSheetIds.length} sheet(s) selected
              </span>
              <span className="text-xs text-blue-600">
                (Only assigned sheets can be reassigned)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const firstSheet = sheets.find(
                    (s) => s.id === selectedSheetIds[0],
                  );
                  if (firstSheet) {
                    openBulkReassignModal(
                      selectedSheetIds,
                      firstSheet.assigned_to || null,
                      firstSheet.exam_id,
                    );
                  }
                }}
                className="text-sm font-medium px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <i className="ri-exchange-line"></i>
                Reassign to Another Checker
              </button>
              <button
                onClick={() => setSelectedSheetIds([])}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

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
                  {/* Checkbox column - ONLY in pending tab */}
                  {activeTab === 'pending' && (
                    <th className="text-left py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={
                          sheets.filter((s) => s.status === 'assigned').length >
                            0 &&
                          selectedSheetIds.length ===
                            sheets.filter((s) => s.status === 'assigned').length
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        title="Select all assigned sheets"
                      />
                    </th>
                  )}
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
                  {activeTab === 'escalated' && (
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Escalation Reason
                    </th>
                  )}
                  {/* Marks column - ONLY show in completed tab */}
                  {activeTab === 'completed' && (
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Marks
                    </th>
                  )}
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Time Spent
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet, index) => {
                  const hasPendingRecheck = sheet.pending_recheck_count > 0;
                  const isRecheckDisabled =
                    sheet.status === 'recheck' || sheet.status === 'rechecked';
                  const isEscalated = sheet.status === 'escalated';
                  const isAssigned = sheet.status === 'assigned';
                  const isChecked =
                    sheet.status === 'checked' || sheet.status === 'rechecked';

                  const timeSpent =
                    (sheet as any).time_spent ||
                    (sheet as any).checking_time_spent ||
                    0;

                  const percentage = calculatePercentage(
                    sheet.marks,
                    sheet.total_marks || 0,
                  );

                  const uniqueKey = `${sheet.id}-${index}`;

                  return (
                    <tr
                      key={uniqueKey}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      {/* Checkbox cell - ONLY for assigned sheets in pending tab */}
                      {activeTab === 'pending' && isAssigned && (
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={selectedSheetIds.includes(sheet.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSheetIds([
                                  ...selectedSheetIds,
                                  sheet.id,
                                ]);
                              } else {
                                setSelectedSheetIds(
                                  selectedSheetIds.filter(
                                    (id) => id !== sheet.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                          />
                        </td>
                      )}
                      {/* Empty cell for non-assigned sheets in pending tab */}
                      {activeTab === 'pending' && !isAssigned && (
                        <td className="py-3 px-2"></td>
                      )}
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
                        {isEscalated && sheet.escalate_reason && (
                          <div className="mt-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-block max-w-[150px] truncate">
                            {getEscalationReasonDisplay(sheet)}
                          </div>
                        )}
                      </td>
                      {activeTab === 'escalated' && (
                        <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap max-w-[200px] truncate">
                          {sheet.escalate_reason || '—'}
                          {sheet.escalate_remarks && (
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              Note: {sheet.escalate_remarks}
                            </span>
                          )}
                        </td>
                      )}
                      {/* Marks cell with fraction format - ONLY show in completed tab */}
                      {activeTab === 'completed' && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          {sheet.marks ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-sm font-semibold">
                                <span className="text-green-600">
                                  {parseFloat(sheet.marks).toFixed(1)}
                                </span>
                                {sheet.total_marks ? (
                                  <span className="text-xs text-gray-400 font-normal">
                                    / {sheet.total_marks}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400 font-normal">
                                    / 0
                                  </span>
                                )}
                              </span>
                              {sheet.total_marks && percentage !== null && (
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    percentage >= 60
                                      ? 'text-green-600 bg-green-50'
                                      : percentage >= 40
                                        ? 'text-amber-600 bg-amber-50'
                                        : 'text-red-600 bg-red-50'
                                  }`}
                                >
                                  {percentage.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {timeSpent > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            {formatTimeSpent(timeSpent)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEscalated ? (
                            <span className="text-xs text-gray-400 italic">
                              Escalated
                            </span>
                          ) : (
                            <>
                              {/* Flag button - Show for 'checked' or 'rechecked' status in pending tab */}
                              {activeTab === 'pending' && isChecked && (
                                <button
                                  onClick={() => openFlagModal(sheet.id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100"
                                  title="Flag for recheck"
                                >
                                  Flag
                                </button>
                              )}

                              {/* Reassign Button - ONLY for 'assigned' sheets in pending tab */}
                              {activeTab === 'pending' && isAssigned && (
                                <button
                                  onClick={() =>
                                    openReassignModal(
                                      sheet.id,
                                      sheet.assigned_to || null,
                                      sheet.exam_id,
                                    )
                                  }
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100"
                                  title="Reassign to another checker"
                                >
                                  <i className="ri-exchange-line mr-0.5"></i>
                                  Reassign
                                </button>
                              )}

                              {/* Show status label for other statuses in pending tab */}
                              {activeTab === 'pending' &&
                                !isChecked &&
                                !isAssigned && (
                                  <span className="text-xs text-gray-400 italic capitalize">
                                    {sheet.status}
                                  </span>
                                )}

                              {/* For other tabs (checking, rechecking, etc.) show Flag button if not recheck disabled */}
                              {activeTab !== 'pending' &&
                                activeTab !== 'rechecking' && (
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
                                    Flag
                                  </button>
                                )}
                            </>
                          )}
                        </div>
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
                </div>
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
                        {r.role && ` - ${r.role}`}
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

      {/* ─── REASSIGN MODAL ────────────────────────────────────── */}

      {reassignModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                Reassign to Another Checker
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {isBulkMode
                    ? `${reassignModal.sheetIds?.length || 0} sheets`
                    : `Sheet #${reassignModal.sheetId}`}
                </span>
              </h4>
              <button
                onClick={() => {
                  setReassignModal({
                    open: false,
                    sheetId: null,
                    currentCheckerId: null,
                  });
                  setIsBulkMode(false);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Select New Checker
                </label>
                {availableCheckers.length === 0 ? (
                  <div className="text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-lg">
                    <i className="ri-information-line mr-1"></i>
                    No other checkers available for this exam.
                    {reassignModal.currentCheckerId && (
                      <span className="block mt-1 text-xs">
                        Current checker may be the only eligible checker.
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedReassigner}
                      onChange={(e) => {
                        setSelectedReassigner(e.target.value);
                        if (reassignError) setReassignError('');
                      }}
                      className="w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                    >
                      <option value="">Select checker...</option>
                      {availableCheckers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.subject ? ` (${c.subject})` : ''}
                          {c.role && ` - ${c.role}`}
                          {c.assigned_count !== undefined &&
                            ` - ${c.assigned_count} assigned`}
                          {c.hasConflict && (
                            <span className="text-red-500">
                              {' '}
                              - {c.conflictReason}
                            </span>
                          )}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5">
                      <i className="ri-information-line mr-0.5"></i>
                      Showing checkers with active status
                    </p>
                  </>
                )}
                {reassignError && (
                  <p className="text-xs text-rose-500 mt-1">{reassignError}</p>
                )}
              </div>

              {isBulkMode && reassignModal.sheetIds && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-700">
                    <i className="ri-information-line mr-1"></i>
                    Reassigning <strong>
                      {reassignModal.sheetIds.length}
                    </strong>{' '}
                    sheets to the selected checker
                  </p>
                  <p className="text-[10px] text-blue-600 mt-1">
                    Sheet IDs: {reassignModal.sheetIds.join(', ')}
                  </p>
                </div>
              )}

              {reassignModal.currentCheckerId && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600">
                    <i className="ri-user-line mr-1"></i>
                    Current checker:{' '}
                    <span className="font-medium">
                      {sheets.find(
                        (s) => s.assigned_to === reassignModal.currentCheckerId,
                      )?.assigned_to_name || 'Unknown'}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => {
                  setReassignModal({
                    open: false,
                    sheetId: null,
                    currentCheckerId: null,
                  });
                  setIsBulkMode(false);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleReassignSubmit}
                disabled={
                  !selectedReassigner ||
                  reassignLoading ||
                  availableCheckers.length === 0
                }
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {reassignLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Reassigning...
                  </>
                ) : (
                  <>
                    <i className="ri-exchange-line"></i>
                    Confirm Reassign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
