export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: "admin" | "teacher" | "checker" | "teacher_checker" | "rechecking";
  subject?: string;
  status?: "active" | "inactive";
}

// ─── App Settings ───

export interface AppSettings {
  companyName: string;
  logoText: string;
  logoUrl: string | null;
  primaryColor: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export const mockAppSettings: AppSettings = {
  companyName: "Digi India Solutions",
  logoText: "DIS",
  logoUrl: null,
  primaryColor: "#4338CA",
  address: "New Delhi, India",
  phone: "+91-XXXXXXXXXX",
  email: "admin@digiindia.com",
  website: "www.digiindiasolutions.com"
};

// ─── Subjects ───

export interface Subject {
  id: number;
  name: string;
  code: string;
  department: string;
  status: "active" | "inactive";
}

export const mockSubjects: Subject[] = [
  { id: 1, name: "Mathematics", code: "MATH", department: "Science", status: "active" },
  { id: 2, name: "Physics", code: "PHY", department: "Science", status: "active" },
  { id: 3, name: "Chemistry", code: "CHEM", department: "Science", status: "active" },
  { id: 4, name: "Computer Science", code: "CS", department: "Engineering", status: "active" },
  { id: 5, name: "English", code: "ENG", department: "Arts", status: "active" },
  { id: 6, name: "Electronics", code: "ECE", department: "Engineering", status: "inactive" },
];

export const users: User[] = [
  { id: 1, name: "Admin User", email: "admin@osm.com", password: "admin123", role: "admin", status: "active" },
  { id: 2, name: "Mr. Sharma", email: "sharma@osm.com", password: "pass123", role: "teacher_checker", subject: "Mathematics", status: "active" },
  { id: 3, name: "Ms. Priya", email: "priya@osm.com", password: "pass123", role: "checker", status: "active" },
  { id: 4, name: "Mr. Ravi", email: "ravi@osm.com", password: "pass123", role: "rechecking", status: "active" },
  { id: 5, name: "Mrs. Neha", email: "neha@osm.com", password: "pass123", role: "teacher", status: "active" },
  { id: 6, name: "Mr. Arjun", email: "arjun@osm.com", password: "pass123", role: "checker", status: "active" },
  { id: 7, name: "Ms. Kavita", email: "kavita@osm.com", password: "pass123", role: "teacher_checker", subject: "Physics", status: "active" },
  { id: 8, name: "Mr. Suresh", email: "suresh@osm.com", password: "pass123", role: "rechecking", status: "active" },
  { id: 9, name: "Dr. Meena", email: "meena@osm.com", password: "pass123", role: "checker", status: "inactive" },
];

export interface Exam {
  id: number;
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  status: "active" | "completed" | "archived";
  createdBy: number;
}

export const exams: Exam[] = [
  { id: 1, name: "Mathematics Mid-Term", subject: "Mathematics", date: "2025-03-15", totalQuestions: 10, maxMarks: 100, status: "active", createdBy: 1 },
  { id: 2, name: "Physics Final", subject: "Physics", date: "2025-03-20", totalQuestions: 8, maxMarks: 80, status: "active", createdBy: 1 },
  { id: 3, name: "Chemistry Unit Test", subject: "Chemistry", date: "2025-03-10", totalQuestions: 5, maxMarks: 50, status: "completed", createdBy: 1 },
  { id: 4, name: "English Essay Exam", subject: "English", date: "2025-04-02", totalQuestions: 3, maxMarks: 60, status: "active", createdBy: 1 },
  { id: 5, name: "Biology Practical", subject: "Biology", date: "2025-02-28", totalQuestions: 12, maxMarks: 120, status: "completed", createdBy: 1 },
  { id: 6, name: "Mathematics Semester Final", subject: "Mathematics", date: "2025-02-20", totalQuestions: 10, maxMarks: 100, status: "completed", createdBy: 1 },
];

export type SheetStatus = "uploaded" | "assigned" | "checking" | "checked" | "recheck" | "rechecked";

export interface Sheet {
  id: number;
  examId: number;
  studentName: string;
  rollNo: string;
  status: SheetStatus;
  assignedTo: number | null;
  totalMarks: number | null;
  checkedBy?: number | null;
  recheckAssignedTo?: number | null;
  barcode?: string;
}

export const sheets: Sheet[] = [
  { id: 1, examId: 1, studentName: "Rahul Verma", rollNo: "101", status: "checked", assignedTo: 3, totalMarks: 78, barcode: "BAR001" },
  { id: 2, examId: 1, studentName: "Priya Singh", rollNo: "102", status: "checking", assignedTo: 3, totalMarks: null, barcode: "BAR003" },
  { id: 3, examId: 1, studentName: "Amit Kumar", rollNo: "103", status: "recheck", assignedTo: 4, totalMarks: null, barcode: "BAR005" },
  { id: 4, examId: 2, studentName: "Sneha Rao", rollNo: "201", status: "uploaded", assignedTo: null, totalMarks: null },
  { id: 5, examId: 2, studentName: "Rohan Mehta", rollNo: "202", status: "uploaded", assignedTo: null, totalMarks: null },
  { id: 6, examId: 1, studentName: "Karan Shah", rollNo: "104", status: "checking", assignedTo: 3, totalMarks: null, barcode: "BAR006" },
  { id: 7, examId: 2, studentName: "Meena Joshi", rollNo: "203", status: "checking", assignedTo: 3, totalMarks: null },
  { id: 8, examId: 2, studentName: "Deepika Joshi", rollNo: "205", status: "assigned", assignedTo: 6, totalMarks: null, barcode: "BAR007" },
  { id: 9, examId: 2, studentName: "Karan Malhotra", rollNo: "204", status: "checking", assignedTo: 3, totalMarks: null, barcode: "BAR008" },
  { id: 10, examId: 4, studentName: "Sunita Reddy", rollNo: "401", status: "uploaded", assignedTo: null, totalMarks: null, barcode: "BAR009" },
  { id: 11, examId: 4, studentName: "Mohammed Ali", rollNo: "402", status: "uploaded", assignedTo: null, totalMarks: null },
  { id: 12, examId: 3, studentName: "Ritu Agarwal", rollNo: "301", status: "checked", assignedTo: 3, totalMarks: 44 },
  { id: 13, examId: 3, studentName: "Gaurav Tandon", rollNo: "302", status: "checked", assignedTo: 6, totalMarks: 38 },
  { id: 14, examId: 4, studentName: "Pooja Nair", rollNo: "403", status: "rechecked", assignedTo: 4, totalMarks: 55, recheckAssignedTo: 4 },
  { id: 15, examId: 5, studentName: "Arun Saxena", rollNo: "501", status: "checked", assignedTo: 3, totalMarks: 105 },
  { id: 16, examId: 6, studentName: "Sneha Patel", rollNo: "201", status: "checked", assignedTo: 3, totalMarks: 65 },
  { id: 17, examId: 6, studentName: "Arjun Mehta", rollNo: "202", status: "checked", assignedTo: 3, totalMarks: 72 },
  { id: 18, examId: 6, studentName: "Divya Rao", rollNo: "203", status: "checked", assignedTo: 3, totalMarks: 45 },
];

export interface DashboardStats {
  label: string;
  value: number;
  icon: string;
  color: string;
}

export const adminStats: DashboardStats[] = [
  { label: "Total Sheets", value: 15, icon: "ri-file-copy-2-line", color: "bg-slate-100 text-slate-700" },
  { label: "Pending", value: 5, icon: "ri-time-line", color: "bg-amber-50 text-amber-600" },
  { label: "Completed", value: 6, icon: "ri-check-double-line", color: "bg-emerald-50 text-emerald-600" },
  { label: "Recheck Pending", value: 1, icon: "ri-refresh-line", color: "bg-violet-50 text-violet-600" },
];

export const teacherStats: DashboardStats[] = [
  { label: "My Exams", value: 8, icon: "ri-file-text-line", color: "bg-emerald-50 text-emerald-600" },
  { label: "Mark Schemes", value: 12, icon: "ri-price-tag-3-line", color: "bg-amber-50 text-amber-600" },
  { label: "Avg Progress", value: 74, icon: "ri-line-chart-line", color: "bg-rose-50 text-rose-600" },
  { label: "Results Published", value: 5, icon: "ri-check-double-line", color: "bg-sky-50 text-sky-600" },
];

export const checkerStats: DashboardStats[] = [
  { label: "In Queue", value: 42, icon: "ri-inbox-line", color: "bg-emerald-50 text-emerald-600" },
  { label: "Completed Today", value: 18, icon: "ri-checkbox-circle-line", color: "bg-amber-50 text-amber-600" },
  { label: "Pending Review", value: 24, icon: "ri-time-line", color: "bg-rose-50 text-rose-600" },
];

export interface ModelAnswerSheet {
  examId: number;
  uploadedBy: number;
  fileName: string;
  totalPages: number;
  uploadedAt: string;
}

export const mockModelAnswerSheets: ModelAnswerSheet[] = [
  { examId: 1, uploadedBy: 5, fileName: "Mathematics_Model_Answer.pdf", totalPages: 5, uploadedAt: "2025-03-14" },
];

export const modelAnswerSheets = mockModelAnswerSheets;

export interface QuestionPaper {
  examId: number;
  uploadedBy: number;
  fileName: string;
  totalPages: number;
  uploadedAt: string;
}

export const mockQuestionPapers: QuestionPaper[] = [
  { examId: 1, uploadedBy: 5, fileName: "Mathematics_MidTerm_QP.pdf", totalPages: 3, uploadedAt: "2025-03-13" },
];

export const recheckStats: DashboardStats[] = [
  { label: "Recheck Queue", value: 13, icon: "ri-refresh-line", color: "bg-emerald-50 text-emerald-600" },
  { label: "Completed", value: 47, icon: "ri-check-double-line", color: "bg-amber-50 text-amber-600" },
  { label: "Disputes", value: 3, icon: "ri-error-warning-line", color: "bg-rose-50 text-rose-600" },
];

export const subjects: string[] = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Hindi",
  "History",
  "Geography",
  "Computer Science",
  "Economics",
];

