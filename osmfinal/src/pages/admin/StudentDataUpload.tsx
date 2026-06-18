import { useState, useMemo } from "react";
import { mockMasterStudents, exams, sheets, mockSubjects } from "@/mock/mockData";
import type { MasterStudent } from "@/mock/mockData";
import Breadcrumb from "@/components/ui/Breadcrumb";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { usePageLoading } from "@/hooks/usePageLoading";

export default function StudentDataUpload() {
  const loading = usePageLoading();

  const [showFormatModal, setShowFormatModal] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [fileName, setFileName] = useState("");
  const [imported, setImported] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [semesterFilter, setSemesterFilter] = useState("All");
  const [branchFilter, setBranchFilter] = useState("All");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleFileSelect = () => {
    setFileName("semester4_master_data.xlsx");
    setFileSelected(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect();
  };

  const handleImport = () => {
    setImported(true);
    showToast("9 student records imported successfully");
  };

  const handleClear = () => {
    setFileSelected(false);
    setFileName("");
  };

  const records: MasterStudent[] = imported ? mockMasterStudents : [];

  const uniqueSubjects = useMemo(
    () => ["All", ...mockSubjects.map((s) => s.name)],
    []
  );
  const uniqueSemesters = useMemo(
    () => ["All", ...new Set(mockMasterStudents.map((s) => String(s.semester)))],
    []
  );
  const uniqueBranches = useMemo(
    () => ["All", ...new Set(mockMasterStudents.map((s) => s.branch))],
    []
  );

  const filteredRecords = useMemo(() => {
    if (!imported) return [];
    return records.filter((s) => {
      if (subjectFilter !== "All" && s.subject !== subjectFilter) return false;
      if (semesterFilter !== "All" && String(s.semester) !== semesterFilter) return false;
      if (branchFilter !== "All" && s.branch !== branchFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.rollNo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [imported, records, subjectFilter, semesterFilter, branchFilter, searchQuery]);

  const summary = useMemo(() => {
    const total = mockMasterStudents.length;
    const mathCount = mockMasterStudents.filter((s) => s.subject === "Mathematics").length;
    const physicsCount = mockMasterStudents.filter((s) => s.subject === "Physics").length;
    const linkedCount = mockMasterStudents.filter((s) => exams.some((e) => e.id === s.examId)).length;
    const barcodeSet = new Set(sheets.filter((sh) => sh.barcode).map((sh) => sh.barcode));
    const uploadedCount = mockMasterStudents.filter((s) => barcodeSet.has(s.barcode)).length;
    const pendingCount = total - uploadedCount;
    return { total, mathCount, physicsCount, linkedCount, uploadedCount, pendingCount };
  }, []);

  const getExamName = (examId: number) => {
    const exam = exams.find((e) => e.id === examId);
    return exam ? exam.name : "Not linked";
  };

  const getSheetByBarcode = (barcode: string) => {
    return sheets.find((s) => s.barcode === barcode);
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Student Data" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Student Data</h3>
          <p className="text-sm text-gray-500 mt-0.5">Upload university master Excel and manage student-barcode records</p>
        </div>
      </div>

      {/* ─── SECTION A — Upload Master Excel ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Upload Master Student Data</h4>
            <p className="text-xs text-gray-500 mt-1">Upload the university semester Excel file containing all student-subject-barcode mappings.</p>
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
            dragOver ? "border-gray-900 bg-gray-50" : "border-gray-200"
          }`}
          onClick={handleFileSelect}
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-file-excel-2-line text-xl text-gray-400"></i>
          </div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Drag Excel file here or click to browse</h4>
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
                  <p className="text-sm font-medium text-gray-900">{fileName}</p>
                  <p className="text-xs text-gray-500">9 students found across 2 subjects</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImport}
                  className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <i className="ri-download-line text-xs"></i>
                  </span>
                  Import
                </button>
                <button
                  onClick={handleClear}
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Course</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Branch</th>
                    <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sem</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Subject</th>
                    <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {mockMasterStudents.slice(0, 5).map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 bg-white">
                      <td className="py-2.5 px-3 text-gray-900 font-medium whitespace-nowrap">{s.rollNo}</td>
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{s.name}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{s.course}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{s.branch}</td>
                      <td className="py-2.5 px-3 text-center text-gray-600 whitespace-nowrap">{s.semester}</td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{s.subject}</td>
                      <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px] whitespace-nowrap">{s.barcode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Showing first 5 of 9 records
            </p>
          </div>
        )}
      </div>

      {/* ─── SECTION B — Student Records ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900">
            Imported Student Records
            {imported && <span className="text-gray-400 font-normal ml-2">({records.length})</span>}
          </h4>
        </div>

        {/* Summary row */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Total</span>
              <span className="text-sm font-semibold text-gray-900">{summary.total}</span>
            </div>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Mathematics</span>
              <span className="text-sm font-semibold text-gray-900">{summary.mathCount}</span>
            </div>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Physics</span>
              <span className="text-sm font-semibold text-gray-900">{summary.physicsCount}</span>
            </div>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Linked to Exam</span>
              <span className="text-sm font-semibold text-emerald-600">{summary.linkedCount}</span>
            </div>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Sheet Uploaded</span>
              <span className="text-sm font-semibold text-gray-900">{summary.uploadedCount}</span>
            </div>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Pending</span>
              <span className="text-sm font-semibold text-amber-600">{summary.pendingCount}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
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
              disabled={!imported}
            />
          </div>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer"
            disabled={!imported}
          >
            {uniqueSubjects.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Subjects" : s}</option>
            ))}
          </select>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer"
            disabled={!imported}
          >
            {uniqueSemesters.map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Semesters" : `Semester ${s}`}</option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 cursor-pointer"
            disabled={!imported}
          >
            {uniqueBranches.map((b) => (
              <option key={b} value={b}>{b === "All" ? "All Branches" : b}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {!imported ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-database-2-line text-2xl text-gray-400"></i>
              </div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">No records imported yet</h4>
              <p className="text-xs text-gray-400">Upload the master Excel file above to see student records here.</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-file-search-line text-2xl text-gray-400"></i>
              </div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">No matching records</h4>
              <p className="text-xs text-gray-400">Try adjusting the filters or search query.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Course</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Branch</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sem</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Subject</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Exam</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">Sheet Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((s, idx) => {
                  const matchedSheet = getSheetByBarcode(s.barcode);
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                      <td className="py-3 px-4 text-gray-900 font-medium whitespace-nowrap">{s.rollNo}</td>
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{s.name}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{s.course}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">{s.branch}</td>
                      <td className="py-3 px-4 text-center text-gray-600 whitespace-nowrap">{s.semester}</td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{s.subject}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">{s.barcode}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">{getExamName(s.examId)}</td>
                      <td className="py-3 px-4">
                        {matchedSheet ? (
                          <StatusBadge status={matchedSheet.status} />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Not uploaded</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Format Guide Modal ─── */}
      {showFormatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFormatModal(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-2xl mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-base font-semibold text-gray-900">Expected Excel Format</h4>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Roll No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Student Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Course</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Branch</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Semester</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Subject</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">101</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">Rahul Verma</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">B.Tech</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">CSE</td>
                    <td className="py-3 px-4 text-center text-gray-500 text-xs whitespace-nowrap">4</td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">Mathematics</td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs whitespace-nowrap">BAR001</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-information-line text-amber-600 text-sm"></i>
              </span>
              <p className="text-xs text-amber-700">
                Each student has one row per subject. Barcode must match the barcode printed on their answer sheet.
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-lg text-sm font-medium shadow-lg">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 flex items-center justify-center">
              <i className="ri-check-line text-sm"></i>
            </span>
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}