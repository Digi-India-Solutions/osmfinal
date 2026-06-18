// pages/admin/UserManagement.tsx
import { useState, useEffect, useRef } from 'react';
import { userApi, CreateUserData } from '@/api/users';
import { useAuth } from '@/context/AuthContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';

const roleOptions: { value: User['role']; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'checker', label: 'Checker' },
  { value: 'teacher_checker', label: 'Teacher + Checker' },
  { value: 'rechecking', label: 'Rechecking' },
];

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-gray-900 text-white',
  teacher: 'bg-emerald-100 text-emerald-700',
  checker: 'bg-amber-100 text-amber-700',
  teacher_checker: 'bg-sky-100 text-sky-700',
  rechecking: 'bg-violet-100 text-violet-700',
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions?: Record<string, any>;
  subject?: string;
  createdAt: string;
}

export default function UserManagement() {
  const loading = usePageLoading();
  const { hasPermission } = useAuth();
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<CreateUserData & { subject?: string }>({
    name: '',
    email: '',
    password: '',
    role: 'checker',
    subject: '',
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [apiError, setApiError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── REFS FOR MODAL ──────────────────────────────────────────

  const modalRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // ─── CLOSE MODAL ON OUTSIDE CLICK ───────────────────────────

  const handleModalClose = () => {
    if (!isSaving) {
      setShowModal(false);
    }
  };

  const handleDeleteModalClose = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  // ─── TOAST FUNCTION ──────────────────────────────────────────

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setSuccessMessage(msg);
    setToastType(type);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  // ─── Fetch Users ──────────────────────────────────────────────

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userApi.getAllUsers();
      setUserList(data.items || []);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ─── Validations ──────────────────────────────────────────────

  const validateField = (field: string, value: string): boolean => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [field]: 'This field is required' }));
      return false;
    }
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors((prev) => ({
        ...prev,
        [field]: 'Please enter a valid email address',
      }));
      return false;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    return true;
  };

  const isFormValid =
    form.name.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    Object.keys(errors).length === 0;

  // ─── CRUD Operations ──────────────────────────────────────────

  const openAdd = () => {
    setEditingUser(null);
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'checker',
      subject: '',
      isActive: true,
    });
    setErrors({});
    setApiError('');
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role as any,
      subject: user.subject || '',
      isActive: user.isActive,
    });
    setErrors({});
    setApiError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!isFormValid) return;

    setIsSaving(true);
    setApiError('');

    try {
      if (editingUser) {
        const updateData: Partial<CreateUserData & { subject?: string }> = {
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          subject: form.subject || null,
        };
        if (form.password) {
          updateData.password = form.password;
        }

        const updated = await userApi.updateUser(editingUser.id, updateData);
        setUserList((prev) =>
          prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)),
        );
        showToast('User updated successfully', 'success');
        setShowModal(false);
      } else {
        const newUser = await userApi.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          isActive: true,
          subject: form.subject || null,
        });
        setUserList((prev) => [...prev, newUser]);
        showToast('User added successfully', 'success');
        setShowModal(false);
      }
    } catch (error: any) {
      console.error('Save error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save user';
      setApiError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── DELETE USER ──────────────────────────────────────────────

  const openDeleteModal = (user: User) => {
    if (user.role === 'admin') {
      showToast('Cannot delete admin user', 'error');
      return;
    }
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setApiError('');

    try {
      await userApi.deleteUser(userToDelete.id);
      setUserList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      showToast('User deleted successfully', 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete user';
      setApiError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const showSubject =
    form.role === 'teacher' || form.role === 'teacher_checker';

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
      />

      {/* ─── TOAST NOTIFICATION ───────────────────────────────── */}

      {showSuccess && (
        <div
          className={`fixed top-20 right-6 z-50 text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-pulse ${
            toastType === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i
              className={
                toastType === 'error'
                  ? 'ri-error-warning-line'
                  : 'ri-check-line'
              }
            ></i>
          </span>
          {successMessage}
        </div>
      )}

      {/* ─── HEADER ────────────────────────────────────────────── */}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            User Management
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage all system users and their roles
          </p>
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

      {/* ─── API ERROR ──────────────────────────────────────────── */}

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
          {apiError}
        </div>
      )}

      {/* ─── USER TABLE ─────────────────────────────────────────── */}

      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Email
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Subject
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {userList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-team-line text-xl text-gray-400"></i>
                    </div>
                    <p className="text-sm text-gray-500">No users found</p>
                  </td>
                </tr>
              ) : (
                userList.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {user.name}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                      {user.email}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${roleBadgeColors[user.role]}`}
                      >
                        {roleOptions.find((r) => r.value === user.role)
                          ?.label || user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {user.subject || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                          user.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <i className="ri-edit-line text-sm"></i>
                        </button>

                        {user.role !== 'admin' && (
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Permanently"
                          >
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD/EDIT MODAL (WITH OUTSIDE CLICK) ──────────────── */}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={handleModalClose} // ✅ Click outside = close
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6"
            onClick={(e) => e.stopPropagation()} // ✅ Prevent closing when clicking inside
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h4>
              <button
                onClick={handleModalClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                disabled={isSaving}
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (errors.name) validateField('name', e.target.value);
                  }}
                  onBlur={() => validateField('name', form.name)}
                  placeholder="e.g. Mr. Sharma"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${
                    errors.name ? 'border-rose-400' : 'border-gray-200'
                  }`}
                  disabled={isSaving}
                />
                {errors.name && (
                  <p className="text-xs text-rose-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    if (errors.email) validateField('email', e.target.value);
                  }}
                  onBlur={() => validateField('email', form.email)}
                  placeholder="user@osm.com"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${
                    errors.email ? 'border-rose-400' : 'border-gray-200'
                  }`}
                  disabled={isSaving}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (errors.password)
                      validateField('password', e.target.value);
                  }}
                  onBlur={() => validateField('password', form.password)}
                  placeholder="Enter password"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${
                    errors.password ? 'border-rose-400' : 'border-gray-200'
                  }`}
                  disabled={isSaving}
                />
                {errors.password && (
                  <p className="text-xs text-rose-500 mt-1">
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as any,
                      subject: '',
                    })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  disabled={isSaving}
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {showSubject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={form.subject || ''}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    placeholder="Enter subject (e.g., Mathematics)"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={handleModalClose}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={!isFormValid || isSaving}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    {editingUser ? 'Updating...' : 'Adding...'}
                  </>
                ) : editingUser ? (
                  'Save Changes'
                ) : (
                  'Add User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL (WITH OUTSIDE CLICK) ──── */}

      {showDeleteModal && userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={handleDeleteModalClose} // ✅ Click outside = close
        >
          <div
            ref={deleteModalRef}
            className="bg-white rounded-2xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()} // ✅ Prevent closing when clicking inside
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-delete-bin-line text-red-600 text-2xl"></i>
              </div>

              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Delete User Permanently
              </h4>
              <p className="text-sm text-gray-600 mb-1">
                Are you sure you want to{' '}
                <span className="text-red-600 font-semibold">
                  permanently delete
                </span>{' '}
                this user?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 my-4 text-left">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Name:</span> {userToDelete.name}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Email:</span>{' '}
                  {userToDelete.email}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Role:</span>{' '}
                  {roleOptions.find((r) => r.value === userToDelete.role)
                    ?.label || userToDelete.role}
                </p>
              </div>
              <p className="text-xs text-rose-600 font-semibold">
                ⚠️ This action cannot be undone! All user data will be
                permanently removed.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={handleDeleteModalClose}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Deleting...
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