// ─── Master Student Data ───

export interface MasterStudent {
  id: number;
  rollNo: string;
  name: string;
  course: string;
  branch: string;
  semester: number;
  subject: string;
  barcode: string;
  examId: number;
}

export const mockMasterStudents: MasterStudent[] = [
  { id: 1, rollNo: "101", name: "Rahul Verma",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Mathematics", barcode: "BAR001", examId: 1 },
  { id: 2, rollNo: "101", name: "Rahul Verma",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Physics",     barcode: "BAR002", examId: 2 },
  { id: 3, rollNo: "102", name: "Priya Singh",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Mathematics", barcode: "BAR003", examId: 1 },
  { id: 4, rollNo: "102", name: "Priya Singh",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Physics",     barcode: "BAR004", examId: 2 },
  { id: 5, rollNo: "103", name: "Amit Kumar",   course: "B.Tech", branch: "ECE", semester: 4, subject: "Mathematics", barcode: "BAR005", examId: 1 },
  { id: 6, rollNo: "104", name: "Karan Shah",   course: "B.Tech", branch: "ECE", semester: 4, subject: "Mathematics", barcode: "BAR006", examId: 1 },
  { id: 7, rollNo: "201", name: "Sneha Patel",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Mathematics", barcode: "BAR007", examId: 6 },
  { id: 8, rollNo: "202", name: "Arjun Mehta",  course: "B.Tech", branch: "CSE", semester: 4, subject: "Mathematics", barcode: "BAR008", examId: 6 },
  { id: 9, rollNo: "203", name: "Divya Rao",    course: "B.Tech", branch: "CSE", semester: 4, subject: "Mathematics", barcode: "BAR009", examId: 6 },
];

export function getStatusBadge(status: SheetStatus | string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    uploaded:   { bg: "bg-gray-100",   text: "text-gray-700",   label: "Uploaded" },
    assigned:   { bg: "bg-sky-100",    text: "text-sky-700",    label: "Assigned" },
    checking:   { bg: "bg-amber-100",  text: "text-amber-700",  label: "Checking" },
    checked:    { bg: "bg-emerald-100",text: "text-emerald-700",label: "Checked" },
    recheck:    { bg: "bg-violet-100", text: "text-violet-700", label: "Recheck" },
    rechecked:  { bg: "bg-teal-100",   text: "text-teal-700",   label: "Rechecked" },
  };
  return map[status] || map.uploaded;
}

export function getExamStatusBadge(status: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active:    { bg: "bg-emerald-100", text: "text-emerald-700", label: "Active" },
    completed: { bg: "bg-gray-100",    text: "text-gray-600",    label: "Completed" },
    archived:  { bg: "bg-rose-100",    text: "text-rose-700",    label: "Archived" },
  };
  return map[status] || map.active;
}

// ─── Recheck data ───

export interface RecheckRequest {
  id: number;
  type: "sheet" | "exam";
  sheetId: number | null;
  examId: number;
  requestedBy: number;
  assignedTo: number;
  reason: string;
  remarks: string;
  finalMarksRule: "higher" | "recheck_marks" | "average";
  status: "pending" | "completed" | "requested_by_teacher";
  createdAt: string;
}

export const mockRecheckRequests: RecheckRequest[] = [
  { id: 1, type: "sheet", sheetId: 3, examId: 1, requestedBy: 1, assignedTo: 4,
    reason: "Wrong scanning — sheet is blurred or unreadable",
    remarks: "Page 3 and 4 are unclear", finalMarksRule: "higher",
    status: "pending", createdAt: "2025-03-16" },
  { id: 2, type: "exam", sheetId: null, examId: 2, requestedBy: 1, assignedTo: 4,
    reason: "Wrong subject — sheet belongs to different subject",
    remarks: "Full batch needs review", finalMarksRule: "recheck_marks",
    status: "pending", createdAt: "2025-03-17" },
  { id: 3, type: "sheet", sheetId: 1, examId: 1, requestedBy: 1, assignedTo: 4,
    reason: "Double answer — student wrote two answers",
    remarks: "", finalMarksRule: "average",
    status: "completed", createdAt: "2025-03-15" },
];

export interface RecheckMark {
  sheetId: number;
  questionName: string;
  max: number;
  originalMarks: number;
  recheckMarks: number | null;
  stampX: number | null;
  stampY: number | null;
  stampPage: number | null;
}

export const mockRecheckMarks: RecheckMark[] = [
  { sheetId: 3, questionName: "Qn1_i", max: 3, originalMarks: 2, recheckMarks: null, stampX: null, stampY: null, stampPage: null },
  { sheetId: 3, questionName: "Qn1_ii", max: 3, originalMarks: 1, recheckMarks: null, stampX: null, stampY: null, stampPage: null },
  { sheetId: 3, questionName: "Qn1_iii", max: 3, originalMarks: 2, recheckMarks: null, stampX: null, stampY: null, stampPage: null },
  { sheetId: 3, questionName: "Qn1_iv", max: 3, originalMarks: 3, recheckMarks: null, stampX: null, stampY: null, stampPage: null },
];

export function getFinalMarksRuleBadge(rule: RecheckRequest["finalMarksRule"]): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    higher:        { bg: "bg-emerald-100", text: "text-emerald-700", label: "Higher" },
    recheck_marks: { bg: "bg-sky-100",     text: "text-sky-700",     label: "Recheck Marks" },
    average:       { bg: "bg-amber-100",   text: "text-amber-700",   label: "Average" },
  };
  return map[rule] || map.higher;
}

export function getRecheckTypeBadge(type: RecheckRequest["type"]): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    sheet: { bg: "bg-violet-100", text: "text-violet-700", label: "Single Sheet" },
    exam:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "Full Exam" },
  };
  return map[type] || map.sheet;
}

