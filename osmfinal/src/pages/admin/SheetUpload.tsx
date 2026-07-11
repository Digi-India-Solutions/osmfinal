// src/pages/admin/SheetUpload.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/ui/Breadcrumb';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '@/api/exam';
import sheetService, { type ISheet } from '@/api/sheet';

interface UploadedFile {
  name: string;
  barcode: string | null;
  file?: File;
}

interface LinkingResult {
  fileName: string;
  barcode: string | null;
  studentName: string | null;
  studentRoll: string | null;
  linked: boolean;
  sheetId?: number;
}

interface StudentLinkingStatus {
  id: number;
  roll_no: string;
  student_name: string;
  barcode: string;
  subject: string;
  sheet_status: string;
  sheet_id: number | null;
  file_name: string | null;
  sheet_status_display: string | null;
  is_linked: boolean;
}

// ✅ Subject mismatch interface
interface SubjectMismatch {
  filename: string;
  barcode: string;
  student_name: string;
  roll_no: string;
  student_subject: string;
  exam_subject: string;
  message: string;
}

export default function SheetUpload() {
  const loading = usePageLoading();
  const navigate = useNavigate();

  // ─── EXAMS ──────────────────────────────────────────────────

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('');

  // ─── SHEETS ──────────────────────────────────────────────────

  const [sheets, setSheets] = useState<ISheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  // ─── UPLOAD ──────────────────────────────────────────────────

  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'linking'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [linkingResults, setLinkingResults] = useState<LinkingResult[] | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // ✅ Subject mismatch state
  const [subjectMismatch, setSubjectMismatch] = useState<SubjectMismatch[]>([]);

  // ─── LINKING ──────────────────────────────────────────────────

  const [linkingStatus, setLinkingStatus] = useState<StudentLinkingStatus[]>(
    [],
  );
  const [linkStats, setLinkStats] = useState({
    total: 0,
    uploaded: 0,
    linked: 0,
    pending: 0,
  });
  const [unlinkedSheets, setUnlinkedSheets] = useState<any[]>([]);
  const [manualLinkOpen, setManualLinkOpen] = useState<number | null>(null);
  const [isManualLinking, setIsManualLinking] = useState(false);

  // ─── TOAST ──────────────────────────────────────────────────

  const [toastMsg, setToastMsg] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const showWarning = (msg: string) => {
    setWarningMsg(msg);
    setTimeout(() => setWarningMsg(null), 4000);
  };

  // ─── FETCH EXAMS ─────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExams(res.data);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
        showToast('Failed to load exams', 'error');
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  // ─── FETCH SHEETS ────────────────────────────────────────────

  const fetchSheets = useCallback(async (examId: string) => {
    if (!examId) return;
    setSheetsLoading(true);
    try {
      const response = await sheetService.getSheetsByExam(examId);
      if (response.success) {
        setSheets(response.data.sheets || []);
      }
    } catch (error) {
      console.error('Failed to fetch sheets:', error);
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  // ─── FETCH LINKING STATUS ────────────────────────────────────

  const fetchLinkingStatus = useCallback(async (examId: string) => {
    if (!examId) return;
    try {
      const response = await sheetService.getStudentLinkingStatus(examId);
      if (response.success) {
        setLinkingStatus(response.data.students || []);
        setLinkStats(
          response.data.stats || {
            total: 0,
            uploaded: 0,
            linked: 0,
            pending: 0,
          },
        );
      }
    } catch (error) {
      console.error('Failed to fetch linking status:', error);
    }
  }, []);

  // ─── FETCH UNLINKED SHEETS ──────────────────────────────────

  const fetchUnlinkedSheets = useCallback(async (examId: string) => {
    if (!examId) return;
    try {
      const response = await sheetService.getUnlinkedSheets(examId);
      if (response.success) {
        setUnlinkedSheets(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch unlinked sheets:', error);
    }
  }, []);

  // ─── EFFECTS ─────────────────────────────────────────────────

  useEffect(() => {
    if (selectedExam) {
      fetchSheets(selectedExam);
      fetchLinkingStatus(selectedExam);
      fetchUnlinkedSheets(selectedExam);
    }
  }, [selectedExam, fetchSheets, fetchLinkingStatus, fetchUnlinkedSheets]);

  // ─── EXAM CHANGE ─────────────────────────────────────────────

  const handleExamChange = (val: string) => {
    setSelectedExam(val);
    setUploadedFiles([]);
    setLinkingResults(null);
    setSubjectMismatch([]); // ✅ Reset subject mismatch
    setManualLinkOpen(null);
    setWarningMsg(null);
  };

  // ─── FILE HANDLING ────────────────────────────────────────────

  const handleFileUpload = (files: File[]) => {
    if (!selectedExam) {
      showToast('Please select an exam first', 'error');
      return;
    }

    const newFiles: UploadedFile[] = files.map((file) => {
      const name = file.name;
      const barcodeMatch = name.match(/^(BAR\d+)\./i);
      return {
        name,
        barcode: barcodeMatch ? barcodeMatch[1] : null,
        file,
      };
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setLinkingResults(null);
    setSubjectMismatch([]); // ✅ Reset subject mismatch
    setWarningMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  };

  const handleClearFiles = () => {
    setUploadedFiles([]);
    setLinkingResults(null);
    setSubjectMismatch([]); // ✅ Reset subject mismatch
    setWarningMsg(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setLinkingResults(null);
    setSubjectMismatch([]); // ✅ Reset subject mismatch
  };

  // ─── AUTO-LINK ────────────────────────────────────────────────

  const handleAutoLink = async () => {
    if (!selectedExam || uploadedFiles.length === 0) return;

    setIsLinking(true);
    setSubjectMismatch([]); // ✅ Reset subject mismatch

    try {
      const files = uploadedFiles
        .map((f) => f.file!)
        .filter((f) => f !== undefined);

      const uploadResponse = await sheetService.uploadSheets(
        selectedExam,
        files,
      );

      if (!uploadResponse.success) {
        showToast(uploadResponse.message || 'Failed to upload files', 'error');
        return;
      }

      const uploadedSheets = uploadResponse.data.sheets || [];
      const duplicates = uploadResponse.data.duplicates || [];
      const invalidFiles = uploadResponse.data.invalidFiles || [];
      const mismatchFiles = uploadResponse.data.subjectMismatch || []; // ✅ Get subject mismatch

      // ✅ Set subject mismatch state
      if (mismatchFiles.length > 0) {
        setSubjectMismatch(mismatchFiles);
        const mismatchDetails = mismatchFiles
          .map(
            (f: any) =>
              `${f.filename} (${f.student_subject} → ${f.exam_subject})`,
          )
          .join('; ');
        showWarning(
          `⚠️ ${mismatchFiles.length} file(s) skipped due to subject mismatch: ${mismatchDetails}`,
        );
      }

      if (duplicates.length > 0) {
        const duplicateNames = duplicates
          .map((d: any) => d.filename)
          .join(', ');
        showWarning(
          `${duplicates.length} file(s) skipped (already uploaded): ${duplicateNames}`,
        );
      }

      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles
          .map((d: any) => d.filename)
          .join(', ');
        showWarning(
          `${invalidFiles.length} file(s) skipped (invalid barcode format): ${invalidNames}`,
        );
      }

      if (uploadedSheets.length === 0) {
        if (
          mismatchFiles.length > 0 ||
          duplicates.length > 0 ||
          invalidFiles.length > 0
        ) {
          setIsLinking(false);
          return;
        }
        showToast('No sheets were uploaded', 'error');
        setIsLinking(false);
        return;
      }

      const sheetIds = uploadedSheets.map((s: any) => s.id);

      const linkResponse = await sheetService.autoLinkSheets(
        selectedExam,
        sheetIds,
      );

      if (linkResponse.success) {
        const results = linkResponse.data.results || [];

        const linkingResults: LinkingResult[] = uploadedFiles.map(
          (file, index) => {
            const result = results.find((r: any) => r.barcode === file.barcode);
            return {
              fileName: file.name,
              barcode: file.barcode,
              studentName: result?.student?.student_name || null,
              studentRoll: result?.student?.roll_no || null,
              linked: result?.matched || false,
              sheetId: uploadedSheets[index]?.id,
            };
          },
        );

        setLinkingResults(linkingResults);

        const linkedCount = linkingResults.filter((r) => r.linked).length;
        const unlinkedCount = linkingResults.length - linkedCount;

        if (unlinkedCount > 0) {
          const mismatchBarcodes = mismatchFiles.map((f: any) => f.barcode);
          const mismatchUnlinked = linkingResults.filter(
            (r) => r.barcode && mismatchBarcodes.includes(r.barcode),
          );

          if (mismatchUnlinked.length > 0) {
            // Already showed warning above
          } else {
            showWarning(
              `${unlinkedCount} file(s) could not be linked — check barcodes`,
            );
          }
        }

        await fetchSheets(selectedExam);
        await fetchLinkingStatus(selectedExam);
        await fetchUnlinkedSheets(selectedExam);
      } else {
        showToast(
          linkResponse.message || 'Failed to auto-link sheets',
          'error',
        );
      }
    } catch (error: any) {
      console.error('Auto-link error:', error);
      showToast(error.message || 'Failed to auto-link sheets', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  // ─── CONFIRM UPLOAD ──────────────────────────────────────────

  const handleConfirmUpload = async () => {
    if (!linkingResults || !selectedExam) return;

    const linked = linkingResults.filter((r) => r.linked);
    if (linked.length === 0) {
      showToast('No sheets to confirm', 'error');
      return;
    }

    try {
      const sheetIds = linked
        .map((r) => r.sheetId)
        .filter((id) => id !== undefined) as number[];

      if (sheetIds.length === 0) {
        showToast('No sheets to confirm', 'error');
        return;
      }

      for (const sheetId of sheetIds) {
        await sheetService.updateSheet(sheetId, { status: 'linked' });
      }

      showToast(
        `${linked.length} sheets uploaded and linked successfully`,
        'success',
      );

      setUploadedFiles([]);
      setLinkingResults(null);
      setSubjectMismatch([]); // ✅ Reset subject mismatch

      await fetchSheets(selectedExam);
      await fetchLinkingStatus(selectedExam);
      await fetchUnlinkedSheets(selectedExam);
    } catch (error: any) {
      console.error('Confirm upload error:', error);
      showToast(error.message || 'Failed to confirm upload', 'error');
    }
  };

  // ─── MANUAL LINK ──────────────────────────────────────────────

  const handleManualLink = async (studentId: number, sheetId: number) => {
    if (!selectedExam) return;

    setIsManualLinking(true);
    try {
      const response = await sheetService.manualLinkStudent(
        selectedExam,
        studentId,
        sheetId,
      );
      if (response.success) {
        showToast('Student linked successfully', 'success');
        setManualLinkOpen(null);
        await fetchSheets(selectedExam);
        await fetchLinkingStatus(selectedExam);
        await fetchUnlinkedSheets(selectedExam);
      } else {
        showToast(response.message || 'Failed to link student', 'error');
      }
    } catch (error: any) {
      console.error('Manual link error:', error);
      showToast(error.message || 'Failed to link student', 'error');
    } finally {
      setIsManualLinking(false);
    }
  };

  // ─── RENDER HELPERS ──────────────────────────────────────────

  const activeExams = exams.filter((e) => e.status === 'active');
  const selectedExamData = exams.find((e) => e.id === selectedExam) || null;

  const linkedCount = linkingResults
    ? linkingResults.filter((r) => r.linked).length
    : 0;
  const totalCount = linkingResults ? linkingResults.length : 0;

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || examsLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Sheet Upload' }]}
      />

      {/* Toast Messages */}
      {toastMsg && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
            toastMsg.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          <span className="w-4 h-4 flex items-center justify-center">
            <i
              className={
                toastMsg.type === 'error'
                  ? 'ri-error-warning-line'
                  : 'ri-check-line'
              }
            ></i>
          </span>
          {toastMsg.message}
        </div>
      )}

      {warningMsg && (
        <div
          className="fixed top-6 right-6 z-50 bg-amber-600 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{ marginTop: toastMsg ? '60px' : '0' }}
        >
          <span className="w-4 h-4 flex items-center justify-center inline-block mr-2">
            <i className="ri-error-warning-line"></i>
          </span>
          {warningMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sheet Upload</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload scanned answer sheets for an exam
          </p>
        </div>
      </div>

      {/* Select Exam */}
      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exam
        </label>
        <select
          value={selectedExam}
          onChange={(e) => handleExamChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
        >
          <option value="">Choose an active exam...</option>
          {activeExams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name} ({exam.subject})
            </option>
          ))}
        </select>
      </div>

      {selectedExam && selectedExamData && (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'upload'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                  <i className="ri-upload-cloud-2-line text-sm"></i>
                </span>
                Upload Sheets
              </button>
              <button
                onClick={() => setActiveTab('linking')}
                className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'linking'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                  <i className="ri-link text-sm"></i>
                </span>
                Student Linking
              </button>
            </div>

            {/* ─── UPLOAD TAB ────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <div className="p-6 space-y-5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-upload-cloud-2-line text-2xl text-gray-400"></i>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    Drag & drop scanned sheets here
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">
                    Supports PDF, JPG, PNG — up to 25MB per file
                  </p>
                  <label className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap">
                    <span className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-folder-open-line text-base"></i>
                    </span>
                    Browse Files
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      multiple
                      className="hidden"
                      onChange={handleBrowse}
                    />
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Selected Files
                        <span className="text-gray-400 font-normal ml-2">
                          ({uploadedFiles.length})
                        </span>
                      </h4>
                      <button
                        onClick={handleClearFiles}
                        className="text-xs text-gray-400 hover:text-rose-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file, i) => (
                        <div
                          key={i}
                          className="px-5 py-2.5 flex items-center gap-3 group"
                        >
                          <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <i className="ri-file-pdf-line text-rose-500 text-sm"></i>
                          </span>
                          <span className="text-sm text-gray-700 flex-1 truncate">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {file.barcode || 'Unknown'}
                          </span>
                          <button
                            onClick={() => removeFile(i)}
                            className="text-gray-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <i className="ri-close-line text-sm"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center gap-3">
                      <button
                        onClick={handleAutoLink}
                        disabled={isLinking}
                        className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLinking ? (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Linking...
                          </>
                        ) : (
                          <>
                            <span className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-link text-sm"></i>
                            </span>
                            Auto-link by Barcode
                          </>
                        )}
                      </button>
                      {linkingResults && linkedCount > 0 && (
                        <button
                          onClick={handleConfirmUpload}
                          className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-check-line text-sm"></i>
                          </span>
                          Confirm Upload ({linkedCount})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {linkingResults && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Linking Results
                      </h4>
                    </div>
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-emerald-600">
                          {linkedCount}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-gray-900">
                          {totalCount}
                        </span>{' '}
                        files linked successfully
                        {totalCount - linkedCount > 0 && (
                          <span className="text-rose-500 ml-2">
                            ({totalCount - linkedCount} failed)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Filename
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Barcode
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Matched Student
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkingResults.map((r, i) => {
                            // ✅ Check if this file was subject mismatch
                            const isSubjectMismatch = subjectMismatch.some(
                              (f) => f.barcode === r.barcode,
                            );

                            return (
                              <tr
                                key={i}
                                className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                              >
                                <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                                  {r.fileName}
                                </td>
                                <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                                  {r.barcode || '—'}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {r.linked ? (
                                    <span className="text-gray-700">
                                      {r.studentName}{' '}
                                      <span className="text-gray-400">
                                        Roll {r.studentRoll}
                                      </span>
                                    </span>
                                  ) : isSubjectMismatch ? (
                                    <span className="text-amber-600 text-xs font-medium">
                                      Subject mismatch: {r.barcode}
                                    </span>
                                  ) : (
                                    <span className="text-rose-500 text-xs font-medium">
                                      No match found
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {r.linked ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      Linked
                                    </span>
                                  ) : isSubjectMismatch ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                      Subject Mismatch
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                                      Unlinked
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

            {/* ─── LINKING TAB ────────────────────────────────────── */}
            {activeTab === 'linking' && (
              <div className="p-6 space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {linkStats.total}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Total Students
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">
                      {linkStats.uploaded}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Sheets Uploaded
                    </p>
                  </div>
                  <div className="bg-sky-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-sky-700">
                      {linkStats.linked}
                    </p>
                    <p className="text-xs text-sky-600 mt-0.5">Linked</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {linkStats.pending}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Pending Upload
                    </p>
                  </div>
                </div>

                {/* Unlinked Students Table */}
                {sheetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                  </div>
                ) : linkingStatus.length === 0 ? (
                  <EmptyState
                    icon="ri-user-search-line"
                    title="No students found"
                    description="Upload master student data first from the Student Data page."
                    actionLabel="Go to Student Data"
                    onAction={() => navigate('/admin/student-data')}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Roll No
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Student Name
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Barcode
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Sheet Uploaded
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Linked
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkingStatus.map((student) => {
                            const isLinked = student.is_linked;
                            const hasSheet = student.sheet_id !== null;
                            const isPending =
                              student.sheet_status !== 'uploaded' &&
                              student.sheet_status !== 'linked';

                            return (
                              <tr
                                key={student.id}
                                className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                              >
                                <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                                  {student.roll_no}
                                </td>
                                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                                  {student.student_name}
                                </td>
                                <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">
                                  {student.barcode}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {hasSheet ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isLinked ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                      No
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {!isLinked &&
                                  isPending &&
                                  unlinkedSheets.length > 0 ? (
                                    <div className="relative inline-block">
                                      <button
                                        onClick={() =>
                                          setManualLinkOpen(
                                            manualLinkOpen === student.id
                                              ? null
                                              : student.id,
                                          )
                                        }
                                        disabled={isManualLinking}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <span className="w-3.5 h-3.5 flex items-center justify-center">
                                          <i className="ri-link text-xs"></i>
                                        </span>
                                        Manual Link
                                      </button>
                                      {manualLinkOpen === student.id && (
                                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[260px]">
                                          <p className="text-xs text-gray-500 px-2 py-1.5 border-b border-gray-100">
                                            Select a sheet to link:
                                            <span className="block text-[10px] text-gray-400">
                                              ({unlinkedSheets.length} sheets
                                              available)
                                            </span>
                                          </p>
                                          <div className="space-y-0.5 max-h-48 overflow-y-auto pt-1">
                                            {unlinkedSheets.length === 0 ? (
                                              <p className="text-xs text-gray-400 px-2 py-2">
                                                No unlinked sheets available
                                              </p>
                                            ) : (
                                              unlinkedSheets.map((sheet) => (
                                                <button
                                                  key={sheet.id}
                                                  onClick={() =>
                                                    handleManualLink(
                                                      student.id,
                                                      sheet.id,
                                                    )
                                                  }
                                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center justify-between"
                                                >
                                                  <span>
                                                    <span className="font-medium">
                                                      {sheet.file_name}
                                                    </span>
                                                    <span className="text-gray-400 ml-2">
                                                      (
                                                      {sheet.barcode ||
                                                        'No barcode'}
                                                      )
                                                    </span>
                                                  </span>
                                                  <span className="text-[10px] text-gray-400">
                                                    #{sheet.id}
                                                  </span>
                                                </button>
                                              ))
                                            )}
                                          </div>
                                          <div className="border-t border-gray-100 pt-1 mt-1">
                                            <button
                                              onClick={() =>
                                                setManualLinkOpen(null)
                                              }
                                              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : !isLinked ? (
                                    <span className="text-xs text-gray-400">
                                      No sheets available
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">
                                      —
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

          {/* ─── ALL UPLOADED SHEETS ────────────────────────────── */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">
                All Uploaded Sheets
                <span className="text-gray-400 font-normal ml-2">
                  ({sheets.length})
                </span>
              </h4>
            </div>
            <div className="overflow-x-auto">
              {sheets.length === 0 ? (
                <EmptyState
                  icon="ri-file-copy-2-line"
                  title="No sheets uploaded yet"
                  description="Upload scanned answer sheets for this exam using the Upload Sheets tab above."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Sheet ID
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Roll No
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Student Name
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Barcode
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Status
                      </th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Marks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((sheet) => (
                      <tr
                        key={sheet.id}
                        className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                          #{sheet.id}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {sheet.roll_no || '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                          {sheet.student_name || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {sheet.barcode || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={sheet.status} />
                        </td>
                        <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                          {sheet.marks !== undefined && sheet.marks !== null
                            ? sheet.marks
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
