// src/pages/admin/CheckerPerformance.tsx

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import checkerPerformanceService, {
  type CheckerPerformance,
  type CheckerStats,
} from '@/api/checkerPerformance';

export default function CheckerPerformance() {
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

  // ─── PERFORMANCE DATA ──────────────────────────────────────
  const [checkers, setCheckers] = useState<CheckerPerformance[]>([]);
  const [stats, setStats] = useState<CheckerStats>({
    totalCheckers: 0,
    totalSheetsCompleted: 0,
    averageTime: 0,
    mostEfficient: null,
  });
  const [selectedExamName, setSelectedExamName] = useState<string>('All Exams');

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
      } catch (error) {
        console.error('Failed to fetch exams:', error);
        showToast('Failed to load exams', 'error');
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH PERFORMANCE DATA ──────────────────────────────────

  useEffect(() => {
    const fetchPerformanceData = async () => {
      setIsLoading(true);
      try {
        const data = await checkerPerformanceService.getCheckerPerformance(
          selectedExamId || undefined,
        );
        setCheckers(data.checkers || []);
        setStats(
          data.stats || {
            totalCheckers: 0,
            totalSheetsCompleted: 0,
            averageTime: 0,
            mostEfficient: null,
          },
        );
        setSelectedExamName(data.exam?.name || 'All Exams');
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
        showToast('Failed to load performance data', 'error');
        setCheckers([]);
        setStats({
          totalCheckers: 0,
          totalSheetsCompleted: 0,
          averageTime: 0,
          mostEfficient: null,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, [selectedExamId]);

  // ─── AVAILABLE EXAMS ────────────────────────────────────────

  const availableExams = useMemo(
    () =>
      exams.filter((e) => e.status === 'active' || e.status === 'completed'),
    [exams],
  );

  // ─── EXPORT TO EXCEL ──────────────────────────────────────────

  const handleExportExcel = () => {
    if (!checkers.length) {
      showToast('No data to export', 'error');
      return;
    }

    setIsExporting(true);
    showToast('📊 Generating Excel file...', 'success');

    try {
      const excelData = checkers.map((checker) => ({
        'Checker Name': checker.checkerName,
        Role: checker.role.charAt(0).toUpperCase() + checker.role.slice(1),
        'Sheets Completed': checker.sheetsCompleted,
        'Avg Time (mins)': checker.avgTimeMinutes.toFixed(1),
        'Checked Count': checker.checkedCount,
        'Recheck Count': checker.recheckCount,
        'Escalated Count': checker.escalatedCount,
        Efficiency:
          checker.avgTimeMinutes < 10
            ? 'Fast'
            : checker.avgTimeMinutes <= 20
              ? 'Normal'
              : 'Slow',
      }));

      // Add summary row
      excelData.push({
        'Checker Name': '📊 SUMMARY',
        Role: '',
        'Sheets Completed': stats.totalSheetsCompleted,
        'Avg Time (mins)': stats.averageTime.toFixed(1),
        'Checked Count': '',
        'Recheck Count': '',
        'Escalated Count': '',
        Efficiency: `Total Checkers: ${stats.totalCheckers}`,
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      ws['!cols'] = [
        { wch: 20 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Checker Performance');

      const safeName = selectedExamName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeName}_Checker_Performance_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('✅ Excel exported successfully!');
    } catch (error) {
      console.error('Export Excel error:', error);
      showToast('❌ Failed to export Excel', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const getEfficiencyBadge = (avgTime: number) => {
    if (avgTime < 10)
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Fast' };
    if (avgTime <= 20)
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Normal' };
    return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Slow' };
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      checker: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Checker' },
      rechecking: {
        bg: 'bg-violet-100',
        text: 'text-violet-700',
        label: 'Rechecker',
      },
      teacher_checker: {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        label: 'Teacher+Checker',
      },
    };
    return (
      map[role] || { bg: 'bg-gray-100', text: 'text-gray-600', label: role }
    );
  };

  const chartData = useMemo(
    () =>
      checkers.map((s) => ({ name: s.checkerName, sheets: s.sheetsCompleted })),
    [checkers],
  );

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Checker Performance' },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Checker Performance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Evaluate checker workload and accuracy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer min-w-[220px]"
          >
            <option value="">All Exams</option>
            {availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.subject})
              </option>
            ))}
          </select>
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
        </div>
      </div>

      {/* ─── STATS CARDS ───────────────────────────────────────── */}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
        </div>
      ) : stats.totalCheckers > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Checkers
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.totalCheckers}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sheets Completed
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.totalSheetsCompleted}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Time (mins)
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.averageTime.toFixed(1)}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Most Efficient
            </p>
            <p
              className="text-lg font-semibold text-gray-900 truncate"
              title={stats.mostEfficient?.name || 'N/A'}
            >
              {stats.mostEfficient?.name || 'N/A'}
            </p>
            <p className="text-xs text-gray-400">
              {stats.mostEfficient?.sheetsCompleted || 0} sheets
            </p>
          </div>
        </div>
      ) : selectedExamId ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No performance data found for this exam.
        </div>
      ) : null}

      {/* ─── CHART ─────────────────────────────────────────────── */}

      <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Sheets Completed per Checker — {selectedExamName}
        </h3>
        <div style={{ height: 220 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    fontSize: '13px',
                  }}
                />
                <Bar
                  dataKey="sheets"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  barSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon="ri-bar-chart-2-line"
              title="No data available"
              description="No data available for selected exam."
            />
          )}
        </div>
      </div>

      {/* ─── TABLE ─────────────────────────────────────────────── */}

      {checkers.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Checker Name
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Role
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Sheets Completed
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Avg Time (mins)
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    Efficiency
                  </th>
                </tr>
              </thead>
              <tbody>
                {checkers.map((checker, idx) => {
                  const roleBadge = getRoleBadge(checker.role);
                  const effBadge = getEfficiencyBadge(checker.avgTimeMinutes);
                  return (
                    <tr
                      key={checker.checkerId}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                        {checker.checkerName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${roleBadge.bg} ${roleBadge.text}`}
                        >
                          {roleBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">
                        {checker.sheetsCompleted}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                        {checker.avgTimeMinutes.toFixed(1)} min
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${effBadge.bg} ${effBadge.text}`}
                        >
                          {effBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        !isLoading && (
          <EmptyState
            icon="ri-user-search-line"
            title="No data available"
            description="No data available for selected exam."
          />
        )
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
