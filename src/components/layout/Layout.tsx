import { useState } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { Outlet } from "react-router-dom";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />
      <TopNav sidebarCollapsed={sidebarCollapsed} />
      <main
        className={`mt-[60px] p-6 min-h-[calc(100vh-60px)] transition-all duration-300 ${
          sidebarCollapsed ? "ml-[48px]" : "ml-60"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}