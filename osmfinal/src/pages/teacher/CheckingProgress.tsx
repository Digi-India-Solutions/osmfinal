// src/pages/teacher/CheckingProgress.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { teacherApi, type TeacherExam, type TeacherSheet } from '@/api/teacher';

interface DisputeForm {
  sheetId: string;
  studentName: string;
  rollNo: string;
  examId: string;
}

export default function CheckingProgress() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();
  const subject = currentUser?.subject ?? '';

  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<TeacherSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disputeModal, setDisputeModal] = useState<DisputeForm | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeError, setDisputeError] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [localDisputeIds, setLocalDisputeIds] = useState<Set<string>>(
    new Set(),
  );
  const [existingDisputeIds, setExistingDisputeIds] = useState<Set<string>>(
    new Set(),
  );

  // ✅ Fetch exams using teacherApi (which now uses examApi internally)
  // src/pages/teacher/CheckingProgress.tsx

  useEffect(() => {
    const fetchExams = async () => {
      setIsLoading(true);
      try {
        const response = await teacherApi.getExams();
        console.log('📋 All exams from API:', response.data);
        console.log('📋 Current user subject:', subject);

        if (response.success) {
          // ✅ Step 1: Exclude archived exams
          const activeExams = response.data.filter(
            (e) => e.status !== 'archived',
          );
          console.log('📋 Active exams (archived removed):', activeExams);

          // ✅ Step 2: Filter by subject
          const trimmedSubject = subject.trim();
          const filtered = activeExams.filter((e) => {
            const examSubject = e.subject?.trim() || '';
            return examSubject.toLowerCase() === trimmedSubject.toLowerCase();
          });

          console.log('📋 Filtered exams:', filtered);
          setExams(filtered);

          // ✅ Step 3: Fallback - show all active exams if no match
          if (filtered.length === 0 && activeExams.length > 0) {
            console.log(
              '⚠️ No exams matched subject, showing all active exams',
            );
            setExams(activeExams);
          }
        }
      } catch (error) {
        console.error('Fetch exams error:', error);
        setToastMsg('Failed to load exams');
        setTimeout(() => setToastMsg(null), 3000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExams();
  }, [subject]);

  // Fetch progress when exam selected
  useEffect(() => {
    const fetchProgress = async () => {
      if (!selectedExamId) {
        setSheets([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await teacherApi.getProgress(selectedExamId);
        if (response.success) {
          setSheets(response.data.sheets);

          const disputeIds = new Set<string>();
          response.data.sheets.forEach((sheet: TeacherSheet) => {
            if (sheet.isDisputed) {
              disputeIds.add(sheet.id);
            }
          });
          setExistingDisputeIds(disputeIds);
        }
      } catch (error) {
        console.error('Fetch progress error:', error);
        setToastMsg('Failed to load progress');
        setTimeout(() => setToastMsg(null), 3000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProgress();
  }, [selectedExamId]);

  const subjectExams = exams;
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const examSheets = selectedExamId ? sheets : [];

  const totalSheets = examSheets.length;
  const checkingSheets = examSheets.filter(
    (s) => s.status === 'checking',
  ).length;
  const checkedSheets = examSheets.filter((s) => s.status === 'checked').length;
  const recheckSheets = examSheets.filter((s) => s.status === 'recheck').length;
  const doneSheets = examSheets.filter(
    (s) => s.status === 'checked' || s.status === 'rechecked',
  ).length;
  const progressPct =
    totalSheets > 0 ? Math.round((doneSheets / totalSheets) * 100) : 0;

  const allDisputeIds = new Set([...existingDisputeIds, ...localDisputeIds]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openDispute = (
    studentName: string,
    rollNo: string,
    examId: string,
    sheetId: string,
  ) => {
    if (allDisputeIds.has(sheetId)) {
      showToast('Dispute already flagged for this sheet');
      return;
    }
    setDisputeModal({ sheetId, studentName, rollNo, examId });
    setDisputeReason('');
    setDisputeError('');
  };

  const submitDispute = async () => {
    if (!disputeReason.trim() || disputeReason.trim().length < 10) {
      setDisputeError('Please enter at least 10 characters for the reason');
      return;
    }
    if (!disputeModal) return;

    try {
      const response = await teacherApi.requestRecheck({
        sheetId: disputeModal.sheetId,
        examId: disputeModal.examId,
        reason: disputeReason.trim(),
      });

      if (response.success) {
        setLocalDisputeIds((prev) => new Set(prev).add(disputeModal.sheetId));
        setDisputeModal(null);
        showToast('Dispute flagged successfully');
      } else {
        setDisputeError(response.message || 'Failed to flag dispute');
      }
    } catch (error: any) {
      console.error('Submit dispute error:', error);
      setDisputeError(error.message || 'Failed to flag dispute');
    }
  };

  const summaryCards = [
    {
      label: 'Total Sheets',
      value: totalSheets,
      color: 'bg-gray-100 text-gray-700',
      icon: 'ri-file-copy-2-line',
    },
    {
      label: 'Checking',
      value: checkingSheets,
      color: 'bg-amber-50 text-amber-600',
      icon: 'ri-time-line',
    },
    {
      label: 'Checked',
      value: checkedSheets,
      color: 'bg-emerald-50 text-emerald-600',
      icon: 'ri-check-line',
    },
    {
      label: 'Recheck',
      value: recheckSheets,
      color: 'bg-violet-50 text-violet-600',
      icon: 'ri-refresh-line',
    },
    {
      label: 'Done',
      value: doneSheets,
      color: 'bg-teal-50 text-teal-600',
      icon: 'ri-check-double-line',
    },
  ];

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg">
          <i className="ri-check-line mr-2"></i>
          {toastMsg}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
          Checking Progress
        </h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
          {subject || 'All Subjects'}
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exam
        </label>
        <select
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
          value={selectedExamId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedExamId(val ? val : null);
          }}
        >
          <option value="" disabled>
            Select an exam...
          </option>
          {subjectExams.length > 0 ? (
            subjectExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.date})
              </option>
            ))
          ) : (
            <option value="" disabled>
              No exams found
            </option>
          )}
        </select>
        {subjectExams.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">
            No exams found for {subject}. Showing all exams.
          </p>
        )}
      </div>

      {selectedExam && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}
                  >
                    <i className={`${card.icon} text-sm`}></i>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {card.label}
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedExam.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {doneSheets} of {totalSheets} sheets completed
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                {progressPct}% Complete
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 overflow-x-auto">
            {examSheets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No sheets found for this exam.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Roll No
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Student
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Assigned To
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Marks
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {examSheets.map((sheet) => {
                    const isDisputed = allDisputeIds.has(sheet.id);

                    return (
                      <tr
                        key={sheet.id}
                        className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors duration-100"
                      >
                        <td className="py-3 px-3">
                          <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                            {sheet.roll_no}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-gray-700 whitespace-nowrap">
                            {sheet.student_name}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {sheet.checker_name || 'Unassigned'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={sheet.status} />
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                            {sheet.marks !== null
                              ? `${sheet.marks} / 100`
                              : '\u2014'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(sheet.status === 'checking' ||
                              sheet.status === 'checked') && (
                              <button
                                onClick={() =>
                                  openDispute(
                                    sheet.student_name,
                                    sheet.roll_no,
                                    sheet.exam_id,
                                    sheet.id,
                                  )
                                }
                                disabled={isDisputed}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150 whitespace-nowrap ${
                                  isDisputed
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer'
                                }`}
                              >
                                <i
                                  className={`${isDisputed ? 'ri-check-line' : 'ri-flag-line'} mr-1`}
                                ></i>
                                {isDisputed ? 'Disputed' : 'Flag Dispute'}
                              </button>
                            )}
                            {(sheet.status === 'checked' ||
                              sheet.status === 'rechecked') && (
                              <button
                                onClick={() =>
                                  navigate(
                                    `/checker/marking/${sheet.id}?mode=readonly`,
                                  )
                                }
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                              >
                                <i className="ri-eye-line mr-1"></i>
                                View
                              </button>
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
        </>
      )}

      {!selectedExam && subjectExams.length > 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-line-chart-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            Select an exam above to view checking progress.
          </p>
        </div>
      )}

      {subjectExams.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-folder-open-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            No exams found for {subject || 'your subject'}.
          </p>
        </div>
      )}

      {disputeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDisputeModal(null)}
          ></div>
          <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <button
              onClick={() => setDisputeModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors duration-150 cursor-pointer"
            >
              <i className="ri-close-line text-gray-500"></i>
            </button>

            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Flag Sheet for Recheck
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {disputeModal.studentName} &middot; Roll No. {disputeModal.rollNo}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reason for dispute *
              </label>
              <textarea
                rows={3}
                maxLength={500}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 ${disputeError ? 'border-rose-400' : 'border-gray-200'}`}
                placeholder="Describe why this sheet needs to be rechecked..."
                value={disputeReason}
                onChange={(e) => {
                  setDisputeReason(e.target.value);
                  if (disputeError) setDisputeError('');
                }}
              ></textarea>
              {disputeError && (
                <p className="text-xs text-rose-500 mt-1">{disputeError}</p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
              <div className="flex items-start gap-2">
                <i className="ri-information-line text-amber-500 mt-0.5"></i>
                <p className="text-xs text-amber-700">
                  This will send a recheck request to Admin for approval.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDisputeModal(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitDispute}
                className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-flag-line mr-1.5"></i> Flag Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