// ─── Mark Schemes ───

export interface MarkScheme {
  id: number;
  examId: number;
  questionName: string;
  maxMarks: number;
  guidelines: string;
}

export const mockMarkSchemes: MarkScheme[] = [
  { id: 1, examId: 1, questionName: "Qn1_i", maxMarks: 3, guidelines: "Award 1 mark per correct point. Max 3." },
  { id: 2, examId: 1, questionName: "Qn1_ii", maxMarks: 3, guidelines: "Partial credit allowed. Award per correct point." },
  { id: 3, examId: 1, questionName: "Qn1_iii", maxMarks: 3, guidelines: "Diagram mandatory for full marks." },
  { id: 4, examId: 1, questionName: "Qn1_iv", maxMarks: 3, guidelines: "Any valid method accepted." },
  { id: 5, examId: 1, questionName: "Qn2_i", maxMarks: 4, guidelines: "Correct method gets full marks even if answer wrong." },
  { id: 6, examId: 1, questionName: "Qn2_ii", maxMarks: 4, guidelines: "1 mark per correct step shown." },
  { id: 7, examId: 1, questionName: "Qn2_iii", maxMarks: 4, guidelines: "Accept any alternative approach." },
  { id: 8, examId: 1, questionName: "Qn3_i", maxMarks: 3, guidelines: "Award marks for correct concept." },
  { id: 9, examId: 1, questionName: "Qn3_ii", maxMarks: 3, guidelines: "Explanation with example required." },
  { id: 10, examId: 1, questionName: "Qn3_iii", maxMarks: 3, guidelines: "Any valid definition accepted." },
];

