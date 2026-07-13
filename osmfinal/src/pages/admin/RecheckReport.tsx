// src/pages/admin/RecheckReport.tsx

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import recheckReportService, {
  type RecheckEntry,
  type RecheckStats,
} from '@/api/RecheckReport';

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

export default function RecheckReport() {
  const loading = usePageLoading();
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // ─── EXAMS ──────────────────────────────────────────────────
  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  // ─── RECHECK DATA ──────────────────────────────────────────
  const [rechecks, setRechecks] = useState<RecheckEntry[]>([]);
  const [stats, setStats] = useState<RecheckStats>({
    total: 0,
    increased: 0,
    decreased: 0,
    noChange: 0,
  });
  const [selectedExam, setSelectedExam] = useState<{
    id: string;
    name: string;
    subject: string;
  } | null>(null);

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

  // ─── FETCH RECHECK DATA WHEN EXAM SELECTED ──────────────────

  useEffect(() => {
    const fetchRecheckData = async () => {
      if (!selectedExamId) {
        setRechecks([]);
        setSelectedExam(null);
        setStats({ total: 0, increased: 0, decreased: 0, noChange: 0 });
        return;
      }

      console.log('🚀 Fetching recheck data for exam:', selectedExamId);
      setIsLoading(true);

      try {
        const data =
          await recheckReportService.getRecheckReport(selectedExamId);
        console.log('✅ Recheck data received:', data);
        setSelectedExam(data.exam);
        setRechecks(data.rechecks || []);
        setStats(
          data.stats || { total: 0, increased: 0, decreased: 0, noChange: 0 },
        );
      } catch (error) {
        console.error('❌ Failed to fetch recheck data:', error);
        showToast('Failed to load recheck data', 'error');
        setRechecks([]);
        setStats({ total: 0, increased: 0, decreased: 0, noChange: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecheckData();
  }, [selectedExamId]);

  // ─── AVAILABLE EXAMS ────────────────────────────────────────

  const availableExams = useMemo(
    () =>
      exams.filter((e) => e.status === 'active' || e.status === 'completed'),
    [exams],
  );

  // ─── EXPORT TO EXCEL ──────────────────────────────────────────

  const handleExportExcel = () => {
    if (!rechecks.length || !selectedExam) {
      showToast('No data to export', 'error');
      return;
    }

    setIsExporting(true);
    showToast('📊 Generating Excel file...', 'success');

    try {
      const excelData = rechecks.map((row) => ({
        'Roll No': row.rollNo,
        'Student Name': row.studentName,
        'Original Total': row.originalTotal.toFixed(1),
        'Rechecked Total': row.recheckedTotal.toFixed(1),
        Difference:
          row.diff > 0 ? `+${row.diff.toFixed(1)}` : row.diff.toFixed(1),
        Change:
          row.diff > 0 ? 'Increased' : row.diff < 0 ? 'Decreased' : 'No Change',
        'Rule Used':
          row.finalMarksRule.charAt(0).toUpperCase() +
          row.finalMarksRule.slice(1),
        Rechecker: row.recheckerName,
        Date: new Date(row.createdAt).toLocaleDateString(),
      }));

      // Add summary row
      excelData.push({
        'Roll No': '📊 SUMMARY',
        'Student Name': '',
        'Original Total': '',
        'Rechecked Total': '',
        Difference: '',
        Change: `Total: ${stats.total}`,
        'Rule Used': `↑ ${stats.increased} | ↓ ${stats.decreased} | ↔ ${stats.noChange}`,
        Rechecker: '',
        Date: '',
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 12 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Recheck Report');

      const safeName = selectedExam.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_Recheck_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('✅ Excel exported successfully!');
    } catch (error) {
      console.error('Export Excel error:', error);
      showToast('❌ Failed to export Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const getChangeBadge = (diff: number) => {
    if (diff > 0)
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        label: 'Increased',
        icon: 'ri-arrow-up-line',
      };
    if (diff < 0)
      return {
        bg: 'bg-rose-100',
        text: 'text-rose-700',
        label: 'Decreased',
        icon: 'ri-arrow-down-line',
      };
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      label: 'No Change',
      icon: 'ri-subtract-line',
    };
  };

  const getRuleLabel = (rule: string): string => {
    const map: Record<string, string> = {
      higher: 'Higher',
      recheck_marks: 'Recheck Marks',
      average: 'Average',
    };
    return map[rule] || rule;
  };

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Recheck Report' },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Recheck Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare original vs rechecked marks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="">-- Select Exam --</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.subject})
              </option>
            ))}
          </select>
          {selectedExam && (
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
          )}
        </div>
      </div>

      {/* ─── STATS CARDS ───────────────────────────────────────── */}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
        </div>
      ) : stats.total > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Rechecked"
            value={stats.total}
            icon="ri-refresh-line"
            color="bg-violet-50 text-violet-600"
          />
          <StatCard
            label="Marks Increased"
            value={stats.increased}
            icon="ri-arrow-up-line"
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Marks Decreased"
            value={stats.decreased}
            icon="ri-arrow-down-line"
            color="bg-rose-50 text-rose-600"
          />
          <StatCard
            label="No Change"
            value={stats.noChange}
            icon="ri-subtract-line"
            color="bg-gray-50 text-gray-600"
          />
        </div>
      ) : selectedExamId ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No recheck records found for this exam.
        </div>
      ) : null}

      {/* ─── RESULTS TABLE ────────────────────────────────────── */}

      {selectedExamId && rechecks.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Roll No
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Student
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Original Total
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Rechecked Total
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Difference
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Change
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Rule Used
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {rechecks.map((row, idx) => {
                  const changeBadge = getChangeBadge(row.diff);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                        {row.rollNo}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {row.studentName}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {row.originalTotal.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-900 font-semibold whitespace-nowrap">
                        {row.recheckedTotal.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`font-medium ${row.diff > 0 ? 'text-emerald-600' : row.diff < 0 ? 'text-rose-600' : 'text-gray-400'}`}
                        >
                          {row.diff > 0
                            ? `+${row.diff.toFixed(1)}`
                            : row.diff === 0
                              ? '0'
                              : row.diff.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${changeBadge.bg} ${changeBadge.text}`}
                        >
                          <span className="w-3 h-3 flex items-center justify-center">
                            <i
                              className={`${changeBadge.icon} text-[10px]`}
                            ></i>
                          </span>
                          {changeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 whitespace-nowrap">
                          {getRuleLabel(row.finalMarksRule)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-xs whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedExamId && !isLoading ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <i className="ri-refresh-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-gray-500 text-sm">
            No completed rechecks found for this exam
          </p>
        </div>
      ) : null}

      {!selectedExamId && (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <i className="ri-bar-chart-2-line text-2xl text-gray-300"></i>
          </div>
          <p className="text-gray-500 text-sm">
            Select an exam to view recheck data
          </p>
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
