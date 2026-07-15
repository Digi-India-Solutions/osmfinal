// src/pages/admin/UserManagement.tsx

import { useState, useEffect, useRef } from 'react';
import { userApi, CreateUserData } from '@/api/users';
import { useAuth } from '@/context/AuthContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';

const roleOptions: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'checker', label: 'Checker' },
  { value: 'teacher_checker', label: 'Teacher + Checker' },
  { value: 'rechecking', label: 'Rechecking' },
];

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-gray-900 text-white',
  super_admin: 'bg-purple-900 text-white',
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
  const { currentUser } = useAuth();

  // ─── LIST STATE ──────────────────────────────────────────────
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ─── MODAL STATE ─────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState('');

  // ─── FORM STATE (only user data — no OTP) ───────────────────
  const [form, setForm] = useState<CreateUserData & { subject?: string }>({
    name: '',
    email: '',
    password: '',
    role: 'checker',
    subject: '',
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── OTP STATE (separate from form) ─────────────────────────
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false); // ✅ track verified
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // ─── TOAST ───────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ─── DELETE STATE ────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── REFS ────────────────────────────────────────────────────
  const originalEmailRef = useRef<string>('');
  const otpInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // ─── OTP RESEND TIMER ────────────────────────────────────────
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setTimeout(() => setOtpResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  // ─── TOAST HELPER ────────────────────────────────────────────
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // ─── FETCH USERS ─────────────────────────────────────────────
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userApi.getAllUsers();
      setUserList(data.items || []);
    } catch (error: any) {
      showToast('Failed to load users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // ─── VALIDATION ──────────────────────────────────────────────
  const validateField = (field: string, value: string): boolean => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [field]: 'This field is required' }));
      return false;
    }
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors((prev) => ({ ...prev, [field]: 'Please enter a valid email address' }));
      return false;
    }
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
    return true;
  };

  // ✅ Password only required for new users
  const isFormValid =
    form.name.trim() !== '' &&
    form.email.trim() !== '' &&
    (editingUser ? true : form.password.trim() !== '') &&
    Object.keys(errors).length === 0;

  // ✅ Check if OTP verification is needed
  const needsEmailVerification = (): boolean => {
    if (!editingUser) return true; // New user — always verify
    // Edit — only if email changed
    return form.email.trim().toLowerCase() !== originalEmailRef.current.toLowerCase();
  };

  const emailChanged = editingUser
    ? form.email.trim().toLowerCase() !== originalEmailRef.current.toLowerCase()
    : false;

  // ─── OPEN/CLOSE MODAL ────────────────────────────────────────
  const resetOtpState = () => {
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError('');
    setOtpResendTimer(0);
  };

  const openAdd = () => {
    setEditingUser(null);
    originalEmailRef.current = '';
    setForm({ name: '', email: '', password: '', role: 'checker', subject: '', isActive: true });
    setErrors({});
    setApiError('');
    resetOtpState();
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    originalEmailRef.current = user.email; // ✅ save original email
    setForm({ name: user.name, email: user.email, password: '', role: user.role as any, subject: user.subject || '', isActive: user.isActive });
    setErrors({});
    setApiError('');
    resetOtpState();
    setShowModal(true);
  };

  const handleModalClose = () => {
    if (isSaving || otpVerifying || otpSending) return;
    setShowModal(false);
    resetOtpState();
  };

  // ─── OTP SEND ────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!form.email.trim() || !validateField('email', form.email)) return;

    setOtpSending(true);
    setOtpError('');
    setOtpVerified(false);
    setOtp('');

    try {
      await userApi.sendOtp(form.email.trim());
      setOtpSent(true);
      setOtpResendTimer(60);
      showToast(`OTP sent to ${form.email}`, 'success');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send OTP';
      setOtpError(msg);
      showToast(msg, 'error');
    } finally {
      setOtpSending(false);
    }
  };

  // ─── OTP VERIFY ──────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 4) {
      setOtpError('Please enter a valid OTP');
      return;
    }
    setOtpVerifying(true);
    setOtpError('');
    try {
      await userApi.verifyOtp(form.email.trim(), otp.trim());
      setOtpVerified(true);
      showToast('Email verified successfully ✓', 'success');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Invalid OTP. Please try again.';
      setOtpError(msg);
    } finally {
      setOtpVerifying(false);
    }
  };

  // ─── SAVE USER ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!isFormValid) return;

    // ✅ If email verification needed but not done
    if (needsEmailVerification() && !otpVerified) {
      showToast('Please verify the email first', 'error');
      return;
    }

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
        if (form.password.trim()) updateData.password = form.password;

        const updated = await userApi.updateUser(editingUser.id, updateData);
        setUserList((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
        showToast('User updated successfully', 'success');
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
      }
      setShowModal(false);
      resetOtpState();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save user';
      setApiError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── DELETE ──────────────────────────────────────────────────
  const canDeleteUser = (user: User): boolean => {
    if (user.role === 'super_admin') return false;
    if (user.role === 'admin') return false;
    if (currentUser?.id === user.id) return false;
    return true;
  };

  const openDeleteModal = (user: User) => {
    if (!canDeleteUser(user)) {
      if (user.role === 'super_admin') showToast('Cannot delete Super Admin user', 'error');
      else if (user.role === 'admin') showToast('Cannot delete Admin user', 'error');
      else showToast('Cannot delete your own account', 'error');
      return;
    }
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await userApi.deleteUser(userToDelete.id);
      setUserList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      showToast('User deleted successfully', 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const showSubject = form.role === 'teacher' || form.role === 'teacher_checker';

  // ─── Save button label logic ─────────────────────────────────
  const getSaveButtonLabel = () => {
    if (isSaving) return <><i className="ri-loader-4-line animate-spin" /> {editingUser ? 'Updating...' : 'Adding...'}</>;
    if (needsEmailVerification() && !otpVerified) return <><i className="ri-shield-check-line" /> Verify Email First</>;
    return editingUser ? 'Save Changes' : 'Add User';
  };

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]} />

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-20 right-6 z-50 text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${toastMsg.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <i className={toastMsg.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'} />
          {toastMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-500 mt-0.5">Manage all system users and their roles</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap">
          <i className="ri-add-line text-base" />
          Add User
        </button>
      </div>

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{apiError}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Name', 'Email', 'Role', 'Subject', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-team-line text-xl text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">No users found</p>
                  </td>
                </tr>
              ) : (
                userList.map((user) => {
                  const isCurrentUser = currentUser?.id === user.id;
                  const showDelete = user.role !== 'super_admin' && !isCurrentUser;

                  return (
                    <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                        {user.name}
                        {isCurrentUser && <span className="ml-2 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">You</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">{user.email}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                          {roleOptions.find((r) => r.value === user.role)?.label || user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{user.subject || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(user)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer" title="Edit User">
                            <i className="ri-edit-line text-sm" />
                          </button>
                          {showDelete && (
                            <button onClick={() => openDeleteModal(user)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Permanently">
                              <i className="ri-delete-bin-line text-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD/EDIT MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleModalClose}>
          <div ref={modalRef} className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h4>
              <button onClick={handleModalClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer" disabled={isSaving}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            <div className="space-y-4">

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) validateField('name', e.target.value); }}
                  onBlur={() => validateField('name', form.name)}
                  placeholder="e.g. Mr. Sharma"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.name ? 'border-rose-400' : 'border-gray-200'}`}
                  disabled={isSaving}
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
              </div>

              {/* Email + Send OTP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                  {/* ✅ Show badge based on state */}
                  {otpVerified && (
                    <span className="ml-2 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-normal">
                      ✓ Verified
                    </span>
                  )}
                  {!otpVerified && emailChanged && (
                    <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-normal">
                      Changed — verify required
                    </span>
                  )}
                  {!otpVerified && !editingUser && (
                    <span className="ml-2 text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded font-normal">
                      OTP required
                    </span>
                  )}
                </label>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      if (errors.email) validateField('email', e.target.value);
                      // ✅ Email badalne par OTP reset
                      if (otpSent || otpVerified) {
                        resetOtpState();
                      }
                    }}
                    onBlur={() => validateField('email', form.email)}
                    placeholder="user@osm.com"
                    className={`flex-1 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.email ? 'border-rose-400' : otpVerified ? 'border-emerald-400' : 'border-gray-200'}`}
                    disabled={isSaving}
                  />
                  {/* ✅ Send OTP button — show only when verification needed and not yet verified */}
                  {needsEmailVerification() && !otpVerified && (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={!form.email.trim() || !!errors.email || otpSending || otpResendTimer > 0}
                      className="px-3 py-2.5 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {otpSending ? (
                        <><i className="ri-loader-4-line animate-spin" /> Sending...</>
                      ) : otpResendTimer > 0 ? (
                        `Resend (${otpResendTimer}s)`
                      ) : otpSent ? (
                        <><i className="ri-refresh-line" /> Resend</>
                      ) : (
                        <><i className="ri-mail-send-line" /> Send OTP</>
                      )}
                    </button>
                  )}
                </div>
                {errors.email && <p className="text-xs text-rose-500 mt-1">{errors.email}</p>}
              </div>

              {/* ✅ OTP input — show only after OTP sent and not yet verified */}
              {otpSent && !otpVerified && needsEmailVerification() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Enter OTP
                    <span className="ml-1 text-[10px] text-gray-400 font-normal">
                      (sent to {form.email})
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtp(val);
                        if (otpError) setOtpError('');
                      }}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className={`flex-1 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 tracking-widest text-center font-semibold ${otpError ? 'border-rose-400' : 'border-gray-200'}`}
                      disabled={otpVerifying || isSaving}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={!otp.trim() || otp.length < 4 || otpVerifying}
                      className="px-4 py-2.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {otpVerifying ? (
                        <><i className="ri-loader-4-line animate-spin" /> Verifying...</>
                      ) : (
                        <><i className="ri-shield-check-line" /> Verify</>
                      )}
                    </button>
                  </div>
                  {otpError && <p className="text-xs text-rose-500 mt-1">{otpError}</p>}
                </div>
              )}

              {/* ✅ Verified success banner */}
              {otpVerified && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-sm" />
                  <p className="text-xs font-medium text-emerald-700">Email verified — you can now save the user</p>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                  {editingUser && <span className="ml-1 text-[10px] text-gray-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => { setForm({ ...form, password: e.target.value }); if (errors.password) validateField('password', e.target.value); }}
                  onBlur={() => { if (!editingUser) validateField('password', form.password); }}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.password ? 'border-rose-400' : 'border-gray-200'}`}
                  disabled={isSaving}
                />
                {errors.password && <p className="text-xs text-rose-500 mt-1">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as any, subject: '' })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  disabled={isSaving}
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              {showSubject && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={form.subject || ''}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g. Mathematics"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                    disabled={isSaving}
                  />
                </div>
              )}

              {/* Active toggle for edit */}
              {editingUser && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isActive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="text-sm text-gray-600">
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
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
                disabled={
                  !isFormValid ||
                  isSaving ||
                  (needsEmailVerification() && !otpVerified)
                }
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                {getSaveButtonLabel()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE MODAL ─── */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!isDeleting) { setShowDeleteModal(false); setUserToDelete(null); } }}>
          <div ref={deleteModalRef} className="bg-white rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-delete-bin-line text-red-600 text-2xl" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Delete User Permanently</h4>
              <p className="text-sm text-gray-600 mb-1">
                Are you sure you want to <span className="text-red-600 font-semibold">permanently delete</span> this user?
              </p>
              <div className="bg-gray-50 rounded-lg p-3 my-4 text-left">
                <p className="text-sm text-gray-700"><span className="font-medium">Name:</span> {userToDelete.name}</p>
                <p className="text-sm text-gray-700"><span className="font-medium">Email:</span> {userToDelete.email}</p>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Role:</span>{' '}
                  {roleOptions.find((r) => r.value === userToDelete.role)?.label || userToDelete.role}
                </p>
              </div>
              <p className="text-xs text-rose-600 font-semibold">⚠️ This action cannot be undone!</p>
            </div>
            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" disabled={isDeleting}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                {isDeleting ? <><i className="ri-loader-4-line animate-spin" /> Deleting...</> : <><i className="ri-delete-bin-line" /> Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}