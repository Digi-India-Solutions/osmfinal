import { useState, useRef, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import settingsService, { ISettings } from '@/api/setting';
import subjectService, { ISubject } from '@/api/subject';
import api from '@/api/axios';

type SettingsTab = 'general' | 'subjects' | 'profile';

const departmentOptions = [
  'Science',
  'Engineering',
  'Arts',
  'Commerce',
  'Other',
];

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
      />

      {toastMsg && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
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
          {toastMsg}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage system configuration, subjects, and your profile
        </p>
      </div>

      <div className="flex gap-6">
        <nav className="w-52 shrink-0">
          <div className="bg-white rounded-2xl overflow-hidden">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'general'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-settings-3-line text-base"></i>
              </span>
              General
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'subjects'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center">
                <i className="ri-book-open-line text-base"></i>
              </span>
              Subject Master
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
          {activeTab === 'general' && <GeneralTab showToast={showToast} />}
          {activeTab === 'subjects' && (
            <SubjectMasterTab showToast={showToast} />
          )}
          {activeTab === 'profile' && (
            <ProfileTab currentUser={currentUser} showToast={showToast} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GENERAL TAB (FULLY INTEGRATED) ──────────────────────────────────────

function GeneralTab({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [settings, setSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await settingsService.getSettings();
      if (response.success && response.exists && response.data) {
        setSettings(response.data);
        setExists(true);
        if (response.data.logo) {
          setLogoPreview(response.data.logo);
        }
      } else {
        setSettings({
          id: 0,
          company_name: '',
          address: '',
          phone: '',
          email: '',
          website: '',
          logo: null,
          logo_public_id: null,
          version: '1.0.0',
          build: 'OSM Frontend',
        });
        setExists(false);
        setLogoPreview(null);
      }
    } catch (error) {
      console.error('Fetch settings error:', error);
      showToast('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = (field: keyof ISettings, value: string) => {
    setSettings((prev) => {
      if (!prev) {
        return {
          id: 0,
          company_name: '',
          address: '',
          phone: '',
          email: '',
          website: '',
          logo: null,
          logo_public_id: null,
          version: '1.0.0',
          build: 'OSM Frontend',
          [field]: value,
        } as ISettings;
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!settings) {
      showToast('Please fill in the settings first', 'error');
      return;
    }

    if (!settings.company_name?.trim()) {
      showToast('Company name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('company_name', settings.company_name || '');
      formData.append('address', settings.address || '');
      formData.append('phone', settings.phone || '');
      formData.append('email', settings.email || '');
      formData.append('website', settings.website || '');
      formData.append('version', settings.version || '1.0.0');
      formData.append('build', settings.build || 'OSM Frontend');

      if (logoFile) {
        formData.append('logo', logoFile);
      }

      let response;
      if (exists) {
        response = await settingsService.updateSettings(formData);
      } else {
        response = await settingsService.createSettings(formData);
      }

      if (response.success) {
        showToast(
          exists
            ? 'Settings updated successfully'
            : 'Settings created successfully',
        );
        await fetchSettings();
        setLogoFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        showToast(response.message || 'Failed to save settings', 'error');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(error.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('File too large. Max size is 2MB', 'error');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (!allowedTypes.includes(file.type)) {
      showToast(
        'Only image files are allowed (JPEG, PNG, GIF, WEBP, SVG)',
        'error',
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await settingsService.patchSettings({
        ...settings,
        logo: null,
      });

      if (response.success) {
        setLogoPreview(null);
        setLogoFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setSettings((prev) => (prev ? { ...prev, logo: null } : null));
        showToast('Logo removed successfully');
        await fetchSettings();
      } else {
        showToast(response.message || 'Failed to remove logo', 'error');
      }
    } catch (error) {
      console.error('Remove logo error:', error);
      showToast('Failed to remove logo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePatchSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const patchData = {
        company_name: settings.company_name,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        version: settings.version,
        build: settings.build,
      };

      const response = await settingsService.patchSettings(patchData);

      if (response.success) {
        showToast('Settings updated successfully');
        await fetchSettings();
      } else {
        showToast(response.message || 'Failed to update settings', 'error');
      }
    } catch (error: any) {
      console.error('Patch save error:', error);
      showToast(error.message || 'Failed to update settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Company Branding
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Company Name *
            </label>
            <input
              key="company_name"
              type="text"
              value={settings?.company_name || ''}
              onChange={(e) =>
                handleInputChange('company_name', e.target.value)
              }
              placeholder="Enter company name"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Address
            </label>
            <input
              key="address"
              type="text"
              value={settings?.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Enter address"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              key="phone"
              type="text"
              value={settings?.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              key="email"
              type="email"
              value={settings?.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter email"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Website
            </label>
            <input
              key="website"
              type="text"
              value={settings?.website || ''}
              onChange={(e) => handleInputChange('website', e.target.value)}
              placeholder="Enter website URL"
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Saving...
              </>
            ) : exists ? (
              'Update Settings'
            ) : (
              'Create Settings'
            )}
          </button>

          {exists && (
            <button
              onClick={handlePatchSave}
              disabled={saving}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          )}
        </div>
        {!exists && (
          <p className="text-xs text-amber-600 mt-2">
            <i className="ri-information-line mr-1"></i>
            No settings found. Click "Create Settings" to add company details.
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Logo</h4>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 shrink-0 overflow-hidden">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm">
                {settings?.company_name?.charAt(0) || 'D'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                <i className="ri-upload-cloud-line text-sm"></i>
              </span>
              Upload Logo
            </button>

            {logoPreview && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving || !logoFile}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Logo'}
                </button>
                <button
                  onClick={handleRemoveLogo}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove Logo
                </button>
              </>
            )}
          </div>
        </div>
        {logoFile && (
          <p className="text-xs text-gray-500 mt-2">
            <i className="ri-file-info-line mr-1"></i>
            New logo selected: {logoFile.name} (
            {(logoFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          System Info
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Version</p>
            <p className="text-sm font-medium text-gray-900">
              {settings?.version || '1.0.0'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Build</p>
            <p className="text-sm font-medium text-gray-900">
              {settings?.build || 'OSM Frontend'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Last Updated</p>
            <p className="text-sm font-medium text-gray-900">
              {settings?.last_updated
                ? new Date(settings.last_updated).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Not updated yet'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT MASTER TAB (FULLY INTEGRATED WITH API) ─────────────────────

function SubjectMasterTab({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ISubject | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    department: 'Science',
  });
  const [formError, setFormError] = useState('');

  // ─── FETCH SUBJECTS ─────────────────────────────────────────────────────

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const response = await subjectService.getSubjects({
        search: searchQuery || undefined,
      });
      if (response.success && response.data) {
        setSubjects(response.data as ISubject[]);
      } else {
        setSubjects([]);
        if (response.message) {
          showToast(response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Fetch subjects error:', error);
      showToast('Failed to fetch subjects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [searchQuery]);

  // ─── FILTERED SUBJECTS ─────────────────────────────────────────────────

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q),
    );
  }, [subjects, searchQuery]);

  // ─── OPEN ADD/EDIT MODAL ──────────────────────────────────────────────

  const openAdd = () => {
    setEditingSubject(null);
    setForm({ name: '', code: '', department: 'Science' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (subject: ISubject) => {
    setEditingSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      department: subject.department,
    });
    setFormError('');
    setShowModal(true);
  };

  // ─── HANDLE SAVE SUBJECT ──────────────────────────────────────────────

  const handleSaveSubject = async () => {
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim().toUpperCase();

    if (!trimmedName) {
      setFormError('Subject name is required');
      return;
    }
    if (!trimmedCode) {
      setFormError('Subject code is required');
      return;
    }
    if (trimmedCode.length > 10) {
      setFormError('Code must be 10 characters max');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        code: trimmedCode,
        department: form.department,
      };

      let response;
      if (editingSubject) {
        response = await subjectService.updateSubject(editingSubject.id, data);
        if (response.success) {
          showToast('Subject updated successfully');
          await fetchSubjects();
          setShowModal(false);
        } else {
          showToast(response.message || 'Failed to update subject', 'error');
        }
      } else {
        response = await subjectService.createSubject(data);
        if (response.success) {
          showToast('Subject added successfully');
          await fetchSubjects();
          setShowModal(false);
        } else {
          showToast(response.message || 'Failed to add subject', 'error');
        }
      }
    } catch (error: any) {
      console.error('Save subject error:', error);
      showToast(error.message || 'Failed to save subject', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── TOGGLE STATUS ─────────────────────────────────────────────────────

  const toggleStatus = async (id: number) => {
    try {
      const response = await subjectService.toggleStatus(id);
      if (response.success) {
        showToast(response.message || 'Status toggled successfully');
        await fetchSubjects();
      } else {
        showToast(response.message || 'Failed to toggle status', 'error');
      }
    } catch (error: any) {
      console.error('Toggle status error:', error);
      showToast(error.message || 'Failed to toggle status', 'error');
    }
  };

  // ─── DELETE SUBJECT ────────────────────────────────────────────────────

  const deleteSubject = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this subject?'))
      return;

    try {
      const response = await subjectService.deleteSubject(id);
      if (response.success) {
        showToast('Subject deleted successfully');
        await fetchSubjects();
      } else {
        showToast(response.message || 'Failed to delete subject', 'error');
      }
    } catch (error: any) {
      console.error('Delete subject error:', error);
      showToast(error.message || 'Failed to delete subject', 'error');
    }
  };

  // ─── LOADING STATE ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
          <span className="text-sm text-gray-500">Loading subjects...</span>
        </div>
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">
            Subject Master
          </h4>
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
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  ID
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Subject Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Code
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Department
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
              {filteredSubjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-file-search-line text-xl text-gray-400"></i>
                    </div>
                    <p className="text-sm text-gray-500">
                      {searchQuery
                        ? 'No subjects found matching your search'
                        : 'No subjects found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {s.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {s.name}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">
                      {s.code}
                    </td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {s.department}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          s.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.status === 'active' ? 'Active' : 'Inactive'}
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
                            s.status === 'active'
                              ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={
                            s.status === 'active' ? 'Deactivate' : 'Activate'
                          }
                        >
                          <i
                            className={`${
                              s.status === 'active'
                                ? 'ri-toggle-line'
                                : 'ri-toggle-fill'
                            } text-sm`}
                          ></i>
                        </button>
                        <button
                          onClick={() => deleteSubject(s.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {filteredSubjects.length} of {subjects.length} subjects
          </p>
        </div>
      </div>

      {/* ─── ADD/EDIT MODAL ────────────────────────────────────────────── */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    setFormError('');
                  }}
                  placeholder="e.g. Biology"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject Code *
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      code: e.target.value.toUpperCase().slice(0, 10),
                    });
                    setFormError('');
                  }}
                  placeholder="e.g. BIO"
                  maxLength={10}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 uppercase"
                  disabled={saving}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Max 10 characters, uppercase only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Department *
                </label>
                <select
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  disabled={saving}
                >
                  {departmentOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="text-xs text-rose-500">{formError}</p>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubject}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                    Saving...
                  </>
                ) : editingSubject ? (
                  'Save Changes'
                ) : (
                  'Add Subject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PROFILE TAB ─────────────────────────────────────────────────────────
// ─── PROFILE TAB (COMPLETE WITH API) ─────────────────────────────────────

// ─── PROFILE TAB (FIXED ERROR HANDLING) ──────────────────────────────────

function ProfileTab({
  currentUser,
  showToast,
}: {
  currentUser: { id: number; name: string; email: string; role: string } | null;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [name, setName] = useState(currentUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ─── UPDATE PROFILE NAME ──────────────────────────────────────────────

  const handleUpdateName = async () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/api/v1/auth/users/profile', {
        name: name.trim(),
      });

      if (response.data.success) {
        showToast('Profile updated successfully');
      } else {
        showToast(response.data.message || 'Failed to update profile', 'error');
      }
    } catch (error: any) {
      console.error('Update name error:', error);
      
      // Don't show error for 401 (will be handled by interceptor)
      if (error.response?.status !== 401) {
        showToast(
          error.response?.data?.message ||
            error.message ||
            'Failed to update profile',
          'error'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── CHANGE PASSWORD (FIXED) ─────────────────────────────────────────

  const handleChangePassword = async () => {
    // Validation
    if (!passwordForm.current) {
      setPasswordError('Current password is required');
      return;
    }
    if (!passwordForm.newPass) {
      setPasswordError('New password is required');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordForm.newPass.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordError('');
    setSaving(true);

    try {
      const response = await api.post('/api/v1/auth/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.newPass,
      });

      if (response.data.success) {
        showToast('Password changed successfully');
        setPasswordForm({ current: '', newPass: '', confirm: '' });
      } else {
        showToast(
          response.data.message || 'Failed to change password',
          'error'
        );
      }
    } catch (error: any) {
      console.error('Change password error:', error);

      // ✅ Proper error handling without infinite loop
      if (error.response?.status === 401) {
        setPasswordError('Current password is incorrect');
        showToast('Current password is incorrect', 'error');
        // Clear current password field
        setPasswordForm((prev) => ({ ...prev, current: '' }));
      } else if (error.response?.status === 400) {
        const message = error.response?.data?.message || 'Invalid request';
        setPasswordError(message);
        showToast(message, 'error');
      } else if (error.response?.status === 500) {
        showToast('Server error. Please try again later.', 'error');
      } else {
        showToast(
          error.response?.data?.message ||
            error.message ||
            'Failed to change password',
          'error'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Profile Info */}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={saving}
              />
              <button
                onClick={handleUpdateName}
                disabled={saving}
                className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
                    Saving...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={currentUser?.email || ''}
              readOnly
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              Email cannot be changed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Role
            </label>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-900 text-white whitespace-nowrap">
              {currentUser?.role || 'Admin'}
            </span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Change Password
        </h4>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, current: e.target.value });
                setPasswordError('');
              }}
              className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                passwordError && !passwordForm.current
                  ? 'border-rose-500'
                  : 'border-gray-200'
              }`}
              disabled={saving}
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={passwordForm.newPass}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, newPass: e.target.value });
                setPasswordError('');
              }}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              disabled={saving}
              placeholder="Enter new password"
            />
            <p className="text-xs text-gray-400 mt-1">
              Must be at least 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => {
                setPasswordForm({ ...passwordForm, confirm: e.target.value });
                setPasswordError('');
              }}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              disabled={saving}
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <i className="ri-error-warning-line text-xs"></i>
              {passwordError}
            </p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}