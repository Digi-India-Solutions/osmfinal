import type { RouteObject } from "react-router-dom";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/auth/LoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ExamManagement from "@/pages/admin/ExamManagement";
import SheetUpload from "@/pages/admin/SheetUpload";
import StudentDataUpload from "@/pages/admin/StudentDataUpload";
import CheckerAssignment from "@/pages/admin/CheckerAssignment";
import WorkQueue from "@/pages/admin/WorkQueue";
import UserManagement from "@/pages/admin/UserManagement";
import AdminReports from "@/pages/admin/AdminReports";
import ResultReport from "@/pages/admin/ResultReport";
import RecheckReport from "@/pages/admin/RecheckReport";
import CheckerPerformance from "@/pages/admin/CheckerPerformance";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import MarkSchemeEditor from "@/pages/teacher/MarkSchemeEditor";
import CheckingProgress from "@/pages/teacher/CheckingProgress";
import ResultsView from "@/pages/teacher/ResultsView";
import CheckerDashboard from "@/pages/checker/CheckerDashboard";
import CheckerWorkQueue from "@/pages/checker/CheckerWorkQueue";
import CheckerCompleted from "@/pages/checker/CheckerCompleted";
import MarkingView from "@/pages/checker/MarkingView";
import RecheckDashboard from "@/pages/recheck/RecheckDashboard";
import RecheckQueue from "@/pages/recheck/RecheckQueue";
import RecheckHistory from "@/pages/recheck/RecheckHistory";
import RecheckMarkingView from "@/pages/recheck/RecheckMarkingView";
import Layout from "@/components/layout/Layout";
import SettingsPage from "@/pages/admin/SettingsPage";

function ProtectedRoute({ allowedRoles }: { allowedRoles: string[] }) {
  const { currentUser, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute allowedRoles={["admin", "teacher", "checker", "teacher_checker", "rechecking"]} />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            element: <ProtectedRoute allowedRoles={["admin"]} />,
            children: [
              { path: "/admin", element: <AdminDashboard /> },
              { path: "/admin/exams", element: <ExamManagement /> },
              { path: "/admin/mark-scheme", element: <MarkSchemeEditor /> },
              { path: "/admin/student-data", element: <StudentDataUpload /> },
              { path: "/admin/upload", element: <SheetUpload /> },
              { path: "/admin/assign", element: <CheckerAssignment /> },
              { path: "/admin/queue", element: <WorkQueue /> },
              { path: "/admin/users", element: <UserManagement /> },
              { path: "/admin/reports", element: <AdminReports /> },
              { path: "/admin/reports/results", element: <ResultReport /> },
              { path: "/admin/reports/recheck", element: <RecheckReport /> },
              { path: "/admin/reports/performance", element: <CheckerPerformance /> },
              { path: "/admin/settings", element: <SettingsPage /> },
              { path: "/admin/*", element: <AdminDashboard /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={["teacher", "teacher_checker"]} />,
            children: [
              { path: "/teacher", element: <TeacherDashboard /> },
              { path: "/teacher/mark-scheme", element: <MarkSchemeEditor /> },
              { path: "/teacher/progress", element: <CheckingProgress /> },
              { path: "/teacher/results", element: <ResultsView /> },
              { path: "/teacher/*", element: <TeacherDashboard /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={["checker", "teacher_checker"]} />,
            children: [
              { path: "/checker/dashboard", element: <CheckerDashboard /> },
              { path: "/checker/queue", element: <CheckerWorkQueue /> },
              { path: "/checker/completed", element: <CheckerCompleted /> },
              { path: "/checker", element: <Navigate to="/checker/dashboard" replace /> },
              { path: "/checker/*", element: <NotFound /> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={["rechecking"]} />,
            children: [
              { path: "/recheck", element: <RecheckDashboard /> },
              { path: "/recheck/queue", element: <RecheckQueue /> },
              { path: "/recheck/history", element: <RecheckHistory /> },
              { path: "/recheck/*", element: <RecheckDashboard /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["checker", "teacher_checker"]} />,
        children: [
          { path: "/checker/marking/:sheetId", element: <MarkingView /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["rechecking"]} />,
        children: [
          { path: "/recheck/marking/:requestId", element: <RecheckMarkingView /> },
        ],
      },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;