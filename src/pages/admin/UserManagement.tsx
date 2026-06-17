import { useState } from "react";
import { users, mockSubjects } from "@/mock/mockData";
import type { User } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

const roleOptions: { value: User["role"]; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "checker", label: "Checker" },
  { value: "teacher_checker", label: "Teacher + Checker" },
  { value: "rechecking", label: "Rechecking" },
];

const roleBadgeColors: Record<string, string> = {
  admin: "bg-gray-900 text-white",
  teacher: "bg-emerald-100 text-emerald-700",
  checker: "bg-amber-100 text-amber-700",
  teacher_checker: "bg-sky-100 text-sky-700",
  rechecking: "bg-violet-100 text-violet-700",
};

export default function UserManagement() {
  const loading = usePageLoading();
  const [userList, setUserList] = useState<User[]>(users);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "checker" as User["role"], subject: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const validateField = (field: string, value: string): boolean => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [field]: "This field is required" }));
      return false;
    }
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors((prev) => ({ ...prev, [field]: "Please enter a valid email address" }));
      return false;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return true;
  };

  const isFormValid = form.name.trim() && form.email.trim() && form.password.trim() && Object.keys(errors).length === 0;

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "checker", subject: "" });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      subject: user.subject || "",
    });
    setErrors({});
    setShowModal(true);
  };

  const handleSave = () => {
    if (!isFormValid) return;
    if (editingUser) {
      setUserList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: form.name, email: form.email, password: form.password, role: form.role, subject: form.subject || undefined }
            : u
        )
      );
      showToast("User updated successfully");
    } else {
      const newUser: User = {
        id: Math.max(...userList.map((u) => u.id), 0) + 1,
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        subject: form.subject || undefined,
        status: "active",
      };
      setUserList((prev) => [...prev, newUser]);
      showToast("User added successfully");
    }
    setShowModal(false);
  };

  const toggleStatus = (id: number) => {
    setUserList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } as User : u))
    );
    const target = userList.find((u) => u.id === id);
    showToast(target?.status === "active" ? "User deactivated" : "User reactivated");
  };

  const showSubject = form.role === "teacher" || form.role === "teacher_checker";

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} />

      {showSuccess && (
        <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line"></i>
          </span>
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-500 mt-0.5">Manage all system users and their roles</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-add-line text-base"></i>
          </span>
          Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Email</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Role</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Subject</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{user.name}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${roleBadgeColors[user.role]}`}>
                      {roleOptions.find((r) => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{user.subject || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                      user.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {user.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      {user.role !== "admin" && (
                        <button
                          onClick={() => toggleStatus(user.id)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                            user.status === "active"
                              ? "text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={user.status === "active" ? "Deactivate" : "Reactivate"}
                        >
                          <i className={`${user.status === "active" ? "ri-user-unfollow-line" : "ri-user-follow-line"} text-sm`}></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingUser ? "Edit User" : "Add New User"}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) validateField("name", e.target.value); }}
                  onBlur={() => validateField("name", form.name)}
                  placeholder="e.g. Mr. Sharma"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.name ? "border-rose-400" : "border-gray-200"}`}
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) validateField("email", e.target.value); }}
                  onBlur={() => validateField("email", form.email)}
                  placeholder="user@osm.com"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.email ? "border-rose-400" : "border-gray-200"}`}
                />
                {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); if (errors.password) validateField("password", e.target.value); }}
                  onBlur={() => validateField("password", form.password)}
                  placeholder="Enter password"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.password ? "border-rose-400" : "border-gray-200"}`}
                />
                {errors.password && <p className="text-xs text-rose-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as User["role"], subject: "" })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {showSubject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  >
                    <option value="">Select subject</option>
                    {mockSubjects.filter((s) => s.status === "active").map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {editingUser ? "Save Changes" : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}