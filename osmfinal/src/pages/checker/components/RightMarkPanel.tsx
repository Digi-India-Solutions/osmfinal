// src/pages/checker/components/RightMarkPanel.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { MarkEntry, RightTab } from '../MarkingView';

function getQuestionGroupKey(criterion: string): string {
  const match = criterion.match(/^(?:Q|Qn)?(\d+)/i);
  if (match) {
    return match[1];
  }
  return criterion || '1';
}

interface RightMarkPanelProps {
  marks: MarkEntry[];
  activeMarkId: string | null;
  questionPage: number;
  totalAwarded: number;
  totalMax: number;
  rightTab: RightTab;
  hasModelAnswer: boolean;
  readOnly?: boolean;
  saveIndicatorText?: string;
  saveIndicatorFresh?: boolean;
  questionPaperUrl?: string | null;
  modelAnswerUrl?: string | null;
  minTimeRequired?: number;
  isTimeRequirementMet?: boolean;
  onActiveMarkChange: (id: string) => void;
  onQuestionPageChange: (page: number) => void;
  onMarkUpdate: (id: string, awarded: number) => void;
  onRemarkUpdate: (id: string, remark: string) => void;
  onRequestAddMark: (markId: string, value: number) => void;
  onClearStampValue: (markId: string) => void;
  onRightTabChange: (tab: RightTab) => void;
  onEscalate: () => void;
  onSubmitContinue: () => void;
  onSubmitExit: () => void;
}