// ─── Question Marks (for results view) ───

export interface QuestionMark {
  sheetId: number;
  questionName: string;
  max: number;
  awarded: number;
}

export const mockQuestionMarks: QuestionMark[] = [
  { sheetId: 1, questionName: "Qn1_i", max: 3, awarded: 2 },
  { sheetId: 1, questionName: "Qn1_ii", max: 3, awarded: 2 },
  { sheetId: 1, questionName: "Qn1_iii", max: 3, awarded: 1 },
  { sheetId: 1, questionName: "Qn1_iv", max: 3, awarded: 3 },
  { sheetId: 1, questionName: "Qn2_i", max: 4, awarded: 3 },
  { sheetId: 1, questionName: "Qn2_ii", max: 4, awarded: 3 },
  { sheetId: 1, questionName: "Qn2_iii", max: 4, awarded: 2 },
  { sheetId: 1, questionName: "Qn3", max: 12, awarded: 10 },
  { sheetId: 1, questionName: "Qn4", max: 12, awarded: 9 },
  { sheetId: 1, questionName: "Qn5", max: 12, awarded: 11 },
  { sheetId: 1, questionName: "Qn6", max: 10, awarded: 8 },
  { sheetId: 1, questionName: "Qn7", max: 10, awarded: 7 },
  { sheetId: 1, questionName: "Qn8", max: 10, awarded: 8 },
  { sheetId: 1, questionName: "Qn9", max: 8, awarded: 6 },
  { sheetId: 1, questionName: "Qn10", max: 8, awarded: 5 },
  { sheetId: 16, questionName: "Qn1_i", max: 3, awarded: 2 },
  { sheetId: 16, questionName: "Qn1_ii", max: 3, awarded: 3 },
  { sheetId: 16, questionName: "Qn1_iii", max: 3, awarded: 2 },
  { sheetId: 16, questionName: "Qn1_iv", max: 3, awarded: 3 },
  { sheetId: 16, questionName: "Qn2_i", max: 4, awarded: 4 },
  { sheetId: 16, questionName: "Qn2_ii", max: 4, awarded: 3 },
  { sheetId: 16, questionName: "Qn2_iii", max: 4, awarded: 2 },
  { sheetId: 16, questionName: "Qn3", max: 12, awarded: 10 },
  { sheetId: 16, questionName: "Qn4", max: 12, awarded: 9 },
  { sheetId: 16, questionName: "Qn5", max: 12, awarded: 11 },
  { sheetId: 16, questionName: "Qn6", max: 10, awarded: 9 },
  { sheetId: 16, questionName: "Qn7", max: 10, awarded: 8 },
  { sheetId: 16, questionName: "Qn8", max: 10, awarded: 7 },
  { sheetId: 16, questionName: "Qn9", max: 8, awarded: 5 },
  { sheetId: 16, questionName: "Qn10", max: 8, awarded: 6 },
  { sheetId: 17, questionName: "Qn1_i", max: 3, awarded: 1 },
  { sheetId: 17, questionName: "Qn1_ii", max: 3, awarded: 1 },
  { sheetId: 17, questionName: "Qn1_iii", max: 3, awarded: 0 },
  { sheetId: 17, questionName: "Qn1_iv", max: 3, awarded: 2 },
  { sheetId: 17, questionName: "Qn2_i", max: 4, awarded: 2 },
  { sheetId: 17, questionName: "Qn2_ii", max: 4, awarded: 1 },
  { sheetId: 17, questionName: "Qn2_iii", max: 4, awarded: 1 },
  { sheetId: 17, questionName: "Qn3", max: 12, awarded: 5 },
  { sheetId: 17, questionName: "Qn4", max: 12, awarded: 6 },
  { sheetId: 17, questionName: "Qn5", max: 12, awarded: 7 },
  { sheetId: 17, questionName: "Qn6", max: 10, awarded: 4 },
  { sheetId: 17, questionName: "Qn7", max: 10, awarded: 5 },
  { sheetId: 17, questionName: "Qn8", max: 10, awarded: 4 },
  { sheetId: 17, questionName: "Qn9", max: 8, awarded: 3 },
  { sheetId: 17, questionName: "Qn10", max: 8, awarded: 3 },
  { sheetId: 18, questionName: "Qn1_i", max: 3, awarded: 2 },
  { sheetId: 18, questionName: "Qn1_ii", max: 3, awarded: 2 },
  { sheetId: 18, questionName: "Qn1_iii", max: 3, awarded: 1 },
  { sheetId: 18, questionName: "Qn1_iv", max: 3, awarded: 3 },
  { sheetId: 18, questionName: "Qn2_i", max: 4, awarded: 3 },
  { sheetId: 18, questionName: "Qn2_ii", max: 4, awarded: 2 },
  { sheetId: 18, questionName: "Qn2_iii", max: 4, awarded: 2 },
  { sheetId: 18, questionName: "Qn3", max: 12, awarded: 8 },
  { sheetId: 18, questionName: "Qn4", max: 12, awarded: 7 },
  { sheetId: 18, questionName: "Qn5", max: 12, awarded: 9 },
  { sheetId: 18, questionName: "Qn6", max: 10, awarded: 7 },
  { sheetId: 18, questionName: "Qn7", max: 10, awarded: 6 },
  { sheetId: 18, questionName: "Qn8", max: 10, awarded: 7 },
  { sheetId: 18, questionName: "Qn9", max: 8, awarded: 5 },
  { sheetId: 18, questionName: "Qn10", max: 8, awarded: 5 },
];

