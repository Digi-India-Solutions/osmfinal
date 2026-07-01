// src/pages/admin/CheckerAssignment.tsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import assignmentService from '@/api/assignment';
import type { IUnassignedSheet, IAvailableChecker } from '@/api/assignment';

interface AssignmentLog {
  id: number;
  sheetIds: number[];
  checkerName: string;
  time: string;
  count: number;
}

export default function CheckerAssignment() {
  const { currentUser } = useAuth();
  const role = currentUser?.role ?? "";
  const subject = currentUser?.subject ?? "";
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

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ─── FETCH EXAMS ────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExams(res.data);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
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
      }
      if (checkersRes.success) {
        setAvailableCheckers(checkersRes.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
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
    if (selectedSheets.size === 0 || !selectedExam) return;
    if (checker.hasConflict) return;

    setIsAssigning(true);
    try {
      const response = await assignmentService.assignSheets(
        selectedExam,
        checker.id,
        Array.from(selectedSheets),
      );

      if (response.success) {
        const sheetIds = Array.from(selectedSheets);
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
        setSuccessMessage(
          `Assigned ${sheetIds.length} sheet(s) to ${checker.name}`,
        );
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        // Refresh data
        await fetchData(selectedExam);
      } else {
        setSuccessMessage(response.message || 'Failed to assign');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Assign error:', error);
      setSuccessMessage('Failed to assign sheets');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsAssigning(false);
    }
  };

  const assignRandomly = async () => {
    if (!selectedExam) return;

    setIsAssigning(true);
    try {
      const response = await assignmentService.randomAssignment(selectedExam);

      if (response.success) {
        const eligible = availableCheckers.filter((c) => c.canAssign);
        const logEntry: AssignmentLog = {
          id: Date.now(),
          sheetIds: [],
          checkerName: `Random (${eligible.length} checkers)`,
          time: new Date().toLocaleTimeString(),
          count: unassignedSheets.length,
        };

        setLogs((prev) => [logEntry, ...prev]);
        setSuccessMessage(response.message);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        // Refresh data
        await fetchData(selectedExam);
      } else {
        setSuccessMessage(response.message || 'Failed to assign randomly');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Random assignment error:', error);
      setSuccessMessage('Failed to assign randomly');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsAssigning(false);
    }
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  const activeExams = exams.filter((e) => e.status === 'active');

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Assign Checkers' },
        ]}
      />

      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line"></i>
          </span>
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
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
            selectedExam === '' || unassignedSheets.length === 0 || isAssigning
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

      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exam
        </label>
        <select
          value={selectedExam}
          onChange={(e) => handleExamChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
        >
          <option value="">Choose an active exam...</option>
          {filteredExams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name} ({exam.subject})
            </option>
          ))}
        </select>
      </div>

      {selectedExam && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ─── UNASSIGNED SHEETS ────────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
                  <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap w-10"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Sheet ID
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
                        All sheets have been assigned
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
          </div>

          {/* ─── AVAILABLE CHECKERS ───────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">
                Available Checkers
                <span className="text-gray-400 font-normal ml-2">
                  ({availableCheckers.length})
                </span>
              </h4>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0">
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
                  {availableCheckers.map((checker) => (
                    <tr
                      key={checker.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                        {checker.name}
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
                            Conflict — cannot assign
                          </span>
                        ) : (
                          <button
                            onClick={() => assignToChecker(checker)}
                            disabled={selectedSheets.size === 0 || isAssigning}
                            className="text-xs font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                          >
                            Assign ({selectedSheets.size})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">
              Assignment Log
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Time
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Checker
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Sheets Assigned
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {log.time}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {log.checkerName}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                      {log.count}
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
