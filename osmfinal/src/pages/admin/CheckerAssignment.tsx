// src/pages/admin/CheckerAssignment.tsx

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import assignmentService from '@/api/assignment';
import type { IUnassignedSheet, IAvailableChecker } from '@/api/assignment';
import { useAuth } from '@/context/AuthContext';

interface AssignmentLog {
  id: number;
  sheetIds: number[];
  checkerName: string;
  time: string;
  count: number;
}

export default function CheckerAssignment() {
  const { currentUser } = useAuth();
  const role = currentUser?.role ?? '';
  const subject = currentUser?.subject ?? '';
  const loading = usePageLoading();
  const navigate = useNavigate();

  // ─── EXAMS ──────────────────────────────────────────────────

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('');

  // ─── DATA ───────────────────────────────────────────────────

  const [unassignedSheets, setUnassignedSheets] = useState<IUnassignedSheet[]>(
    [],
  );
  const [availableCheckers, setAvailableCheckers] = useState<
    IAvailableChecker[]
  >([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // ─── TOAST ──────────────────────────────────────────────────

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ─── FILTER EXAMS ──────────────────────────────────────────

  const filteredExams = useMemo(() => {
    if (
      role === 'super_admin' ||
      role === 'admin' ||
      role === 'teacher_checker'
    ) {
      return exams;
    }
    return exams.filter((e) => e.subject === subject);
  }, [role, subject, exams]);

  // ─── FETCH EXAMS ────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({
          limit: 1000,
          excludeArchived: true,
        });
        setExams(res.data);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
        showToast('Failed to load exams', 'error');
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH DATA ─────────────────────────────────────────────

  const fetchData = useCallback(async (examId: string) => {
    if (!examId) return;

    try {
      const [sheetsRes, checkersRes] = await Promise.all([
        assignmentService.getUnassignedSheets(examId),
        assignmentService.getAvailableCheckers(examId),
      ]);

      if (sheetsRes.success) {
        setUnassignedSheets(sheetsRes.data || []);
        setSelectedSheets(new Set());
      } else {
        showToast(sheetsRes.message || 'Failed to load sheets', 'error');
      }

      if (checkersRes.success) {
        setAvailableCheckers(checkersRes.data || []);
      } else {
        showToast(checkersRes.message || 'Failed to load checkers', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      showToast('Failed to load assignment data', 'error');
    }
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchData(selectedExam);
    }
  }, [selectedExam, fetchData]);

  // ─── HANDLERS ──────────────────────────────────────────────

  const handleExamChange = (val: string) => {
    setSelectedExam(val);
    setSelectedSheets(new Set());
    setLogs([]);
  };

  const toggleSheet = (id: number) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllSheets = () => {
    if (selectedSheets.size === unassignedSheets.length) {
      setSelectedSheets(new Set());
    } else {
      setSelectedSheets(new Set(unassignedSheets.map((s) => s.id)));
    }
  };

  const assignToChecker = async (checker: IAvailableChecker) => {
    if (selectedSheets.size === 0 || !selectedExam) {
      showToast('Please select at least one sheet to assign', 'info');
      return;
    }
    if (checker.hasConflict) {
      showToast(
        `${checker.name} has a conflict and cannot be assigned`,
        'error',
      );
      return;
    }

    setIsAssigning(true);
    try {
      const sheetIds = Array.from(selectedSheets);
      const response = await assignmentService.assignSheets(
        selectedExam,
        checker.id,
        sheetIds,
      );

      if (response.success) {
        setLogs((prev) => [
          {
            id: Date.now(),
            sheetIds,
            checkerName: checker.name,
            time: new Date().toLocaleTimeString(),
            count: sheetIds.length,
          },
          ...prev,
        ]);
        setSelectedSheets(new Set());
        showToast(
          `✅ Assigned ${sheetIds.length} sheet(s) to ${checker.name}`,
          'success',
        );
        await fetchData(selectedExam);
      } else {
        showToast(response.message || 'Failed to assign', 'error');
      }
    } catch (error) {
      console.error('Assign error:', error);
      showToast('Failed to assign sheets', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const assignRandomly = async () => {
    if (!selectedExam) {
      showToast('Please select an exam first', 'info');
      return;
    }

    if (unassignedSheets.length === 0) {
      showToast('No unassigned sheets to assign', 'info');
      return;
    }

    const eligibleCheckers = availableCheckers.filter((c) => c.canAssign);
    if (eligibleCheckers.length === 0) {
      showToast(
        'No eligible checkers available for random assignment',
        'error',
      );
      return;
    }

    setIsAssigning(true);
    try {
      const response = await assignmentService.randomAssignment(selectedExam);

      if (response.success) {
        const logEntry: AssignmentLog = {
          id: Date.now(),
          sheetIds: [],
          checkerName: `Random (${eligibleCheckers.length} checkers)`,
          time: new Date().toLocaleTimeString(),
          count: unassignedSheets.length,
        };

        setLogs((prev) => [logEntry, ...prev]);
        showToast(response.message || 'Random assignment completed', 'success');
        await fetchData(selectedExam);
      } else {
        showToast(response.message || 'Failed to assign randomly', 'error');
      }
    } catch (error) {
      console.error('Random assignment error:', error);
      showToast('Failed to assign randomly', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  // ─── GET SELECTED SHEET DETAILS ────────────────────────────

  const getSelectedSheetDetails = () => {
    return unassignedSheets
      .filter((s) => selectedSheets.has(s.id))
      .map((s) => `${s.roll_no} (${s.student_name})`)
      .join(', ');
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Assign Checkers' },
        ]}
      />

      {/* ─── TOAST NOTIFICATION ─── */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 animate-slide-in-right ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : toast.type === 'info'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-900 text-white'
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            {toast.type === 'error' && (
              <i className="ri-error-warning-line"></i>
            )}
            {toast.type === 'info' && <i className="ri-information-line"></i>}
            {toast.type === 'success' && <i className="ri-check-line"></i>}
          </span>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Checker Assignment
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Assign unassigned sheets to available checkers
          </p>
        </div>
        <button
          onClick={assignRandomly}
          disabled={
            selectedExam === '' ||
            unassignedSheets.length === 0 ||
            isAssigning ||
            availableCheckers.filter((c) => c.canAssign).length === 0
          }
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          {isAssigning ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Assigning...
            </>
          ) : (
            <>
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-shuffle-line text-base"></i>
              </span>
              Assign Randomly
            </>
          )}
        </button>
      </div>

      {/* ─── EXAM SELECTOR ─── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exam
        </label>
        <select
          value={selectedExam}
          onChange={(e) => handleExamChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
        >
          <option value="">Choose an active exam...</option>
          {filteredExams
            .filter((e) => e.status === 'active')
            .map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.subject}) - {exam.semester || 'N/A'}
              </option>
            ))}
        </select>
      </div>

      {selectedExam && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ─── UNASSIGNED SHEETS ────────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-900">
                Unassigned Sheets
                <span className="text-gray-400 font-normal ml-2">
                  ({unassignedSheets.length})
                </span>
              </h4>
              {unassignedSheets.length > 0 && (
                <button
                  onClick={toggleAllSheets}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {selectedSheets.size === unassignedSheets.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              )}
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap w-10"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      ID
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Roll No
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Student
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedSheets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-gray-400 text-sm"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <i className="ri-check-double-line text-2xl text-gray-300"></i>
                          <span>All sheets have been assigned</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unassignedSheets.map((sheet) => (
                      <tr
                        key={sheet.id}
                        className={`border-b border-gray-50 transition-colors cursor-pointer ${
                          selectedSheets.has(sheet.id)
                            ? 'bg-gray-50'
                            : 'hover:bg-gray-50/30'
                        }`}
                        onClick={() => toggleSheet(sheet.id)}
                      >
                        <td className="py-3 px-4">
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedSheets.has(sheet.id)
                                ? 'bg-gray-900 border-gray-900'
                                : 'border-gray-300'
                            }`}
                          >
                            {selectedSheets.has(sheet.id) && (
                              <i className="ri-check-line text-white text-[10px]"></i>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                          #{sheet.id}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {sheet.roll_no}
                        </td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                          {sheet.student_name}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedSheets.size > 0 && (
              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/30">
                <p className="text-xs text-gray-500">
                  Selected:{' '}
                  <span className="font-medium text-gray-700">
                    {selectedSheets.size}
                  </span>{' '}
                  sheets
                  {selectedSheets.size <= 3 && (
                    <span className="ml-2 text-gray-400">
                      ({getSelectedSheetDetails()})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* ─── AVAILABLE CHECKERS ───────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-900">
                Available Checkers
                <span className="text-gray-400 font-normal ml-2">
                  ({availableCheckers.length})
                </span>
              </h4>
              {availableCheckers.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {availableCheckers.filter((c) => c.canAssign).length} eligible
                  for assignment
                </p>
              )}
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Role
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Subject
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {availableCheckers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-gray-400 text-sm"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <i className="ri-user-search-line text-2xl text-gray-300"></i>
                          <span>No checkers available</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    availableCheckers.map((checker) => (
                      <tr
                        key={checker.id}
                        className={`border-b border-gray-50 transition-colors ${
                          checker.hasConflict
                            ? 'opacity-60'
                            : 'hover:bg-gray-50/30'
                        }`}
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                          {checker.name}
                          {checker.currentLoad > 0 && (
                            <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              {checker.currentLoad} assigned
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                          {checker.role === 'teacher_checker'
                            ? 'Teacher + Checker'
                            : 'Checker'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                          {checker.subject || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {checker.hasConflict ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full whitespace-nowrap">
                              <span className="w-3 h-3 flex items-center justify-center">
                                <i className="ri-error-warning-line text-[10px]"></i>
                              </span>
                              Conflict
                            </span>
                          ) : (
                            <button
                              onClick={() => assignToChecker(checker)}
                              disabled={
                                selectedSheets.size === 0 || isAssigning
                              }
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                                selectedSheets.size === 0 || isAssigning
                                  ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                  : 'text-white bg-gray-900 hover:bg-gray-800 cursor-pointer'
                              }`}
                            >
                              Assign ({selectedSheets.size})
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── ASSIGNMENT LOG ─── */}
      {logs.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h4 className="text-sm font-semibold text-gray-900">
              Assignment Log
              <span className="text-gray-400 font-normal ml-2">
                ({logs.length} entries)
              </span>
            </h4>
          </div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Time
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Checker
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Sheets Assigned
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Sheet IDs
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {log.time}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {log.checkerName}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold text-xs">
                        {log.count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {log.sheetIds.length > 0 ? (
                        <span className="font-mono">
                          {log.sheetIds.slice(0, 5).join(', ')}
                          {log.sheetIds.length > 5 &&
                            ` +${log.sheetIds.length - 5} more`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
