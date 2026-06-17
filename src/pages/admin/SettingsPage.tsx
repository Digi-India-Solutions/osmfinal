import { useState, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { mockAppSettings, mockSubjects } from "@/mock/mockData";
import type { AppSettings, Subject } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

type SettingsTab = "general" | "subjects" | "profile";

const departmentOptions = ["Science", "Engineering", "Arts", "Commerce", "Other"];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();

  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]} />

      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-check-line"></i>
          </span>
          {toastMsg}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
        <p className="text-sm text-gray-500 mt-0.5">Manage system configuration, subjects, and your profile</p>
      </div>

      <div className="flex gap-6">
        <nav className="w-52 shrink-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "general"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-settings-3-line text-base"></i>
              </span>
              General
            </button>
            <button
              onClick={() => setActiveTab("subjects")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "subjects"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-book-open-line text-base"></i>
              </span>
              Subject Master
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "profile"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-user-line text-base"></i>
              </span>
              Profile
            </button>
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === "general" && <GeneralTab showToast={showToast} />}
          {activeTab === "subjects" && <SubjectMasterTab showToast={showToast} />}
          {activeTab === "profile" && <ProfileTab currentUser={currentUser} showToast={showToast} />}
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ showToast }: { showToast: (msg: string) => void }) {
  const [settings, setSettings] = useState<AppSettings>({ ...mockAppSettings });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    showToast("Settings saved");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setSettings((prev) => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setSettings((prev) => ({ ...prev, logoUrl: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveLogo = () => {
    showToast("Logo updated successfully");
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Company Branding</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => setSettings((prev) => ({ ...prev, companyName: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
            <input
              type="text"
              value={settings.website}
              onChange={(e) => setSettings((prev) => ({ ...prev, website: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Logo</h4>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 shrink-0 overflow-hidden">
            {logoPreview || settings.logoUrl ? (
              <img src={logoPreview || settings.logoUrl || ""} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span>{settings.logoText}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.svg"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                <i className="ri-upload-cloud-line text-sm"></i>
              </span>
              Upload Logo
            </button>
            {(logoPreview || settings.logoUrl) && (
              <>
                <button
                  onClick={handleSaveLogo}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Save Logo
                </button>
                <button
                  onClick={handleRemoveLogo}
                  className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Remove Logo
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">System Info</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Version</p>
            <p className="text-sm font-medium text-gray-900">1.0.0</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Build</p>
            <p className="text-sm font-medium text-gray-900">OSM Frontend</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Last Updated</p>
            <p className="text-sm font-medium text-gray-900">2025-03-01</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubjectMasterTab({ showToast }: { showToast: (msg: string) => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([...mockSubjects]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", code: "", department: "Science" });
  const [formError, setFormError] = useState("");

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [subjects, searchQuery]);

  const openAdd = () => {
    setEditingSubject(null);
    setForm({ name: "", code: "", department: "Science" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setForm({ name: subject.name, code: subject.code, department: subject.department });
    setFormError("");
    setShowModal(true);
  };

  const handleSaveSubject = () => {
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim().toUpperCase();
    if (!trimmedName) { setFormError("Subject name is required"); return; }
    if (!trimmedCode) { setFormError("Subject code is required"); return; }
    if (trimmedCode.length > 10) { setFormError("Code must be 10 characters max"); return; }

    if (editingSubject) {
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === editingSubject.id
            ? { ...s, name: trimmedName, code: trimmedCode, department: form.department }
            : s
        )
      );
      showToast("Subject updated");
    } else {
      const newSubject: Subject = {
        id: Math.max(...subjects.map((s) => s.id), 0) + 1,
        name: trimmedName,
        code: trimmedCode,
        department: form.department,
        status: "active",
      };
      setSubjects((prev) => [...prev, newSubject]);
      showToast("Subject added");
    }
    setShowModal(false);
  };

  const toggleStatus = (id: number) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === "active" ? "inactive" : "active" } as Subject : s
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Subject Master</h4>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line text-base"></i>
            </span>
            Add Subject
          </button>
        </div>

        <div className="relative max-w-xs mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
            <i className="ri-search-line text-sm"></i>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent placeholder:text-gray-400"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">ID</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Subject Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Code</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Department</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-file-search-line text-xl text-gray-400"></i>
                    </div>
                    <p className="text-sm text-gray-500">No subjects found</p>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{s.id}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{s.code}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{s.department}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        s.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {s.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => toggleStatus(s.id)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                            s.status === "active"
                              ? "text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                              : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={s.status === "active" ? "Deactivate" : "Activate"}
                        >
                          <i className={`${s.status === "active" ? "ri-toggle-line" : "ri-toggle-fill"} text-sm`}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingSubject ? "Edit Subject" : "Add Subject"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError(""); }}
                  placeholder="e.g. Biology"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject Code</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => { setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 10) }); setFormError(""); }}
                  placeholder="e.g. BIO"
                  maxLength={10}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">Max 10 characters, uppercase only</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                >
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-xs text-rose-500">{formError}</p>}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubject}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                {editingSubject ? "Save Changes" : "Add Subject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ currentUser, showToast }: { currentUser: { name: string; email: string; role: string } | null; showToast: (msg: string) => void }) {
  const [name, setName] = useState(currentUser?.name || "");
  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpdatePassword = () => {
    if (!passwordForm.current) { setPasswordError("Current password is required"); return; }
    if (!passwordForm.newPass) { setPasswordError("New password is required"); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { setPasswordError("Passwords do not match"); return; }
    setPasswordError("");
    showToast("Password updated");
    setPasswordForm({ current: "", newPass: "", confirm: "" });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-900 text-white flex items-center justify-center text-xl font-bold shrink-0">
            {getInitials(name)}
          </div>
          <div>
            <h4 className="text-base font-semibold text-gray-900">{name}</h4>
            <p className="text-sm text-gray-500">{currentUser?.email}</p>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={currentUser?.email || ""}
              readOnly
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-900 text-white whitespace-nowrap">
              Admin
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h4>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => { setPasswordForm({ ...passwordForm, current: e.target.value }); setPasswordError(""); }}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={passwordForm.newPass}
              onChange={(e) => { setPasswordForm({ ...passwordForm, newPass: e.target.value }); setPasswordError(""); }}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => { setPasswordForm({ ...passwordForm, confirm: e.target.value }); setPasswordError(""); }}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          {passwordError && <p className="text-xs text-rose-500">{passwordError}</p>}
          <button
            onClick={handleUpdatePassword}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}