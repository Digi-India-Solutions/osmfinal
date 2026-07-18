// config.tsx

import type { RouteObject } from 'react-router-dom';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import NotFound from '@/pages/NotFound';
import LoginPage from '@/pages/auth/LoginPage';

// ─── ADMIN PAGES ──────────────────────────────────────────────────────
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ExamManagement from '@/pages/admin/ExamManagement';
import SheetUpload from '@/pages/admin/SheetUpload';
import StudentDataUpload from '@/pages/admin/StudentDataUpload';
import CheckerAssignment from '@/pages/admin/CheckerAssignment';
import WorkQueue from '@/pages/admin/WorkQueue';
import UserManagement from '@/pages/admin/UserManagement';
import AdminReports from '@/pages/admin/AdminReports';
import ResultReport from '@/pages/admin/ResultReport';
import RecheckReport from '@/pages/admin/RecheckReport';
import CheckerPerformance from '@/pages/admin/CheckerPerformance';
import SettingsPage from '@/pages/admin/SettingsPage';
// ✅ ADD THIS IMPORT
import CheckedSheetView from '@/pages/admin/CheckedSheetView';

// ─── TEACHER PAGES ────────────────────────────────────────────────────
import TeacherDashboard from '@/pages/teacher/TeacherDashboard';
import MarkSchemeEditor from '@/pages/teacher/MarkSchemeEditor';
import CheckingProgress from '@/pages/teacher/CheckingProgress';
import ResultsView from '@/pages/teacher/ResultsView';

// ─── CHECKER PAGES ────────────────────────────────────────────────────
import CheckerDashboard from '@/pages/checker/CheckerDashboard';
import CheckerWorkQueue from '@/pages/checker/CheckerWorkQueue';
import CheckerCompleted from '@/pages/checker/CheckerCompleted';
import MarkingView from '@/pages/checker/MarkingView';

// ─── RECHECKING PAGES ────────────────────────────────────────────────
import RecheckDashboard from '@/pages/recheck/RecheckDashboard';
import RecheckQueue from '@/pages/recheck/RecheckQueue';
import RecheckHistory from '@/pages/recheck/RecheckHistory';
import RecheckMarkingView from '@/pages/recheck/RecheckMarkingView';

import Layout from '@/components/layout/Layout';
import RecheckedSheetView from '@/pages/admin/RecheckedSheetView';

// ─── PROTECTED ROUTE COMPONENT ──────────────────────────────────────

function ProtectedRoute({
  allowedRoles = [],
  redirectTo = '/login',
}: {
  allowedRoles?: string[];
  redirectTo?: string;
}) {
  const { currentUser, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (
    allowedRoles.length > 0 &&
    currentUser &&
    !allowedRoles.includes(currentUser.role)
  ) {
    return <Navigate to={`${redirectTo}?error=unauthorized`} replace />;
  }

  return <Outlet />;
}

// ─── ROUTES CONFIGURATION ────────────────────────────────────────────

const routes: RouteObject[] = [
  // ─── PUBLIC ROUTES ──────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ─── PROTECTED ROUTES ───────────────────────────────────────────
  {
    element: (
      <ProtectedRoute
        allowedRoles={[
          'super_admin',
          'admin',
          'teacher',
          'checker',
          'teacher_checker',
          'rechecking',
        ]}
      />
    ),
    children: [
      {
        element: <Layout />,
        children: [
          // ─── ✅ ADMIN + SUPER ADMIN ROUTES (SHARED) ───────────
          {
            element: <ProtectedRoute allowedRoles={['admin', 'super_admin']} />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
              { path: '/admin/exams', element: <ExamManagement /> },
              { path: '/admin/mark-scheme', element: <MarkSchemeEditor /> },
              { path: '/admin/student-data', element: <StudentDataUpload /> },
              { path: '/admin/upload', element: <SheetUpload /> },
              { path: '/admin/assign', element: <CheckerAssignment /> },
              { path: '/admin/queue', element: <WorkQueue /> },
              { path: '/admin/users', element: <UserManagement /> },
              { path: '/admin/reports', element: <AdminReports /> },
              { path: '/admin/reports/results', element: <ResultReport /> },
              { path: '/admin/reports/recheck', element: <RecheckReport /> },
              {
                path: '/admin/reports/performance',
                element: <CheckerPerformance />,
              },
              // ✅ ADD THIS ROUTE - Admin se checked sheet view karne ke liye
              {
                path: '/admin/view-checked-sheet/:sheetId',
                element: <CheckedSheetView />,
              },
              {
                path: '/admin/view-rechecked-sheet/:requestId',
                element: <RecheckedSheetView />,
              },
              { path: '/admin/*', element: <AdminDashboard /> },
            ],
          },

          // ─── ✅ SETTINGS — SIRF SUPER ADMIN KE LIYE ───────────
          {
            element: <ProtectedRoute allowedRoles={['super_admin']} />,
            children: [{ path: '/admin/settings', element: <SettingsPage /> }],
          },

          // ─── TEACHER ROUTES ─────────────────────────────
          {
            element: (
              <ProtectedRoute allowedRoles={['teacher', 'teacher_checker']} />
            ),
            children: [
              { path: '/teacher', element: <TeacherDashboard /> },
              { path: '/teacher/mark-scheme', element: <MarkSchemeEditor /> },
              { path: '/teacher/progress', element: <CheckingProgress /> },
              { path: '/teacher/results', element: <ResultsView /> },
              { path: '/teacher/*', element: <TeacherDashboard /> },
            ],
          },

          // ─── CHECKER ROUTES ─────────────────────────────
          {
            element: (
              <ProtectedRoute allowedRoles={['checker', 'teacher_checker']} />
            ),
            children: [
              { path: '/checker/dashboard', element: <CheckerDashboard /> },
              { path: '/checker/queue', element: <CheckerWorkQueue /> },
              { path: '/checker/completed', element: <CheckerCompleted /> },
              {
                path: '/checker',
                element: <Navigate to="/checker/dashboard" replace />,
              },
              { path: '/checker/*', element: <NotFound /> },
            ],
          },

          // ─── RECHECKING ROUTES ──────────────────────────
          {
            element: <ProtectedRoute allowedRoles={['rechecking']} />,
            children: [
              { path: '/recheck', element: <RecheckDashboard /> },
              { path: '/recheck/queue', element: <RecheckQueue /> },
              { path: '/recheck/history', element: <RecheckHistory /> },
              { path: '/recheck/*', element: <RecheckDashboard /> },
            ],
          },
        ],
      },

      // ─── CHECKER MARKING (without Layout) ──────────────────
      {
        element: (
          <ProtectedRoute allowedRoles={['checker', 'teacher_checker']} />
        ),
        children: [
          { path: '/checker/marking/:sheetId', element: <MarkingView /> },
        ],
      },

      // ─── RECHECKING MARKING (without Layout) ──────────────
      {
        element: <ProtectedRoute allowedRoles={['rechecking']} />,
        children: [
          {
            path: '/recheck/marking/:requestId',
            element: <RecheckMarkingView />,
          },
        ],
      },

      // ─── OLD /super-admin LINKS → REDIRECT TO /admin ────────
      {
        path: '/super-admin',
        element: <Navigate to="/admin" replace />,
      },
    ],
  },

  // ─── FALLBACK ROUTES ─────────────────────────────────────────────
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
];

export default routes;