export function getDisputeStatusBadge(status: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    requested_by_teacher: { bg: "bg-rose-100", text: "text-rose-700", label: "Teacher Disputed" },
  };
  return map[status] || getStatusBadge(status);
}

// ─── Results data for Admin Reports ───

export interface ResultEntry {
  sheetId: number;
  examId: number;
  rollNo: string;
  studentName: string;
  questionTotals: Record<string, number>;
  totalMarks: number;
  maxMarks: number;
  round: number;
  isRechecked: boolean;
}

export const mockResults: ResultEntry[] = [
  { sheetId: 1, examId: 1, rollNo: "101", studentName: "Rahul Verma",
    questionTotals: { Q1: 11, Q2: 10, Q3: 9, Q4: 12, Q5: 8, Q6: 10, Q7: 8, Q8: 5, Q9: 3, Q10: 2 },
    totalMarks: 78, maxMarks: 100, round: 1, isRechecked: false },
  { sheetId: 16, examId: 6, rollNo: "201", studentName: "Sneha Patel",
    questionTotals: { Q1: 10, Q2: 9, Q3: 8, Q4: 11, Q5: 7, Q6: 8, Q7: 7, Q8: 3, Q9: 1, Q10: 1 },
    totalMarks: 65, maxMarks: 100, round: 1, isRechecked: false },
  { sheetId: 17, examId: 6, rollNo: "202", studentName: "Arjun Mehta",
    questionTotals: { Q1: 12, Q2: 11, Q3: 10, Q4: 13, Q5: 8, Q6: 9, Q7: 5, Q8: 2, Q9: 1, Q10: 1 },
    totalMarks: 72, maxMarks: 100, round: 1, isRechecked: false },
  { sheetId: 18, examId: 6, rollNo: "203", studentName: "Divya Rao",
    questionTotals: { Q1: 8, Q2: 7, Q3: 6, Q4: 9, Q5: 5, Q6: 4, Q7: 3, Q8: 2, Q9: 1, Q10: 0 },
    totalMarks: 45, maxMarks: 100, round: 1, isRechecked: false },
];

