// src/pages/admin/AdminDashboard.tsx

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import dashboardService from '@/api/admindashboard';

interface DashboardStats {
  totalSheets: number;
  totalExams: number;
  totalUsers: number;
  totalStudents: number;
  uploaded: number;
  checking: number;
  checked: number;
  recheck: number;
  rechecked: number;
  escalated: number;
  pendingRechecks: number;
  teacherDisputes: number;
  completedByCheckers: number;
}

interface StatusChartData {
  status: string;
  count: number;
  fill: string;
}

interface RecentSheet {
  id: number;
  student_name: string;
  exam_name: string;
  status: string;
  assigned_to_name: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  // ─── STATE ──────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalSheets: 0,
    totalExams: 0,
    totalUsers: 0,
    totalStudents: 0,
    uploaded: 0,
    checking: 0,
    checked: 0,
    recheck: 0,
    rechecked: 0,
    escalated: 0,
    pendingRechecks: 0,
    teacherDisputes: 0,
    completedByCheckers: 0,
  });
  const [statusChartData, setStatusChartData] = useState<StatusChartData[]>([]);
  const [recentSheets, setRecentSheets] = useState<RecentSheet[]>([]);
  const [quickStats, setQuickStats] = useState([
    { label: 'Checking Progress', value: 0 },
    { label: 'Upload Queue', value: 0 },
    { label: 'Completion Rate', value: 0 },
  ]);

  // ─── ✅ ADMIN + SUPER ADMIN ACCESS CHECK ──────────────────────
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
      navigate('/login?error=unauthorized');
      return;
    }
  }, [currentUser, navigate]);

  // ─── FETCH DASHBOARD DATA ──────────────────────────────────

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // Fetch all data in parallel
        const [statsRes, chartRes, sheetsRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getStatusChart(),
          dashboardService.getRecentSheets(8),
        ]);

        setStats(statsRes);
        setStatusChartData(chartRes);
        setRecentSheets(sheetsRes);

        // Calculate quick stats
        const total = statsRes.totalSheets || 1;
        const completed = statsRes.checked + statsRes.rechecked;
        const checking = statsRes.checking || 0;
        const uploaded = statsRes.uploaded || 0;

        setQuickStats([
          {
            label: 'Checking Progress',
            value: Math.round((checking / total) * 100),
          },
          {
            label: 'Upload Queue',
            value: Math.round((uploaded / total) * 100),
          },
          {
            label: 'Completion Rate',
            value: Math.round((completed / total) * 100),
          },
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // ─── RENDER HELPERS ──────────────────────────────────────────

  const getStatusBadgeVariant = (status: string) => {
    const map: Record<string, string> = {
      uploaded: 'uploaded',
      assigned: 'assigned',
      checking: 'checking',
      checked: 'checked',
      recheck: 'recheck',
      rechecked: 'rechecked',
      escalated: 'escalated',
    };
    return map[status] || 'pending';
  };

  const statItems = [
    {
      label: 'Total Sheets',
      value: stats.totalSheets,
      icon: 'ri-file-copy-2-line',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Total Exams',
      value: stats.totalExams,
      icon: 'ri-book-open-line',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: 'ri-team-line',
      color: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: 'ri-user-line',
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  const quickLinks = [
    {
      title: 'Result Report',
      desc: 'View final marks by exam',
      icon: 'ri-bar-chart-2-line',
      path: '/admin/reports/results',
    },
    {
      title: 'Recheck Report',
      desc: 'Compare original vs rechecked',
      icon: 'ri-refresh-line',
      path: '/admin/reports/recheck',
    },
    {
      title: 'Checker Performance',
      desc: 'Evaluate workload & accuracy',
      icon: 'ri-user-star-line',
      path: '/admin/reports/performance',
    },
  ];

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Dashboard' }]}
      />

      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-gray-500">
                Here's what's happening with your marking system today.
              </p>
              {currentUser?.role === 'super_admin' && (
                <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  ⭐ Super Admin
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── STATS CARDS ──────────────────────────────────────── */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-sm text-gray-500 whitespace-nowrap">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
              >
                <i className={`${stat.icon} text-lg`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── STATUS CHART ────────────────────────────────────── */}

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Sheet Status Overview
        </h4>
        {statusChartData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={statusChartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f1f5f9"
                vertical={false}
              />
              <XAxis
                dataKey="status"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                {statusChartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── RECHECK STATS ─────────────────────────────────────── */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <i className="ri-refresh-line text-violet-600 text-sm"></i>
            </span>
            <p className="text-sm font-medium text-gray-900">
              Pending Rechecks
            </p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.pendingRechecks}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Awaiting recheck evaluation
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
              <i className="ri-flag-line text-rose-600 text-sm"></i>
            </span>
            <p className="text-sm font-medium text-gray-900">
              Teacher Disputes
            </p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {stats.teacherDisputes}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Flagged by subject teachers
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="ri-check-double-line text-emerald-600 text-sm"></i>
              </span>
              <p className="text-sm font-medium text-gray-900">Completed</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.completedByCheckers}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Sheets finished by checkers
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/queue')}
            className="mt-3 w-full text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            Go to Recheck Management
          </button>
        </div>
      </div>

      {/* ─── QUICK LINKS ───────────────────────────────────────── */}

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Quick Links to Reports
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="bg-white rounded-2xl p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 group-hover:bg-gray-200 transition-colors">
                  <i className={`${link.icon} text-gray-600 text-sm`}></i>
                </span>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                    {link.title}
                  </p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {link.desc}
                  </p>
                </div>
              </div>
              <span className="w-6 h-6 flex items-center justify-center shrink-0 text-gray-300 group-hover:text-gray-600 transition-colors">
                <i className="ri-arrow-right-s-line text-lg"></i>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── RECENT SHEETS & QUICK OVERVIEW ────────────────────── */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Recent Sheet Activity
          </h4>
          <div className="overflow-x-auto">
            {recentSheets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No recent activity
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Sheet ID
                    </th>
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Student
                    </th>
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Exam
                    </th>
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Assigned To
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSheets.map((sheet) => (
                    <tr
                      key={sheet.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-2 font-medium text-gray-900 whitespace-nowrap">
                        #{sheet.id}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">
                        {sheet.student_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 whitespace-nowrap text-xs">
                        {sheet.exam_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-2">
                        <StatusBadge
                          status={getStatusBadgeVariant(sheet.status)}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-gray-500 text-xs whitespace-nowrap">
                        {sheet.assigned_to_name || 'Unassigned'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Quick Overview
          </h4>
          <div className="space-y-4">
            {quickStats.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">
                    {item.value}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.value, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
              Status Distribution
            </h4>
            <div className="flex flex-wrap gap-2">
              {statusChartData.map((item) => (
                <StatusBadge
                  key={item.status}
                  status={getStatusBadgeVariant(item.status.toLowerCase())}
                  className="text-[11px]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
