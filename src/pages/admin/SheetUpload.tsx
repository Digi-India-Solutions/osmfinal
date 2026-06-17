import { useState } from "react";
import { exams, sheets, mockMasterStudents, getStatusBadge } from "@/mock/mockData";
import type { SheetStatus } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EmptyState from "@/components/ui/EmptyState";
import { usePageLoading } from "@/hooks/usePageLoading";
import { useNavigate } from "react-router-dom";

interface UploadedFile {
  name: string;
  barcode: string | null;
}

interface LinkingResult {
  fileName: string;
  barcode: string | null;
  studentName: string | null;
  studentRoll: string | null;
  linked: boolean;
}

const MOCK_FILE_NAMES = ["BAR001.pdf", "BAR003.pdf", "BAR999.pdf", "BAR002.pdf", "BAR005.pdf", "BAR006.pdf", "BAR004.pdf"];

export default function SheetUpload() {
  const loading = usePageLoading();
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState<number | "">("");
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<"upload" | "linking">("upload");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [linkingResults, setLinkingResults] = useState<LinkingResult[] | null>(null);
  const [localSheets, setLocalSheets] = useState<typeof sheets>([...sheets]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [manualLinkOpen, setManualLinkOpen] = useState<number | null>(null);

  const activeExams = exams.filter((e) => e.status === "active");
  const selectedExamData = exams.find((e) => e.id === selectedExam) || null;
  const allSheets = localSheets.filter((s) => s.examId === selectedExam);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const showWarning = (msg: string) => {
    setWarningMsg(msg);
    setTimeout(() => setWarningMsg(null), 4000);
  };

  const handleExamChange = (val: string) => {
    const examId = val ? Number(val) : "";
    setSelectedExam(examId);
    setUploadedFiles([]);
    setLinkingResults(null);
    setManualLinkOpen(null);
    setWarningMsg(null);
  };

  const addMockFiles = () => {
    if (!selectedExam) return;
    const existingNames = new Set(uploadedFiles.map((f) => f.name));
    const newFiles: UploadedFile[] = [];
    for (const name of MOCK_FILE_NAMES) {
      if (!existingNames.has(name)) {
        const barcodeMatch = name.match(/^(BAR\d+)\./i);
        newFiles.push({ name, barcode: barcodeMatch ? barcodeMatch[1] : null });
        if (newFiles.length >= 3) break;
      }
    }
    if (newFiles.length === 0) {
      showToast("All mock files already added");
      return;
    }
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    setLinkingResults(null);
    setWarningMsg(null);
  };

  const handleBrowse = () => {
    addMockFiles();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addMockFiles();
  };

  const handleClearFiles = () => {
    setUploadedFiles([]);
    setLinkingResults(null);
    setWarningMsg(null);
  };

  const handleAutoLink = () => {
    if (!selectedExam || uploadedFiles.length === 0) return;
    const masterStudents = mockMasterStudents.filter((s) => s.examId === selectedExam);

    const results: LinkingResult[] = uploadedFiles.map((file) => {
      if (!file.barcode) {
        return { fileName: file.name, barcode: null, studentName: null, studentRoll: null, linked: false };
      }
      const match = masterStudents.find((ms) => ms.barcode === file.barcode);
      if (match) {
        return { fileName: file.name, barcode: file.barcode, studentName: match.name, studentRoll: match.rollNo, linked: true };
      }
      return { fileName: file.name, barcode: file.barcode, studentName: null, studentRoll: null, linked: false };
    });

    setLinkingResults(results);
  };

  const linkedCount = linkingResults ? linkingResults.filter((r) => r.linked).length : 0;
  const totalCount = linkingResults ? linkingResults.length : 0;

  const handleConfirmUpload = () => {
    if (!linkingResults || !selectedExamData || !selectedExam) return;

    const linked = linkingResults.filter((r) => r.linked);
    if (linked.length === 0) return;

    let nextSheetId = Math.max(...localSheets.map((s) => s.id), 0) + 1;
    const newSheets: typeof sheets = [];

    linked.forEach((result) => {
      const masterStudent = mockMasterStudents.find(
        (ms) => ms.barcode === result.barcode && ms.examId === selectedExam
      );
      if (masterStudent) {
        const alreadyExists = localSheets.some(
          (s) => s.barcode === result.barcode && s.examId === selectedExam
        );
        if (!alreadyExists) {
          newSheets.push({
            id: nextSheetId++,
            examId: selectedExam as number,
            studentName: masterStudent.name,
            rollNo: masterStudent.rollNo,
            status: "uploaded" as SheetStatus,
            assignedTo: null,
            totalMarks: null,
            barcode: result.barcode!,
          });
        }
      }
    });

    if (newSheets.length > 0) {
      setLocalSheets((prev) => [...prev, ...newSheets]);
    }

    const unlinkedCount = totalCount - linked.length;
    showToast(`${linked.length} sheets uploaded and linked successfully`);

    if (unlinkedCount > 0) {
      showWarning(`${unlinkedCount} file${unlinkedCount > 1 ? "s" : ""} could not be linked — check barcodes`);
    }

    setUploadedFiles([]);
    setLinkingResults(null);
  };

  const getSheetForStudent = (barcode: string) => {
    return allSheets.find((s) => s.barcode === barcode);
  };

  const getUnlinkedSheets = () => {
    const masterBarcodes = new Set(
      mockMasterStudents.filter((ms) => ms.examId === selectedExam).map((ms) => ms.barcode)
    );
    return allSheets.filter((s) => !s.barcode || !masterBarcodes.has(s.barcode));
  };

  const handleManualLink = (studentBarcode: string, sheetId: number) => {
    setLocalSheets((prev) =>
      prev.map((s) => (s.id === sheetId ? { ...s, barcode: studentBarcode } : s))
    );
    setManualLinkOpen(null);
    showToast("Student linked successfully");
  };

  if (loading) return <LoadingSpinner fullPage />;

  const studentsForExam = selectedExam
    ? mockMasterStudents.filter((s) => s.examId === selectedExam)
    : [];

  const studentStats = {
    total: studentsForExam.length,
    uploaded: studentsForExam.filter((s) => allSheets.some((sh) => sh.barcode === s.barcode)).length,
    linked: studentsForExam.filter((s) => {
      const sh = allSheets.find((sh2) => sh2.barcode === s.barcode);
      return sh && sh.barcode === s.barcode;
    }).length,
    pending: studentsForExam.filter((s) => !allSheets.some((sh) => sh.barcode === s.barcode)).length,
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Sheet Upload" }]} />

      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg">
          <span className="w-4 h-4 flex items-center justify-center inline-block mr-2">
            <i className="ri-check-line"></i>
          </span>
          {toastMsg}
        </div>
      )}

      {warningMsg && (
        <div className="fixed top-6 right-6 z-50 bg-amber-600 text-white px-5 py-3 rounded-xl text-sm font-medium shadow-lg" style={{ marginTop: toastMsg ? "60px" : "0" }}>
          <span className="w-4 h-4 flex items-center justify-center inline-block mr-2">
            <i className="ri-error-warning-line"></i>
          </span>
          {warningMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Sheet Upload</h3>
          <p className="text-sm text-gray-500 mt-0.5">Upload scanned answer sheets for an exam</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
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
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab("upload")}
                className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "upload"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                  <i className="ri-upload-cloud-2-line text-sm"></i>
                </span>
                Upload Sheets
              </button>
              <button
                onClick={() => setActiveTab("linking")}
                className={`flex-1 py-3.5 text-sm font-medium text-center transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "linking"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center inline-block mr-1.5">
                  <i className="ri-link text-sm"></i>
                </span>
                Student Linking
              </button>
            </div>

            {activeTab === "upload" && (
              <div className="p-6 space-y-5">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
                    dragOver ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-upload-cloud-2-line text-2xl text-gray-400"></i>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Drag & drop scanned sheets here</h4>
                  <p className="text-xs text-gray-400 mb-4">Supports PDF, JPG, PNG — up to 25MB per file</p>
                  <button
                    onClick={handleBrowse}
                    className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="w-4 h-4 flex items-center justify-center">
                      <i className="ri-folder-open-line text-base"></i>
                    </span>
                    Browse Files
                  </button>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Selected Files
                        <span className="text-gray-400 font-normal ml-2">({uploadedFiles.length})</span>
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleClearFiles}
                          className="text-xs text-gray-400 hover:text-rose-600 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
                            <i className="ri-file-pdf-line text-rose-500 text-sm"></i>
                          </span>
                          <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                          <span className="text-xs text-gray-400">{file.barcode || "Unknown"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center gap-3">
                      <button
                        onClick={handleAutoLink}
                        className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-link text-sm"></i>
                        </span>
                        Auto-link by Barcode
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
                      <h4 className="text-sm font-semibold text-gray-900">Linking Results</h4>
                    </div>
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-emerald-600">{linkedCount}</span> of{" "}
                        <span className="font-semibold text-gray-900">{totalCount}</span> files linked successfully
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Filename</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Matched Student</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkingResults.map((r, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                              <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{r.fileName}</td>
                              <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{r.barcode || "—"}</td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {r.linked ? (
                                  <span className="text-gray-700">{r.studentName} <span className="text-gray-400">Roll {r.studentRoll}</span></span>
                                ) : (
                                  <span className="text-rose-500 text-xs font-medium">No match found</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  r.linked ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                }`}>
                                  {r.linked ? "Linked" : "Unlinked"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "linking" && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{studentStats.total}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Students</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{studentStats.uploaded}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Sheets Uploaded</p>
                  </div>
                  <div className="bg-sky-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-sky-700">{studentStats.linked}</p>
                    <p className="text-xs text-sky-600 mt-0.5">Linked</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{studentStats.pending}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Pending Upload</p>
                  </div>
                </div>

                {studentsForExam.length === 0 ? (
                  <EmptyState
                    icon="ri-user-search-line"
                    title="No students found"
                    description="Upload master student data first from the Student Data page."
                    actionLabel="Go to Student Data"
                    onAction={() => navigate("/admin/student-data")}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sheet Uploaded</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Linked</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsForExam.map((student) => {
                            const matchedSheet = getSheetForStudent(student.barcode);
                            const hasSheet = !!matchedSheet;
                            const isLinked = hasSheet && matchedSheet!.barcode === student.barcode;
                            const unlinkedSheets = getUnlinkedSheets();

                            return (
                              <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                                <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{student.rollNo}</td>
                                <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{student.name}</td>
                                <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{student.barcode}</td>
                                <td className="py-3 px-4 text-center">
                                  {hasSheet ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Yes</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isLinked ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Yes</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {!hasSheet && unlinkedSheets.length > 0 ? (
                                    <div className="relative inline-block">
                                      <button
                                        onClick={() => setManualLinkOpen(manualLinkOpen === student.id ? null : student.id)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                      >
                                        <span className="w-3.5 h-3.5 flex items-center justify-center">
                                          <i className="ri-link text-xs"></i>
                                        </span>
                                        Manual Link
                                      </button>
                                      {manualLinkOpen === student.id && (
                                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[220px]">
                                          <p className="text-xs text-gray-500 px-2 py-1.5">Select a sheet to link:</p>
                                          <div className="space-y-0.5 max-h-40 overflow-y-auto">
                                            {unlinkedSheets.map((sheet) => (
                                              <button
                                                key={sheet.id}
                                                onClick={() => handleManualLink(student.barcode, sheet.id)}
                                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                                              >
                                                Sheet #{sheet.id} — {sheet.studentName} (Roll {sheet.rollNo})
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : !hasSheet ? (
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

          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">
                All Uploaded Sheets
                <span className="text-gray-400 font-normal ml-2">({allSheets.length})</span>
              </h4>
            </div>
            <div className="overflow-x-auto">
              {allSheets.length === 0 ? (
                <EmptyState
                  icon="ri-file-copy-2-line"
                  title="No sheets uploaded yet"
                  description="Upload scanned answer sheets for this exam using the Upload Sheets tab above."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sheet ID</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSheets.map((sheet) => (
                      <tr key={sheet.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">#{sheet.id}</td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{sheet.rollNo}</td>
                        <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{sheet.studentName}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs font-mono whitespace-nowrap">{sheet.barcode || "—"}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={sheet.status} />
                        </td>
                        <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">
                          {sheet.totalMarks !== null ? sheet.totalMarks : "—"}
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