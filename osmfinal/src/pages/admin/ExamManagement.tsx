import { useEffect, useState } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import { useNavigate } from 'react-router-dom';
import { examApi, type ExamResponse } from '../../api/exam';
import subjectService, { ISubject } from '../../api/subject';

export default function ExamManagement() {
  const loading = usePageLoading();
  const navigate = useNavigate();
  const [examList, setExamList] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  // ─── SUBJECTS STATE ──────────────────────────────────────────
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamResponse | null>(null);
  const [form, setForm] = useState({
    name: '',
    subject: '',
    date: '',
    totalQuestions: '',
    maxMarks: '',
    spentTime: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [detailExamId, setDetailExamId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'students'>('details');
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('osm_user') || 'null'),
  );

  // ─── SELECTION & DELETE STATE ────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: number; name: string } | { type: 'bulk' } | null > (null);
  const [deleting, setDeleting] = useState(false);

  const detailExam = detailExamId
    ? examList.find((e) => e.id === detailExamId) || null
    : null;
  const examStudents = detailExamId
    ? [] // Will be replaced with real data later
    : [];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // ─── FETCH SUBJECTS ──────────────────────────────────────────
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setSubjectsLoading(true);
        const response = await subjectService.getActiveSubjects();
        if (response.success) {
          setSubjects((response.data as ISubject[]) || []);
        }
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  // ─── FETCH EXAMS ─────────────────────────────────────────────
  const fetchExams = async () => {
    try {
      setExamsLoading(true);
      const res = await examApi.getAllExams({ limit: 1000 });
      setExamList(res.data);
    } catch (error) {
      console.error('Failed to fetch exams:', error);
      showToast('Failed to load exams');
    } finally {
      setExamsLoading(false);
    }
  };

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('osm_user')));
    fetchExams();
  }, []);

  const validateField = (field: string, value: string) => {
    if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [field]: 'This field is required' }));
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
    form.subject.trim() &&
    form.date.trim() &&
    form.totalQuestions.trim() &&
    form.maxMarks.trim() &&
    form.spentTime.trim();

  const openAdd = () => {
    setEditingExam(null);
    setForm({
      name: '',
      subject: '',
      date: '',
      totalQuestions: '',
      maxMarks: '',
      spentTime: '',
    });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (exam: ExamResponse) => {
    setEditingExam(exam);
    setForm({
      name: exam.name,
      subject: exam.subject,
      date: exam.date,
      totalQuestions: String(exam.totalQuestions),
      maxMarks: String(exam.maxMarks),
      spentTime: String(exam.spentTime || 0),
    });
    setErrors({});
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!isFormValid) return;

    if (!user?.id) {
      showToast('Session expired. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      if (editingExam) {
        const updated = await examApi.updateExam(editingExam.id, {
          name: form.name,
          subject: form.subject,
          date: form.date,
          totalQuestions: Number(form.totalQuestions),
          maxMarks: Number(form.maxMarks),
          spentTime: Number(form.spentTime) || 0,
        });
        setExamList((prev) =>
          prev.map((e) => (e.id === editingExam.id ? updated : e)),
        );
        showToast('Exam updated successfully');
      } else {
        const created = await examApi.createExam({
          name: form.name,
          subject: form.subject,
          date: form.date,
          totalQuestions: Number(form.totalQuestions),
          maxMarks: Number(form.maxMarks),
          spentTime: Number(form.spentTime) || 0,
          status: 'active',
          createdBy: user?.id,
        });
        setExamList((prev) => [...prev, created]);
        showToast('Exam created successfully');
      }
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save exam:', error);
      showToast(
        editingExam ? 'Failed to update exam' : 'Failed to create exam',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (exam: ExamResponse) => {
    const newStatus = exam.status === 'archived' ? 'active' : 'archived';
    try {
      const updated = await examApi.updateExam(exam.id, { status: newStatus });
      setExamList((prev) => prev.map((e) => (e.id === exam.id ? updated : e)));
    } catch (error) {
      console.error('Failed to update exam status:', error);
      showToast('Failed to update exam status');
    }
  };

  const openDetail = (id: number) => {
    setDetailExamId(id);
    setDetailTab('details');
  };

  const closeDetail = () => {
    setDetailExamId(null);
  };

  // ─── SELECTION HANDLERS ──────────────────────────────────────
  const isAllSelected =
    examList.length > 0 && selectedIds.length === examList.length;
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(examList.map((e) => e.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearSelection = () => setSelectedIds([]);

  // ─── DELETE HANDLERS ─────────────────────────────────────────
  const requestDeleteSingle = (exam: ExamResponse) => {
    setDeleteTarget({ type: 'single', id: exam.id, name: exam.name });
  };

  const requestDeleteBulk = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({ type: 'bulk' });
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'single') {
        await examApi.deleteExam(deleteTarget.id);
        setExamList((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
        showToast('Exam deleted successfully');
      } else {
        // Bulk delete — run in parallel
        await Promise.all(selectedIds.map((id) => examApi.deleteExam(id)));
        setExamList((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
        showToast(`${selectedIds.length} exam(s) deleted successfully`);
        setSelectedIds([]);
      }
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete exam(s):', error);
      showToast('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Exams' }]}
      />

      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg">
          <span className="w-4 h-4 flex items-center justify-center inline-block mr-2">
            <i className="ri-check-line"></i>
          </span>
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Exam Management
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Create, edit, and manage all examinations
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-add-line text-base"></i>
          </span>
          Add New Exam
        </button>
      </div>

      {/* ─── BULK ACTION BAR ────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-gray-900 text-white px-4 py-3 rounded-xl">
          <p className="text-sm font-medium">
            {selectedIds.length} exam{selectedIds.length > 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              Clear
            </button>
            <button
              onClick={requestDeleteBulk}
              className="flex items-center gap-1.5 text-xs font-medium bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-delete-bin-line text-sm"></i>
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={toggleSelectAll}
                    disabled={examList.length === 0}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Exam Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Subject
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Questions
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Max Marks
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Spent Time
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
              {examsLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-sm text-gray-400"
                  >
                    Loading exams...
                  </td>
                </tr>
              ) : examList.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-sm text-gray-400"
                  >
                    No exams found
                  </td>
                </tr>
              ) : (
                examList.map((exam) => (
                  <tr
                    key={exam.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${selectedIds.includes(exam.id) ? 'bg-gray-50/60' : ''
                      }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(exam.id)}
                        onChange={() => toggleSelectOne(exam.id)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => openDetail(exam.id)}
                        className="font-medium text-gray-900 hover:text-gray-600 transition-colors cursor-pointer text-left"
                      >
                        {exam.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {exam.subject}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {exam.date}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                      {exam.totalQuestions}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                      {exam.maxMarks}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                      {exam.spentTime || 0} min
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(exam)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button
                          onClick={() => toggleArchive(exam)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${exam.status === 'archived'
                            ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                            : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                          title={
                            exam.status === 'archived' ? 'Restore' : 'Archive'
                          }
                        >
                          <i
                            className={`${exam.status === 'archived' ? 'ri-arrow-go-back-line' : 'ri-archive-line'} text-sm`}
                          ></i>
                        </button>
                        <button
                          onClick={() => requestDeleteSingle(exam)}
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
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                {editingExam ? 'Edit Exam' : 'Add New Exam'}
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
                  Exam Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (errors.name) validateField('name', e.target.value);
                  }}
                  onBlur={() => validateField('name', form.name)}
                  placeholder="e.g. Mathematics Mid-Term"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.name ? 'border-rose-400' : 'border-gray-200'}`}
                />
                {errors.name && (
                  <p className="text-xs text-rose-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject
                </label>
                <select
                  value={form.subject}
                  onChange={(e) => {
                    setForm({ ...form, subject: e.target.value });
                    if (errors.subject)
                      validateField('subject', e.target.value);
                  }}
                  onBlur={() => validateField('subject', form.subject)}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer ${errors.subject ? 'border-rose-400' : 'border-gray-200'}`}
                  disabled={subjectsLoading}
                >
                  <option value="">Select subject</option>
                  {subjectsLoading ? (
                    <option value="" disabled>
                      Loading subjects...
                    </option>
                  ) : subjects.length === 0 ? (
                    <option value="" disabled>
                      No subjects available
                    </option>
                  ) : (
                    subjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {errors.subject && (
                  <p className="text-xs text-rose-500 mt-1">{errors.subject}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => {
                    setForm({ ...form, date: e.target.value });
                    if (errors.date) validateField('date', e.target.value);
                  }}
                  onBlur={() => validateField('date', form.date)}
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer ${errors.date ? 'border-rose-400' : 'border-gray-200'}`}
                />
                {errors.date && (
                  <p className="text-xs text-rose-500 mt-1">{errors.date}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Total Questions
                  </label>
                  <input
                    type="number"
                    value={form.totalQuestions}
                    onChange={(e) => {
                      setForm({ ...form, totalQuestions: e.target.value });
                      if (errors.totalQuestions)
                        validateField('totalQuestions', e.target.value);
                    }}
                    onBlur={() =>
                      validateField('totalQuestions', form.totalQuestions)
                    }
                    placeholder="10"
                    min="1"
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.totalQuestions ? 'border-rose-400' : 'border-gray-200'}`}
                  />
                  {errors.totalQuestions && (
                    <p className="text-xs text-rose-500 mt-1">
                      {errors.totalQuestions}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Max Marks
                  </label>
                  <input
                    type="number"
                    value={form.maxMarks}
                    onChange={(e) => {
                      setForm({ ...form, maxMarks: e.target.value });
                      if (errors.maxMarks)
                        validateField('maxMarks', e.target.value);
                    }}
                    onBlur={() => validateField('maxMarks', form.maxMarks)}
                    placeholder="100"
                    min="1"
                    className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.maxMarks ? 'border-rose-400' : 'border-gray-200'}`}
                  />
                  {errors.maxMarks && (
                    <p className="text-xs text-rose-500 mt-1">
                      {errors.maxMarks}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Spent Time (minutes)
                  <span className="text-xs text-gray-400 ml-1">
                    (minimum time to spend)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.spentTime}
                  onChange={(e) => {
                    setForm({ ...form, spentTime: e.target.value });
                    if (errors.spentTime)
                      validateField('spentTime', e.target.value);
                  }}
                  onBlur={() => validateField('spentTime', form.spentTime)}
                  placeholder="e.g. 60"
                  min="1"
                  className={`w-full px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 ${errors.spentTime ? 'border-rose-400' : 'border-gray-200'}`}
                />
                {errors.spentTime && (
                  <p className="text-xs text-rose-500 mt-1">
                    {errors.spentTime}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  <i className="ri-information-line mr-1"></i>
                  Checker/Rechecker must spend at least this many minutes while
                  checking this exam
                </p>
              </div>
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
                disabled={!isFormValid || saving}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {saving
                  ? 'Saving...'
                  : editingExam
                    ? 'Save Changes'
                    : 'Create Exam'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRMATION MODAL ──────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
              <i className="ri-delete-bin-line text-xl text-rose-500"></i>
            </div>
            <h4 className="text-base font-semibold text-gray-900 mb-2">
              {deleteTarget.type === 'single' ? 'Delete Exam?' : 'Delete Selected Exams?'}
            </h4>
            <p className="text-sm text-gray-500 mb-6">
              {deleteTarget.type === 'single' ? (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-gray-700">
                    "{deleteTarget.name}"
                  </span>
                  ? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-gray-700">
                    {selectedIds.length} exam{selectedIds.length > 1 ? 's' : ''}
                  </span>
                  ? This action cannot be undone.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h4 className="text-base font-semibold text-gray-900">
                  {detailExam.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {detailExam.subject} — {detailExam.date}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="flex border-b border-gray-100 px-6">
              <button
                onClick={() => setDetailTab('details')}
                className={`py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap mr-6 ${detailTab === 'details'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Details
              </button>
              <button
                onClick={() => setDetailTab('students')}
                className={`py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${detailTab === 'students'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                Students
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {detailTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Subject</p>
                      <p className="text-sm font-medium text-gray-900">
                        {detailExam.subject}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {detailExam.date}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">
                        Total Questions
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {detailExam.totalQuestions}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Max Marks</p>
                      <p className="text-sm font-medium text-gray-900">
                        {detailExam.maxMarks}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Spent Time</p>
                      <p className="text-sm font-medium text-gray-900">
                        {detailExam.spentTime || 0} minutes
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <StatusBadge status={detailExam.status} />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Students Registered
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {examStudents.length}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'students' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">
                        {examStudents.length}
                      </span>{' '}
                      students registered for this exam
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          closeDetail();
                          navigate('/admin/student-data');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center">
                          <i className="ri-database-2-line text-xs"></i>
                        </span>
                        Manage Student Data
                      </button>
                      <button
                        onClick={() => {
                          closeDetail();
                          navigate('/admin/upload');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 px-3 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center">
                          <i className="ri-upload-cloud-2-line text-xs"></i>
                        </span>
                        Upload Sheets
                      </button>
                    </div>
                  </div>

                  {examStudents.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <i className="ri-user-search-line text-xl text-gray-400"></i>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        No students registered
                      </p>
                      <p className="text-xs text-gray-400">
                        Upload master student data from the Student Data page.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Roll No
                              </th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Name
                              </th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Course
                              </th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Branch
                              </th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Barcode
                              </th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                Sheet Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {examStudents.map((student) => {
                              const matchedSheet = null; // Will be replaced with real data
                              return (
                                <tr
                                  key={student.id}
                                  className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                                >
                                  <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                                    {student.rollNo}
                                  </td>
                                  <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                                    {student.name}
                                  </td>
                                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                                    {student.course}
                                  </td>
                                  <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                                    {student.branch}
                                  </td>
                                  <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">
                                    {student.barcode}
                                  </td>
                                  <td className="py-3 px-4">
                                    {matchedSheet ? (
                                      <StatusBadge
                                        status={matchedSheet.status}
                                      />
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                        Not uploaded
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}