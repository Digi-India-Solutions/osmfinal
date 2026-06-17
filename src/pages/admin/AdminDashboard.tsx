import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { adminStats, sheets, exams, users, getStatusBadge, mockRecheckRequests, mockCheckerStats } from "@/mock/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Breadcrumb from "@/components/ui/Breadcrumb";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const recentSheets = [...sheets]
    .sort((a, b) => b.id - a.id)
    .slice(0, 8);

  const getExamName = (examId: number) => exams.find((e) => e.id === examId)?.name || "Unknown";
  const getUserName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    return users.find((u) => u.id === userId)?.name || "Unknown";
  };

  const statusChartData = (["uploaded", "checking", "checked", "recheck", "done"] as const).map((status) => {
    let count = 0;
    if (status === "done") {
      count = sheets.filter((s) => s.status === "done" || s.status === "rechecked").length;
    } else {
      count = sheets.filter((s) => s.status === status).length;
    }
    const badge = getStatusBadge(status === "done" ? "rechecked" : status);
    return {
      status: badge.label,
      count,
      fill: status === "uploaded" ? "#9ca3af" : status === "checking" ? "#f59e0b" : status === "checked" ? "#34d399" : status === "recheck" ? "#a78bfa" : "#059669",
    };
  });

  const pendingRechecks = mockRecheckRequests.filter((r) => r.status === "pending").length;
  const teacherDisputes = mockRecheckRequests.filter((r) => r.status === "requested_by_teacher").length;

  const quickLinks = [
    { title: "Result Report", desc: "View final marks by exam", icon: "ri-bar-chart-2-line", path: "/admin/reports/results" },
    { title: "Recheck Report", desc: "Compare original vs rechecked", icon: "ri-refresh-line", path: "/admin/reports/recheck" },
    { title: "Checker Performance", desc: "Evaluate workload & accuracy", icon: "ri-user-star-line", path: "/admin/reports/performance" },
  ];

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Dashboard" }]} />

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
            <p className="text-sm text-gray-500 mt-0.5">
              Here's what's happening with your marking system today.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-sm text-gray-500 whitespace-nowrap">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                <i className={`${stat.icon} text-lg`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Sheet Status Overview</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={statusChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "12px" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
              {statusChartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <i className="ri-refresh-line text-violet-600 text-sm"></i>
            </span>
            <p className="text-sm font-medium text-gray-900">Pending Rechecks</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{pendingRechecks}</p>
          <p className="text-xs text-gray-400 mt-1">Awaiting recheck evaluation</p>
        </div>

        <div className="bg-white rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
              <i className="ri-flag-line text-rose-600 text-sm"></i>
            </span>
            <p className="text-sm font-medium text-gray-900">Teacher Disputes</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{teacherDisputes}</p>
          <p className="text-xs text-gray-400 mt-1">Flagged by subject teachers</p>
        </div>

        <div className="bg-white rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="ri-check-double-line text-emerald-600 text-sm"></i>
              </span>
              <p className="text-sm font-medium text-gray-900">Completed</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{mockCheckerStats.reduce((sum, c) => sum + c.sheetsCompleted, 0)}</p>
            <p className="text-xs text-gray-400 mt-1">Sheets finished by checkers</p>
          </div>
          <button
            onClick={() => navigate("/admin/queue")}
            className="mt-3 w-full text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            Go to Recheck Management
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Links to Reports</h4>
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
                  <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{link.title}</p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{link.desc}</p>
                </div>
              </div>
              <span className="w-6 h-6 flex items-center justify-center shrink-0 text-gray-300 group-hover:text-gray-600 transition-colors">
                <i className="ri-arrow-right-s-line text-lg"></i>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Recent Sheet Activity</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sheet ID</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Student</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Exam</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {recentSheets.map((sheet) => (
                  <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                    <td className="py-2.5 px-2 font-medium text-gray-900 whitespace-nowrap">#{sheet.id}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{sheet.studentName}</td>
                    <td className="py-2.5 px-2 text-gray-500 whitespace-nowrap text-xs">{getExamName(sheet.examId)}</td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={sheet.status} />
                    </td>
                    <td className="py-2.5 px-2 text-gray-500 text-xs whitespace-nowrap">{getUserName(sheet.assignedTo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Quick Overview</h4>
          <div className="space-y-4">
            {[
              { label: "Checking Progress", value: 68 },
              { label: "Upload Queue", value: 42 },
              { label: "Reports Generated", value: 91 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-500">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 rounded-full transition-all duration-500" style={{ width: `${item.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Status Distribution</h4>
            <div className="flex flex-wrap gap-2">
              {(["uploaded", "assigned", "checking", "checked", "recheck", "rechecked"] as const).map((status) => {
                const count = sheets.filter((s) => s.status === status).length;
                return (
                  <StatusBadge key={status} status={status} className="text-[11px]" />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}