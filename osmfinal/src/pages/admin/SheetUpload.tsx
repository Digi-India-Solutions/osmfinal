// // src/pages/admin/SheetUpload.tsx
// import { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import Breadcrumb from '@/components/ui/Breadcrumb';
// import StatusBadge from '@/components/ui/StatusBadge';
// import LoadingSpinner from '@/components/ui/LoadingSpinner';
// import EmptyState from '@/components/ui/EmptyState';
// import { usePageLoading } from '@/hooks/usePageLoading';
// import { examApi, type ExamResponse } from '@/api/exam';
// import sheetService, { type ISheet } from '@/api/sheet';

// interface UploadedFile {
//   name: string;
//   barcode: string | null;
//   file?: File;
// }

// // ✅ Extended with failure reason
// type FailureReason =
//   | 'subject_mismatch'
//   | 'barcode_not_found'
//   | 'already_linked'
//   | 'invalid_barcode'
//   | 'duplicate_upload'
//   | 'unknown';

// interface LinkingResult {
//   fileName: string;
//   barcode: string | null;
//   studentName: string | null;
//   studentRoll: string | null;
//   linked: boolean;
//   alreadyLinked?: boolean;
//   sheetId?: number;
//   failureReason?: FailureReason;
//   // Subject mismatch detail
//   studentSubject?: string;
//   examSubject?: string;
// }

// interface StudentLinkingStatus {
//   id: number;
//   roll_no: string;
//   student_name: string;
//   barcode: string;
//   subject: string;
//   sheet_status: string;
//   sheet_id: number | null;
//   file_name: string | null;
//   sheet_status_display: string | null;
//   is_linked: boolean;
// }

// interface SubjectMismatch {
//   filename: string;
//   barcode: string;
//   student_name: string;
//   roll_no: string;
//   student_subject: string;
//   exam_subject: string;
//   message: string;
// }

// // ✅ Human readable failure reasons
// const FAILURE_LABELS: Record<FailureReason, { label: string; color: string; bg: string; icon: string; tip: string }> = {
//   subject_mismatch: {
//     label: 'Subject Mismatch',
//     color: 'text-amber-700',
//     bg: 'bg-amber-100',
//     icon: 'ri-book-line',
//     tip: "Student's subject in master data doesn't match this exam's subject.",
//   },
//   barcode_not_found: {
//     label: 'Barcode Not Found',
//     color: 'text-rose-700',
//     bg: 'bg-rose-100',
//     icon: 'ri-barcode-line',
//     tip: 'No student in master data has this barcode. Check barcode or re-upload master data.',
//   },
//   already_linked: {
//     label: 'Already Linked',
//     color: 'text-sky-700',
//     bg: 'bg-sky-100',
//     icon: 'ri-link',
//     tip: 'This sheet was already linked to a student in a previous upload.',
//   },
//   invalid_barcode: {
//     label: 'Invalid Barcode',
//     color: 'text-orange-700',
//     bg: 'bg-orange-100',
//     icon: 'ri-error-warning-line',
//     tip: 'File name does not follow the BAR#### naming format. Rename the file.',
//   },
//   duplicate_upload: {
//     label: 'Duplicate Upload',
//     color: 'text-purple-700',
//     bg: 'bg-purple-100',
//     icon: 'ri-file-copy-line',
//     tip: 'This file was already uploaded for this exam.',
//   },
//   unknown: {
//     label: 'Unknown Error',
//     color: 'text-gray-700',
//     bg: 'bg-gray-100',
//     icon: 'ri-question-line',
//     tip: 'An unexpected error occurred. Try again or contact support.',
//   },
// };

// export default function SheetUpload() {
//   const loading = usePageLoading();
//   const navigate = useNavigate();

//   const [exams, setExams] = useState<ExamResponse[]>([]);
//   const [examsLoading, setExamsLoading] = useState(true);
//   const [selectedExam, setSelectedExam] = useState<string>('');

//   const [sheets, setSheets] = useState<ISheet[]>([]);
//   const [sheetsLoading, setSheetsLoading] = useState(false);

//   const [dragOver, setDragOver] = useState(false);
//   const [activeTab, setActiveTab] = useState<'upload' | 'linking'>('upload');
//   const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
//   const [linkingResults, setLinkingResults] = useState<LinkingResult[] | null>(null);
//   const [isLinking, setIsLinking] = useState(false);
//   const [subjectMismatch, setSubjectMismatch] = useState<SubjectMismatch[]>([]);

//   const [linkingStatus, setLinkingStatus] = useState<StudentLinkingStatus[]>([]);
//   const [linkStats, setLinkStats] = useState({ total: 0, uploaded: 0, linked: 0, pending: 0 });
//   const [unlinkedSheets, setUnlinkedSheets] = useState<any[]>([]);
//   const [manualLinkOpen, setManualLinkOpen] = useState<number | null>(null);
//   const [isManualLinking, setIsManualLinking] = useState(false);

//   // ✅ Results filter tab
//   const [resultFilter, setResultFilter] = useState<'all' | 'linked' | 'failed'>('all');

//   const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

//   const showToast = (message: string, type: 'success' | 'error' = 'success') => {
//     setToastMsg({ message, type });
//     setTimeout(() => setToastMsg(null), 4000);
//   };

//   // ─── FETCH ───────────────────────────────────────────────────

//   useEffect(() => {
//     const fetchExams = async () => {
//       try {
//         setExamsLoading(true);
//         const res = await examApi.getAllExams({ limit: 1000 });
//         setExams(res.data);
//       } catch {
//         showToast('Failed to load exams', 'error');
//       } finally {
//         setExamsLoading(false);
//       }
//     };
//     fetchExams();
//   }, []);

//   const fetchSheets = useCallback(async (examId: string) => {
//     if (!examId) return;
//     setSheetsLoading(true);
//     try {
//       const response = await sheetService.getSheetsByExam(examId);
//       if (response.success) setSheets(response.data.sheets || []);
//     } catch (error) {
//       console.error('Failed to fetch sheets:', error);
//     } finally {
//       setSheetsLoading(false);
//     }
//   }, []);

//   const fetchLinkingStatus = useCallback(async (examId: string) => {
//     if (!examId) return;
//     try {
//       const response = await sheetService.getStudentLinkingStatus(examId);
//       if (response.success) {
//         setLinkingStatus(response.data.students || []);
//         setLinkStats(response.data.stats || { total: 0, uploaded: 0, linked: 0, pending: 0 });
//       }
//     } catch (error) {
//       console.error('Failed to fetch linking status:', error);
//     }
//   }, []);

//   const fetchUnlinkedSheets = useCallback(async (examId: string) => {
//     if (!examId) return;
//     try {
//       const response = await sheetService.getUnlinkedSheets(examId);
//       if (response.success) setUnlinkedSheets(response.data || []);
//     } catch (error) {
//       console.error('Failed to fetch unlinked sheets:', error);
//     }
//   }, []);

//   useEffect(() => {
//     if (selectedExam) {
//       fetchSheets(selectedExam);
//       fetchLinkingStatus(selectedExam);
//       fetchUnlinkedSheets(selectedExam);
//     }
//   }, [selectedExam, fetchSheets, fetchLinkingStatus, fetchUnlinkedSheets]);

//   // ─── HANDLERS ────────────────────────────────────────────────

//   const resetUploadState = () => {
//     setLinkingResults(null);
//     setSubjectMismatch([]);
//     setResultFilter('all');
//   };

//   const handleExamChange = (val: string) => {
//     setSelectedExam(val);
//     setUploadedFiles([]);
//     setManualLinkOpen(null);
//     resetUploadState();
//   };

