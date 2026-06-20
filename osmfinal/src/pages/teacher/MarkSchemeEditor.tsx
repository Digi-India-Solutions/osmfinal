// src/pages/MarkSchemeEditor.tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { mockSubjects } from '@/mock/mockData';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { usePageLoading } from '@/hooks/usePageLoading';
import { examApi, type ExamResponse } from '../../api/exam';
import {
  markSchemeApi,
  type MarkSchemeRow,
  type SaveMarkSchemeItem,
} from '../../api/markScheme';

const ROMAN_NUMERALS = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
];

interface SchemeSubPart {
  label: string;
  maxMarks: number;
  guidelines: string;
}

interface SchemeQuestion {
  questionNum: number;
  subParts: SchemeSubPart[];
  guidelines: string;
  maxMarks: number;
}

interface SetupForm {
  totalQuestions: number;
  subPartsPerQuestion: number;
  defaultMaxMarks: number;
}

function parseQuestionName(name: string): {
  qNum: number;
  subLabel: string | null;
} {
  const match = name.match(/^Qn(\d+)(?:_(.+))?$/);
  if (!match) return { qNum: 0, subLabel: null };
  return { qNum: parseInt(match[1], 10), subLabel: match[2] || null };
}

function toQuestionName(qNum: number, subLabel: string | null): string {
  return subLabel ? `Qn${qNum}_${subLabel}` : `Qn${qNum}`;
}

function buildSchemeQuestionsFromRows(rows: MarkSchemeRow[]): SchemeQuestion[] {
  const grouped: Record<
    number,
    { subLabel: string | null; maxMarks: number; guidelines: string }[]
  > = {};
  rows.forEach((row) => {
    const { qNum, subLabel } = parseQuestionName(row.questionName);
    if (qNum === 0) return;
    if (!grouped[qNum]) grouped[qNum] = [];
    grouped[qNum].push({
      subLabel,
      maxMarks: row.maxMarks,
      guidelines: row.guidelines,
    });
  });

  const questions: SchemeQuestion[] = [];
  Object.entries(grouped)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([qNumStr, parts]) => {
      const qNum = parseInt(qNumStr);
      const allHaveSub = parts.every((p) => p.subLabel !== null);
      if (allHaveSub) {
        const subParts: SchemeSubPart[] = parts
          .sort(
            (a, b) =>
              ROMAN_NUMERALS.indexOf(a.subLabel!) -
              ROMAN_NUMERALS.indexOf(b.subLabel!),
          )
          .map((p) => ({
            label: p.subLabel!,
            maxMarks: p.maxMarks,
            guidelines: p.guidelines,
          }));
        questions.push({
          questionNum: qNum,
          subParts,
          guidelines: '',
          maxMarks: 0,
        });
      } else {
        const first = parts[0];
        questions.push({
          questionNum: qNum,
          subParts: [],
          guidelines: first.guidelines,
          maxMarks: first.maxMarks,
        });
      }
    });
  return questions;
}

