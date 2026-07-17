// src/pages/teacher/ResultsView.tsx

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { teacherApi, type TeacherExam, type TeacherSheet } from '@/api/teacher';

export default function ResultsView() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();
  const subject = currentUser?.subject ?? '';

  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // ✅ Fetch exams and filter by teacher's subject (exclude archived)
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

          // ✅ Step 2: Filter by teacher's subject
          const trimmedSubject = subject.trim();
          const filteredExams = activeExams.filter((e) => {
            const examSubject = e.subject?.trim() || '';
            return examSubject.toLowerCase() === trimmedSubject.toLowerCase();
          });

          console.log('📋 Filtered exams (by subject):', filteredExams);
          setExams(filteredExams);

          if (filteredExams.length === 0) {
            console.log('⚠️ No exams found for subject:', subject);
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

  // Fetch results when exam selected
  useEffect(() => {
    const fetchResults = async () => {
      if (!selectedExamId) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        console.log('📋 Fetching results for examId:', selectedExamId);
        const response = await teacherApi.getResults(selectedExamId);
        console.log('📋 Results response:', response);

        if (response.success) {
          setResults(response.data);
        } else {
          setToastMsg(response.message || 'Failed to load results');
          setTimeout(() => setToastMsg(null), 3000);
        }
      } catch (error) {
        console.error('Fetch results error:', error);
        setToastMsg('Failed to load results');
        setTimeout(() => setToastMsg(null), 3000);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [selectedExamId]);

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const examSheets = results?.sheets || [];
  const stats = results?.stats || {
    totalStudents: 0,
    average: '0.0',
    highest: 0,
    lowest: 0,
    passCount: 0,
    failCount: 0,
  };

  const summaryCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: 'ri-group-line',
      color: 'bg-gray-100 text-gray-700',
    },
    {
      label: 'Class Average',
      value: `${stats.average}%`,
      icon: 'ri-bar-chart-line',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Highest',
      value: stats.highest,
      icon: 'ri-arrow-up-line',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Lowest',
      value: stats.lowest,
      icon: 'ri-arrow-down-line',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Pass Count',
      value: stats.passCount,
      icon: 'ri-check-line',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Fail Count',
      value: stats.failCount,
      icon: 'ri-close-line',
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  // ─── ✅ EXCEL EXPORT FUNCTION ──────────────────────────────────

  const exportToExcel = () => {
    if (!selectedExam || examSheets.length === 0) {
      setToastMsg('No data to export');
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    setIsExporting(true);

    try {
      // ✅ Prepare data for export
      const exportData = examSheets.map((sheet: TeacherSheet) => {
        const totalMarks = sheet.marks || 0;
        const percentage =
          selectedExam.max_marks > 0
            ? ((totalMarks / selectedExam.max_marks) * 100).toFixed(1)
            : '0.0';
        const passed = parseFloat(percentage) >= 40;

        return {
          'Roll No': sheet.roll_no || '',
          'Student Name': sheet.student_name || '',
          'Total Marks': totalMarks,
          'Max Marks': selectedExam.max_marks || 0,
          'Percentage (%)': percentage,
          Result: passed ? 'Pass' : 'Fail',
          Status: sheet.status || 'pending',
        };
      });

      // ✅ Add summary row
      const summaryRow = {
        'Roll No': '--- SUMMARY ---',
        'Student Name': '',
        'Total Marks': '',
        'Max Marks': '',
        'Percentage (%)': '',
        Result: '',
        Status: '',
      };

      const summaryData = [
        summaryRow,
        {
          'Roll No': 'Total Students',
          'Student Name': stats.totalStudents,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
        {
          'Roll No': 'Class Average',
          'Student Name': `${stats.average}%`,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
        {
          'Roll No': 'Highest Marks',
          'Student Name': stats.highest,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
        {
          'Roll No': 'Lowest Marks',
          'Student Name': stats.lowest,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
        {
          'Roll No': 'Pass Count',
          'Student Name': stats.passCount,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
        {
          'Roll No': 'Fail Count',
          'Student Name': stats.failCount,
          'Total Marks': '',
          'Max Marks': '',
          'Percentage (%)': '',
          Result: '',
          Status: '',
        },
      ];

      // ✅ Combine data
      const finalData = [...exportData, ...summaryData];

      // ✅ Convert to CSV
      const headers = Object.keys(finalData[0]);
      const csvRows = [];

      // Add headers
      csvRows.push(headers.join(','));

      // Add rows
      for (const row of finalData) {
        const values = headers.map((header) => {
          const val = row[header as keyof typeof row] ?? '';
          // Handle strings with commas
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val;
        });
        csvRows.push(values.join(','));
      }

      // Create CSV content with BOM for Excel
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });

      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      // Generate filename with exam name and date
      const fileName = `Results_${selectedExam.name.replace(/\s+/g, '_')}_${selectedExam.date}.csv`;
      link.setAttribute('download', fileName);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setToastMsg('✅ Results exported successfully!');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setToastMsg('Failed to export results');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
            toastMsg.includes('✅')
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <i
            className={
              toastMsg.includes('✅')
                ? 'ri-check-line'
                : 'ri-error-warning-line'
            }
          ></i>
          {toastMsg}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
          Results View
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
          {exams.length > 0 ? (
            exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.date}) - {exam.status}
              </option>
            ))
          ) : (
            <option value="" disabled>
              No exams found for {subject}
            </option>
          )}
        </select>
        {exams.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">
            No active exams found for {subject}.
          </p>
        )}
      </div>

      {selectedExam && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

          <div className="bg-white rounded-2xl p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {selectedExam.name}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedExam.date} &middot; {selectedExam.max_marks} marks
                &middot; Status: {selectedExam.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToExcel}
                disabled={isExporting || examSheets.length === 0}
                className={`px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isExporting || examSheets.length === 0
                    ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isExporting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Exporting...
                  </>
                ) : (
                  <>
                    <i className="ri-file-excel-2-line"></i>
                    Export Excel
                  </>
                )}
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-printer-line mr-1.5"></i> Print
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 overflow-x-auto">
            {examSheets.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">
                  No checked sheets found for this exam.
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  Note: Only sheets with status 'checked' or 'rechecked' appear
                  here.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Roll No
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Student Name
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Total Marks
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Max Marks
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Percentage
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Result
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {examSheets.map((sheet: TeacherSheet) => {
                    const totalMarks = sheet.marks || 0;
                    const percentage =
                      selectedExam.max_marks > 0
                        ? ((totalMarks / selectedExam.max_marks) * 100).toFixed(
                            1,
                          )
                        : '0.0';
                    const passed = parseFloat(percentage) >= 40;

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
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {totalMarks}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {selectedExam.max_marks}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                            {percentage}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge
                            status={passed ? 'completed' : 'pending'}
                            className={
                              passed
                                ? '!bg-emerald-100 !text-emerald-600'
                                : '!bg-rose-100 !text-rose-600'
                            }
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {sheet.status || 'pending'}
                          </span>
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

      {!selectedExam && exams.length > 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-bar-chart-box-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            Select an exam above to view results.
          </p>
        </div>
      )}

      {exams.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-folder-open-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            No active exams found for {subject}.
          </p>
        </div>
      )}
    </div>
  );
}
