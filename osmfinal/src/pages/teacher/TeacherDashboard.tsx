// src/pages/teacher/TeacherDashboard.tsx

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { teacherApi, type TeacherExam, type TeacherSheet } from '@/api/teacher';

export default function TeacherDashboard() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();
  const [isLoading, setIsLoading] = useState(true);
  const [exams, setExams] = useState<TeacherExam[]>([]);
  const [sheets, setSheets] = useState<TeacherSheet[]>([]);
  const [stats, setStats] = useState({
    totalExams: 0,
    checking: 0,
    completed: 0,
    pendingDisputes: 0,
    totalSheets: 0,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [dashboardRes, examsRes, sheetsRes] = await Promise.all([
          teacherApi.getDashboard(),
          teacherApi.getExams(),
          teacherApi.getSheets(),
        ]);

        if (dashboardRes.success) {
          setStats(dashboardRes.data.stats);
        }

        if (examsRes.success) {
          setExams(examsRes.data);
        }

        if (sheetsRes.success) {
          setSheets(sheetsRes.data);
        }
      } catch (error) {
        console.error('Fetch dashboard error:', error);
        setToastMsg('Failed to load dashboard data');
        setTimeout(() => setToastMsg(null), 3000);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const subject = currentUser?.subject ?? '';
  const subjectExams = exams.filter((e) => e.subject === subject);
  const examIds = new Set(subjectExams.map((e) => e.id));
  const subjectSheets = sheets.filter((s) => examIds.has(s.exam_id));

  const checkingCount = subjectSheets.filter(
    (s) => s.status === 'checking',
  ).length;
  const checkedCount = subjectSheets.filter(
    (s) => s.status === 'checked' || s.status === 'rechecked',
  ).length;

  const statCards = [
    {
      label: 'My Exams',
      value: subjectExams.length,
      icon: 'ri-file-text-line',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Sheets Checking',
      value: checkingCount,
      icon: 'ri-time-line',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Completed Sheets',
      value: checkedCount,
      icon: 'ri-check-double-line',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Pending Disputes',
      value: stats.pendingDisputes,
      icon: 'ri-error-warning-line',
      color: 'bg-rose-50 text-rose-600',
    },
  ];

  const quickLinks = [
    {
      label: 'Mark Scheme',
      path: '/teacher/mark-scheme',
      icon: 'ri-price-tag-3-line',
      color: 'bg-amber-100 text-amber-700',
    },
    {
      label: 'View Progress',
      path: '/teacher/progress',
      icon: 'ri-line-chart-line',
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'View Results',
      path: '/teacher/results',
      icon: 'ri-bar-chart-box-line',
      color: 'bg-sky-100 text-sky-700',
    },
  ];

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-red-600 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg">
          <i className="ri-error-warning-line mr-2"></i>
          {toastMsg}
        </div>
      )}

      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0) ?? 'T'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {subject} &middot; {subjectExams.length} exam
              {subjectExams.length !== 1 ? 's' : ''} &middot;{' '}
              {subjectSheets.length} sheets
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
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

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Quick Actions
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors duration-150"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${link.color}`}
              >
                <i className={`${link.icon} text-lg`}></i>
              </div>
              <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                {link.label}
              </span>
              <i className="ri-arrow-right-s-line text-gray-300 ml-auto"></i>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">My Exams</h4>
          <div className="space-y-3">
            {subjectExams.length === 0 ? (
              <p className="text-sm text-gray-400">
                No exams in {subject} yet.
              </p>
            ) : (
              subjectExams.map((exam) => {
                const examSheetCount = subjectSheets.filter(
                  (s) => s.exam_id === exam.id,
                ).length;
                const examChecked = subjectSheets.filter(
                  (s) =>
                    s.exam_id === exam.id &&
                    (s.status === 'checked' || s.status === 'rechecked'),
                ).length;
                return (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {exam.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {exam.date} &middot; {exam.total_questions} questions
                        &middot; {exam.max_marks} marks
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {examChecked}/{examSheetCount} checked
                      </span>
                      <StatusBadge status={exam.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Recent Sheets
          </h4>
          <div className="space-y-3">
            {subjectSheets.slice(0, 5).length === 0 ? (
              <p className="text-sm text-gray-400">No sheets uploaded yet.</p>
            ) : (
              subjectSheets.slice(0, 5).map((sheet) => (
                <div
                  key={sheet.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {sheet.student_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Roll No. {sheet.roll_no}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {sheet.marks !== null && (
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {sheet.marks} / 100
                      </span>
                    )}
                    <StatusBadge status={sheet.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