export interface CheckerStat {
  checkerId: number;
  checkerName: string;
  role: string;
  examId: number;
  sheetsCompleted: number;
  avgTimeMinutes: number;
}

export const mockCheckerStats: CheckerStat[] = [
  { checkerId: 3, checkerName: "Ms. Priya", role: "checker", examId: 1, sheetsCompleted: 4, avgTimeMinutes: 14 },
  { checkerId: 4, checkerName: "Mr. Ravi", role: "rechecking", examId: 1, sheetsCompleted: 2, avgTimeMinutes: 18 },
  { checkerId: 2, checkerName: "Mr. Sharma", role: "teacher_checker", examId: 6, sheetsCompleted: 3, avgTimeMinutes: 11 },
];

export let mockPublishedExams: number[] = [];

// ─── Notifications ───

export interface Notification {
  id: number;
  userId: number;
  role: string;
  message: string;
  type: "submission" | "recheck" | "dispute" | "assignment" | "confirmed";
  read: boolean;
  createdAt: string;
}

export const mockNotifications: Notification[] = [
  { id: 1, userId: 1, role: "admin", message: "Ms. Priya submitted Sheet #002 — Mathematics Mid-Term", type: "submission", read: false, createdAt: "2025-03-16T10:30:00" },
  { id: 2, userId: 1, role: "admin", message: "Mr. Ravi completed recheck for Sheet #003", type: "recheck", read: false, createdAt: "2025-03-16T11:00:00" },
  { id: 3, userId: 1, role: "admin", message: "Teacher Neha flagged Sheet #002 for dispute", type: "dispute", read: true, createdAt: "2025-03-15T09:00:00" },
  { id: 4, userId: 3, role: "checker", message: "2 new sheets assigned to you — Mathematics Mid-Term", type: "assignment", read: false, createdAt: "2025-03-14T08:00:00" },
  { id: 5, userId: 4, role: "rechecking", message: "Sheet #003 assigned to you for recheck", type: "assignment", read: false, createdAt: "2025-03-16T10:00:00" },
  { id: 6, userId: 3, role: "checker", message: "Sheet #001 marking confirmed by admin", type: "confirmed", read: true, createdAt: "2025-03-13T14:00:00" },
]

// ─── Draft Marks (auto-save / resume) ───

export interface DraftMark {
  sheetId: number
  questionName: string
  marks: number | null
  stampX: number | null
  stampY: number | null
  stampPage: number | null
  savedAt: string
  isComplete: boolean
}

export const mockDraftMarks: DraftMark[] = []