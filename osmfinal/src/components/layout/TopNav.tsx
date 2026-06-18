import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { mockNotifications, type Notification } from "@/mock/mockData";

const pageTitles: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/exams": "Exams",
  "/admin/mark-scheme": "Mark Scheme",
  "/admin/student-data": "Student Data",
  "/admin/upload": "Sheet Upload",
  "/admin/assign": "Assign Checkers",
  "/admin/queue": "Work Queue",
  "/admin/users": "Users",
  "/admin/reports": "Reports",
  "/admin/reports/results": "Result Report",
  "/admin/reports/recheck": "Recheck Report",
  "/admin/reports/performance": "Checker Performance",
  "/admin/settings": "Settings",
  "/teacher": "Teacher Dashboard",
  "/teacher/exams": "My Exams",
  "/teacher/mark-scheme": "Mark Scheme",
  "/teacher/progress": "Progress",
  "/teacher/results": "Results",
  "/checker": "Checker Dashboard",
  "/checker/queue": "My Queue",
  "/checker/completed": "Completed",
  "/checker/marking": "Marking",
  "/recheck": "Recheck Dashboard",
  "/recheck/queue": "Recheck Queue",
  "/recheck/completed": "Completed",
  "/recheck/disputes": "Dispute Log",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-gray-900 text-white",
  teacher: "bg-emerald-100 text-emerald-700",
  checker: "bg-amber-100 text-amber-700",
  teacher_checker: "bg-sky-100 text-sky-700",
  rechecking: "bg-rose-100 text-rose-700",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  teacher: "Teacher",
  checker: "Checker",
  teacher_checker: "Teacher + Checker",
  rechecking: "Rechecking",
};

const typeIcons: Record<Notification["type"], string> = {
  submission: "ri-check-line",
  recheck: "ri-refresh-line",
  dispute: "ri-flag-line",
  assignment: "ri-inbox-line",
  confirmed: "ri-shield-check-line",
};

const typeColors: Record<Notification["type"], string> = {
  submission: "bg-emerald-100 text-emerald-600",
  recheck: "bg-violet-100 text-violet-600",
  dispute: "bg-rose-100 text-rose-600",
  assignment: "bg-sky-100 text-sky-600",
  confirmed: "bg-amber-100 text-amber-600",
};

function timeAgo(dateStr: string): string {
  const now = new Date("2025-03-16T12:00:00");
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TopNav({ sidebarCollapsed = false }: { sidebarCollapsed?: boolean }) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [localReadIds, setLocalReadIds] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    const match = Object.entries(pageTitles).find(([key]) => {
      if (key === "/admin" || key === "/teacher" || key === "/checker" || key === "/recheck") {
        return path === key;
      }
      return path.startsWith(key);
    });
    return match ? match[1] : "Dashboard";
  }, [location.pathname]);

  useEffect(() => {
    document.title = `OSM — ${pageTitle}`;
  }, [pageTitle]);

  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return mockNotifications
      .filter((n) => n.userId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [currentUser]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter((n) => !n.read && !localReadIds.has(n.id)).length;
  }, [userNotifications, localReadIds]);

  const handleMarkRead = useCallback((id: number) => {
    setLocalReadIds((prev) => new Set(prev).add(id));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      userNotifications.forEach((n) => next.add(n.id));
      return next;
    });
  }, [userNotifications]);

  const handleBellClick = () => {
    setDropdownOpen((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const isUnread = (n: Notification) => !n.read && !localReadIds.has(n.id);

  return (
    <header className={`h-[60px] bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 right-0 z-20 transition-all duration-300 ${sidebarCollapsed ? "left-[48px]" : "left-60"}`}>
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900 whitespace-nowrap">{pageTitle}</h2>
        {currentUser?.subject && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
            {currentUser.subject}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            ref={bellRef}
            onClick={handleBellClick}
            className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors duration-150 cursor-pointer"
          >
            <span className="w-5 h-5 flex items-center justify-center">
              <i className="ri-notification-3-line text-lg text-gray-600"></i>
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-full mt-2 w-[320px] max-h-[380px] bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
                {userNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <span className="w-10 h-10 flex items-center justify-center mb-2">
                      <i className="ri-notification-off-line text-2xl"></i>
                    </span>
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  userNotifications.map((n) => {
                    const unread = isUnread(n);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                          unread ? "bg-amber-50/60" : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${typeColors[n.type]}`}>
                          <i className={`${typeIcons[n.type]} text-sm`}></i>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-gray-800 leading-snug line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        {unread && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-2"></span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 whitespace-nowrap">{currentUser?.name}</p>
            <p className="text-xs text-gray-400 whitespace-nowrap">{currentUser?.email}</p>
          </div>
          {currentUser?.role && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${roleBadgeColors[currentUser.role]}`}>
              {roleLabels[currentUser.role]}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors duration-150 cursor-pointer whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-logout-box-r-line"></i>
          </span>
          Logout
        </button>
      </div>
    </header>
  );
}