//   const handleFileUpload = (files: File[]) => {
//     if (!selectedExam) {
//       showToast('Please select an exam first', 'error');
//       return;
//     }
//     const newFiles: UploadedFile[] = files.map((file) => {
//       const barcodeMatch = file.name.match(/^(BAR\d+)\./i);
//       return { name: file.name, barcode: barcodeMatch ? barcodeMatch[1] : null, file };
//     });
//     setUploadedFiles((prev) => [...prev, ...newFiles]);
//     resetUploadState();
//   };

//   const handleDrop = (e: React.DragEvent) => {
//     e.preventDefault();
//     setDragOver(false);
//     const files = Array.from(e.dataTransfer.files);
//     if (files.length > 0) handleFileUpload(files);
//   };

//   const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     if (files.length > 0) handleFileUpload(files);
//     e.target.value = '';
//   };

//   // ─── AUTO-LINK ────────────────────────────────────────────────

//   const handleAutoLink = async () => {
//     if (!selectedExam || uploadedFiles.length === 0) return;
//     setIsLinking(true);
//     setSubjectMismatch([]);

//     try {
//       const files = uploadedFiles.map((f) => f.file!).filter(Boolean);

//       const uploadResponse = await sheetService.uploadSheets(selectedExam, files);
//       if (!uploadResponse.success) {
//         showToast(uploadResponse.message || 'Failed to upload files', 'error');
//         return;
//       }

//       const uploadedSheets = uploadResponse.data.sheets || [];
//       const duplicates: any[] = uploadResponse.data.duplicates || [];
//       const invalidFiles: any[] = uploadResponse.data.invalidFiles || [];
//       const mismatchFiles: SubjectMismatch[] = uploadResponse.data.subjectMismatch || [];

//       if (mismatchFiles.length > 0) setSubjectMismatch(mismatchFiles);

//       // ✅ Build results for ALL uploaded files including skipped ones
//       const allResults: LinkingResult[] = [];

//       // Mark invalid barcode files
//       invalidFiles.forEach((f: any) => {
//         allResults.push({
//           fileName: f.filename,
//           barcode: null,
//           studentName: null,
//           studentRoll: null,
//           linked: false,
//           failureReason: 'invalid_barcode',
//         });
//       });

//       // Mark duplicate files
//       duplicates.forEach((f: any) => {
//         allResults.push({
//           fileName: f.filename,
//           barcode: f.barcode || null,
//           studentName: f.student_name || null,
//           studentRoll: f.roll_no || null,
//           linked: false,
//           alreadyLinked: true,
//           failureReason: 'duplicate_upload',
//         });
//       });

//       // Mark subject mismatch files
//       mismatchFiles.forEach((f) => {
//         allResults.push({
//           fileName: f.filename,
//           barcode: f.barcode,
//           studentName: f.student_name,
//           studentRoll: f.roll_no,
//           linked: false,
//           failureReason: 'subject_mismatch',
//           studentSubject: f.student_subject,
//           examSubject: f.exam_subject,
//         });
//       });

//       if (uploadedSheets.length > 0) {
//         const sheetIds = uploadedSheets.map((s: any) => s.id);
//         const linkResponse = await sheetService.autoLinkSheets(selectedExam, sheetIds);

//         if (linkResponse.success) {
//           const results = linkResponse.data.results || [];

//           uploadedSheets.forEach((sheet: any, index: number) => {
//             const matchedFile = uploadedFiles.find((f) => f.barcode === sheet.barcode);
//             const result = results.find((r: any) => r.barcode === sheet.barcode);

//             if (result?.matched) {
//               allResults.push({
//                 fileName: matchedFile?.name || sheet.file_name,
//                 barcode: sheet.barcode,
//                 studentName: result.student?.student_name || null,
//                 studentRoll: result.student?.roll_no || null,
//                 linked: true,
//                 sheetId: sheet.id,
//               });
//             } else {
//               allResults.push({
//                 fileName: matchedFile?.name || sheet.file_name,
//                 barcode: sheet.barcode,
//                 studentName: null,
//                 studentRoll: null,
//                 linked: false,
//                 sheetId: sheet.id,
//                 failureReason: 'barcode_not_found',
//               });
//             }
//           });
//         }
//       }

//       setLinkingResults(allResults);

//       const linkedCount = allResults.filter((r) => r.linked).length;
//       const failedCount = allResults.filter((r) => !r.linked).length;

//       if (linkedCount > 0 && failedCount === 0) {
//         showToast(`✅ All ${linkedCount} sheet(s) linked successfully`, 'success');
//       } else if (linkedCount > 0) {
//         showToast(`${linkedCount} linked, ${failedCount} failed — see results below`, 'success');
//       } else {
//         showToast(`No sheets linked — check errors below`, 'error');
//       }

//       // Auto-switch to show results
//       if (failedCount > 0) setResultFilter('failed');
//       else setResultFilter('linked');

//       await fetchSheets(selectedExam);
//       await fetchLinkingStatus(selectedExam);
//       await fetchUnlinkedSheets(selectedExam);
//     } catch (error: any) {
//       console.error('Auto-link error:', error);
//       showToast(error.message || 'Failed to auto-link sheets', 'error');
//     } finally {
//       setIsLinking(false);
//     }
//   };

//   // ─── CONFIRM ─────────────────────────────────────────────────

//   const handleConfirmUpload = async () => {
//     if (!linkingResults || !selectedExam) return;
//     const linked = linkingResults.filter((r) => r.linked);
//     if (linked.length === 0) { showToast('No sheets to confirm', 'error'); return; }

//     try {
//       const sheetIds = linked.map((r) => r.sheetId).filter((id): id is number => id !== undefined);
//       for (const sheetId of sheetIds) {
//         await sheetService.updateSheet(sheetId, { status: 'linked' });
//       }
//       showToast(`${linked.length} sheets confirmed and linked`, 'success');
//       setUploadedFiles([]);
//       resetUploadState();
//       await fetchSheets(selectedExam);
//       await fetchLinkingStatus(selectedExam);
//       await fetchUnlinkedSheets(selectedExam);
//     } catch (error: any) {
//       showToast(error.message || 'Failed to confirm upload', 'error');
//     }
//   };

//   // ─── MANUAL LINK ─────────────────────────────────────────────

//   const handleManualLink = async (studentId: number, sheetId: number) => {
//     if (!selectedExam) return;
//     setIsManualLinking(true);
//     try {
//       const response = await sheetService.manualLinkStudent(selectedExam, studentId, sheetId);
//       if (response.success) {
//         showToast('Student linked successfully', 'success');
//         setManualLinkOpen(null);
//         await fetchSheets(selectedExam);
//         await fetchLinkingStatus(selectedExam);
//         await fetchUnlinkedSheets(selectedExam);
//       } else {
//         showToast(response.message || 'Failed to link student', 'error');
//       }
//     } catch (error: any) {
//       showToast(error.message || 'Failed to link student', 'error');
//     } finally {
//       setIsManualLinking(false);
//     }
//   };

//   // ─── DERIVED STATE ────────────────────────────────────────────

//   const activeExams = exams.filter((e) => e.status === 'active');
//   const selectedExamData = exams.find((e) => e.id === selectedExam) || null;

//   const linkedCount = linkingResults?.filter((r) => r.linked).length ?? 0;
//   const failedCount = linkingResults?.filter((r) => !r.linked).length ?? 0;
//   const totalCount = linkingResults?.length ?? 0;

//   // ✅ Failure breakdown
//   const failureBreakdown = linkingResults
//     ? Object.entries(
//         linkingResults
//           .filter((r) => !r.linked)
//           .reduce<Record<string, number>>((acc, r) => {
//             const key = r.failureReason || 'unknown';
//             acc[key] = (acc[key] || 0) + 1;
//             return acc;
//           }, {})
//       )
//     : [];

//   const filteredResults = linkingResults?.filter((r) => {
//     if (resultFilter === 'linked') return r.linked;
//     if (resultFilter === 'failed') return !r.linked;
//     return true;
//   });

