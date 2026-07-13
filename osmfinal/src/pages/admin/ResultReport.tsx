// src/pages/admin/ResultReport.tsx

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import resultService, {
  type ResultEntry,
  type ExamResultStats,
} from '@/api/reports';

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <span
          className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}
        >
          <i className={`${icon} text-sm`}></i>
        </span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function ResultReport() {
  const loading = usePageLoading();
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // ─── EXAMS ──────────────────────────────────────────────────
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  // ─── RESULTS ───────────────────────────────────────────────
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [stats, setStats] = useState<ExamResultStats>({
    total: 0,
    average: 0,
    highest: 0,
    lowest: 0,
    passCount: 0,
    failCount: 0,
    passPercentage: 0,
  });
  const [selectedExam, setSelectedExam] = useState<{
    id: string;
    name: string;
    subject: string;
    maxMarks: number;
    status: string;
  } | null>(null);
  const [publishedExams, setPublishedExams] = useState<Set<string>>(new Set());

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── FETCH EXAMS ────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExams(res.data || []);
        console.log('📥 Exams loaded:', res.data);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
        showToast('Failed to load exams', 'error');
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH PUBLISHED EXAMS ──────────────────────────────────

  useEffect(() => {
    const fetchPublished = async () => {
      try {
        const published = await resultService.getPublishedExams();
        console.log('📥 Published exams:', published);
        const ids = new Set(published.map((p) => String(p.id)));
        setPublishedExams(ids);
      } catch (error) {
        console.error('Failed to fetch published exams:', error);
      }
    };
    fetchPublished();
  }, []);

  // ─── FETCH RESULTS WHEN EXAM SELECTED ──────────────────────

  useEffect(() => {
    const fetchResults = async () => {
      if (!selectedExamId) {
        console.log('⏹️ No exam selected');
        setResults([]);
        setSelectedExam(null);
        setStats({
          total: 0,
          average: 0,
          highest: 0,
          lowest: 0,
          passCount: 0,
          failCount: 0,
          passPercentage: 0,
        });
        return;
      }

      console.log('🚀 Fetching results for exam:', selectedExamId);
      setIsLoading(true);

      try {
        const data = await resultService.getExamResults(selectedExamId);
        console.log('✅ Results data:', data);

        setSelectedExam(data.exam);
        setResults(data.results || []);
        setStats(
          data.stats || {
            total: 0,
            average: 0,
            highest: 0,
            lowest: 0,
            passCount: 0,
            failCount: 0,
            passPercentage: 0,
          },
        );
      } catch (error) {
        console.error('❌ Failed to fetch results:', error);
        showToast('Failed to load results', 'error');
        setResults([]);
        setStats({
          total: 0,
          average: 0,
          highest: 0,
          lowest: 0,
          passCount: 0,
          failCount: 0,
          passPercentage: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [selectedExamId]);

  // ─── AVAILABLE EXAMS ────────────────────────────────────────

  const availableExams = useMemo(
    () =>
      exams.filter((e) => e.status === 'active' || e.status === 'completed'),
    [exams],
  );

  const isPublished =
    selectedExamId !== '' && publishedExams.has(selectedExamId);

  // ─── HANDLE PUBLISH ──────────────────────────────────────────

  const handlePublish = async () => {
    if (!selectedExamId) return;

    try {
      const response = await resultService.publishExamResults(selectedExamId);
      if (response.success) {
        setPublishedExams((prev) => new Set([...prev, selectedExamId]));
        setShowPublishModal(false);
        showToast('✅ Results published successfully');
      } else {
        showToast(response.message || 'Failed to publish results', 'error');
      }
    } catch (error: any) {
      console.error('Publish error:', error);
      showToast(error.message || 'Failed to publish results', 'error');
    }
  };

  // ─── ✅ EXPORT TO EXCEL ──────────────────────────────────────

  const handleExportExcel = () => {
    if (!results.length || !selectedExam) {
      showToast('No data to export', 'error');
      return;
    }

    setIsExporting(true);
    showToast('📊 Generating Excel file...', 'success');

    try {
      const questionKeys = getQuestionKeys(results);

      // Prepare data for Excel
      const excelData = results.map((row) => {
        const rowData: any = {
          'Roll No': row.rollNo,
          'Student Name': row.studentName,
        };

        questionKeys.forEach((q) => {
          rowData[q] =
            row.questionTotals[q] !== undefined ? row.questionTotals[q] : '-';
        });

        rowData['Total'] = row.totalMarks.toFixed(1);
        const pct = ((row.totalMarks / (row.maxMarks || 100)) * 100).toFixed(1);
        rowData['%'] = pct;
        rowData['Status'] = Number(pct) >= 40 ? 'Pass' : 'Fail';

        return rowData;
      });

      // Add summary row
      const summaryRow: any = {
        'Roll No': '📊 SUMMARY',
        'Student Name': '',
      };

      questionKeys.forEach((q) => {
        summaryRow[q] = '';
      });

      summaryRow['Total'] = `Avg: ${stats.average.toFixed(1)}`;
      summaryRow['%'] = `Pass: ${stats.passCount} | Fail: ${stats.failCount}`;
      summaryRow['Status'] = `Total: ${stats.total}`;

      excelData.push(summaryRow);

      // Add empty row
      excelData.push({});

      // Add exam info
      const infoRow: any = {
        'Roll No': 'Exam:',
        'Student Name': selectedExam.name,
      };
      excelData.push(infoRow);

      const subjectRow: any = {
        'Roll No': 'Subject:',
        'Student Name': selectedExam.subject,
      };
      excelData.push(subjectRow);

      const dateRow: any = {
        'Roll No': 'Generated:',
        'Student Name': new Date().toLocaleString(),
      };
      excelData.push(dateRow);

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 14 }, // Roll No
        { wch: 22 }, // Student Name
        ...questionKeys.map(() => ({ wch: 8 })),
        { wch: 12 }, // Total
        { wch: 10 }, // %
        { wch: 14 }, // Status
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Results');

      // Generate filename
      const safeName = selectedExam.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_Results_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      showToast('✅ Excel exported successfully!');
    } catch (error) {
      console.error('Export Excel error:', error);
      showToast('❌ Failed to export Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── ✅ EXPORT TO PDF ────────────────────────────────────────

  const handleExportPDF = () => {
    if (!results.length || !selectedExam) {
      showToast('No data to export', 'error');
      return;
    }

    setIsExporting(true);
    showToast('📄 Generating PDF file...', 'success');

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      const questionKeys = getQuestionKeys(results);

      // Add title
      doc.setFontSize(18);
      doc.text(selectedExam.name, 14, 20);

      doc.setFontSize(12);
      doc.text(`Subject: ${selectedExam.subject}`, 14, 28);

      doc.setFontSize(10);
      doc.text(`Total Students: ${stats.total}`, 14, 36);
      doc.text(`Average: ${stats.average.toFixed(1)}`, 14, 42);
      doc.text(`Highest: ${stats.highest} | Lowest: ${stats.lowest}`, 14, 48);
      doc.text(`Pass: ${stats.passCount} | Fail: ${stats.failCount}`, 14, 54);

      // Prepare table data
      const headers = [
        'Roll No',
        'Student Name',
        ...questionKeys,
        'Total',
        '%',
        'Status',
      ];

      const rows = results.map((row) => {
        const rowData = [row.rollNo, row.studentName];

        questionKeys.forEach((q) => {
          rowData.push(
            row.questionTotals[q] !== undefined ? row.questionTotals[q] : '-',
          );
        });

        const pct = ((row.totalMarks / (row.maxMarks || 100)) * 100).toFixed(1);
        rowData.push(row.totalMarks.toFixed(1));
        rowData.push(pct);
        rowData.push(Number(pct) >= 40 ? 'Pass' : 'Fail');

        return rowData;
      });

      // Add table
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 60,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [51, 51, 51],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        didDrawPage: (data) => {
          // Add footer
          doc.setFontSize(8);
          doc.text(
            `Generated on: ${new Date().toLocaleString()}`,
            14,
            doc.internal.pageSize.height - 10,
          );
        },
      });

      // Generate filename
      const safeName = selectedExam.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_Results_${new Date().toISOString().split('T')[0]}.pdf`;

      // Download
      doc.save(filename);
      showToast('✅ PDF exported successfully!');
    } catch (error) {
      console.error('Export PDF error:', error);
      showToast('❌ Failed to export PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // ─── QUESTION KEYS ───────────────────────────────────────────

  const getQuestionKeys = (results: ResultEntry[]) => {
    if (!results || results.length === 0) return [];
    const keys = Object.keys(results[0].questionTotals || {});
    return keys.sort();
  };

  const questionKeys = getQuestionKeys(results);

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Result Report' },
        ]}
      />

      {/* ─── HEADER ────────────────────────────────────────────── */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Result Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View final marks for all students
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* ✅ Exam Select Dropdown */}
          <select
            value={selectedExamId}
            onChange={(e) => {
              const val = e.target.value;
              console.log('📌 Exam selected:', val);
              setSelectedExamId(val);
            }}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="">-- Select Exam --</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.subject})
              </option>
            ))}
          </select>

          {/* ✅ Action Buttons - only show when exam selected */}
          {selectedExam && (
            <>
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-excel-2-line text-sm text-green-600"></i>
                </span>{' '}
                {isExporting ? 'Exporting...' : 'Excel'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-file-pdf-2-line text-sm text-red-600"></i>
                </span>{' '}
                {isExporting ? 'Exporting...' : 'PDF'}
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className="ri-printer-line text-sm"></i>
                </span>{' '}
                Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── PUBLISH STATUS ───────────────────────────────────── */}

      {isPublished && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6">
          <span className="w-5 h-5 flex items-center justify-center">
            <i className="ri-checkbox-circle-fill text-emerald-600 text-sm"></i>
          </span>
          <p className="text-sm font-medium text-emerald-700">
            Results published — marks are locked
          </p>
        </div>
      )}

      {/* ─── PUBLISH BUTTON ───────────────────────────────────── */}

      {selectedExam && !isPublished && (
        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowPublishModal(true)}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-send-plane-line text-sm"></i>
            </span>{' '}
            Publish Results
          </button>
        </div>
      )}

      {selectedExam && isPublished && (
        <div className="flex justify-end mb-6">
          <button
            disabled
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium whitespace-nowrap cursor-not-allowed flex items-center gap-2 opacity-90"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-check-line text-sm"></i>
            </span>{' '}
            Published ✓
          </button>
        </div>
      )}

      {/* ─── STATS CARDS ───────────────────────────────────────── */}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
        </div>
      ) : stats.total > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            label="Total Students"
            value={stats.total}
            icon="ri-team-line"
            color="bg-gray-50 text-gray-600"
          />
          <StatCard
            label="Class Average"
            value={`${stats.average.toFixed(1)}`}
            icon="ri-line-chart-line"
            color="bg-sky-50 text-sky-600"
          />
          <StatCard
            label="Highest Score"
            value={stats.highest}
            icon="ri-arrow-up-line"
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Lowest Score"
            value={stats.lowest}
            icon="ri-arrow-down-line"
            color="bg-rose-50 text-rose-600"
          />
          <StatCard
            label="Pass Count"
            value={stats.passCount}
            icon="ri-check-line"
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Fail Count"
            value={stats.failCount}
            icon="ri-close-line"
            color="bg-rose-50 text-rose-600"
          />
        </div>
      ) : selectedExamId ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No results available for this exam yet.
        </div>
      ) : null}

      {/* ─── RESULTS TABLE ────────────────────────────────────── */}

      {selectedExamId && results.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Roll No
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Student Name
                  </th>
                  {questionKeys.map((q) => (
                    <th
                      key={q}
                      className="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {q}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Total
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    %
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, idx) => {
                  const pct = (
                    (row.totalMarks / (row.maxMarks || 100)) *
                    100
                  ).toFixed(1);
                  const isPass = Number(pct) >= 40;

                  return (
                    <tr
                      key={row.sheetId}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                        {row.rollNo}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {row.studentName}
                      </td>
                      {questionKeys.map((q) => (
                        <td
                          key={q}
                          className="px-2 py-3 text-center text-gray-600 whitespace-nowrap"
                        >
                          {row.questionTotals &&
                          row.questionTotals[q] !== undefined
                            ? row.questionTotals[q]
                            : '—'}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900 font-semibold whitespace-nowrap">
                          {row.totalMarks.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {pct}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge
                          status={isPass ? 'completed' : 'uploaded'}
                          className={
                            isPass
                              ? '!bg-emerald-100 !text-emerald-700'
                              : '!bg-rose-100 !text-rose-700'
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedExamId && !isLoading ? (
        <EmptyState
          icon="ri-file-search-line"
          title="No results found"
          description="No completed sheets found for this exam."
        />
      ) : null}

      {!selectedExamId && (
        <EmptyState
          icon="ri-bar-chart-2-line"
          title="Select an exam"
          description="Select an exam from the dropdown above to view results."
        />
      )}

      {/* ─── PUBLISH MODAL ────────────────────────────────────── */}
      {showPublishModal && selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowPublishModal(false)}
          ></div>
          <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Publish Results
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Publish results for <strong>{selectedExam.name}</strong>? This
              will lock all marks.
            </p>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100 mb-4">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-amber-600 text-sm"></i>
              </span>
              <p className="text-xs text-amber-700">
                Once published, marks cannot be modified.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Confirm Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TOAST ────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i
              className={
                toast.type === 'error'
                  ? 'ri-error-warning-line'
                  : 'ri-check-line'
              }
            ></i>
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
