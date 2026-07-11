// src/pages/admin/StudentDataUpload.tsx

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePageLoading } from '@/hooks/usePageLoading';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import studentService, { IStudentRecord } from '@/api/student';

// ─────────────────────────────────────────────────────────────
// Toast Component
// ─────────────────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5 ${
        type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        <i
          className={
            type === 'error'
              ? 'ri-error-warning-line text-lg'
              : 'ri-check-line text-lg'
          }
        ></i>
      </span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
      >
        <i className="ri-close-line text-sm"></i>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete Confirmation Modal
// ─────────────────────────────────────────────────────────────
interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  title?: string;
  message?: string;
  previewData: {
    totalStudents: number;
    totalSheets: number;
    students: Array<{
      id: number;
      student_name: string;
      roll_no: string;
      sheet_count: number;
    }>;
  } | null;
}

function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  title = 'Confirm Deletion',
  message = 'You are about to delete student(s) and their associated sheet(s). This cannot be undone.',
  previewData,
}: DeleteModalProps) {
  if (!isOpen || !previewData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <i className="ri-delete-bin-2-line text-red-500"></i>
            {title}
          </h4>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-4">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-600 text-sm"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-red-800">
                  ⚠️ This action is permanent!
                </p>
                <p className="text-xs text-red-600 mt-1">{message}</p>
                <p className="text-xs text-red-600 mt-2">
                  You are about to delete{' '}
                  <strong>{previewData.totalStudents}</strong> student(s) and{' '}
                  <strong>{previewData.totalSheets}</strong> associated
                  sheet(s).
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
            {previewData.students.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between py-2.5 px-3 border-b border-gray-50 last:border-0"
              >
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    {student.student_name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    (Roll: {student.roll_no})
                  </span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {student.sheet_count || 0} sheet(s)
                </span>
              </div>
            ))}
          </div>

          {previewData.students.length > 10 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Showing first 10 of {previewData.students.length} students
            </p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
// CustomSelect — portal-based dropdown
// ─────────────────────────────────────────────────────────────
interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
}

function CustomSelect({
  value,
  onChange,
  options,
  className = '',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      zIndex: 9999,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setStyle((prev) => ({ ...prev, top: rect.bottom + 4, left: rect.left }));
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer select-none ${className}`}
      >
        <span className="whitespace-nowrap">{selectedLabel}</span>
        <i
          className={`ri-arrow-down-s-line text-gray-400 text-sm transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={style}
            className="bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors whitespace-nowrap cursor-pointer ${
                  opt.value === value
                    ? 'bg-gray-900 text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function StudentDataUpload() {
  const loading = usePageLoading();
  const [isLoading, setIsLoading] = useState(false);

  // ─── STATE ──────────────────────────────────────────────────

  const [showFormatModal, setShowFormatModal] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState('');
  const [previewData, setPreviewData] = useState<IStudentRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [imported, setImported] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // ─── TOAST STATE ──────────────────────────────────────────
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    id: number;
  } | null>(null);

  // ─── DELETE RELATED STATE ──────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePreview, setDeletePreview] = useState<{
    totalStudents: number;
    totalSheets: number;
    students: Array<{
      id: number;
      student_name: string;
      roll_no: string;
      sheet_count: number;
    }>;
  } | null>(null);

  // ✅ SINGLE DELETE STATE
  const [singleDeleteData, setSingleDeleteData] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false);
  const [singleDeletePreview, setSingleDeletePreview] = useState<{
    totalStudents: number;
    totalSheets: number;
    students: Array<{
      id: number;
      student_name: string;
      roll_no: string;
      sheet_count: number;
    }>;
  } | null>(null);

  // ─── FILTERS ──────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');

  // ─── STUDENTS DATA ────────────────────────────────────────────

  const [allStudents, setAllStudents] = useState<IStudentRecord[]>([]);
  const [students, setStudents] = useState<IStudentRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    uploaded: 0,
    pending: 0,
    checking: 0,
    checked: 0,
    recheck: 0,
    linkedToExam: 0,
    subjectWise: [] as Array<{ subject: string; count: number }>,
  });

  // ─── TOAST ────────────────────────────────────────────────────

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type, id: Date.now() });
  };

  const hideToast = () => setToast(null);

  // ─── FETCH STUDENTS ──────────────────────────────────────────

  const fetchAllStudents = useCallback(async () => {
    try {
      const response = await studentService.getStudents({});
      if (response.success && response.data) {
        setAllStudents(response.data.items || []);
      }
    } catch (error) {
      console.error('Fetch all students error:', error);
    }
  }, []);

  useEffect(() => {
    fetchAllStudents();
  }, [fetchAllStudents]);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await studentService.getStudents({
        search: searchQuery || undefined,
        subject: subjectFilter !== 'All' ? subjectFilter : undefined,
        semester: semesterFilter !== 'All' ? semesterFilter : undefined,
        branch: branchFilter !== 'All' ? branchFilter : undefined,
      });

      if (response.success && response.data) {
        setStudents(response.data.items || []);
        setStats({
          total: response.data.stats?.total || 0,
          uploaded: response.data.stats?.uploaded || 0,
          pending: response.data.stats?.pending || 0,
          checking: response.data.stats?.checking || 0,
          checked: response.data.stats?.checked || 0,
          recheck: response.data.stats?.recheck || 0,
          linkedToExam: response.data.stats?.linkedToExam || 0,
          subjectWise: response.data.subjectWise || [],
        });
        setImported(response.data.items?.length > 0);
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('Fetch students error:', error);
      showToast('Failed to load students', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, subjectFilter, semesterFilter, branchFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ─── AUTO-LINK STUDENTS ─────────────────────────────────────

  const handleAutoLink = async () => {
    if (students.length === 0) {
      showToast('No students to link. Please import students first.', 'error');
      return;
    }

    setIsLinking(true);
    try {
      const response = await studentService.autoLinkStudents();
      if (response.success) {
        showToast(
          response.message || 'Students linked successfully',
          'success',
        );
        await fetchStudents();
        await fetchAllStudents();
      } else {
        showToast(response.message || 'Failed to link students', 'error');
      }
    } catch (error: any) {
      console.error('Auto-link error:', error);
      showToast(error.message || 'Failed to link students', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  // ─── DELETE FUNCTIONS ──────────────────────────────────────

  const handleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map((s) => s.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  // ─── BULK DELETE ───────────────────────────────────────────

  const getDeletionPreview = async () => {
    if (selectedIds.length === 0) {
      showToast('Please select at least one student to delete', 'error');
      return;
    }

    try {
      const response = await studentService.getDeletionPreview(
        selectedIds.join(','),
      );
      if (response.success) {
        setDeletePreview(response.data);
        setShowDeleteModal(true);
      } else {
        showToast(response.message || 'Failed to get preview', 'error');
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      showToast(error.message || 'Failed to get deletion preview', 'error');
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    setIsDeleting(true);
    try {
      const response = await studentService.bulkDeleteStudents(selectedIds);
      if (response.success) {
        showToast(
          response.message ||
            `${selectedIds.length} students deleted successfully`,
          'success',
        );
        setSelectedIds([]);
        setShowDeleteModal(false);
        setDeletePreview(null);
        await fetchStudents();
        await fetchAllStudents();
      } else {
        showToast(response.message || 'Failed to delete students', 'error');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      showToast(error.message || 'Failed to delete students', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── SINGLE DELETE ──────────────────────────────────────────

  const handleSingleDeleteClick = (id: number, studentName: string) => {
    setSingleDeleteData({ id, name: studentName });
    getSingleDeletePreview(id, studentName);
  };

  const getSingleDeletePreview = async (id: number, name: string) => {
    try {
      const response = await studentService.getDeletionPreview(String(id));
      if (response.success) {
        setSingleDeletePreview(response.data);
        setShowSingleDeleteModal(true);
      } else {
        showToast(response.message || 'Failed to get preview', 'error');
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      showToast(error.message || 'Failed to get deletion preview', 'error');
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!singleDeleteData) return;

    setIsDeleting(true);
    try {
      const response = await studentService.deleteStudent(singleDeleteData.id);
      if (response.success) {
        showToast(
          response.message ||
            `Student "${singleDeleteData.name}" deleted successfully`,
          'success',
        );
        setShowSingleDeleteModal(false);
        setSingleDeletePreview(null);
        setSingleDeleteData(null);
        await fetchStudents();
        await fetchAllStudents();
      } else {
        showToast(response.message || 'Failed to delete student', 'error');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      showToast(error.message || 'Failed to delete student', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── FILE HANDLING ───────────────────────────────────────────

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSelected(true);
    await handleUpload(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleUpload = async (selectedFile: File) => {
    setIsLoading(true);
    try {
      const response = await studentService.uploadAndPreview(selectedFile);
      if (response.success) {
        setPreviewData(response.data.preview || []);
        setTotalRecords(response.data.validRecords || 0);
        setFilePath(response.filePath);
        showToast(
          `File uploaded: ${response.data.validRecords} valid records found`,
          'success',
        );
      } else {
        showToast(response.message || 'Failed to upload file', 'error');
        setFileSelected(false);
        setFileName('');
        setFile(null);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast(error.message || 'Failed to upload file', 'error');
      setFileSelected(false);
      setFileName('');
      setFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!filePath) {
      showToast('No file to import', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const response = await studentService.importStudents(filePath);
      if (response.success) {
        showToast(
          response.message || 'Students imported successfully',
          'success',
        );
        setFileSelected(false);
        setFileName('');
        setFile(null);
        setPreviewData([]);
        setTotalRecords(0);
        setFilePath('');
        await fetchAllStudents();
        await fetchStudents();
      } else {
        showToast(response.message || 'Failed to import students', 'error');
      }
    } catch (error: any) {
      console.error('Import error:', error);
      showToast(error.message || 'Failed to import students', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setFileSelected(false);
    setFileName('');
    setFile(null);
    setPreviewData([]);
    setTotalRecords(0);
    setFilePath('');
  };

  // ─── DOWNLOAD IMPORT FORMAT TEMPLATE ────────────────────────

  const handleDownloadTemplate = () => {
    // Headers matching the Excel format
    const headers = [
      'ROLL NO',
      'STUDENT NAME',
      'COURSE',
      'BRANCH',
      'SEM',
      'SUBJECT',
      'BARCODE',
      'EXAM',
    ];

    // Create a sample row with placeholder data
    const sampleRow = [
      '101',
      'John Doe',
      'B.Tech',
      'CSE',
      '1',
      'Mathematics',
      'BAR001',
      'Maths-Mid-Term',
    ];

    // Create worksheet data with headers and one sample row
    const worksheetData = [headers, sampleRow];

    // Create XML for Excel file
    const createExcelXML = () => {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<?mso-application progid="Excel.Sheet"?>\n';
      xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
      xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
      xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
      xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
      xml += ' <Worksheet ss:Name="Students">\n';
      xml += '  <Table>\n';

      // Add rows
      worksheetData.forEach((row) => {
        xml += '   <Row>\n';
        row.forEach((cell: string) => {
          xml += `    <Cell><Data ss:Type="String">${cell}</Data></Cell>\n`;
        });
        xml += '   </Row>\n';
      });

      xml += '  </Table>\n';
      xml += ' </Worksheet>\n';
      xml += '</Workbook>';

      return xml;
    };

    const xmlContent = createExcelXML();
    const blob = new Blob([xmlContent], {
      type: 'application/vnd.ms-excel',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Import_Format_Template.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showToast('Template downloaded successfully!', 'success');
  };

  // ─── FILTER OPTIONS ──────────────────────────────────────────

  const uniqueSubjects = useMemo(() => {
    const subjects = allStudents.map((s) => s.subject);
    return ['All', ...new Set(subjects)];
  }, [allStudents]);

  const uniqueSemesters = useMemo(() => {
    const semesters = allStudents.map((s) => String(s.semester));
    return ['All', ...new Set(semesters)];
  }, [allStudents]);

  const uniqueBranches = useMemo(() => {
    const branches = allStudents.map((s) => s.branch);
    return ['All', ...new Set(branches)];
  }, [allStudents]);

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── TOAST ─── */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}

      {/* ─── BULK DELETE CONFIRMATION MODAL ─── */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmBulkDelete}
        isDeleting={isDeleting}
        title="Confirm Bulk Deletion"
        message="You are about to delete multiple students and their associated sheets. This cannot be undone."
        previewData={deletePreview}
      />

      {/* ─── SINGLE DELETE CONFIRMATION MODAL ─── */}
      <DeleteConfirmationModal
        isOpen={showSingleDeleteModal}
        onClose={() => {
          setShowSingleDeleteModal(false);
          setSingleDeletePreview(null);
          setSingleDeleteData(null);
        }}
        onConfirm={handleConfirmSingleDelete}
        isDeleting={isDeleting}
        title={`Delete "${singleDeleteData?.name || 'Student'}"`}
        message={`You are about to delete "${singleDeleteData?.name || 'this student'}" and all their associated sheets. This cannot be undone.`}
        previewData={singleDeletePreview}
      />

      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Student Data' }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Student Data</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload university master Excel and manage student-barcode records
          </p>
        </div>
      </div>

      {/* ─── SECTION A — Upload Master Excel ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Upload Master Student Data
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Upload the university semester Excel file containing all
              student-subject-barcode mappings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* ✅ IMPORT FORMAT BUTTON */}
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-file-download-line text-xs"></i>
              </span>
              Import Format
            </button>
            {/* FORMAT GUIDE BUTTON */}
            <button
              onClick={() => setShowFormatModal(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-information-line text-xs"></i>
              </span>
              Format Guide
            </button>
          </div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
          }`}
        >
          <input
            id="fileInput"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) handleFileSelect(selectedFile);
            }}
          />
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-file-excel-2-line text-xl text-gray-400"></i>
          </div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">
            Drag Excel file here or click to browse
          </h4>
          <p className="text-xs text-gray-400">Accepts .xlsx and .csv files</p>
        </div>

        {fileSelected && (
          <div className="mt-5 bg-gray-50 rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <i className="ri-file-excel-2-line text-lg text-emerald-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {totalRecords} students found
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <span className="w-3.5 h-3.5 flex items-center justify-center">
                        <i className="ri-download-line text-xs"></i>
                      </span>
                      Import
                    </>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>

            {previewData.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      {[
                        'Roll No',
                        'Student Name',
                        'Course',
                        'Branch',
                        'Sem',
                        'Subject',
                        'Barcode',
                      ].map((h) => (
                        <th
                          key={h}
                          className={`py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${h === 'Sem' ? 'text-center' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 5).map((s, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-gray-50 bg-white"
                      >
                        <td className="py-2.5 px-3 text-gray-900 font-medium whitespace-nowrap">
                          {s.roll_no}
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">
                          {s.student_name}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                          {s.course}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                          {s.branch}
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-600 whitespace-nowrap">
                          {s.semester}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">
                          {s.subject}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                          {s.barcode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 5 && (
                  <p className="text-xs text-gray-400 py-2 text-center">
                    Showing first 5 of {previewData.length} records
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── SECTION B — Student Records ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Imported Student Records
              {students.length > 0 && (
                <span className="text-gray-400 font-normal ml-2">
                  ({students.length})
                </span>
              )}
            </h4>
          </div>

          {students.length > 0 && (
            <div className="flex items-center gap-3">
              {selectedIds.length > 0 && (
                <>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {selectedIds.length} selected
                  </span>
                  <button
                    onClick={getDeletionPreview}
                    className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    <i className="ri-delete-bin-line text-sm"></i>
                    Delete Selected
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Summary row */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-sm font-semibold text-gray-900">
                  {stats.total}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              {stats.subjectWise.map((item) => (
                <React.Fragment key={item.subject}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">
                      {item.subject}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {item.count}
                    </span>
                  </div>
                  <span className="text-gray-200">|</span>
                </React.Fragment>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Linked to Exam</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {stats.linkedToExam || 0}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Uploaded</span>
                <span className="text-sm font-semibold text-emerald-600">
                  {stats.uploaded || 0}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Checking</span>
                <span className="text-sm font-semibold text-amber-600">
                  {stats.checking || 0}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Checked</span>
                <span className="text-sm font-semibold text-blue-600">
                  {stats.checked || 0}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Recheck</span>
                <span className="text-sm font-semibold text-rose-600">
                  {stats.recheck || 0}
                </span>
              </div>
              <span className="text-gray-200">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Pending</span>
                <span className="text-sm font-semibold text-gray-400">
                  {stats.pending || 0}
                </span>
              </div>
            </div>

            <button
              onClick={handleAutoLink}
              disabled={isLinking || students.length === 0}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
            >
              {isLinking ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Linking...
                </>
              ) : (
                <>
                  <i className="ri-link text-sm"></i>
                  Auto-Link to Exams
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── Filter bar ─── */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
              <i className="ri-search-line text-sm"></i>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or roll no..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent bg-white placeholder:text-gray-400"
            />
          </div>

          <CustomSelect
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={uniqueSubjects.map((s) => ({
              value: s,
              label: s === 'All' ? 'All Subjects' : s,
            }))}
          />

          <CustomSelect
            value={semesterFilter}
            onChange={setSemesterFilter}
            options={uniqueSemesters.map((s) => ({
              value: s,
              label: s === 'All' ? 'All Semesters' : `Semester ${s}`,
            }))}
          />

          <CustomSelect
            value={branchFilter}
            onChange={setBranchFilter}
            options={uniqueBranches.map((b) => ({
              value: b,
              label: b === 'All' ? 'All Branches' : b,
            }))}
          />
        </div>

        {/* ─── Table ─── */}
        <div className="overflow-x-auto">
          {students.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-database-2-line text-2xl text-gray-400"></i>
              </div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">
                No records imported yet
              </h4>
              <p className="text-xs text-gray-400">
                Upload the master Excel file above to see student records here.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === students.length &&
                        students.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200 cursor-pointer"
                    />
                  </th>
                  {[
                    'Roll No',
                    'Student Name',
                    'Course',
                    'Branch',
                    'Sem',
                    'Subject',
                    'Barcode',
                    'Exam',
                    'Sheet Status',
                    'Action',
                  ].map((label) => (
                    <th
                      key={label}
                      className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                        label === 'Sem' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => handleToggleSelect(s.id)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-medium whitespace-nowrap">
                      {s.roll_no}
                    </td>
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                      {s.student_name}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {s.course}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {s.branch}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600 whitespace-nowrap">
                      {s.semester}
                    </td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {s.subject}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {s.barcode}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                      {(s as any).exam_name || 'Not linked'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={s.sheet_status} />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() =>
                          handleSingleDeleteClick(s.id, s.student_name)
                        }
                        className="text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded-lg"
                        title="Delete student"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Format Guide Modal ─── */}
      {showFormatModal && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowFormatModal(false)}
          ></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">
                Expected Excel Format
              </h4>
              <button
                onClick={() => setShowFormatModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {[
                      'ROLL NO',
                      'STUDENT NAME',
                      'COURSE',
                      'BRANCH',
                      'SEM',
                      'SUBJECT',
                      'BARCODE',
                      'EXAM',
                    ].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                          h === 'SEM' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      101
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      Rahul Verma
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      B.Tech
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      CSE
                    </td>
                    <td className="py-3 px-4 text-center text-gray-500 text-xs whitespace-nowrap">
                      1
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      Mathematics
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                      BAR001
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      Maths-Mid-Term
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-information-line text-amber-600 text-sm"></i>
              </span>
              <div className="text-xs text-amber-700">
                <p className="font-medium mb-1">📋 Column Requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    <strong>ROLL NO</strong> - Student's roll number (e.g., 101)
                  </li>
                  <li>
                    <strong>STUDENT NAME</strong> - Full name of the student
                  </li>
                  <li>
                    <strong>COURSE</strong> - Course name (e.g., B.Tech, BCA,
                    MCA)
                  </li>
                  <li>
                    <strong>BRANCH</strong> - Branch/Department (e.g., CSE, ECE,
                    IT)
                  </li>
                  <li>
                    <strong>SEM</strong> - Semester number (1-8)
                  </li>
                  <li>
                    <strong>SUBJECT</strong> - Subject name (e.g., Mathematics,
                    Physics)
                  </li>
                  <li>
                    <strong>BARCODE</strong> - Unique barcode (e.g., BAR001,
                    BAR002)
                  </li>
                  <li>
                    <strong>EXAM</strong> - Exam name (e.g., Maths-Mid-Term)
                  </li>
                </ul>
                <p className="mt-2 text-amber-600">
                  💡 Click <strong>"Import Format"</strong> to download a
                  template with these headers.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowFormatModal(false)}
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
