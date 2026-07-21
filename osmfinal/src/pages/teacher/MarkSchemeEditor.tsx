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

type ViewMode = 'list' | 'editor';

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
  const grouped: {
    [key: number]: {
      subLabel: string | null;
      maxMarks: number;
      guidelines: string;
    }[];
  } = {};

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
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [modelAnswerFile, setModelAnswerFile] = useState<File | null>(null);
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);

  const [examList, setExamList] = useState<ExamResponse[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [isUserLoaded, setIsUserLoaded] = useState(!!currentUser);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [listSearch, setListSearch] = useState('');
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      console.log('🔍 User loaded:', currentUser);
      setIsUserLoaded(true);
    }
  }, [currentUser]);

  const fetchExams = useCallback(async () => {
    try {
      setExamsLoading(true);
      const res = await examApi.getAllExams({
        limit: 1000,
        excludeArchived: true,
      });
      setExamList(res.data);
    } catch (error) {
      console.error('Failed to fetch exams:', error);
    } finally {
      setExamsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const filteredExams = useMemo(() => {
    const role = currentUser?.role ?? '';
    const subject = currentUser?.subject ?? '';

    if (!isUserLoaded) return [];

    let exams = examList;
    exams = exams.filter((e) => e.status !== 'archived');

    if (role === 'admin' || role === 'teacher_checker') {
      return exams;
    }

    if (role === 'teacher') {
      if (subject) {
        exams = exams.filter(
          (e) => e.subject.toLowerCase() === subject.toLowerCase(),
        );
      } else {
        return [];
      }
    }

    return exams;
  }, [currentUser?.role, currentUser?.subject, examList, isUserLoaded]);

  const searchedExams = useMemo(() => {
    if (!listSearch.trim()) return filteredExams;
    const q = listSearch.trim().toLowerCase();
    return filteredExams.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q),
    );
  }, [filteredExams, listSearch]);

  const hasScheme = (exam: ExamResponse): boolean => {
    return (exam.totalQuestions ?? 0) > 0 || (exam.maxMarks ?? 0) > 0;
  };

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [schemeQuestions, setSchemeQuestions] = useState<SchemeQuestion[]>([]);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeSaving, setSchemeSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

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

  // ─── ✅ VALIDATION CHECKS ────────────────────────────────────

  // ✅ Check if all required files are uploaded for saving
  const canSaveScheme = useMemo(() => {
    if (schemeQuestions.length === 0) return false;
    if (!modelAnswerPdf && !modelAnswerFile) return false;
    if (!questionPaperPdf && !questionPaperFile) return false;
    return true;
  }, [
    schemeQuestions,
    modelAnswerPdf,
    modelAnswerFile,
    questionPaperPdf,
    questionPaperFile,
  ]);

  // ✅ Get validation error message for save
  const getSaveValidationError = useCallback(() => {
    if (schemeQuestions.length === 0) {
      return 'Please generate or add at least one question first.';
    }
    if (!modelAnswerPdf && !modelAnswerFile) {
      return 'Please upload the Model Answer PDF first.';
    }
    if (!questionPaperPdf && !questionPaperFile) {
      return 'Please upload the Question Paper PDF first.';
    }
    return null;
  }, [
    schemeQuestions.length,
    modelAnswerPdf,
    modelAnswerFile,
    questionPaperPdf,
    questionPaperFile,
  ]);

  // ✅ Check if PDFs are uploaded for generating scheme
  const canGenerateScheme = useMemo(() => {
    return (
      !!(modelAnswerPdf || modelAnswerFile) &&
      !!(questionPaperPdf || questionPaperFile)
    );
  }, [modelAnswerPdf, modelAnswerFile, questionPaperPdf, questionPaperFile]);

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

  const openCreateOrEdit = async (examId: string) => {
    setViewMode('editor');
    await handleExamChange(examId);
  };

  const backToList = () => {
    setViewMode('list');
    setSelectedExamId(null);
    setSchemeQuestions([]);
    setModelAnswerFile(null);
    setQuestionPaperFile(null);
    setModelAnswerPdf(null);
    setQuestionPaperPdf(null);
    setShowExcelUpload(false);
    setExcelPreviewVisible(false);
  };

  const handleDeleteScheme = async (examId: string, examName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the entire mark scheme for "${examName}"? This will remove all questions, marks, guidelines and uploaded PDFs. This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingExamId(examId);
    try {
      const response = await markSchemeApi.deleteByExam(examId);
      if (response.success) {
        showToast('Mark scheme deleted successfully', 'success');
        await fetchExams();

        if (selectedExamId === examId) {
          backToList();
        }
      } else {
        showToast(response.message || 'Failed to delete mark scheme', 'error');
      }
    } catch (error: any) {
      console.error('Delete mark scheme error:', error);
      showToast(error.message || 'Failed to delete mark scheme', 'error');
    } finally {
      setDeletingExamId(null);
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
        console.log('✅ Model Answer uploaded:', response.data.url);
        setModelAnswerPdf(response.data.url);
        setModelAnswerFile(file);
        showToast('Model answer uploaded successfully', 'success');
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
        console.log('✅ Question Paper uploaded:', response.data.url);
        setQuestionPaperPdf(response.data.url);
        setQuestionPaperFile(file);
        showToast('Question paper uploaded successfully', 'success');
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
          setModelAnswerFile(null);
        } else {
          setQuestionPaperPdf(null);
          setQuestionPaperFile(null);
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
    // ✅ Check if PDFs are uploaded
    if (!canGenerateScheme) {
      showToast(
        'Please upload both Question Paper and Model Answer PDFs first.',
        'error',
      );
      return;
    }

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

  const handleDeleteQuestion = useCallback((qNum: number) => {
    if (!window.confirm(`Remove Question ${qNum} entirely from this scheme?`)) {
      return;
    }
    setSchemeQuestions((prev) => {
      const filtered = prev.filter((q) => q.questionNum !== qNum);
      return filtered.map((q, i) => ({ ...q, questionNum: i + 1 }));
    });
  }, []);

  const handleAddQuestion = useCallback(() => {
    setSchemeQuestions((prev) => [
      ...prev,
      {
        questionNum: prev.length + 1,
        subParts: [],
        guidelines: '',
        maxMarks: 3,
      },
    ]);
  }, []);

  const totalSubParts = useMemo(() => {
    return schemeQuestions.reduce((sum, q) => sum + q.subParts.length, 0);
  }, [schemeQuestions]);

  // ─── SAVE SCHEME (with validation) ──────────────────────────

  const handleSaveScheme = async () => {
    if (!selectedExamId) {
      showToast('No exam selected', 'error');
      return;
    }

    // ✅ Validation check
    const validationError = getSaveValidationError();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

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
      const response = await markSchemeApi.save(selectedExamId, flattened, {
        model_answer: modelAnswerFile || undefined,
        question_paper: questionPaperFile || undefined,
      });

      if (response.success) {
        showToast('Mark scheme saved successfully', 'success');
        setModelAnswerFile(null);
        setQuestionPaperFile(null);
        await handleExamChange(selectedExamId);
        await fetchExams();
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

    const grouped: {
      [key: number]: { label: string; maxMarks: number; guidelines: string }[];
    } = {};

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
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
          {currentUser?.role === 'admin'
            ? 'All Subjects'
            : currentUser?.subject || 'No Subject'}
        </span>
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
            <i className="ri-information-line text-sky-500 text-sm"></i>
          </div>
          <p className="text-xs text-sky-700 leading-relaxed">
            Mark schemes are created by the subject teacher and used by checkers
            as reference during evaluation. Both Question Paper and Model Answer
            PDFs are required before saving.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* LIST VIEW */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                All Mark Schemes
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                View, create, edit, or delete mark schemes for your exams.
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center text-gray-400">
                <i className="ri-search-line text-xs"></i>
              </span>
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Search exam or subject..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent w-64 placeholder:text-gray-400"
              />
            </div>
          </div>

          {examsLoading || !isUserLoaded ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-400 mt-3">Loading exams...</p>
            </div>
          ) : searchedExams.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-folder-open-line text-gray-400 text-2xl"></i>
              </div>
              <p className="text-sm text-gray-500">
                {currentUser?.role === 'teacher' && !currentUser?.subject
                  ? 'No subject assigned to you. Please contact admin.'
                  : 'No exams found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Exam
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Subject
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Questions
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Max Marks
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searchedExams.map((exam) => {
                    const created = hasScheme(exam);
                    const matchedSubject = mockSubjects.find(
                      (s) => s.name === exam.subject,
                    );
                    const isDeleting = deletingExamId === exam.id;

                    return (
                      <tr
                        key={exam.id}
                        className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                          {exam.name}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {exam.subject}
                          {matchedSubject ? ` (${matchedSubject.code})` : ''}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                          {exam.date}
                        </td>
                        <td className="py-3 px-4">
                          {created ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              <i className="ri-checkbox-circle-fill"></i>{' '}
                              Created
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              <i className="ri-error-warning-line"></i> Not
                              Created
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {created ? (exam.totalQuestions ?? '—') : '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {created ? (exam.maxMarks ?? '—') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openCreateOrEdit(exam.id)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                                created
                                  ? 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100'
                                  : 'text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              <i
                                className={
                                  created
                                    ? 'ri-edit-line mr-0.5'
                                    : 'ri-add-line mr-0.5'
                                }
                              ></i>
                              {created ? 'Edit' : 'Create'}
                            </button>

                            {created && (
                              <button
                                onClick={() =>
                                  handleDeleteScheme(exam.id, exam.name)
                                }
                                disabled={isDeleting}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isDeleting ? (
                                  <>
                                    <span className="inline-block w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin mr-1"></span>
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <i className="ri-delete-bin-line mr-0.5"></i>
                                    Delete
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* EDITOR VIEW */}
      {/* ══════════════════════════════════════════════════════════ */}
      {viewMode === 'editor' && (
        <>
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
            <button
              onClick={backToList}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              title="Back to all mark schemes"
            >
              <i className="ri-arrow-left-line text-lg"></i>
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {selectedExam ? selectedExam.name : 'Loading...'}
              </p>
              <p className="text-xs text-gray-400">
                {selectedExam?.subject} · {selectedExam?.date}
              </p>
            </div>
          </div>

          {selectedExam && schemeLoading && (
            <div className="bg-white rounded-2xl p-12 text-center">
              <p className="text-sm text-gray-500">Loading mark scheme...</p>
            </div>
          )}

          {/* ─── SETUP MODE - No Scheme Yet ─────────────────────── */}

          {selectedExam && !schemeLoading && !hasExistingScheme && (
            <div className="bg-white rounded-2xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Setup Mark Scheme — {selectedExam.name}
              </h3>
              <p className="text-xs text-gray-400 mb-5">
                First upload the required PDFs, then configure the question
                structure.
              </p>

              {/* ✅ PDF Upload Required Banner */}
              <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <i className="ri-information-line text-amber-500 text-sm mt-0.5"></i>
                  <div>
                    <p className="text-sm font-medium text-amber-700">
                      Both PDFs are required before generating the mark scheme
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Please upload the Question Paper PDF and Model Answer PDF
                      first.
                    </p>
                  </div>
                </div>
              </div>

              {/* PDF Upload Section in Setup Mode */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Model Answer PDF */}
                <div
                  className={`bg-gray-50 rounded-xl p-4 border-2 ${!modelAnswerPdf && !modelAnswerFile ? 'border-amber-200' : 'border-emerald-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Model Answer PDF <span className="text-rose-500">*</span>
                    </h4>
                    {modelAnswerPdf || modelAnswerFile ? (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ✓ Uploaded
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  {modelAnswerPdf ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={modelAnswerPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate"
                      >
                        {modelAnswerPdf.split('/').pop()}
                      </a>
                      <button
                        onClick={() => handleDeletePDF('model_answer')}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                      <i className="ri-upload-cloud-line"></i> Upload
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleModelAnswerUpload}
                        disabled={uploadingModelAnswer}
                      />
                    </label>
                  )}
                  {uploadingModelAnswer && (
                    <p className="text-xs text-gray-400 mt-1">Uploading...</p>
                  )}
                </div>

                {/* Question Paper PDF */}
                <div
                  className={`bg-gray-50 rounded-xl p-4 border-2 ${!questionPaperPdf && !questionPaperFile ? 'border-amber-200' : 'border-emerald-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Question Paper PDF{' '}
                      <span className="text-rose-500">*</span>
                    </h4>
                    {questionPaperPdf || questionPaperFile ? (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ✓ Uploaded
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  {questionPaperPdf ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={questionPaperPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate"
                      >
                        {questionPaperPdf.split('/').pop()}
                      </a>
                      <button
                        onClick={() => handleDeletePDF('question_paper')}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                      <i className="ri-upload-cloud-line"></i> Upload
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleQuestionPaperUpload}
                        disabled={uploadingQuestionPaper}
                      />
                    </label>
                  )}
                  {uploadingQuestionPaper && (
                    <p className="text-xs text-gray-400 mt-1">Uploading...</p>
                  )}
                </div>
              </div>

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
                  disabled={!canGenerateScheme}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    canGenerateScheme
                      ? 'bg-gray-900 text-white hover:bg-gray-800'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title={
                    !canGenerateScheme ? 'Please upload both PDFs first' : ''
                  }
                >
                  <i className="ri-play-line mr-1.5"></i> Generate Scheme
                </button>
                {/* <button
                  onClick={() => {
                    setShowExcelUpload(true);
                    setExcelPreviewVisible(false);
                    setSetupError('');
                  }}
                  disabled={!canGenerateScheme}
                  className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    canGenerateScheme
                      ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <i className="ri-upload-cloud-line mr-1.5"></i> Upload Excel
                  instead
                </button> */}
                {/* <button
                  onClick={() => setShowFormatGuide(true)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-file-text-line mr-1.5"></i> Format Guide
                </button> */}
              </div>

              {!canGenerateScheme && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-4 py-2.5">
                  <i className="ri-error-warning-line mr-1.5"></i>
                  Please upload both Question Paper and Model Answer PDFs before
                  generating the mark scheme.
                </p>
              )}

              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3">
                <i className="ri-information-line mr-1 text-gray-400"></i>
                These are starting defaults. You can change sub-parts and marks
                for each question individually in the next step.
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
                        <i className="ri-folder-open-line mr-1.5"></i> Browse
                        Files
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
                          <i className="ri-check-line mr-1.5"></i> Confirm
                          Import
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

          {/* ─── EXISTING SCHEME - Editor ────────────────────────── */}

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
                      {selectedExam.maxMarks} max marks &middot;{' '}
                      {selectedExam.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleDeleteScheme(selectedExam.id, selectedExam.name)
                      }
                      disabled={deletingExamId === selectedExam.id}
                      className="px-4 py-2.5 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-100 transition-colors duration-150 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <i className="ri-delete-bin-line mr-1.5"></i> Delete
                      Scheme
                    </button>
                    <button
                      onClick={handleSaveScheme}
                      disabled={!canSaveScheme || schemeSaving}
                      className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                        canSaveScheme && !schemeSaving
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={
                        !canSaveScheme ? getSaveValidationError() || '' : ''
                      }
                    >
                      <i className="ri-save-line mr-1.5"></i>{' '}
                      {schemeSaving ? 'Saving...' : 'Save Scheme'}
                    </button>
                  </div>
                </div>

                {/* ✅ Validation Banner */}
                {!canSaveScheme && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <i className="ri-error-warning-line text-amber-500 text-sm mt-0.5"></i>
                      <div>
                        <p className="text-sm font-medium text-amber-700">
                          {!modelAnswerPdf && !modelAnswerFile
                            ? 'Model Answer PDF is required'
                            : !questionPaperPdf && !questionPaperFile
                              ? 'Question Paper PDF is required'
                              : 'Please upload both PDFs before saving'}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          {!modelAnswerPdf && !modelAnswerFile
                            ? 'Upload the Model Answer PDF using the section below.'
                            : !questionPaperPdf && !questionPaperFile
                              ? 'Upload the Question Paper PDF using the section below.'
                              : 'Both Model Answer and Question Paper PDFs are required to save the mark scheme.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                          onSubPartGuidelineChange={
                            handleSubPartGuidelineChange
                          }
                          onDirectMarkChange={handleDirectMarkChange}
                          onDirectGuidelineChange={handleDirectGuidelineChange}
                          onDeleteQuestion={handleDeleteQuestion}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={handleAddQuestion}
                  className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors duration-150 whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-add-line mr-1.5"></i> Add Question
                </button>

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
                      <strong className="text-gray-900">
                        {realTotalMarks}
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={handleSaveScheme}
                    disabled={!canSaveScheme || schemeSaving}
                    className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                      canSaveScheme && !schemeSaving
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    title={!canSaveScheme ? getSaveValidationError() || '' : ''}
                  >
                    <i className="ri-save-line mr-1.5"></i>{' '}
                    {schemeSaving ? 'Saving...' : 'Save Scheme'}
                  </button>
                </div>
              </div>

              {/* PDF UPLOAD SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Model Answer PDF */}
                <div
                  className={`bg-white rounded-2xl p-6 border-2 ${!modelAnswerPdf && !modelAnswerFile ? 'border-amber-200' : 'border-transparent'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Model Answer PDF <span className="text-rose-500">*</span>
                    </h4>
                    {!modelAnswerPdf && !modelAnswerFile ? (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ✓ Uploaded
                      </span>
                    )}
                  </div>
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
                            {modelAnswerPdf.split('/').pop() ||
                              'Model Answer.pdf'}
                          </a>
                          <p className="text-xs text-gray-400">
                            Click to view PDF
                          </p>
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
                        <i className="ri-upload-cloud-line"></i> Upload Model
                        Answer
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
                <div
                  className={`bg-white rounded-2xl p-6 border-2 ${!questionPaperPdf && !questionPaperFile ? 'border-amber-200' : 'border-transparent'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Question Paper PDF{' '}
                      <span className="text-rose-500">*</span>
                    </h4>
                    {!questionPaperPdf && !questionPaperFile ? (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ✓ Uploaded
                      </span>
                    )}
                  </div>
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
                          <p className="text-xs text-gray-400">
                            Click to view PDF
                          </p>
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
        </>
      )}

      {/* ─── FORMAT GUIDE MODAL ────────────────────────────────── */}

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

// ─── SCHEME QUESTION ROW COMPONENT ──────────────────────────

function SchemeQuestionRow({
  question,
  onAddSubPart,
  onRemoveSubPart,
  onConvertToSubParts,
  onSubPartMarkChange,
  onSubPartGuidelineChange,
  onDirectMarkChange,
  onDirectGuidelineChange,
  onDeleteQuestion,
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
  onDeleteQuestion: (qNum: number) => void;
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
            <button
              onClick={() => onDeleteQuestion(question.questionNum)}
              className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors duration-150 cursor-pointer"
              title="Delete this question"
            >
              <i className="ri-delete-bin-line text-sm"></i>
            </button>
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
