import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NavLink } from 'react-router-dom';
import settingsService, { ISettings } from '@/api/setting';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const adminLinks = [
  { label: 'Dashboard', path: '/admin', icon: 'ri-dashboard-line' },
  { label: 'Exams', path: '/admin/exams', icon: 'ri-file-list-3-line' },
  {
    label: 'Mark Scheme',
    path: '/admin/mark-scheme',
    icon: 'ri-price-tag-3-line',
  },
  {
    label: 'Student Data',
    path: '/admin/student-data',
    icon: 'ri-database-2-line',
  },
  {
    label: 'Sheet Upload',
    path: '/admin/upload',
    icon: 'ri-upload-cloud-2-line',
  },
  {
    label: 'Assign Checkers',
    path: '/admin/assign',
    icon: 'ri-user-settings-line',
  },
  { label: 'Work Queue', path: '/admin/queue', icon: 'ri-stack-line' },
  { label: 'Users', path: '/admin/users', icon: 'ri-team-line' },
  { label: 'Reports', path: '/admin/reports', icon: 'ri-bar-chart-2-line' },
  { label: 'Settings', path: '/admin/settings', icon: 'ri-settings-3-line' },
];

const teacherLinks = [
  { label: 'Dashboard', path: '/teacher', icon: 'ri-dashboard-line' },
  {
    label: 'Mark Scheme',
    path: '/teacher/mark-scheme',
    icon: 'ri-price-tag-3-line',
  },
  { label: 'Progress', path: '/teacher/progress', icon: 'ri-line-chart-line' },
  { label: 'Results', path: '/teacher/results', icon: 'ri-award-line' },
];

const checkerLinks = [
  { label: 'My Queue', path: '/checker/queue', icon: 'ri-inbox-line' },
  {
    label: 'Completed',
    path: '/checker/completed',
    icon: 'ri-checkbox-circle-line',
  },
];

const recheckLinks = [
  { label: 'Dashboard', path: '/recheck', icon: 'ri-dashboard-line' },
  { label: 'Recheck Queue', path: '/recheck/queue', icon: 'ri-refresh-line' },
  {
    label: 'Completed',
    path: '/recheck/history',
    icon: 'ri-check-double-line',
  },
  {
    label: 'Dispute Log',
    path: '/recheck/disputes',
    icon: 'ri-error-warning-line',
  },
];

function Tooltip({ label, show }: { label: string; show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
      {label}
      <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-gray-900"></div>
    </div>
  );
}

function NavSection({
  label,
  links,
  collapsed,
}: {
  label: string;
  links: { label: string; path: string; icon: string }[];
  collapsed: boolean;
}) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div>
      {!collapsed && (
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.path} className="relative">
            <NavLink
              to={link.path}
              onMouseEnter={() => setHoveredPath(link.path)}
              onMouseLeave={() => setHoveredPath(null)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                  collapsed ? 'justify-center px-1' : ''
                } ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <span className="w-5 h-5 flex items-center justify-center shrink-0">
                <i className={`${link.icon} text-base`}></i>
              </span>
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
            <Tooltip
              label={link.label}
              show={collapsed && hoveredPath === link.path}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const isDual = role === 'teacher_checker';

  // ─── SETTINGS STATE ──────────────────────────────────────────────────────

  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── FETCH SETTINGS ─────────────────────────────────────────────────────

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsService.getSettings();
        if (response.success && response.exists && response.data) {
          setSettings(response.data);
        } else {
          // Fallback to default if no settings
          setSettings(null);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // ─── GET COMPANY INITIALS ──────────────────────────────────────────────

  const getCompanyInitials = (name: string) => {
    if (!name) return 'OSM';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return name.slice(0, 2).toUpperCase();
    }
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  // ─── COMPANY NAME & LOGO ──────────────────────────────────────────────

  const companyName = settings?.company_name || 'OSM Pro';
  const companyLogo = settings?.logo || null;
  const companyInitials = getCompanyInitials(companyName);

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <aside
      className={`h-screen fixed left-0 top-0 bg-white border-r border-gray-100 flex flex-col z-30 transition-all duration-300 ${
        collapsed ? 'w-[48px]' : 'w-60'
      }`}
    >
      {/* ─── HEADER ────────────────────────────────────────────────────── */}

      <div
        className={`h-[60px] flex items-center border-b border-gray-100 shrink-0 ${collapsed ? 'justify-center px-2' : 'px-6'}`}
      >
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-sm font-bold">
                {companyInitials}
              </span>
            )}
          </div>

          {/* Company Name */}
          {!collapsed && (
            <span className="font-semibold text-gray-900 text-base whitespace-nowrap">
              {companyName}
            </span>
          )}
        </div>
      </div>

      {/* ─── NAVIGATION ────────────────────────────────────────────────── */}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {isDual ? (
          <>
            <NavSection
              label="Teacher"
              links={teacherLinks}
              collapsed={collapsed}
            />
            {!collapsed && <div className="border-t border-gray-100" />}
            {collapsed && (
              <div className="w-6 mx-auto border-t border-gray-100" />
            )}
            <NavSection
              label="Checker"
              links={checkerLinks}
              collapsed={collapsed}
            />
          </>
        ) : (
          <>
            {role === 'admin' && (
              <NavSection
                label="Navigation"
                links={adminLinks}
                collapsed={collapsed}
              />
            )}
            {role === 'teacher' && (
              <NavSection
                label="Navigation"
                links={teacherLinks}
                collapsed={collapsed}
              />
            )}
            {role === 'checker' && (
              <NavSection
                label="Navigation"
                links={checkerLinks}
                collapsed={collapsed}
              />
            )}
            {role === 'rechecking' && (
              <NavSection
                label="Navigation"
                links={recheckLinks}
                collapsed={collapsed}
              />
            )}
          </>
        )}
      </nav>

      {/* ─── HELP SECTION ──────────────────────────────────────────────── */}

      {!collapsed && (
        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Need help?</p>
            <p className="text-xs text-gray-400">
              Contact your system administrator for assistance.
            </p>
          </div>
        </div>
      )}

      {/* ─── TOGGLE BUTTON ────────────────────────────────────────────── */}

      <button
        onClick={onToggle}
        className={`flex items-center justify-center h-10 border-t border-gray-100 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer ${
          collapsed ? 'px-2' : 'px-4 gap-2'
        }`}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          <i
            className={`${collapsed ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'} text-sm`}
          ></i>
        </span>
        {!collapsed && <span className="text-xs font-medium">Collapse</span>}
      </button>
    </aside>
  );
}
