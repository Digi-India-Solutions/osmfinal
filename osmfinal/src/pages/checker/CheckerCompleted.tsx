// src/pages/checker/CheckerCompleted.tsx

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import assignmentService from '@/api/assignment';
import { IAssignedSheet } from '@/api/assignment';

export default function CheckerCompleted() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [sheets, setSheets] = useState<IAssignedSheet[]>([]);
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

  // ─── FETCH COMPLETED SHEETS ──────────────────────────────────

  const fetchCompletedSheets = useCallback(async () => {
    setSheetsLoading(true);
    try {
      const response = await assignmentService.getMyAssignedSheets('checked');
      if (response.success) {
        setSheets(response.data.items || []);
      } else {
        showToast(
          response.message || 'Failed to load completed sheets',
          'error',
        );
      }
    } catch (error) {
      console.error('Fetch completed sheets error:', error);
      showToast('Failed to load completed sheets', 'error');
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedSheets();
  }, [fetchCompletedSheets]);

  // ─── CALCULATE STATS ─────────────────────────────────────────

  const totalCompleted = sheets.length;

  // ✅ Fix: Parse marks as float, handle null/undefined
  const averageMarks =
    totalCompleted > 0
      ? (
          sheets.reduce((sum, s) => {
            const marks = parseFloat((s.marks as string) || '0');
            return sum + (isNaN(marks) ? 0 : marks);
          }, 0) / totalCompleted
        ).toFixed(1)
      : '0.0';

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || sheetsLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div>
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Completed Evaluations
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Sheets you have finished marking
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <i className="ri-check-double-line text-lg text-emerald-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {totalCompleted}
              </p>
              <p className="text-xs text-gray-400">Total Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <i className="ri-bar-chart-2-line text-lg text-amber-600"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{averageMarks}</p>
              <p className="text-xs text-gray-400">Average Marks Given</p>
            </div>
          </div>
        </div>
      </div>

      {totalCompleted === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <i className="ri-checkbox-circle-line text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 text-base font-medium">
            No completed evaluations yet
          </p>
          <p className="text-gray-400 text-sm mt-1">
            Finished sheets will appear here
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Sheet ID
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Exam
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Roll No
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Marks
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => {
                  // ✅ Parse marks as float for display
                  const marks = parseFloat((sheet.marks as string) || '0');
                  const displayMarks = isNaN(marks) ? '-' : marks.toFixed(2);

                  return (
                    <tr
                      key={sheet.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        #{sheet.id}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {sheet.exam_name || 'Unknown'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-900 font-medium">
                        {sheet.student_name || 'Unknown'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {sheet.roll_no || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-900 font-semibold">
                        {displayMarks}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={sheet.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() =>
                            navigate(
                              `/checker/marking/${sheet.id}?mode=readonly`,
                            )
                          }
                          className="text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