//   if (loading || examsLoading) return <LoadingSpinner fullPage />;

//   return (
//     <div className="space-y-5">
//       <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Sheet Upload' }]} />

//       {/* Toast */}
//       {toastMsg && (
//         <div
//           className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 max-w-md ${
//             toastMsg.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
//           }`}
//         >
//           <i className={toastMsg.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'} />
//           {toastMsg.message}
//         </div>
//       )}

//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h3 className="text-lg font-semibold text-gray-900">Sheet Upload</h3>
//           <p className="text-sm text-gray-500 mt-0.5">Upload scanned answer sheets for an exam</p>
//         </div>
//       </div>

//       {/* Select Exam */}
//       <div className="bg-white rounded-2xl p-6">
//         <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
//         <select
//           value={selectedExam}
//           onChange={(e) => handleExamChange(e.target.value)}
//           className="w-full max-w-md px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
//         >
//           <option value="">Choose an active exam...</option>
//           {activeExams.map((exam) => (
//             <option key={exam.id} value={exam.id}>
//               {exam.name} ({exam.subject})
//             </option>
//           ))}
//         </select>
//       </div>

//       {selectedExam && selectedExamData && (
//         <>
//           {/* Tabs */}
//           <div className="bg-white rounded-2xl overflow-hidden">
//             <div className="flex border-b border-gray-100">
//               {(['upload', 'linking'] as const).map((tab) => (
//                 <button
//                   key={tab}
//                   onClick={() => setActiveTab(tab)}
//                   className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${
//                     activeTab === tab
//                       ? 'text-gray-900 border-b-2 border-gray-900'
//                       : 'text-gray-400 hover:text-gray-600'
//                   }`}
//                 >
//                   <i className={`${tab === 'upload' ? 'ri-upload-cloud-2-line' : 'ri-link'} mr-1.5`} />
//                   {tab === 'upload' ? 'Upload Sheets' : 'Student Linking'}
//                 </button>
//               ))}
//             </div>

//             {/* ─── UPLOAD TAB ─── */}
//             {activeTab === 'upload' && (
//               <div className="p-6 space-y-5">
//                 {/* Drop Zone */}
//                 <div
//                   onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
//                   onDragLeave={() => setDragOver(false)}
//                   onDrop={handleDrop}
//                   className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
//                     dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white'
//                   }`}
//                 >
//                   <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
//                     <i className="ri-upload-cloud-2-line text-2xl text-gray-400" />
//                   </div>
//                   <h4 className="text-sm font-semibold text-gray-900 mb-1">Drag & drop scanned sheets here</h4>
//                   <p className="text-xs text-gray-400 mb-4">
//                     PDF, JPG, PNG — up to 25MB per file. Name files as <code className="bg-gray-100 px-1 rounded">BAR001.pdf</code>
//                   </p>
//                   <label className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap">
//                     <i className="ri-folder-open-line" />
//                     Browse Files
//                     <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={handleBrowse} />
//                   </label>
//                 </div>

//                 {/* Selected Files */}
//                 {uploadedFiles.length > 0 && (
//                   <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//                     <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
//                       <h4 className="text-sm font-semibold text-gray-900">
//                         Selected Files <span className="text-gray-400 font-normal">({uploadedFiles.length})</span>
//                       </h4>
//                       <button
//                         onClick={() => { setUploadedFiles([]); resetUploadState(); }}
//                         className="text-xs text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
//                       >
//                         Clear All
//                       </button>
//                     </div>
//                     <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
//                       {uploadedFiles.map((file, i) => (
//                         <div key={i} className="px-5 py-2.5 flex items-center gap-3 group">
//                           <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
//                             <i className="ri-file-pdf-line text-rose-500 text-sm" />
//                           </span>
//                           <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
//                           {file.barcode ? (
//                             <span className="text-xs text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded">
//                               {file.barcode}
//                             </span>
//                           ) : (
//                             <span className="text-xs text-rose-500 bg-rose-50 px-2 py-0.5 rounded">
//                               No barcode
//                             </span>
//                           )}
//                           <button
//                             onClick={() => {
//                               setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));
//                               resetUploadState();
//                             }}
//                             className="text-gray-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
//                           >
//                             <i className="ri-close-line text-sm" />
//                           </button>
//                         </div>
//                       ))}
//                     </div>
//                     <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center gap-3">
//                       <button
//                         onClick={handleAutoLink}
//                         disabled={isLinking}
//                         className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
//                       >
//                         {isLinking ? (
//                           <>
//                             <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
//                             Linking...
//                           </>
//                         ) : (
//                           <>
//                             <i className="ri-link text-sm" />
//                             Auto-link by Barcode
//                           </>
//                         )}
//                       </button>
//                       {linkingResults && linkedCount > 0 && (
//                         <button
//                           onClick={handleConfirmUpload}
//                           className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
//                         >
//                           <i className="ri-check-line text-sm" />
//                           Confirm Upload ({linkedCount})
//                         </button>
//                       )}
//                     </div>
//                   </div>
//                 )}

//                 {/* ✅ LINKING RESULTS — detailed */}
//                 {linkingResults && (
//                   <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//                     <div className="px-5 py-4 border-b border-gray-100">
//                       <h4 className="text-sm font-semibold text-gray-900 mb-3">Linking Results</h4>

//                       {/* Summary cards */}
//                       <div className="grid grid-cols-3 gap-3 mb-4">
//                         <div className="bg-gray-50 rounded-xl p-3 text-center">
//                           <p className="text-xl font-bold text-gray-900">{totalCount}</p>
//                           <p className="text-xs text-gray-500 mt-0.5">Total Files</p>
//                         </div>
//                         <div className="bg-emerald-50 rounded-xl p-3 text-center">
//                           <p className="text-xl font-bold text-emerald-700">{linkedCount}</p>
//                           <p className="text-xs text-emerald-600 mt-0.5">Linked ✓</p>
//                         </div>
//                         <div className="bg-rose-50 rounded-xl p-3 text-center">
//                           <p className="text-xl font-bold text-rose-700">{failedCount}</p>
//                           <p className="text-xs text-rose-600 mt-0.5">Failed ✗</p>
//                         </div>
//                       </div>

//                       {/* ✅ Failure breakdown */}
//                       {failureBreakdown.length > 0 && (
//                         <div className="space-y-2 mb-4">
//                           <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Why did they fail?</p>
//                           {failureBreakdown.map(([reason, count]) => {
//                             const cfg = FAILURE_LABELS[reason as FailureReason] || FAILURE_LABELS.unknown;
//                             return (
//                               <div key={reason} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${cfg.bg}`}>
//                                 <i className={`${cfg.icon} ${cfg.color} text-sm mt-0.5 shrink-0`} />
//                                 <div className="flex-1 min-w-0">
//                                   <div className="flex items-center justify-between">
//                                     <span className={`text-xs font-semibold ${cfg.color}`}>
//                                       {cfg.label} — {count} file{count > 1 ? 's' : ''}
//                                     </span>
//                                   </div>
//                                   <p className="text-xs text-gray-500 mt-0.5">{cfg.tip}</p>
//                                 </div>
//                               </div>
//                             );
//                           })}
//                         </div>
//                       )}

//                       {/* Filter tabs */}
//                       <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
//                         {([
//                           { key: 'all', label: `All (${totalCount})` },
//                           { key: 'linked', label: `Linked (${linkedCount})` },
//                           { key: 'failed', label: `Failed (${failedCount})` },
//                         ] as const).map(({ key, label }) => (
//                           <button
//                             key={key}
//                             onClick={() => setResultFilter(key)}
//                             className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
//                               resultFilter === key
//                                 ? 'bg-white text-gray-900 shadow-sm'
//                                 : 'text-gray-500 hover:text-gray-700'
//                             }`}
//                           >
//                             {label}
//                           </button>
//                         ))}
//                       </div>
//                     </div>