export default function RightMarkPanel({
  marks,
  activeMarkId,
  questionPage,
  totalAwarded,
  totalMax,
  rightTab,
  hasModelAnswer,
  readOnly = false,
  saveIndicatorText = 'Auto-saves every 30s',
  saveIndicatorFresh = false,
  questionPaperUrl = null,
  modelAnswerUrl = null,
  minTimeRequired = 0,
  isTimeRequirementMet = true,
  onActiveMarkChange,
  onQuestionPageChange,
  onMarkUpdate,
  onRemarkUpdate,
  onRequestAddMark,
  onClearStampValue,
  onRightTabChange,
  onEscalate,
  onSubmitContinue,
  onSubmitExit,
}: RightMarkPanelProps) {
  // ─── Shared numpad state ───
  const [displayValue, setDisplayValue] = useState('');
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    type: 'questions' | 'answers';
    url: string;
    title: string;
  } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const activeMark = marks.find((m) => m.id === activeMarkId);
  const activeMax = activeMark?.max ?? 0;

  useEffect(() => {
    if (activeMark) {
      setDisplayValue(activeMark.awarded > 0 ? String(activeMark.awarded) : '');
    } else {
      setDisplayValue('');
    }
  }, [activeMarkId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add these after your other hooks/calculations
  const hasAnyMarks = marks.some((m) => m.awarded > 0);
  const allMarksComplete =
    marks.length > 0 && marks.every((m) => m.awarded > 0);

  const totalQuestions = marks.length;

  // Group marks by main question number (e.g. 1i, 1ii => Question 1)
  const questionGroups = useMemo(() => {
    const map = new Map<string, MarkEntry[]>();
    marks.forEach((m) => {
      const key = getQuestionGroupKey(m.criterion);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(m);
    });
    return map;
  }, [marks]);

  const groupKeys = useMemo(() => Array.from(questionGroups.keys()), [questionGroups]);

  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  // Sync selectedGroupIndex when activeMarkId changes
  useEffect(() => {
    if (activeMarkId && marks.length > 0) {
      const activeMark = marks.find((m) => m.id === activeMarkId);
      if (activeMark) {
        const activeGroupKey = getQuestionGroupKey(activeMark.criterion);
        const idx = groupKeys.indexOf(activeGroupKey);
        if (idx !== -1 && idx !== selectedGroupIndex) {
          setSelectedGroupIndex(idx);
        }
      }
    }
  }, [activeMarkId, groupKeys, marks]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeGroupIndex = Math.min(
    Math.max(0, selectedGroupIndex),
    Math.max(0, groupKeys.length - 1),
  );
  const currentGroupKey = groupKeys[safeGroupIndex] || '';
  const currentQuestionMarks = questionGroups.get(currentGroupKey) || [];

  // Handle manual question group switching (via Left / Right arrows)
  const handleGroupChange = useCallback(
    (newIndex: number) => {
      const clampedIndex = Math.min(
        Math.max(0, newIndex),
        Math.max(0, groupKeys.length - 1),
      );
      setSelectedGroupIndex(clampedIndex);
      const targetGroupKey = groupKeys[clampedIndex];
      if (targetGroupKey) {
        const firstMark = questionGroups.get(targetGroupKey)?.[0];
        if (firstMark && !readOnly) {
          onActiveMarkChange(firstMark.id);
        }
      }
    },
    [groupKeys, questionGroups, readOnly, onActiveMarkChange],
  );

  const displayNumeric =
    displayValue === '' ? 0 : parseFloat(displayValue) || 0;
  const hasDecimal = displayValue.includes('.');
  const isEmpty = displayValue === '';

  // ─── Numpad handlers ───
  const handleDigit = useCallback(
    (digit: number) => {
      setDisplayValue((prev) => {
        const candidate = prev + String(digit);
        const num = parseFloat(candidate);
        if (num > activeMax) return prev;
        return candidate;
      });
    },
    [activeMax],
  );

  const handleDecimal = useCallback(() => {
    if (hasDecimal || isEmpty) return;
    setDisplayValue((prev) => prev + '.');
  }, [hasDecimal, isEmpty]);

  const handleHalf = useCallback(() => {
    setDisplayValue((prev) => {
      const current = prev === '' ? 0 : parseFloat(prev) || 0;
      const next = current + 0.5;
      if (next > activeMax) return prev;
      const s = String(next);
      return s.endsWith('.0') ? String(Math.floor(next)) : s;
    });
  }, [activeMax]);

  const handleBackspace = useCallback(() => {
    setDisplayValue((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setDisplayValue('');
    if (activeMarkId) {
      onClearStampValue(activeMarkId);
    }
  }, [activeMarkId, onClearStampValue]);

  const handleAddMark = useCallback(() => {
    if (!activeMarkId || isEmpty) return;
    const num = parseFloat(displayValue) || 0;
    const capped = Math.min(num, activeMax);
    onRequestAddMark(activeMarkId, capped);
  }, [activeMarkId, isEmpty, displayValue, activeMax, onRequestAddMark]);

  const digitDisabled = (digit: number) => digit > activeMax;
  const halfDisabled = displayNumeric + 0.5 > activeMax;
  const decimalDisabled = hasDecimal || isEmpty;

  // ─── Tab config ───
  const tabs: { key: RightTab; icon: string; label: string }[] = [
    { key: 'marks', icon: 'ri-list-check', label: 'Marks' },
    { key: 'questions', icon: 'ri-file-list-3-line', label: 'Q. Paper' },
    { key: 'answerSheet', icon: 'ri-check-double-line', label: 'Ans. Sheet' },
  ];

  // Progress — how many marks have been set (awarded > 0)
  const completedCount = marks.filter((m) => m.awarded > 0).length;
  const progressPct =
    totalQuestions > 0
      ? Math.round((completedCount / totalQuestions) * 100)
      : 0;

  const submitDisabled = readOnly;

  // ─── Open preview modal ───
  const openPreview = (type: 'questions' | 'answers', url: string) => {
    if (!url) return;
    setPreviewModal({
      open: true,
      type,
      url,
      title: type === 'questions' ? 'Question Paper' : 'Model Answer Sheet',
    });
  };

  // ─── Close preview modal ───
  const closePreview = () => {
    setPreviewModal(null);
  };

  // ─── Keyboard: ESC to close preview ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewModal?.open) {
        closePreview();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewModal]);

  return (
    <aside className="flex-1 min-h-0 w-full shrink-0 bg-[#1e293b] flex flex-col border-l border-slate-700">
      {/* ─── THREE TABS ─── */}
      <div className="flex border-b border-slate-700 shrink-0">
        {tabs.map((tab) => {
          const isActive = rightTab === tab.key;
          const isAnswerSheet = tab.key === 'answerSheet';
          const activeBorder = isAnswerSheet ? '#639922' : '#0ea5e9';
          const activeText = isAnswerSheet ? '#639922' : '#0ea5e9';
          return (
            <button
              key={tab.key}
              onClick={() => onRightTabChange(tab.key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              style={{
                color: isActive ? activeText : '#94a3b8',
                borderBottom: isActive
                  ? `2px solid ${activeBorder}`
                  : '2px solid transparent',
              }}
            >
              <i className={`${tab.icon} text-[13px]`}></i>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── SAVE INDICATOR ─── */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 border-b border-slate-700/50 shrink-0">
        {saveIndicatorFresh && (
          <span className="w-3 h-3 flex items-center justify-center">
            <i className="ri-check-line text-emerald-400 text-[10px]"></i>
          </span>
        )}
        <span
          className={`text-[9px] tabular-nums transition-colors duration-300 ${
            saveIndicatorFresh ? 'text-emerald-400' : 'text-slate-500'
          }`}
        >
          {saveIndicatorText}
        </span>
      </div>

      {/* ─── MINIMUM TIME INDICATOR ─── */}
      {minTimeRequired > 0 && (
        <div
          className={`shrink-0 px-3 py-1.5 text-center text-[10px] font-medium border-b ${
            isTimeRequirementMet
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {isTimeRequirementMet ? (
            <span className="flex items-center justify-center gap-1.5">
              <i className="ri-check-line text-xs"></i>
              Minimum time requirement met
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <i className="ri-timer-line text-xs"></i>
              Minimum {minTimeRequired} minute{minTimeRequired === 1 ? '' : 's'}{' '}
              required
            </span>
          )}
        </div>
      )}

      {/* ─── READ ONLY BANNER ─── */}
      {readOnly && (
        <div className="shrink-0 bg-slate-600/50 border-b border-slate-600 px-3 py-2 flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <i className="ri-lock-line text-slate-300 text-xs"></i>
          </div>
          <p className="text-[10px] text-slate-300 italic">
            Read Only — Viewing submitted evaluation
          </p>
        </div>
      )}

      {/* ─── CONTENT AREA ─── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ─── MARKS TAB ─── */}
        {rightTab === 'marks' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Progress bar */}
            {totalQuestions > 0 && (
              <div className="px-2.5 pt-2 pb-1 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-400 font-medium">Progress</span>
                  <span className="text-[9px] text-slate-300 tabular-nums font-semibold">
                    {completedCount}/{totalQuestions}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Question Group Nav Header */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-700/50 shrink-0 bg-slate-800/50">
              <button
                onClick={() => handleGroupChange(safeGroupIndex - 1)}
                disabled={safeGroupIndex === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Question"
              >
                <i className="ri-arrow-left-s-line text-sm"></i>
              </button>

              <div className="text-center min-w-0 flex-1 px-1">
                <span className="text-[11px] font-bold text-white tracking-wide block truncate">
                  {groupKeys.length === 0
                    ? 'No questions'
                    : `Question ${currentGroupKey}`}
                </span>
                {groupKeys.length > 0 && (
                  <span className="text-[9px] text-slate-400 block font-normal leading-none mt-0.5">
                    {safeGroupIndex + 1} of {groupKeys.length} 
                    {/* ({currentQuestionMarks.length} part{currentQuestionMarks.length === 1 ? '' : 's'}) */}
                  </span>
                )}
              </div>

              <button
                onClick={() => handleGroupChange(safeGroupIndex + 1)}
                disabled={safeGroupIndex >= groupKeys.length - 1}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Question"
              >
                <i className="ri-arrow-right-s-line text-sm"></i>
              </button>
            </div>

            {/* Marks table header */}
            <div className="grid grid-cols-[55px_32px_44px_1fr] gap-1 border-b border-slate-700/50 text-[10px] font-semibold text-slate-400 uppercase tracking-normal px-2.5 py-1.5 shrink-0 bg-slate-800/60">
              <span className="truncate">Criterion</span>
              <span className="text-center truncate">Max</span>
              <span className="text-center truncate">Award</span>
              <span className="truncate">Remark</span>
            </div>

            {/* Marks table rows for current question */}
            <div className="shrink-0">
              {currentQuestionMarks.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4">
                  <p className="text-[11px] text-slate-500 text-center">
                    No mark scheme loaded yet
                  </p>
                </div>
              ) : (
                currentQuestionMarks.map((m) => {
                  const isActive = activeMarkId === m.id;
                  const awardedStr = m.awarded === 0 ? '—' : String(m.awarded);

                  return (
                    <div
                      key={m.id}
                      onClick={() => !readOnly && onActiveMarkChange(m.id)}
                      className={`px-2.5 py-1.5 border-b border-slate-700/30 transition-colors ${
                        readOnly ? 'cursor-default' : 'cursor-pointer'
                      } ${
                        isActive
                          ? 'bg-sky-500/15 border-l-[3px] border-l-sky-400'
                          : 'border-l-[3px] border-l-transparent hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="grid grid-cols-[55px_32px_44px_1fr] items-center gap-1 text-[11px]">
                        <span className="text-slate-300 font-medium truncate" title={m.criterion}>
                          {m.criterion}
                        </span>
                        <span className="text-center text-slate-400 font-mono">
                          {m.max}
                        </span>
                        <span
                          className={`text-center font-mono tabular-nums text-[12px] font-semibold ${
                            m.awarded > 0 ? 'text-emerald-400' : 'text-slate-300'
                          }`}
                        >
                          {awardedStr}
                        </span>
                        <input
                          type="text"
                          value={m.remark}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onRemarkUpdate(m.id, e.target.value)}
                          placeholder="—"
                          disabled={readOnly}
                          className="w-full h-5 px-1.5 text-[10px] rounded border border-slate-600 bg-slate-800 text-slate-300 outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-600 disabled:opacity-60 disabled:cursor-default"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ─── SHARED NUMPAD ─── */}
            <div className="border-t border-slate-700 px-2.5 py-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400">
                  Entering marks for:
                </span>
                {activeMark ? (
                  <span className="text-[10px] font-semibold text-white bg-sky-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {activeMark.criterion}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">—</span>
                )}
              </div>

              <div className="flex items-baseline justify-between mb-2.5">
                <span
                  className={`text-2xl font-mono tabular-nums font-bold ${
                    isEmpty ? 'text-slate-500' : 'text-white'
                  }`}
                >
                  {isEmpty ? '—' : displayValue}
                </span>
                <span className="text-[10px] text-slate-400">
                  max {activeMax}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 mb-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    onClick={() => !readOnly && handleDigit(n)}
                    disabled={readOnly || digitDisabled(n)}
                    className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => !readOnly && handleDigit(0)}
                  disabled={readOnly || digitDisabled(0)}
                  className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                >
                  0
                </button>
                <button
                  onClick={() => !readOnly && handleHalf()}
                  disabled={readOnly || halfDisabled}
                  className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                >
                  ½
                </button>
                <button
                  onClick={() => !readOnly && handleDecimal()}
                  disabled={readOnly || decimalDisabled}
                  className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                >
                  .
                </button>
              </div>

              {/* <button
                onClick={() => !readOnly && handleBackspace()}
                disabled={readOnly || isEmpty}
                className="w-full h-7 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-1 mb-1.5 active:bg-slate-500"
              >
                <i className="ri-delete-back-2-line text-[11px]"></i>
                backspace
              </button> */}

              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => !readOnly && handleClear()}
                  disabled={readOnly || isEmpty}
                  className="h-7 rounded bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap active:bg-slate-400"
                >
                  Clear
                </button>
                <button
                  onClick={() => !readOnly && handleAddMark()}
                  disabled={readOnly || !activeMarkId || isEmpty}
                  className="h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-0.5 active:bg-emerald-400"
                >
                  Add Mark
                  <i className="ri-check-line text-[11px]"></i>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ─── ✅ QUESTION PAPER TAB — CLICKABLE PDF PREVIEW ─── */}
        {rightTab === 'questions' && (
          <div className="flex-1 flex flex-col min-h-0">
            {questionPaperUrl ? (
              <>
                {/* Info bar with click hint */}
                <div
                  className="shrink-0 px-3 py-2 flex items-center gap-2 bg-sky-500/10 border-b border-sky-500/20 cursor-pointer hover:bg-sky-500/20 transition-colors"
                  onClick={() => openPreview('questions', questionPaperUrl)}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i className="ri-file-pdf-line text-sky-400 text-sm"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-sky-300 font-medium truncate">
                      Question Paper
                    </p>
                  </div>
                  <span className="text-[9px] text-sky-400/70 flex items-center gap-1">
                    <i className="ri-fullscreen-line text-xs"></i>
                    Click to preview
                  </span>
                </div>

                {/* PDF Viewer - click to preview */}
                <div
                  className="flex-1 overflow-hidden bg-slate-800 cursor-pointer relative group"
                  onClick={() => openPreview('questions', questionPaperUrl)}
                >
                  <iframe
                    src={`${questionPaperUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Question Paper"
                    onError={() => setPdfError('Failed to load question paper')}
                  />
                  {/* Overlay with preview hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                    <div className="bg-sky-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                      <i className="ri-fullscreen-line"></i>
                      Click to view full screen
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* No question paper uploaded */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                    <i className="ri-file-unknow-line text-slate-400 text-lg"></i>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    No question paper uploaded yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ─── ✅ ANSWER SHEET TAB — CLICKABLE PDF PREVIEW ─── */}
        {rightTab === 'answerSheet' && (
          <div className="flex-1 flex flex-col min-h-0">
            {modelAnswerUrl ? (
              <>
                {/* Green info bar with click hint */}
                <div
                  className="shrink-0 px-3 py-2 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#EAF3DE' }}
                  onClick={() => openPreview('answers', modelAnswerUrl)}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i
                      className="ri-shield-check-line text-sm"
                      style={{ color: '#27500A' }}
                    ></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: '#27500A' }}
                    >
                      Model answer sheet
                    </p>
                  </div>
                  <span className="text-[9px]" style={{ color: '#27500A' }}>
                    <i className="ri-fullscreen-line text-xs mr-1"></i>
                    Click to preview
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
                    style={{
                      color: '#27500A',
                      backgroundColor: 'rgba(99,153,34,0.15)',
                    }}
                  >
                    Confidential
                  </span>
                </div>

                {/* PDF Viewer - click to preview */}
                <div
                  className="flex-1 overflow-hidden bg-slate-800 cursor-pointer relative group"
                  onClick={() => openPreview('answers', modelAnswerUrl)}
                >
                  <iframe
                    src={`${modelAnswerUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-full border-0 pointer-events-none"
                    title="Model Answer Sheet"
                    onError={() => setPdfError('Failed to load model answer')}
                  />
                  {/* Overlay with preview hint */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                    <div className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                      <i className="ri-fullscreen-line"></i>
                      Click to view full screen
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* No model answer uploaded */
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                    <i className="ri-file-unknow-line text-slate-400 text-lg"></i>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    No model answer sheet uploaded yet.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Contact the teacher.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ─── TOTAL BAR ─── */}
        <div className="border-t border-slate-700 px-3 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-300">
            Total Awarded:
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {totalAwarded}
            <span className="text-xs font-normal text-slate-400">
              {' '}
              / {totalMax}
            </span>
          </span>
        </div>
        {/* ─── ACTION BUTTONS ─── */}
       
        {!readOnly && rightTab === 'marks' && (
          <div className="px-2.5 pb-3 space-y-1.5 pt-1 shrink-0">
            {/* Escalate Button - Always clickable */}
            <button
              onClick={onEscalate}
              disabled={submitDisabled}
              title={
                !isTimeRequirementMet
                  ? `Minimum ${minTimeRequired} minute(s) required`
                  : undefined
              }
              className="w-full py-2 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-500 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-flag-line mr-1.5"></i>
              Escalate
            </button>

            {/* Submit Continue - Always enabled */}
            <button
              onClick={onSubmitContinue}
              disabled={submitDisabled}
              title={
                !isTimeRequirementMet
                  ? `Minimum ${minTimeRequired} minute(s) required`
                  : undefined
              }
              className="w-full py-2 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-check-double-line mr-1.5"></i>
              Submit and Continue
            </button>

            {/* Submit Exit - Always enabled */}
            <button
              onClick={onSubmitExit}
              disabled={submitDisabled}
              title={
                !isTimeRequirementMet
                  ? `Minimum ${minTimeRequired} minute(s) required`
                  : undefined
              }
              className="w-full py-2 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-logout-box-line mr-1.5"></i>
              Submit and Exit
            </button>
          </div>
        )}
      </div>

      {/* ─── ✅ FULL SCREEN PREVIEW MODAL ─── */}
      {previewModal?.open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0 bg-white rounded-t-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor:
                      previewModal.type === 'questions' ? '#E0F2FE' : '#EAF3DE',
                  }}
                >
                  <i
                    className={`${previewModal.type === 'questions' ? 'ri-file-pdf-line text-sky-600' : 'ri-shield-check-line'}`}
                  ></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">
                    {previewModal.title}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {previewModal.type === 'questions'
                      ? 'Question Paper'
                      : 'Model Answer Sheet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Open in new tab
                    window.open(previewModal.url, '_blank');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-external-link-line"></i>
                  Open in new tab
                </button>
                <button
                  onClick={closePreview}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden bg-slate-100 rounded-b-lg">
              <iframe
                src={`${previewModal.url}#toolbar=1&navpanes=1&scrollbar=1`}
                className="w-full h-full border-0"
                title={previewModal.title}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