export default function MarkSchemeEditor() {
  const { currentUser } = useAuth();
  const loading = usePageLoading();
  const location = useLocation();
  const role = currentUser?.role ?? '';
  const subject = currentUser?.subject ?? '';
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [examList, setExamList] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        const res = await examApi.getAllExams({ limit: 1000 });
        setExamList(res.data);
      } catch (error) {
        console.error('Failed to fetch exams:', error);
      } finally {
        setExamsLoading(false);
      }
    };
    fetchExams();
  }, []);

  const filteredExams = useMemo(() => {
    if (role === 'admin' || role === 'teacher_checker') return examList;
    return examList.filter((e) => e.subject === subject);
  }, [role, subject, examList]);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [schemeQuestions, setSchemeQuestions] = useState<SchemeQuestion[]>([]);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeSaving, setSchemeSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // ─── PDF STATES ──────────────────────────────────────────────

  const [modelAnswerPdf, setModelAnswerPdf] = useState<string | null>(null);
  const [questionPaperPdf, setQuestionPaperPdf] = useState<string | null>(null);
  const [uploadingModelAnswer, setUploadingModelAnswer] = useState(false);
  const [uploadingQuestionPaper, setUploadingQuestionPaper] = useState(false);

  const [setupForm, setSetupForm] = useState<SetupForm>({
    totalQuestions: 5,
    subPartsPerQuestion: 4,
    defaultMaxMarks: 3,
  });
  const [setupError, setSetupError] = useState('');

  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelPreviewVisible, setExcelPreviewVisible] = useState(false);

  const selectedExam = examList.find((e) => e.id === selectedExamId);

  const hasExistingScheme = schemeQuestions.length > 0;

  const breadcrumbItems = isAdminRoute
    ? [{ label: 'Admin', href: '/admin' }, { label: 'Mark Scheme' }]
    : [{ label: 'Teacher', href: '/teacher' }, { label: 'Mark Scheme' }];

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3000);
  };

  // ─── FETCH MARK SCHEME ───────────────────────────────────────

  const handleExamChange = async (examId: string) => {
    setSelectedExamId(examId);
    setSetupError('');
    setShowExcelUpload(false);
    setExcelPreviewVisible(false);
    setSchemeLoading(true);
    try {
      const rows = await markSchemeApi.getByExam(examId);
      setSchemeQuestions(buildSchemeQuestionsFromRows(rows));

      // Load PDF URLs
      if (rows.length > 0) {
        setModelAnswerPdf(rows[0]?.model_answer_pdf || null);
        setQuestionPaperPdf(rows[0]?.question_paper_pdf || null);
      } else {
        setModelAnswerPdf(null);
        setQuestionPaperPdf(null);
      }
    } catch (error) {
      console.error('Failed to fetch mark scheme:', error);
      showToast('Failed to load mark scheme', 'error');
      setSchemeQuestions([]);
    } finally {
      setSchemeLoading(false);
    }
  };

  // ─── PDF UPLOAD FUNCTIONS ──────────────────────────────────

  const handleModelAnswerUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExamId) return;

    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      showToast('Only PDF files are allowed', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large. Max size is 10MB', 'error');
      return;
    }

    setUploadingModelAnswer(true);
    try {
      const response = await markSchemeApi.uploadModelAnswer(
        selectedExamId,
        file,
      );
      if (response.success) {
        setModelAnswerPdf(response.data.url);
        showToast('Model answer uploaded successfully', 'success');
        await handleExamChange(selectedExamId);
      } else {
        showToast(response.message || 'Failed to upload model answer', 'error');
      }
    } catch (error: any) {
      console.error('Upload model answer error:', error);
      showToast(error.message || 'Failed to upload model answer', 'error');
    } finally {
      setUploadingModelAnswer(false);
      e.target.value = '';
    }
  };

  const handleQuestionPaperUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExamId) return;

    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      showToast('Only PDF files are allowed', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('File too large. Max size is 10MB', 'error');
      return;
    }

    setUploadingQuestionPaper(true);
    try {
      const response = await markSchemeApi.uploadQuestionPaper(
        selectedExamId,
        file,
      );
      if (response.success) {
        setQuestionPaperPdf(response.data.url);
        showToast('Question paper uploaded successfully', 'success');
        await handleExamChange(selectedExamId);
      } else {
        showToast(
          response.message || 'Failed to upload question paper',
          'error',
        );
      }
    } catch (error: any) {
      console.error('Upload question paper error:', error);
      showToast(error.message || 'Failed to upload question paper', 'error');
    } finally {
      setUploadingQuestionPaper(false);
      e.target.value = '';
    }
  };

  const handleDeletePDF = async (type: 'model_answer' | 'question_paper') => {
    if (!selectedExamId) return;

    if (
      !window.confirm(
        `Are you sure you want to delete the ${type === 'model_answer' ? 'model answer' : 'question paper'} PDF?`,
      )
    ) {
      return;
    }

    try {
      const response = await markSchemeApi.deletePDF(selectedExamId, type);
      if (response.success) {
        if (type === 'model_answer') {
          setModelAnswerPdf(null);
        } else {
          setQuestionPaperPdf(null);
        }
        showToast('PDF deleted successfully', 'success');
        await handleExamChange(selectedExamId);
      } else {
        showToast(response.message || 'Failed to delete PDF', 'error');
      }
    } catch (error: any) {
      console.error('Delete PDF error:', error);
      showToast(error.message || 'Failed to delete PDF', 'error');
    }
  };

  // ─── SCHEME GENERATION FUNCTIONS ──────────────────────────

  const handleGenerate = () => {
    if (
      !setupForm.totalQuestions ||
      setupForm.totalQuestions < 1 ||
      setupForm.totalQuestions > 100
    ) {
      setSetupError('Enter 1–100 questions');
      return;
    }
    if (
      setupForm.subPartsPerQuestion < 0 ||
      setupForm.subPartsPerQuestion > 10
    ) {
      setSetupError('Sub-parts: 0–10');
      return;
    }
    if (!setupForm.defaultMaxMarks || setupForm.defaultMaxMarks < 1) {
      setSetupError('Enter valid default max marks');
      return;
    }
    setSetupError('');

    const questions: SchemeQuestion[] = [];
    for (let q = 1; q <= setupForm.totalQuestions; q++) {
      if (setupForm.subPartsPerQuestion === 0) {
        questions.push({
          questionNum: q,
          subParts: [],
          guidelines: '',
          maxMarks: setupForm.defaultMaxMarks,
        });
      } else {
        const subParts: SchemeSubPart[] = [];
        for (let s = 0; s < setupForm.subPartsPerQuestion; s++) {
          subParts.push({
            label: ROMAN_NUMERALS[s],
            maxMarks: setupForm.defaultMaxMarks,
            guidelines: '',
          });
        }
        questions.push({
          questionNum: q,
          subParts,
          guidelines: '',
          maxMarks: 0,
        });
      }
    }
    setSchemeQuestions(questions);
    showToast(`${setupForm.totalQuestions} questions generated`, 'success');
  };

  const handleAddSubPart = useCallback((qNum: number) => {
    setSchemeQuestions((prev) =>
      prev.map((q) => {
        if (q.questionNum !== qNum) return q;
        const nextLabel = ROMAN_NUMERALS[q.subParts.length];
        if (!nextLabel) return q;
        const defaultMarks = q.subParts.length > 0 ? q.subParts[0].maxMarks : 3;
        return {
          ...q,
          subParts: [
            ...q.subParts,
            { label: nextLabel, maxMarks: defaultMarks, guidelines: '' },
          ],
        };
      }),
    );
  }, []);

  const handleRemoveSubPart = useCallback((qNum: number, subLabel: string) => {
    setSchemeQuestions((prev) =>
      prev.map((q) => {
        if (q.questionNum !== qNum) return q;
        const filtered = q.subParts.filter((s) => s.label !== subLabel);
        const relabeled = filtered.map((s, i) => ({
          ...s,
          label: ROMAN_NUMERALS[i],
        }));
        return { ...q, subParts: relabeled };
      }),
    );
  }, []);

  const handleConvertToSubParts = useCallback((qNum: number) => {
    setSchemeQuestions((prev) =>
      prev.map((q) => {
        if (q.questionNum !== qNum) return q;
        return {
          ...q,
          subParts: [
            { label: 'i', maxMarks: 3, guidelines: '' },
            { label: 'ii', maxMarks: 3, guidelines: '' },
          ],
          guidelines: '',
          maxMarks: 0,
        };
      }),
    );
  }, []);

  const handleSubPartMarkChange = useCallback(
    (qNum: number, subLabel: string, val: number) => {
      setSchemeQuestions((prev) =>
        prev.map((q) => {
          if (q.questionNum !== qNum) return q;
          return {
            ...q,
            subParts: q.subParts.map((s) =>
              s.label === subLabel ? { ...s, maxMarks: val || 0 } : s,
            ),
          };
        }),
      );
    },
    [],
  );

  const handleSubPartGuidelineChange = useCallback(
    (qNum: number, subLabel: string, val: string) => {
      setSchemeQuestions((prev) =>
        prev.map((q) => {
          if (q.questionNum !== qNum) return q;
          return {
            ...q,
            subParts: q.subParts.map((s) =>
              s.label === subLabel ? { ...s, guidelines: val } : s,
            ),
          };
        }),
      );
    },
    [],
  );

  const handleDirectMarkChange = useCallback((qNum: number, val: number) => {
    setSchemeQuestions((prev) =>
      prev.map((q) =>
        q.questionNum === qNum ? { ...q, maxMarks: val || 0 } : q,
      ),
    );
  }, []);

  const handleDirectGuidelineChange = useCallback(
    (qNum: number, val: string) => {
      setSchemeQuestions((prev) =>
        prev.map((q) =>
          q.questionNum === qNum ? { ...q, guidelines: val } : q,
        ),
      );
    },
    [],
  );

  const totalSubParts = useMemo(() => {
    return schemeQuestions.reduce((sum, q) => sum + q.subParts.length, 0);
  }, [schemeQuestions]);

  const handleSaveScheme = async () => {
    if (!selectedExamId) return;

    const flattened: SaveMarkSchemeItem[] = [];
    schemeQuestions.forEach((q) => {
      if (q.subParts.length > 0) {
        q.subParts.forEach((sp) => {
          flattened.push({
            questionName: toQuestionName(q.questionNum, sp.label),
            maxMarks: sp.maxMarks,
            guidelines: sp.guidelines,
          });
        });
      } else {
        flattened.push({
          questionName: toQuestionName(q.questionNum, null),
          maxMarks: q.maxMarks,
          guidelines: q.guidelines,
        });
      }
    });

    setSchemeSaving(true);
    try {
      // Save mark scheme without PDF files (they are already uploaded separately)
      const response = await markSchemeApi.save(selectedExamId, flattened);
      if (response.success) {
        showToast('Mark scheme saved successfully', 'success');
      } else {
        showToast(response.message || 'Failed to save mark scheme', 'error');
      }
    } catch (error) {
      console.error('Failed to save mark scheme:', error);
      showToast('Failed to save mark scheme', 'error');
    } finally {
      setSchemeSaving(false);
    }
  };

  const handleMockExcelUpload = () => {
    setExcelPreviewVisible(true);
  };

  const handleConfirmExcelImport = () => {
    const previewData = [
      {
        qNum: 1,
        sub: 'i',
        marks: 3,
        guide: 'Award 1 mark per correct point. Max 3.',
      },
      { qNum: 1, sub: 'ii', marks: 3, guide: 'Partial credit allowed.' },
      {
        qNum: 1,
        sub: 'iii',
        marks: 3,
        guide: 'Diagram mandatory for full marks.',
      },
      { qNum: 2, sub: 'i', marks: 4, guide: 'Correct method gets full marks.' },
      { qNum: 2, sub: 'ii', marks: 4, guide: '1 mark per correct step shown.' },
    ];

    const grouped: Record<
      number,
      { label: string; maxMarks: number; guidelines: string }[]
    > = {};
    previewData.forEach((row) => {
      if (!grouped[row.qNum]) grouped[row.qNum] = [];
      grouped[row.qNum].push({
        label: row.sub,
        maxMarks: row.marks,
        guidelines: row.guide,
      });
    });

    const questions: SchemeQuestion[] = [];
    Object.entries(grouped)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([qNumStr, parts]) => {
        questions.push({
          questionNum: parseInt(qNumStr),
          subParts: parts.sort(
            (a, b) =>
              ROMAN_NUMERALS.indexOf(a.label) - ROMAN_NUMERALS.indexOf(b.label),
          ),
          guidelines: '',
          maxMarks: 0,
        });
      });

    setSchemeQuestions(questions);
    setExcelPreviewVisible(false);
    setShowExcelUpload(false);
    showToast(`${questions.length} questions imported from Excel`, 'success');
  };

  const handleClearExcel = () => {
    setExcelPreviewVisible(false);
    setShowExcelUpload(false);
  };

  const realTotalMarks = useMemo(() => {
    return schemeQuestions.reduce((sum, q) => {
      if (q.subParts.length > 0) {
        return sum + q.subParts.reduce((s, sp) => s + sp.maxMarks, 0);
      }
      return sum + q.maxMarks;
    }, 0);
  }, [schemeQuestions]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {saveToast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
            saveToast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          <i
            className={
              saveToast.type === 'error'
                ? 'ri-error-warning-line'
                : 'ri-check-line'
            }
          ></i>
          {saveToast.message}
        </div>
      )}

      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
          Mark Scheme Editor
        </h2>
        {role !== 'admin' && subject && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
            {subject}
          </span>
        )}
        {role === 'admin' && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
            All Subjects
          </span>
        )}
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
            <i className="ri-information-line text-sky-500 text-sm"></i>
          </div>
          <p className="text-xs text-sky-700 leading-relaxed">
            Mark schemes are created by the subject teacher and used by checkers
            as reference during evaluation.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Exam
        </label>
        <select
          className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
          value={selectedExamId ?? ''}
          disabled={examsLoading}
          onChange={(e) => {
            const val = e.target.value;
            if (val) handleExamChange(val);
          }}
        >
          <option value="" disabled>
            {examsLoading ? 'Loading exams...' : 'Select an exam...'}
          </option>
          {filteredExams.map((exam) => {
            const matchedSubject = mockSubjects.find(
              (s) => s.name === exam.subject,
            );
            return (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.date}) — {exam.subject}
                {matchedSubject ? ` (${matchedSubject.code})` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {selectedExam && schemeLoading && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <p className="text-sm text-gray-500">Loading mark scheme...</p>
        </div>
      )}

      {selectedExam && !schemeLoading && !hasExistingScheme && (
        <div className="bg-white rounded-2xl p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            Setup Mark Scheme — {selectedExam.name}
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            Configure the question structure for this exam.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Total Questions
              </label>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                value={setupForm.totalQuestions}
                onChange={(e) =>
                  setSetupForm((prev) => ({
                    ...prev,
                    totalQuestions: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Sub-parts per Question
              </label>
              <input
                type="number"
                min={0}
                max={10}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                value={setupForm.subPartsPerQuestion}
                onChange={(e) =>
                  setSetupForm((prev) => ({
                    ...prev,
                    subPartsPerQuestion: Number(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-[11px] text-gray-400 mt-1">
                0 = no sub-parts, marks entered directly
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Default Max Marks
              </label>
              <input
                type="number"
                min={1}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300"
                value={setupForm.defaultMaxMarks}
                onChange={(e) =>
                  setSetupForm((prev) => ({
                    ...prev,
                    defaultMaxMarks: Number(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>

          {setupError && (
            <p className="text-xs text-rose-500 mb-3">{setupError}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap mb-4">
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-play-line mr-1.5"></i> Generate Scheme
            </button>
            <button
              onClick={() => {
                setShowExcelUpload(true);
                setExcelPreviewVisible(false);
                setSetupError('');
              }}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors duration-150 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-upload-cloud-line mr-1.5"></i> Upload Excel
              instead
            </button>
            <button
              onClick={() => setShowFormatGuide(true)}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-150 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-file-text-line mr-1.5"></i> Format Guide
            </button>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
            <i className="ri-information-line mr-1 text-gray-400"></i>
            These are starting defaults. You can change sub-parts and marks for
            each question individually in the next step.
          </p>

          {showExcelUpload && (
            <div className="mt-5 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
              {!excelPreviewVisible ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-file-excel-2-line text-gray-400 text-2xl"></i>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Drag Excel file here or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Accepts .xlsx and .csv files
                  </p>
                  <button
                    onClick={handleMockExcelUpload}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-folder-open-line mr-1.5"></i> Browse Files
                  </button>
                </>
              ) : (
                <div className="text-left space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <i className="ri-file-excel-2-line text-emerald-600 text-lg"></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        master_scheme.xlsx
                      </p>
                      <p className="text-xs text-gray-500">
                        5 rows found across 2 questions
                      </p>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">
                          Q No
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">
                          Sub-part
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">
                          Max Marks
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase">
                          Guidelines
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-900">Q1</td>
                        <td className="py-2 px-3 text-gray-600">i</td>
                        <td className="py-2 px-3 text-gray-900">3</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          Award 1 mark per correct point. Max 3.
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-900">Q1</td>
                        <td className="py-2 px-3 text-gray-600">ii</td>
                        <td className="py-2 px-3 text-gray-900">3</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          Partial credit allowed.
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-900">Q1</td>
                        <td className="py-2 px-3 text-gray-600">iii</td>
                        <td className="py-2 px-3 text-gray-900">3</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          Diagram mandatory for full marks.
                        </td>
                      </tr>
                      <tr className="border-b border-gray-50">
                        <td className="py-2 px-3 text-gray-900">Q2</td>
                        <td className="py-2 px-3 text-gray-600">i</td>
                        <td className="py-2 px-3 text-gray-900">4</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          Correct method gets full marks.
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-gray-900">Q2</td>
                        <td className="py-2 px-3 text-gray-600">ii</td>
                        <td className="py-2 px-3 text-gray-900">4</td>
                        <td className="py-2 px-3 text-gray-500 text-xs">
                          1 mark per correct step shown.
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleConfirmExcelImport}
                      className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-check-line mr-1.5"></i> Confirm Import
                    </button>
                    <button
                      onClick={handleClearExcel}
                      className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedExam && !schemeLoading && hasExistingScheme && (
        <>
          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {selectedExam.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedExam.totalQuestions} questions &middot;{' '}
                  {selectedExam.maxMarks} max marks &middot; {selectedExam.date}
                </p>
              </div>
              <button
                onClick={handleSaveScheme}
                disabled={schemeSaving}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-save-line mr-1.5"></i>{' '}
                {schemeSaving ? 'Saving...' : 'Save Scheme'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Question
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Max Marks
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Sub-total
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Guidelines
                    </th>
                    <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schemeQuestions.map((q) => (
                    <SchemeQuestionRow
                      key={`q-${q.questionNum}`}
                      question={q}
                      onAddSubPart={handleAddSubPart}
                      onRemoveSubPart={handleRemoveSubPart}
                      onConvertToSubParts={handleConvertToSubParts}
                      onSubPartMarkChange={handleSubPartMarkChange}
                      onSubPartGuidelineChange={handleSubPartGuidelineChange}
                      onDirectMarkChange={handleDirectMarkChange}
                      onDirectGuidelineChange={handleDirectGuidelineChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 bg-gray-50 rounded-xl px-5 py-3 flex-wrap gap-3">
              <div className="flex items-center gap-4 flex-wrap text-xs text-gray-600">
                <span>
                  Total questions:{' '}
                  <strong className="text-gray-900">
                    {schemeQuestions.length}
                  </strong>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  Total sub-parts:{' '}
                  <strong className="text-gray-900">{totalSubParts}</strong>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  Total marks:{' '}
                  <strong className="text-gray-900">{realTotalMarks}</strong>
                </span>
              </div>
              <button
                onClick={handleSaveScheme}
                disabled={schemeSaving}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-save-line mr-1.5"></i>{' '}
                {schemeSaving ? 'Saving...' : 'Save Scheme'}
              </button>
            </div>
          </div>

          {/* ─── PDF UPLOAD SECTION ────────────────────────────── */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model Answer PDF */}
            <div className="bg-white rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Model Answer PDF
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                Visible to checkers during evaluation
              </p>

              {modelAnswerPdf ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                      <i className="ri-file-pdf-line text-rose-500 text-lg"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={modelAnswerPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 truncate hover:text-rose-600 transition-colors block"
                      >
                        {modelAnswerPdf.split('/').pop() || 'Model Answer.pdf'}
                      </a>
                      <p className="text-xs text-gray-400">Click to view PDF</p>
                    </div>
                    <button
                      onClick={() => handleDeletePDF('model_answer')}
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Delete PDF"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors duration-150 cursor-pointer whitespace-nowrap">
                    <i className="ri-upload-cloud-line"></i> Replace File
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleModelAnswerUpload}
                      disabled={uploadingModelAnswer}
                    />
                  </label>
                  {uploadingModelAnswer && (
                    <p className="text-xs text-gray-400">Uploading...</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    No model answer uploaded yet.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors duration-150 cursor-pointer whitespace-nowrap">
                    <i className="ri-upload-cloud-line"></i> Upload Model Answer
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleModelAnswerUpload}
                      disabled={uploadingModelAnswer}
                    />
                  </label>
                  {uploadingModelAnswer && (
                    <p className="text-xs text-gray-400">Uploading...</p>
                  )}
                </div>
              )}
            </div>

            {/* Question Paper PDF */}
            <div className="bg-white rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Question Paper PDF
              </h4>
              <p className="text-xs text-gray-400 mb-4">
                Visible to all evaluators
              </p>

              {questionPaperPdf ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                      <i className="ri-file-pdf-line text-sky-500 text-lg"></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={questionPaperPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 truncate hover:text-sky-600 transition-colors block"
                      >
                        {questionPaperPdf.split('/').pop() ||
                          'Question Paper.pdf'}
                      </a>
                      <p className="text-xs text-gray-400">Click to view PDF</p>
                    </div>
                    <button
                      onClick={() => handleDeletePDF('question_paper')}
                      className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Delete PDF"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors duration-150 cursor-pointer whitespace-nowrap">
                    <i className="ri-upload-cloud-line"></i> Replace File
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleQuestionPaperUpload}
                      disabled={uploadingQuestionPaper}
                    />
                  </label>
                  {uploadingQuestionPaper && (
                    <p className="text-xs text-gray-400">Uploading...</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    No question paper uploaded yet.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors duration-150 cursor-pointer whitespace-nowrap">
                    <i className="ri-upload-cloud-line"></i> Upload Question
                    Paper
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleQuestionPaperUpload}
                      disabled={uploadingQuestionPaper}
                    />
                  </label>
                  {uploadingQuestionPaper && (
                    <p className="text-xs text-gray-400">Uploading...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedExam && filteredExams.length > 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-file-search-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            Select an exam above to view and edit its mark scheme.
          </p>
        </div>
      )}

      {!selectedExam && !examsLoading && filteredExams.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-folder-open-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm text-gray-500">
            No exams found. Create an exam first.
          </p>
        </div>
      )}

      {showFormatGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowFormatGuide(false)}
          ></div>
          <div className="relative bg-white rounded-2xl w-full max-w-xl mx-4 p-6 shadow-2xl">
            <button
              onClick={() => setShowFormatGuide(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors duration-150 cursor-pointer"
            >
              <i className="ri-close-line text-gray-500"></i>
            </button>

            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Expected Excel Format
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Your Excel file should have these columns in the first row:
            </p>

            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Column
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Roll No
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Student roll number
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Student Name
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Full name of the student
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Course
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Course name (e.g. B.Tech)
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Branch
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Branch code (e.g. CSE, ECE)
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Semester
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Current semester number
                  </td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Subject
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Subject name
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium text-gray-900 whitespace-nowrap">
                    Barcode
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">
                    Unique barcode ID (e.g. BAR001)
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ri-information-line text-amber-500 text-sm"></i>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Each student has one row per subject. Barcode must match the
                  barcode printed on their answer sheet.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFormatGuide(false)}
              className="mt-5 w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors duration-150 whitespace-nowrap cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SchemeQuestionRow({
  question,
  onAddSubPart,
  onRemoveSubPart,
  onConvertToSubParts,
  onSubPartMarkChange,
  onSubPartGuidelineChange,
  onDirectMarkChange,
  onDirectGuidelineChange,
}: {
  question: SchemeQuestion;
  onAddSubPart: (qNum: number) => void;
  onRemoveSubPart: (qNum: number, subLabel: string) => void;
  onConvertToSubParts: (qNum: number) => void;
  onSubPartMarkChange: (qNum: number, subLabel: string, val: number) => void;
  onSubPartGuidelineChange: (
    qNum: number,
    subLabel: string,
    val: string,
  ) => void;
  onDirectMarkChange: (qNum: number, val: number) => void;
  onDirectGuidelineChange: (qNum: number, val: string) => void;
}) {
  const hasSubParts = question.subParts.length > 0;
  const subTotal = hasSubParts
    ? question.subParts.reduce((sum, sp) => sum + sp.maxMarks, 0)
    : question.maxMarks;

  return (
    <>
      <tr className="border-b border-gray-100 bg-white">
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
              Q{question.questionNum}
            </span>
            {hasSubParts && (
              <span className="text-[11px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                {question.subParts.length} part
                {question.subParts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3">
          {hasSubParts ? (
            <span className="text-xs text-gray-400 italic">auto</span>
          ) : (
            <input
              type="number"
              min={0}
              className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={question.maxMarks}
              onChange={(e) =>
                onDirectMarkChange(
                  question.questionNum,
                  Number(e.target.value) || 0,
                )
              }
            />
          )}
        </td>
        <td className="py-3 px-3">
          <span className="text-sm font-medium text-gray-900">{subTotal}</span>
        </td>
        <td className="py-3 px-3">
          {hasSubParts ? (
            <span className="text-xs text-gray-400 italic">
              Set per sub-part
            </span>
          ) : (
            <textarea
              rows={1}
              className="w-full min-w-[200px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={question.guidelines}
              onChange={(e) =>
                onDirectGuidelineChange(question.questionNum, e.target.value)
              }
              placeholder="Enter guidelines..."
            />
          )}
        </td>
        <td className="py-3 px-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {hasSubParts ? (
              <button
                onClick={() => onAddSubPart(question.questionNum)}
                className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors duration-150 cursor-pointer"
                title="Add sub-part"
              >
                <i className="ri-add-line text-sm"></i>
              </button>
            ) : (
              <button
                onClick={() => onConvertToSubParts(question.questionNum)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-layout-column-line mr-1"></i> sub-parts
              </button>
            )}
          </div>
        </td>
      </tr>

      {hasSubParts &&
        question.subParts.map((sp) => (
          <tr
            key={`${question.questionNum}-${sp.label}`}
            className="border-b border-gray-50 bg-gray-50/50 hover:bg-gray-100/50 transition-colors duration-100"
          >
            <td className="py-2.5 px-3 pl-8">
              <span className="text-sm text-gray-500 whitespace-nowrap">
                Q{question.questionNum}({sp.label})
              </span>
            </td>
            <td className="py-2.5 px-3">
              <input
                type="number"
                min={0}
                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 text-center bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={sp.maxMarks}
                onChange={(e) =>
                  onSubPartMarkChange(
                    question.questionNum,
                    sp.label,
                    Number(e.target.value) || 0,
                  )
                }
              />
            </td>
            <td className="py-2.5 px-3">
              <span className="text-sm text-gray-500">{sp.maxMarks}</span>
            </td>
            <td className="py-2.5 px-3">
              <textarea
                rows={1}
                className="w-full min-w-[200px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={sp.guidelines}
                onChange={(e) =>
                  onSubPartGuidelineChange(
                    question.questionNum,
                    sp.label,
                    e.target.value,
                  )
                }
                placeholder="Enter guidelines..."
              />
            </td>
            <td className="py-2.5 px-3 text-right">
              <button
                onClick={() => onRemoveSubPart(question.questionNum, sp.label)}
                className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors duration-150 cursor-pointer"
                title="Remove sub-part"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}