//                     {/* Results table */}
//                     <div className="overflow-x-auto">
//                       <table className="w-full text-sm">
//                         <thead>
//                           <tr className="border-b border-gray-100 bg-gray-50/50">
//                             <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Filename</th>
//                             <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
//                             <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Matched Student</th>
//                             <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Reason / Status</th>
//                             <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Result</th>
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {filteredResults?.map((r, i) => {
//                             const cfg = r.failureReason
//                               ? FAILURE_LABELS[r.failureReason] || FAILURE_LABELS.unknown
//                               : null;

//                             return (
//                               <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
//                                 <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap max-w-[160px] truncate" title={r.fileName}>
//                                   {r.fileName}
//                                 </td>
//                                 <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">
//                                   {r.barcode || <span className="text-rose-400">—</span>}
//                                 </td>
//                                 <td className="py-3 px-4 whitespace-nowrap">
//                                   {r.linked ? (
//                                     <span className="text-gray-700">
//                                       {r.studentName}
//                                       <span className="text-gray-400 ml-1.5 text-xs">Roll {r.studentRoll}</span>
//                                     </span>
//                                   ) : r.studentName ? (
//                                     <span className="text-gray-500 text-xs">
//                                       {r.studentName}
//                                       {r.studentRoll && <span className="text-gray-400 ml-1">({r.studentRoll})</span>}
//                                     </span>
//                                   ) : (
//                                     <span className="text-gray-300 text-xs">—</span>
//                                   )}
//                                 </td>
//                                 <td className="py-3 px-4 whitespace-nowrap">
//                                   {r.linked ? (
//                                     <span className="text-emerald-600 text-xs">Linked successfully</span>
//                                   ) : cfg ? (
//                                     <div>
//                                       <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
//                                       {r.failureReason === 'subject_mismatch' && r.studentSubject && (
//                                         <p className="text-[11px] text-gray-400 mt-0.5">
//                                           Student: <span className="text-amber-600">{r.studentSubject}</span>
//                                           {' → '}
//                                           Exam: <span className="text-gray-600">{r.examSubject}</span>
//                                         </p>
//                                       )}
//                                     </div>
//                                   ) : null}
//                                 </td>
//                                 <td className="py-3 px-4 text-center">
//                                   {r.linked ? (
//                                     <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
//                                       <i className="ri-check-line text-[10px]" /> Linked
//                                     </span>
//                                   ) : cfg ? (
//                                     <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
//                                       <i className={`${cfg.icon} text-[10px]`} />
//                                       {cfg.label}
//                                     </span>
//                                   ) : null}
//                                 </td>
//                               </tr>
//                             );
//                           })}
//                         </tbody>
//                       </table>
//                       {filteredResults?.length === 0 && (
//                         <p className="text-sm text-gray-400 text-center py-6">No results to show</p>
//                       )}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* ─── LINKING TAB ─── */}
//             {activeTab === 'linking' && (
//               <div className="p-6 space-y-5">
//                 {/* Stats */}
//                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//                   {[
//                     { label: 'Total Students', value: linkStats.total, color: 'gray' },
//                     { label: 'Sheets Uploaded', value: linkStats.uploaded, color: 'emerald' },
//                     { label: 'Linked', value: linkStats.linked, color: 'sky' },
//                     { label: 'Pending Upload', value: linkStats.pending, color: 'amber' },
//                   ].map(({ label, value, color }) => (
//                     <div key={label} className={`bg-${color}-50 rounded-xl p-4 text-center`}>
//                       <p className={`text-2xl font-bold text-${color}-${color === 'gray' ? '900' : '700'}`}>{value}</p>
//                       <p className={`text-xs text-${color}-${color === 'gray' ? '500' : '600'} mt-0.5`}>{label}</p>
//                     </div>
//                   ))}
//                 </div>

//                 {/* ✅ Progress bar */}
//                 {linkStats.total > 0 && (
//                   <div className="bg-white rounded-xl border border-gray-100 p-4">
//                     <div className="flex items-center justify-between mb-2">
//                       <span className="text-xs font-medium text-gray-600">Linking Progress</span>
//                       <span className="text-xs text-gray-500">
//                         {linkStats.linked} / {linkStats.total} students linked
//                       </span>
//                     </div>
//                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
//                       <div
//                         className="h-full bg-emerald-500 rounded-full transition-all duration-500"
//                         style={{ width: `${Math.round((linkStats.linked / linkStats.total) * 100)}%` }}
//                       />
//                     </div>
//                     <p className="text-xs text-gray-400 mt-1.5">
//                       {Math.round((linkStats.linked / linkStats.total) * 100)}% complete
//                       {linkStats.pending > 0 && (
//                         <span className="text-amber-500 ml-2">· {linkStats.pending} students still need sheets</span>
//                       )}
//                     </p>
//                   </div>
//                 )}

//                 {/* Student table */}
//                 {sheetsLoading ? (
//                   <div className="flex items-center justify-center py-8">
//                     <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
//                   </div>
//                 ) : linkingStatus.length === 0 ? (
//                   <EmptyState
//                     icon="ri-user-search-line"
//                     title="No students found"
//                     description="Upload master student data first from the Student Data page."
//                     actionLabel="Go to Student Data"
//                     onAction={() => navigate('/admin/student-data')}
//                   />
//                 ) : (
//                   <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
//                     <div className="overflow-x-auto">
//                       <table className="w-full text-sm">
//                         <thead>
//                           <tr className="border-b border-gray-100 bg-gray-50/50">
//                             {['Roll No', 'Student Name', 'Barcode', 'Sheet Uploaded', 'Linked', 'Action'].map((h, i) => (
//                               <th
//                                 key={h}
//                                 className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${
//                                   i >= 3 ? 'text-center' : 'text-left'
//                                 }`}
//                               >
//                                 {h}
//                               </th>
//                             ))}
//                           </tr>
//                         </thead>
//                         <tbody>
//                           {linkingStatus.map((student) => {
//                             const isLinked = student.is_linked;
//                             const hasSheet = student.sheet_id !== null;
//                             const isPending = student.sheet_status !== 'uploaded' && student.sheet_status !== 'linked';

//                             return (
//                               <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
//                                 <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{student.roll_no}</td>
//                                 <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{student.student_name}</td>
//                                 <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{student.barcode}</td>
//                                 <td className="py-3 px-4 text-center">
//                                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
//                                     hasSheet ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
//                                   }`}>
//                                     {hasSheet ? 'Yes' : 'No'}
//                                   </span>
//                                 </td>
//                                 <td className="py-3 px-4 text-center">
//                                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
//                                     isLinked ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
//                                   }`}>
//                                     {isLinked ? 'Yes' : 'No'}
//                                   </span>
//                                 </td>
//                                 <td className="py-3 px-4 text-center">
//                                   {!isLinked && isPending && unlinkedSheets.length > 0 ? (
//                                     <div className="relative inline-block">
//                                       <button
//                                         onClick={() => setManualLinkOpen(manualLinkOpen === student.id ? null : student.id)}
//                                         disabled={isManualLinking}
//                                         className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
//                                       >
//                                         <i className="ri-link text-xs" />
//                                         Manual Link
//                                       </button>
//                                       {manualLinkOpen === student.id && (
//                                         <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[260px]">
//                                           <p className="text-xs text-gray-500 px-2 py-1.5 border-b border-gray-100">
//                                             Select a sheet to link:
//                                             <span className="block text-[10px] text-gray-400">({unlinkedSheets.length} available)</span>
//                                           </p>
//                                           <div className="space-y-0.5 max-h-48 overflow-y-auto pt-1">
//                                             {unlinkedSheets.map((sheet) => (
//                                               <button
//                                                 key={sheet.id}
//                                                 onClick={() => handleManualLink(student.id, sheet.id)}
//                                                 className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
//                                               >
//                                                 <span>
//                                                   <span className="font-medium">{sheet.file_name}</span>
//                                                   <span className="text-gray-400 ml-2">({sheet.barcode || 'No barcode'})</span>
//                                                 </span>
//                                                 <span className="text-[10px] text-gray-400">#{sheet.id}</span>
//                                               </button>
//                                             ))}
//                                           </div>
//                                           <div className="border-t border-gray-100 pt-1 mt-1">
//                                             <button
//                                               onClick={() => setManualLinkOpen(null)}
//                                               className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1"
//                                             >
//                                               Cancel
//                                             </button>
//                                           </div>
//                                         </div>
//                                       )}
//                                     </div>
//                                   ) : !isLinked ? (
//                                     <span className="text-xs text-gray-400">No sheets available</span>
//                                   ) : (
//                                     <span className="text-xs text-gray-400">—</span>
//                                   )}
//                                 </td>
//                               </tr>
//                             );
//                           })}
//                         </tbody>
//                       </table>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* All Uploaded Sheets */}
//           <div className="bg-white rounded-2xl overflow-hidden">
//             <div className="px-6 py-4 border-b border-gray-100">
//               <h4 className="text-sm font-semibold text-gray-900">
//                 All Uploaded Sheets
//                 <span className="text-gray-400 font-normal ml-2">({sheets.length})</span>
//               </h4>
//             </div>
//             <div className="overflow-x-auto">
//               {sheets.length === 0 ? (
//                 <EmptyState
//                   icon="ri-file-copy-2-line"
//                   title="No sheets uploaded yet"
//                   description="Upload scanned answer sheets using the Upload Sheets tab above."
//                 />
//               ) : (
//                 <table className="w-full text-sm">
//                   <thead>
//                     <tr className="border-b border-gray-100 bg-gray-50/50">
//                       {['Sheet ID', 'Roll No', 'Student Name', 'Barcode', 'Status', 'Marks'].map((h, i) => (
//                         <th
//                           key={h}
//                           className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${
//                             i === 5 ? 'text-center' : 'text-left'
//                           }`}
//                         >
//                           {h}
//                         </th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {sheets.map((sheet) => (
//                       <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
//                         <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">#{sheet.id}</td>
//                         <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{sheet.roll_no || '—'}</td>
//                         <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{sheet.student_name || 'Unknown'}</td>
//                         <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{sheet.barcode || '—'}</td>
//                         <td className="py-3 px-4"><StatusBadge status={sheet.status} /></td>
//                         <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
//                           {sheet.marks !== undefined && sheet.marks !== null ? sheet.marks : '—'}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               )}
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }



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

type FailureReason =
  | 'subject_mismatch'
  | 'barcode_not_found'
  | 'already_linked'
  | 'invalid_barcode'
  | 'duplicate_upload'
  | 'unknown';

interface LinkingResult {
  fileName: string;
  barcode: string | null;
  studentName: string | null;
  studentRoll: string | null;
  linked: boolean;
  alreadyLinked?: boolean;
  sheetId?: number;
  failureReason?: FailureReason;
  studentSubject?: string;
  examSubject?: string;
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

interface SubjectMismatch {
  filename: string;
  barcode: string;
  student_name: string;
  roll_no: string;
  student_subject: string;
  exam_subject: string;
  message: string;
}

const FAILURE_LABELS: Record<FailureReason, { label: string; color: string; bg: string; icon: string; tip: string }> = {
  subject_mismatch: {
    label: 'Subject Mismatch',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: 'ri-book-line',
    tip: "Student's subject in master data doesn't match this exam's subject.",
  },
  barcode_not_found: {
    label: 'Barcode Not Found',
    color: 'text-rose-700',
    bg: 'bg-rose-100',
    icon: 'ri-barcode-line',
    tip: 'No student in master data has this barcode. Check barcode or re-upload master data.',
  },
  already_linked: {
    label: 'Already Linked',
    color: 'text-sky-700',
    bg: 'bg-sky-100',
    icon: 'ri-link',
    tip: 'This sheet was already linked to a student in a previous upload.',
  },
  invalid_barcode: {
    label: 'Invalid Barcode',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    icon: 'ri-error-warning-line',
    tip: 'File name does not follow the BAR#### naming format. Rename the file.',
  },
  duplicate_upload: {
    label: 'Duplicate Upload',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: 'ri-file-copy-line',
    tip: 'This file was already uploaded for this exam.',
  },
  unknown: {
    label: 'Unknown Error',
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    icon: 'ri-question-line',
    tip: 'An unexpected error occurred. Try again or contact support.',
  },
};

export default function SheetUpload() {
  const loading = usePageLoading();
  const navigate = useNavigate();

  const [exams, setExams] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<string>('');

  const [sheets, setSheets] = useState<ISheet[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(false);

  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'linking'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [linkingResults, setLinkingResults] = useState<LinkingResult[] | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [subjectMismatch, setSubjectMismatch] = useState<SubjectMismatch[]>([]);

  const [linkingStatus, setLinkingStatus] = useState<StudentLinkingStatus[]>([]);
  const [linkStats, setLinkStats] = useState({ total: 0, uploaded: 0, linked: 0, pending: 0 });
  const [unlinkedSheets, setUnlinkedSheets] = useState<any[]>([]);
  const [manualLinkOpen, setManualLinkOpen] = useState<number | null>(null);
  const [isManualLinking, setIsManualLinking] = useState(false);

  const [resultFilter, setResultFilter] = useState<'all' | 'linked' | 'failed'>('all');

  // ✅ NEW: Multi-delete state
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Chunked Upload Progress State (100 files per chunk)
  const [uploadProgressModal, setUploadProgressModal] = useState<{
    open: boolean;
    isUploading: boolean;
    currentChunk: number;
    totalChunks: number;
    totalFiles: number;
    uploadedCount: number;
    progressText: string;
    cancelRequested: boolean;
  }>({
    open: false,
    isUploading: false,
    currentChunk: 0,
    totalChunks: 0,
    totalFiles: 0,
    uploadedCount: 0,
    progressText: '',
    cancelRequested: false,
  });

  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ─── FETCH ───────────────────────────────────────────────────

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExams(res.data);
      } catch {
        showToast('Failed to load exams', 'error');
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  const fetchSheets = useCallback(async (examId: string) => {
    if (!examId) return;
    setSheetsLoading(true);
    try {
      const response = await sheetService.getSheetsByExam(examId);
      if (response.success) {
        setSheets(response.data.sheets || []);
        setSelectedSheetIds(new Set()); // ✅ clear selection on refresh
      }
    } catch (error) {
      console.error('Failed to fetch sheets:', error);
    } finally {
      setSheetsLoading(false);
    }
  }, []);

  const fetchLinkingStatus = useCallback(async (examId: string) => {
    if (!examId) return;
    try {
      const response = await sheetService.getStudentLinkingStatus(examId);
      if (response.success) {
        setLinkingStatus(response.data.students || []);
        setLinkStats(response.data.stats || { total: 0, uploaded: 0, linked: 0, pending: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch linking status:', error);
    }
  }, []);

  const fetchUnlinkedSheets = useCallback(async (examId: string) => {
    if (!examId) return;
    try {
      const response = await sheetService.getUnlinkedSheets(examId);
      if (response.success) setUnlinkedSheets(response.data || []);
    } catch (error) {
      console.error('Failed to fetch unlinked sheets:', error);
    }
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchSheets(selectedExam);
      fetchLinkingStatus(selectedExam);
      fetchUnlinkedSheets(selectedExam);
    }
  }, [selectedExam, fetchSheets, fetchLinkingStatus, fetchUnlinkedSheets]);

  // ─── HANDLERS ────────────────────────────────────────────────

  const resetUploadState = () => {
    setLinkingResults(null);
    setSubjectMismatch([]);
    setResultFilter('all');
  };

  const handleExamChange = (val: string) => {
    setSelectedExam(val);
    setUploadedFiles([]);
    setManualLinkOpen(null);
    setSelectedSheetIds(new Set());
    resetUploadState();
  };

  const handleFileUpload = (files: File[]) => {
    if (!selectedExam) {
      showToast('Please select an exam first', 'error');
      return;
    }
    const newFiles: UploadedFile[] = files.map((file) => {
      const barcodeMatch = file.name.match(/^(BAR\d+)\./i);
      return { name: file.name, barcode: barcodeMatch ? barcodeMatch[1] : null, file };
    });
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    resetUploadState();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files);
  };

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFileUpload(files);
    e.target.value = '';
  };

  // ─── AUTO-LINK & CHUNKED UPLOAD (100 SHEETS PER CHUNK) ───────

  const handleAutoLink = async () => {
    if (!selectedExam || uploadedFiles.length === 0) return;
    setIsLinking(true);
    setSubjectMismatch([]);

    const allFiles = uploadedFiles.map((f) => f.file!).filter(Boolean);
    const CHUNK_SIZE = 100;
    const totalFiles = allFiles.length;
    const totalChunks = Math.ceil(totalFiles / CHUNK_SIZE);

    setUploadProgressModal({
      open: true,
      isUploading: true,
      currentChunk: 1,
      totalChunks,
      totalFiles,
      uploadedCount: 0,
      progressText: `Preparing to upload ${totalFiles} sheets in ${totalChunks} chunk(s)...`,
      cancelRequested: false,
    });

    const allResults: LinkingResult[] = [];
    const allMismatches: SubjectMismatch[] = [];

    try {
      for (let c = 0; c < totalChunks; c++) {
        let cancelState = false;
        const startIdx = c * CHUNK_SIZE;
        const chunkFiles = allFiles.slice(startIdx, startIdx + CHUNK_SIZE);
        const endNum = Math.min((c + 1) * CHUNK_SIZE, totalFiles);

        setUploadProgressModal((prev) => {
          if (prev.cancelRequested) cancelState = true;
          return {
            ...prev,
            currentChunk: c + 1,
            progressText: `Uploading Chunk ${c + 1} of ${totalChunks} (Sheets ${startIdx + 1} - ${endNum} of ${totalFiles})...`,
          };
        });

        if (cancelState) {
          showToast('Upload cancelled by user', 'error');
          break;
        }

        const uploadResponse = await sheetService.uploadSheets(selectedExam, chunkFiles);

        if (!uploadResponse.success) {
          showToast(`Chunk ${c + 1} failed: ${uploadResponse.message || 'Failed to upload'}`, 'error');
          continue;
        }

        const uploadedSheets = uploadResponse.data.sheets || [];
        const duplicates: any[] = uploadResponse.data.duplicates || [];
        const invalidFiles: any[] = uploadResponse.data.invalidFiles || [];
        const mismatchFiles: SubjectMismatch[] = uploadResponse.data.subjectMismatch || [];

        if (mismatchFiles.length > 0) {
          allMismatches.push(...mismatchFiles);
        }

        invalidFiles.forEach((f: any) => {
          allResults.push({
            fileName: f.filename,
            barcode: null,
            studentName: null,
            studentRoll: null,
            linked: false,
            failureReason: 'invalid_barcode',
          });
        });

        duplicates.forEach((f: any) => {
          allResults.push({
            fileName: f.filename,
            barcode: f.barcode || null,
            studentName: f.student_name || null,
            studentRoll: f.roll_no || null,
            linked: false,
            alreadyLinked: true,
            failureReason: 'duplicate_upload',
          });
        });

        mismatchFiles.forEach((f) => {
          allResults.push({
            fileName: f.filename,
            barcode: f.barcode,
            studentName: f.student_name,
            studentRoll: f.roll_no,
            linked: false,
            failureReason: 'subject_mismatch',
            studentSubject: f.student_subject,
            examSubject: f.exam_subject,
          });
        });

        if (uploadedSheets.length > 0) {
          const sheetIds = uploadedSheets.map((s: any) => s.id);
          const linkResponse = await sheetService.autoLinkSheets(selectedExam, sheetIds);

          if (linkResponse.success) {
            const results = linkResponse.data.results || [];
            uploadedSheets.forEach((sheet: any) => {
              const matchedFile = uploadedFiles.find((f) => f.barcode === sheet.barcode);
              const result = results.find((r: any) => r.barcode === sheet.barcode);
              if (result?.matched) {
                allResults.push({
                  fileName: matchedFile?.name || sheet.file_name,
                  barcode: sheet.barcode,
                  studentName: result.student?.student_name || null,
                  studentRoll: result.student?.roll_no || null,
                  linked: true,
                  sheetId: sheet.id,
                });
              } else {
                allResults.push({
                  fileName: matchedFile?.name || sheet.file_name,
                  barcode: sheet.barcode,
                  studentName: null,
                  studentRoll: null,
                  linked: false,
                  sheetId: sheet.id,
                  failureReason: 'barcode_not_found',
                });
              }
            });
          }
        }

        // Update progress state after chunk finishes
        setUploadProgressModal((prev) => ({
          ...prev,
          uploadedCount: endNum,
          progressText: `Uploaded ${endNum} of ${totalFiles} sheets (Chunk ${c + 1} of ${totalChunks} complete)`,
        }));

        if (c < totalChunks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (allMismatches.length > 0) setSubjectMismatch(allMismatches);
      setLinkingResults(allResults);

      const lc = allResults.filter((r) => r.linked).length;
      const fc = allResults.filter((r) => !r.linked).length;

      if (lc > 0 && fc === 0) showToast(`✅ All ${lc} sheet(s) uploaded & linked successfully`, 'success');
      else if (lc > 0) showToast(`${lc} linked, ${fc} failed — see results below`, 'success');
      else showToast('No sheets linked — check errors below', 'error');

      if (fc > 0) setResultFilter('failed');
      else setResultFilter('linked');

      await fetchSheets(selectedExam);
      await fetchLinkingStatus(selectedExam);
      await fetchUnlinkedSheets(selectedExam);
    } catch (error: any) {
      console.error('Auto-link error:', error);
      showToast(error.message || 'Failed to process sheet upload', 'error');
    } finally {
      setIsLinking(false);
      setUploadProgressModal({
        open: false,
        isUploading: false,
        currentChunk: 0,
        totalChunks: 0,
        totalFiles: 0,
        uploadedCount: 0,
        progressText: '',
        cancelRequested: false,
      });
    }
  };

  // ─── CONFIRM ─────────────────────────────────────────────────

  const handleConfirmUpload = async () => {
    if (!linkingResults || !selectedExam) return;
    const linked = linkingResults.filter((r) => r.linked);
    if (linked.length === 0) { showToast('No sheets to confirm', 'error'); return; }

    try {
      const sheetIds = linked.map((r) => r.sheetId).filter((id): id is number => id !== undefined);
      for (const sheetId of sheetIds) {
        await sheetService.updateSheet(sheetId, { status: 'linked' });
      }
      showToast(`${linked.length} sheets confirmed and linked`, 'success');
      setUploadedFiles([]);
      resetUploadState();
      await fetchSheets(selectedExam);
      await fetchLinkingStatus(selectedExam);
      await fetchUnlinkedSheets(selectedExam);
    } catch (error: any) {
      showToast(error.message || 'Failed to confirm upload', 'error');
    }
  };

  // ─── MANUAL LINK ─────────────────────────────────────────────

  const handleManualLink = async (studentId: number, sheetId: number) => {
    if (!selectedExam) return;
    setIsManualLinking(true);
    try {
      const response = await sheetService.manualLinkStudent(selectedExam, studentId, sheetId);
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
      showToast(error.message || 'Failed to link student', 'error');
    } finally {
      setIsManualLinking(false);
    }
  };

  // ─── ✅ MULTI-DELETE HANDLERS ─────────────────────────────────

  const handleSelectSheet = (id: number) => {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedSheetIds.size === sheets.length) {
      setSelectedSheetIds(new Set());
    } else {
      const sheetsFilter = sheets.filter((sheet) => sheet?.status === 'linked' || sheet?.status === 'unlinked')
      setSelectedSheetIds(new Set(sheetsFilter.map((s) => s.id as number)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSheetIds.size === 0 || !selectedExam) return;

    const confirmDelete = window.confirm(
      `Delete ${selectedSheetIds.size} sheet(s)? This cannot be undone.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const ids = Array.from(selectedSheetIds);
      // ✅ Delete all selected sheets — parallel for speed
      await Promise.all(ids.map((id) => sheetService.deleteSheet(id)));
      showToast(`${ids.length} sheet(s) deleted successfully`, 'success');
      setSelectedSheetIds(new Set());
      await fetchSheets(selectedExam);
      await fetchLinkingStatus(selectedExam);
      await fetchUnlinkedSheets(selectedExam);
    } catch (error: any) {
      showToast(error.message || 'Failed to delete sheets', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── DERIVED STATE ────────────────────────────────────────────

  const activeExams = exams.filter((e) => e.status === 'active');
  const selectedExamData = exams.find((e) => e.id === selectedExam) || null;

  const linkedCount = linkingResults?.filter((r) => r.linked).length ?? 0;
  const failedCount = linkingResults?.filter((r) => !r.linked).length ?? 0;
  const totalCount = linkingResults?.length ?? 0;

  const failureBreakdown = linkingResults
    ? Object.entries(
      linkingResults
        .filter((r) => !r.linked)
        .reduce<Record<string, number>>((acc, r) => {
          const key = r.failureReason || 'unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
    )
    : [];

  const filteredResults = linkingResults?.filter((r) => {
    if (resultFilter === 'linked') return r.linked;
    if (resultFilter === 'failed') return !r.linked;
    return true;
  });

  const allSelected = sheets.length > 0 && selectedSheetIds.size === sheets.length;
  const someSelected = selectedSheetIds.size > 0 && !allSelected;

  if (loading || examsLoading) return <LoadingSpinner fullPage />;
  console.log("sheets===>sheets===>", sheets)
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Sheet Upload' }]} />

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 max-w-md ${toastMsg.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <i className={toastMsg.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'} />
          {toastMsg.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sheet Upload</h3>
          <p className="text-sm text-gray-500 mt-0.5">Upload scanned answer sheets for an exam</p>
        </div>
      </div>

      {/* Select Exam */}
      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
        <select
          value={selectedExam}
          onChange={(e) => handleExamChange(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
        >
          <option value="">Choose an active exam...</option>
          {activeExams.map((exam) => (
            <option key={exam.id} value={exam.id}>{exam.name} ({exam.subject})</option>
          ))}
        </select>
      </div>

      {selectedExam && selectedExamData && (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['upload', 'linking'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${activeTab === tab ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <i className={`${tab === 'upload' ? 'ri-upload-cloud-2-line' : 'ri-link'} mr-1.5`} />
                  {tab === 'upload' ? 'Upload Sheets' : 'Student Linking'}
                </button>
              ))}
            </div>

            {/* ─── UPLOAD TAB ─── */}
            {activeTab === 'upload' && (
              <div className="p-6 space-y-5">
                {/* Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-upload-cloud-2-line text-2xl text-gray-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Drag & drop scanned sheets here</h4>
                  <p className="text-xs text-gray-400 mb-4">
                    PDF, JPG, PNG — up to 25MB per file. Name files as <code className="bg-gray-100 px-1 rounded">BAR001.pdf</code>
                  </p>
                  <label className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap">
                    <i className="ri-folder-open-line" />
                    Browse Files
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={handleBrowse} />
                  </label>
                </div>

                {/* Selected Files */}
                {uploadedFiles.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Selected Files <span className="text-gray-400 font-normal">({uploadedFiles.length})</span>
                      </h4>
                      <button onClick={() => { setUploadedFiles([]); resetUploadState(); }} className="text-xs text-gray-400 hover:text-rose-600 transition-colors cursor-pointer">
                        Clear All
                      </button>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="px-5 py-2.5 flex items-center gap-3 group">
                          <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <i className="ri-file-pdf-line text-rose-500 text-sm" />
                          </span>
                          <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                          {file.barcode ? (
                            <span className="text-xs text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded">{file.barcode}</span>
                          ) : (
                            <span className="text-xs text-rose-500 bg-rose-50 px-2 py-0.5 rounded">No barcode</span>
                          )}
                          <button
                            onClick={() => { setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i)); resetUploadState(); }}
                            className="text-gray-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <i className="ri-close-line text-sm" />
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
                          <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />Linking...</>
                        ) : (
                          <><i className="ri-link text-sm" />Auto-link by Barcode</>
                        )}
                      </button>
                      {linkingResults && linkedCount > 0 && (
                        <button
                          onClick={handleConfirmUpload}
                          className="inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-check-line text-sm" />Confirm Upload ({linkedCount})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Linking Results */}
                {linkingResults && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Linking Results</h4>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-gray-900">{totalCount}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Total Files</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-emerald-700">{linkedCount}</p>
                          <p className="text-xs text-emerald-600 mt-0.5">Linked ✓</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-rose-700">{failedCount}</p>
                          <p className="text-xs text-rose-600 mt-0.5">Failed ✗</p>
                        </div>
                      </div>

                      {failureBreakdown.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Why did they fail?</p>
                          {failureBreakdown.map(([reason, count]) => {
                            const cfg = FAILURE_LABELS[reason as FailureReason] || FAILURE_LABELS.unknown;
                            return (
                              <div key={reason} className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${cfg.bg}`}>
                                <i className={`${cfg.icon} ${cfg.color} text-sm mt-0.5 shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label} — {count} file{count > 1 ? 's' : ''}</span>
                                  <p className="text-xs text-gray-500 mt-0.5">{cfg.tip}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                        {([
                          { key: 'all', label: `All (${totalCount})` },
                          { key: 'linked', label: `Linked (${linkedCount})` },
                          { key: 'failed', label: `Failed (${failedCount})` },
                        ] as const).map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => setResultFilter(key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${resultFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Filename</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Matched Student</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Reason / Status</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredResults?.map((r, i) => {
                            const cfg = r.failureReason ? FAILURE_LABELS[r.failureReason] || FAILURE_LABELS.unknown : null;
                            return (
                              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap max-w-[160px] truncate" title={r.fileName}>{r.fileName}</td>
                                <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">{r.barcode || <span className="text-rose-400">—</span>}</td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {r.linked ? (
                                    <span className="text-gray-700">{r.studentName}<span className="text-gray-400 ml-1.5 text-xs">Roll {r.studentRoll}</span></span>
                                  ) : r.studentName ? (
                                    <span className="text-gray-500 text-xs">{r.studentName}{r.studentRoll && <span className="text-gray-400 ml-1">({r.studentRoll})</span>}</span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {r.linked ? (
                                    <span className="text-emerald-600 text-xs">Linked successfully</span>
                                  ) : cfg ? (
                                    <div>
                                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                                      {r.failureReason === 'subject_mismatch' && r.studentSubject && (
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                          Student: <span className="text-amber-600">{r.studentSubject}</span>{' → '}Exam: <span className="text-gray-600">{r.examSubject}</span>
                                        </p>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {r.linked ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                      <i className="ri-check-line text-[10px]" />Linked
                                    </span>
                                  ) : cfg ? (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                                      <i className={`${cfg.icon} text-[10px]`} />{cfg.label}
                                    </span>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredResults?.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-6">No results to show</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── LINKING TAB ─── */}
            {activeTab === 'linking' && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Students', value: linkStats.total, color: 'gray' },
                    { label: 'Sheets Uploaded', value: linkStats.uploaded, color: 'emerald' },
                    { label: 'Linked', value: linkStats.linked, color: 'sky' },
                    { label: 'Pending Upload', value: linkStats.pending, color: 'amber' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-${color}-50 rounded-xl p-4 text-center`}>
                      <p className={`text-2xl font-bold text-${color}-${color === 'gray' ? '900' : '700'}`}>{value}</p>
                      <p className={`text-xs text-${color}-${color === 'gray' ? '500' : '600'} mt-0.5`}>{label}</p>
                    </div>
                  ))}
                </div>

                {linkStats.total > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Linking Progress</span>
                      <span className="text-xs text-gray-500">{linkStats.linked} / {linkStats.total} students linked</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.round((linkStats.linked / linkStats.total) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {Math.round((linkStats.linked / linkStats.total) * 100)}% complete
                      {linkStats.pending > 0 && <span className="text-amber-500 ml-2">· {linkStats.pending} students still need sheets</span>}
                    </p>
                  </div>
                )}

                {sheetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                  </div>
                ) : linkingStatus.length === 0 ? (
                  <EmptyState icon="ri-user-search-line" title="No students found" description="Upload master student data first from the Student Data page." actionLabel="Go to Student Data" onAction={() => navigate('/admin/student-data')} />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            {['Roll No', 'Student Name', 'Barcode', 'Sheet Uploaded', 'Linked', 'Action'].map((h, i) => (
                              <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${i >= 3 ? 'text-center' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {linkingStatus.map((student) => {
                            const isLinked = student.is_linked;
                            const hasSheet = student.sheet_id !== null;
                            // ✅ FIX: was inverted — student needs manual link if NOT linked and has no sheet
                            const canManualLink = !isLinked && unlinkedSheets.length > 0;

                            return (
                              <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{student.roll_no}</td>
                                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{student.student_name}</td>
                                <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{student.barcode}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hasSheet ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {hasSheet ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isLinked ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {isLinked ? 'Yes' : 'No'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {canManualLink ? (
                                    <div className="relative inline-block">
                                      <button
                                        onClick={() => setManualLinkOpen(manualLinkOpen === student.id ? null : student.id)}
                                        disabled={isManualLinking}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                                      >
                                        <i className="ri-link text-xs" />Manual Link
                                      </button>
                                      {manualLinkOpen === student.id && (
                                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[260px]">
                                          <p className="text-xs text-gray-500 px-2 py-1.5 border-b border-gray-100">
                                            Select a sheet to link:
                                            <span className="block text-[10px] text-gray-400">({unlinkedSheets.length} available)</span>
                                          </p>
                                          <div className="space-y-0.5 max-h-48 overflow-y-auto pt-1">
                                            {unlinkedSheets.map((sheet) => (
                                              <button key={sheet.id} onClick={() => handleManualLink(student.id, sheet.id)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer flex items-center justify-between">
                                                <span>
                                                  <span className="font-medium">{sheet.file_name}</span>
                                                  <span className="text-gray-400 ml-2">({sheet.barcode || 'No barcode'})</span>
                                                </span>
                                                <span className="text-[10px] text-gray-400">#{sheet.id}</span>
                                              </button>
                                            ))}
                                          </div>
                                          <div className="border-t border-gray-100 pt-1 mt-1">
                                            <button onClick={() => setManualLinkOpen(null)} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">Cancel</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : !isLinked ? (
                                    <span className="text-xs text-gray-400">No sheets available</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
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

          {/* ─── ALL UPLOADED SHEETS — with multi-delete ─── */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">
                All Uploaded Sheets
                <span className="text-gray-400 font-normal ml-2">({sheets.length})</span>
              </h4>
              {/* ✅ Delete button — appears only when items selected */}
              {selectedSheetIds.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <><span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin inline-block" />Deleting...</>
                  ) : (
                    <><i className="ri-delete-bin-line text-xs" />Delete Selected ({selectedSheetIds.size})</>
                  )}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              {sheets.length === 0 ? (
                <EmptyState icon="ri-file-copy-2-line" title="No sheets uploaded yet" description="Upload scanned answer sheets using the Upload Sheets tab above." />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {/* ✅ Select all checkbox */}
                      <th className="py-3 px-4 w-10">
                        <div
                          onClick={handleSelectAll}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${allSelected ? 'bg-gray-900 border-gray-900' : someSelected ? 'bg-gray-200 border-gray-400' : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          {allSelected && <i className="ri-check-line text-white text-[10px]" />}
                          {someSelected && <span className="w-1.5 h-0.5 bg-gray-600 rounded-full" />}
                        </div>
                      </th>
                      {['Sheet ID', 'Roll No', 'Student Name', 'Barcode', 'Status', 'Marks'].map((h, i) => (
                        <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap ${i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheets.map((sheet) => {
                      const sheetId = sheet.id as number;
                      const isSelected = selectedSheetIds.has(sheetId);
                      return (
                        <tr
                          key={sheetId}
                          className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50/30'}`}
                        >
                          {/* ✅ Row checkbox */}
                          {sheet?.status === 'linked' || sheet?.status === 'unlinked' ? <td className="py-3 px-4">
                            <div
                              onClick={() => handleSelectSheet(sheetId)}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300 hover:border-gray-400'
                                }`}
                            >
                              {isSelected && <i className="ri-check-line text-white text-[10px]" />}
                            </div>
                          </td> : <td className="py-3 px-4">
                            <div

                            >
                              -
                            </div>
                          </td>}
                          <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">#{sheet.id}</td>
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{sheet.roll_no || '—'}</td>
                          <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{sheet.student_name || 'Unknown'}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{sheet.barcode || '—'}</td>
                          <td className="py-3 px-4"><StatusBadge status={sheet.status} /></td>
                          <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                            {sheet.marks !== undefined && sheet.marks !== null ? sheet.marks : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── UPLOAD PROGRESS MODAL (CHUNKS OF 100) ─── */}
      {uploadProgressModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xl flex-shrink-0">
                <i className="ri-upload-cloud-2-line text-2xl animate-bounce"></i>
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900">
                  Uploading Answer Sheets
                </h4>
                <p className="text-xs text-gray-500">
                  Chunk size: 100 sheets per batch
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
                <span>Sheets Uploaded</span>
                <span className="text-blue-600 font-bold text-sm">
                  {uploadProgressModal.uploadedCount} / {uploadProgressModal.totalFiles}
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-1"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        3,
                        Math.round(
                          (uploadProgressModal.uploadedCount /
                            (uploadProgressModal.totalFiles || 1)) *
                            100,
                        ),
                      ),
                    )}%`,
                  }}
                >
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium pt-0.5">
                <span>
                  Chunk {uploadProgressModal.currentChunk} of {uploadProgressModal.totalChunks}
                </span>
                <span>
                  {Math.round(
                    (uploadProgressModal.uploadedCount /
                      (uploadProgressModal.totalFiles || 1)) *
                      100,
                  )}
                  % Complete
                </span>
              </div>

              <p className="text-xs text-gray-600 font-medium italic pt-1.5 border-t border-gray-200/60 mt-1 flex items-center gap-1.5">
                <i className="ri-loader-4-line text-blue-600 animate-spin text-sm flex-shrink-0"></i>
                <span className="truncate">{uploadProgressModal.progressText}</span>
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() =>
                  setUploadProgressModal((prev) => ({
                    ...prev,
                    cancelRequested: true,
                  }))
                }
                className="px-4 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-red-200"
              >
                Cancel Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}