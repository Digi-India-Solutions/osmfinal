// src/pages/admin/StudentDataUpload.tsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePageLoading } from '@/hooks/usePageLoading';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import studentService, { IStudentRecord } from '@/api/student';

// ─────────────────────────────────────────────────────────────
// CustomSelect — portal-based dropdown (fixes overflow clipping)
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
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ─── FILTERS ──────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [semesterFilter, setSemesterFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');

  // ─── STUDENTS DATA ────────────────────────────────────────────

  // allStudents = unfiltered full list, used only for building dropdown options
  // so that options never shrink when a filter is active
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
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── FETCH STUDENTS ──────────────────────────────────────────

  // Fetch ALL students once (no filters) — used to build dropdown options
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

  // ─── UPLOAD AND PREVIEW ─────────────────────────────────────

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

  // ─── IMPORT ──────────────────────────────────────────────────

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
        await fetchAllStudents(); // refresh dropdown options
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

  // ─── CLEAR ───────────────────────────────────────────────────

  const handleClear = () => {
    setFileSelected(false);
    setFileName('');
    setFile(null);
    setPreviewData([]);
    setTotalRecords(0);
    setFilePath('');
  };

  // ─── FILTER OPTIONS ──────────────────────────────────────────
  // Always derived from allStudents (unfiltered) so options never shrink
  // when a filter is active

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
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900">
            Imported Student Records
            {students.length > 0 && (
              <span className="text-gray-400 font-normal ml-2">
                ({students.length})
              </span>
            )}
          </h4>
        </div>

        {/* Summary row */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
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
                  <span className="text-xs text-gray-400">{item.subject}</span>
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
        </div>

        {/* ─── Filter bar ─── */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          {/* Search */}
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

          {/* ✅ Subject — CustomSelect (portal-based, no overflow clipping) */}
          <CustomSelect
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={uniqueSubjects.map((s) => ({
              value: s,
              label: s === 'All' ? 'All Subjects' : s,
            }))}
          />

          {/* ✅ Semester — CustomSelect */}
          <CustomSelect
            value={semesterFilter}
            onChange={setSemesterFilter}
            options={uniqueSemesters.map((s) => ({
              value: s,
              label: s === 'All' ? 'All Semesters' : `Semester ${s}`,
            }))}
          />

          {/* ✅ Branch — CustomSelect */}
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
                  {[
                    { label: 'Roll No', center: false },
                    { label: 'Student Name', center: false },
                    { label: 'Course', center: false },
                    { label: 'Branch', center: false },
                    { label: 'Sem', center: true },
                    { label: 'Subject', center: false },
                    { label: 'Barcode', center: false },
                    { label: 'Exam', center: false },
                    { label: 'Sheet Status', center: false },
                  ].map(({ label, center }) => (
                    <th
                      key={label}
                      className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${center ? 'text-center' : 'text-left'}`}
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
                    className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Format Guide Modal ─── */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowFormatModal(false)}
          ></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 p-6">
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
                      'Roll No',
                      'Student Name',
                      'Course',
                      'Branch',
                      'Semester',
                      'Subject',
                      'Barcode',
                      'Exam ID',
                    ].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${h === 'Semester' ? 'text-center' : 'text-left'}`}
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
                      4
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      Mathematics
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">
                      BAR001
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      1
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-information-line text-amber-600 text-sm"></i>
              </span>
              <p className="text-xs text-amber-700">
                Each student has one row per subject. Barcode must match the
                barcode printed on their answer sheet. <br />
                <strong>Exam ID</strong> is optional - it links the student to a
                specific exam.
              </p>
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

      {/* ─── Toast ─── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i
              className={
                toast.type === 'error'
                  ? 'ri-error-warning-line'
                  : 'ri-check-line'
              }
            ></i>
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
