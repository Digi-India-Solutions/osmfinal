// src/pages/checker/components/RightMarkPanel.tsx

import { useState, useEffect, useCallback } from 'react';
import type { MarkEntry, RightTab } from '../MarkingView';

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
  minTimeRequired?: number; // ✅ ADD
  isTimeRequirementMet?: boolean; // ✅ ADD
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

const QUESTIONS_PER_PAGE = 4;
const totalQuestions = 23;
const totalQuestionPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);

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
  minTimeRequired = 0, // ✅ Default
  isTimeRequirementMet = true, // ✅ Default
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

  const activeMark = marks.find((m) => m.id === activeMarkId);
  const activeMax = activeMark?.max ?? 0;

  useEffect(() => {
    if (activeMark) {
      setDisplayValue(activeMark.awarded > 0 ? String(activeMark.awarded) : '');
    } else {
      setDisplayValue('');
    }
  }, [activeMarkId]);

  const startIdx = questionPage * QUESTIONS_PER_PAGE;
  const visibleMarks = marks.slice(startIdx, startIdx + QUESTIONS_PER_PAGE);
  const displayStart = startIdx + 1;
  const displayEnd = Math.min(startIdx + QUESTIONS_PER_PAGE, totalQuestions);

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

  return (
    <aside className="w-[255px] shrink-0 bg-[#1e293b] flex flex-col border-l border-slate-700">
      {/* ─── THREE TABS ─── */}
      <div className="flex border-b border-slate-700">
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

      {/* ─── ✅ MINIMUM TIME INDICATOR ─── */}
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
              Minimum {minTimeRequired} minutes required
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
          <div className="flex-1 flex flex-col min-h-0">
            {/* Question nav */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-700/50 shrink-0">
              <button
                onClick={() =>
                  onQuestionPageChange(Math.max(0, questionPage - 1))
                }
                disabled={questionPage === 0}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <i className="ri-arrow-left-s-line text-xs"></i>
              </button>
              <span className="text-[11px] text-slate-400">
                Showing {displayStart}–{displayEnd} of {totalQuestions}
              </span>
              <button
                onClick={() =>
                  onQuestionPageChange(
                    Math.min(totalQuestionPages - 1, questionPage + 1),
                  )
                }
                disabled={questionPage >= totalQuestionPages - 1}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <i className="ri-arrow-right-s-line text-xs"></i>
              </button>
            </div>

            {/* Marks table header */}
            <div className="grid grid-cols-[38px_24px_34px_1fr] border-b border-slate-700/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5 shrink-0">
              <span>Criterion</span>
              <span className="text-center">Max</span>
              <span className="text-center">Award</span>
              <span>Remark</span>
            </div>

            {/* Marks table rows */}
            <div className="flex-1 overflow-y-auto">
              {visibleMarks.map((m) => {
                const isActive = activeMarkId === m.id;
                const awardedStr = m.awarded === 0 ? '—' : String(m.awarded);

                return (
                  <div
                    key={m.id}
                    onClick={() => !readOnly && onActiveMarkChange(m.id)}
                    className={`px-1.5 py-1.5 border-b border-slate-700/30 transition-colors ${
                      readOnly ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isActive
                        ? 'bg-sky-500/15 border-l-[3px] border-l-sky-400'
                        : 'border-l-[3px] border-l-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="grid grid-cols-[38px_24px_34px_1fr] items-center gap-0.5 text-[11px]">
                      <span className="text-slate-300 font-medium truncate">
                        {m.criterion}
                      </span>
                      <span className="text-center text-slate-500">
                        {m.max}
                      </span>
                      <span className="text-center text-white font-mono tabular-nums text-[12px]">
                        {awardedStr}
                      </span>
                      <input
                        type="text"
                        value={m.remark}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRemarkUpdate(m.id, e.target.value)}
                        placeholder="—"
                        disabled={readOnly}
                        className="w-full h-5 px-1 text-[10px] rounded border border-slate-600 bg-slate-800 text-slate-300 outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-600 disabled:opacity-60 disabled:cursor-default"
                      />
                    </div>
                  </div>
                );
              })}
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
                  className={`text-2xl font-mono tabular-nums font-bold ${isEmpty ? 'text-slate-500' : 'text-white'}`}
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

              <button
                onClick={() => !readOnly && handleBackspace()}
                disabled={readOnly || isEmpty}
                className="w-full h-7 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-1 mb-1.5 active:bg-slate-500"
              >
                <i className="ri-delete-back-2-line text-[11px]"></i>
                backspace
              </button>

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

        {/* ─── QUESTION PAPER TAB ─── */}
        {rightTab === 'questions' && (
          <div className="flex-1 flex flex-col min-h-0">
            {questionPaperUrl ? (
              <iframe
                src={questionPaperUrl}
                title="Question Paper"
                className="w-full h-full border-0"
              />
            ) : (
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

        {/* ─── ANSWER SHEET TAB ─── */}
        {rightTab === 'answerSheet' && (
          <div className="flex-1 flex flex-col min-h-0">
            {modelAnswerUrl ? (
              <>
                <div
                  className="shrink-0 px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: '#EAF3DE' }}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i
                      className="ri-shield-check-line text-sm"
                      style={{ color: '#27500A' }}
                    ></i>
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: '#27500A' }}
                    >
                      Model answer sheet — uploaded by teacher
                    </p>
                  </div>
                  <span
                    className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
                    style={{
                      color: '#27500A',
                      backgroundColor: 'rgba(99,153,34,0.15)',
                    }}
                  >
                    Confidential
                  </span>
                </div>
                <iframe
                  src={modelAnswerUrl}
                  title="Model Answer"
                  className="flex-1 w-full border-0"
                />
              </>
            ) : (
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
            Total Awarded Marks:
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {totalAwarded}
          </span>
        </div>

        {/* ─── ACTION BUTTONS ─── */}
        {!readOnly && (
          <div className="px-2.5 pb-3 space-y-1.5 pt-1 shrink-0">
            <button
              onClick={onEscalate}
              className="w-full py-2 text-xs font-semibold rounded bg-sky-600 text-white hover:bg-sky-500 cursor-pointer transition-colors whitespace-nowrap"
            >
              Escalate and Next
            </button>
            <button
              onClick={onSubmitContinue}
              className="w-full py-2 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer transition-colors whitespace-nowrap"
            >
              Submit and Continue
            </button>
            <button
              onClick={onSubmitExit}
              className="w-full py-2 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-500 cursor-pointer transition-colors whitespace-nowrap"
            >
              Submit and Exit
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
