// src/pages/recheck/components/RecheckRightPanel.tsx

import { useState, useEffect, useCallback } from 'react';

export type RecheckTab = 'recheckMarks' | 'questions' | 'answerSheet' | 'notes';

export interface RecheckMarkEntry {
  id: string;
  criterion: string;
  max: number;
  round1: number;
  round2: number | null;
  remark: string;
}

export interface RecheckStamp {
  markId: string;
  placed: boolean;
  x: number;
  y: number;
  page: number;
  value: number | null;
}

interface RecheckRightPanelProps {
  marks: RecheckMarkEntry[];
  stamps: RecheckStamp[];
  activeMarkId: string | null;
  questionPage: number;
  readOnly?: boolean;
  totalRound2: number;
  totalMax: number;
  finalMarks: number;
  finalMarksRule: 'higher' | 'recheck_marks' | 'average';
  rightTab: RecheckTab;
  hasModelAnswer: boolean;
  questionPaperUrl: string | null;
  modelAnswerUrl: string | null;
  saveIndicatorText?: string;
  minTimeRequired?: number;
  isTimeRequirementMet?: boolean;
  saveIndicatorFresh?: boolean;
  onActiveMarkChange: (id: string) => void;
  onQuestionPageChange: (page: number) => void;
  onRound2Update: (id: string, value: number | null) => void;
  onRemarkUpdate: (id: string, remark: string) => void;
  onRequestAddMark: (markId: string, value: number) => void;
  onClearStampValue: (markId: string) => void;
  onRightTabChange: (tab: RecheckTab) => void;
  onSubmitRecheck: () => void;
  onEscalateFurther: () => void;
}

const QUESTIONS_PER_PAGE = 4;

const RULE_LABELS: Record<string, string> = {
  higher: 'Higher of two',
  recheck_marks: 'Recheck Marks',
  average: 'Average of two',
};

function computeVisibleCount(marks: RecheckMarkEntry[]): number {
  return marks.length;
}

export default function RecheckRightPanel({
  marks,
  activeMarkId,
  questionPage,
  totalRound2,
  totalMax,
  finalMarks,
  finalMarksRule,
  rightTab,
  readOnly = false,
  questionPaperUrl,
  modelAnswerUrl,
  saveIndicatorText = 'Auto-saves every 30s',
  saveIndicatorFresh = false,
  minTimeRequired = 0,
  isTimeRequirementMet = true,
  onActiveMarkChange,
  onQuestionPageChange,
  onRound2Update,
  onRemarkUpdate,
  onRequestAddMark,
  onClearStampValue,
  onRightTabChange,
  onSubmitRecheck,
  onEscalateFurther,
}: RecheckRightPanelProps) {
  const [displayValue, setDisplayValue] = useState('');

  const activeMark = marks.find((m) => m.id === activeMarkId);
  const activeMax = activeMark?.max ?? 0;
  const totalQuestions = computeVisibleCount(marks);
  const totalQuestionPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);

  useEffect(() => {
    if (activeMark) {
      setDisplayValue(
        activeMark.round2 !== null ? String(activeMark.round2) : '',
      );
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
    if (!activeMarkId || isEmpty || readOnly) return;
    const num = parseFloat(displayValue) || 0;
    const capped = Math.min(num, activeMax);
    onRound2Update(activeMarkId, capped);
    onRequestAddMark(activeMarkId, capped);
  }, [
    activeMarkId,
    isEmpty,
    displayValue,
    activeMax,
    readOnly,
    onRound2Update,
    onRequestAddMark,
  ]);

  const digitDisabled = (digit: number) => digit > activeMax || readOnly;
  const halfDisabled = displayNumeric + 0.5 > activeMax || readOnly;
  const decimalDisabled = hasDecimal || isEmpty || readOnly;

  const tabs: { key: RecheckTab; icon: string; label: string }[] = [
    { key: 'recheckMarks', icon: 'ri-list-check', label: 'Recheck Marks' },
    { key: 'questions', icon: 'ri-file-list-3-line', label: 'Q. Paper' },
    { key: 'answerSheet', icon: 'ri-check-double-line', label: 'Ans. Sheet' },
    { key: 'notes', icon: 'ri-sticky-note-line', label: 'Notes' },
  ];

  const canSubmit = totalRound2 > 0 && !readOnly;

  return (
    <aside className="flex-1 min-h-0 bg-[#1e293b] flex flex-col border-l border-slate-700">
      {/* ─── THREE TABS ─── */}
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => {
          const isActive = rightTab === tab.key;
          const activeColor = '#7C3AED';
          return (
            <button
              key={tab.key}
              onClick={() => onRightTabChange(tab.key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              style={{
                color: isActive ? activeColor : '#94a3b8',
                borderBottom: isActive
                  ? `2px solid ${activeColor}`
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
      <div className="flex items-center justify-center py-1 border-b border-slate-700/50 shrink-0">
        <span
          className={`text-[10px] transition-colors duration-300 ${saveIndicatorFresh ? 'text-emerald-400' : 'text-slate-500'}`}
        >
          {saveIndicatorFresh && <i className="ri-check-line mr-1"></i>}
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
            Read Only — Viewing completed recheck
          </p>
        </div>
      )}

      {/* ─── CONTENT AREA ─── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ─── RECHECK MARKS TAB ─── */}
        {rightTab === 'recheckMarks' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Question nav */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-700/50 shrink-0">
              <button
                onClick={() =>
                  onQuestionPageChange(Math.max(0, questionPage - 1))
                }
                disabled={questionPage === 0 || readOnly}
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
                disabled={questionPage >= totalQuestionPages - 1 || readOnly}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <i className="ri-arrow-right-s-line text-xs"></i>
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[36px_22px_32px_32px_1fr] border-b border-slate-700/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5 shrink-0">
              <span>Crit.</span>
              <span className="text-center">Max</span>
              <span className="text-center">R1</span>
              <span className="text-center">R2</span>
              <span>Remark</span>
            </div>

            {/* Table rows */}
            <div className="flex-1 overflow-y-auto">
              {visibleMarks.map((m) => {
                const isActive = activeMarkId === m.id;
                const round1Str = String(m.round1);
                const round2Str = m.round2 !== null ? String(m.round2) : '—';

                return (
                  <div
                    key={m.id}
                    onClick={() => !readOnly && onActiveMarkChange(m.id)}
                    className={`px-1.5 py-1.5 border-b border-slate-700/30 transition-colors ${
                      readOnly ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isActive && !readOnly
                        ? 'bg-violet-500/15 border-l-[3px] border-l-violet-400'
                        : 'border-l-[3px] border-l-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="grid grid-cols-[36px_22px_32px_32px_1fr] items-center gap-0.5 text-[11px]">
                      <span className="text-slate-300 font-medium truncate">
                        {m.criterion}
                      </span>
                      <span className="text-center text-slate-500">
                        {m.max}
                      </span>
                      <span className="text-center text-slate-500 font-mono tabular-nums bg-slate-800 rounded px-1 py-0.5 text-[10px]">
                        {round1Str}
                      </span>
                      <span
                        className={`text-center font-mono tabular-nums text-[12px] ${
                          m.round2 !== null
                            ? 'text-white font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {round2Str}
                      </span>
                      <input
                        type="text"
                        value={m.remark}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRemarkUpdate(m.id, e.target.value)}
                        placeholder="—"
                        disabled={readOnly}
                        className="w-full h-5 px-1 text-[10px] rounded border border-slate-600 bg-slate-800 text-slate-300 outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 placeholder:text-slate-600 disabled:opacity-60 disabled:cursor-default"
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
                  <span className="text-[10px] font-semibold text-white bg-violet-600 px-2 py-0.5 rounded-full whitespace-nowrap">
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

              {readOnly ? (
                <div className="text-center text-slate-500 text-xs py-4 bg-slate-800/50 rounded-lg">
                  <i className="ri-lock-line mr-1"></i>
                  Read-only mode
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <button
                        key={n}
                        onClick={() => handleDigit(n)}
                        disabled={digitDisabled(n)}
                        className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => handleDigit(0)}
                      disabled={digitDisabled(0)}
                      className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                    >
                      0
                    </button>
                    <button
                      onClick={handleHalf}
                      disabled={halfDisabled}
                      className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                    >
                      ½
                    </button>
                    <button
                      onClick={handleDecimal}
                      disabled={decimalDisabled}
                      className="h-8 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center active:bg-slate-500"
                    >
                      .
                    </button>
                  </div>

                  <button
                    onClick={handleBackspace}
                    disabled={isEmpty}
                    className="w-full h-7 rounded bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-1 mb-1.5 active:bg-slate-500"
                  >
                    <i className="ri-delete-back-2-line text-[11px]"></i>
                    backspace
                  </button>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={handleClear}
                      disabled={isEmpty}
                      className="h-7 rounded bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap active:bg-slate-400"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleAddMark}
                      disabled={!activeMarkId || isEmpty}
                      className="h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-0.5 active:bg-emerald-400"
                    >
                      Add Mark
                      <i className="ri-check-line text-[11px]"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── QUESTION PAPER TAB ─── */}
        {rightTab === 'questions' && (
          <div className="flex-1 flex flex-col min-h-0">
            {questionPaperUrl ? (
              <>
                <div
                  className="shrink-0 px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: '#E0F2FE' }}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i
                      className="ri-file-pdf-line text-sm"
                      style={{ color: '#0369A1' }}
                    ></i>
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: '#0369A1' }}
                    >
                      Question Paper
                    </p>
                    <p className="text-[8px] text-slate-500 truncate">
                      {questionPaperUrl.split('/').pop() || 'PDF'}
                    </p>
                  </div>
                  <a
                    href={questionPaperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap shrink-0"
                    style={{
                      color: '#0369A1',
                      backgroundColor: 'rgba(3,105,161,0.1)',
                    }}
                  >
                    <i className="ri-external-link-line mr-1"></i>
                    Open PDF
                  </a>
                </div>
                <div className="flex-1 overflow-hidden bg-[#0f172a]">
                  <iframe
                    src={questionPaperUrl}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                    title="Question Paper PDF"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                    <i className="ri-file-unknow-line text-slate-400 text-lg"></i>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    No question paper uploaded yet.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Contact the teacher.
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
                      Model Answer Sheet
                    </p>
                    <p className="text-[8px] text-slate-500 truncate">
                      {modelAnswerUrl.split('/').pop() || 'PDF'}
                    </p>
                  </div>
                  <a
                    href={modelAnswerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap shrink-0"
                    style={{
                      color: '#27500A',
                      backgroundColor: 'rgba(99,153,34,0.15)',
                    }}
                  >
                    <i className="ri-external-link-line mr-1"></i>
                    Open PDF
                  </a>
                </div>
                <div className="flex-1 overflow-hidden bg-[#0f172a]">
                  <iframe
                    src={modelAnswerUrl}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                    title="Model Answer PDF"
                  />
                </div>
              </>
            ) : questionPaperUrl ? (
              <>
                <div
                  className="shrink-0 px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: '#E0F2FE' }}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i
                      className="ri-file-pdf-line text-sm"
                      style={{ color: '#0369A1' }}
                    ></i>
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-medium"
                      style={{ color: '#0369A1' }}
                    >
                      Question Paper
                    </p>
                    <p className="text-[8px] text-slate-500 truncate">
                      {questionPaperUrl.split('/').pop() || 'PDF'}
                    </p>
                  </div>
                  <a
                    href={questionPaperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[9px] font-semibold px-2 py-1 rounded whitespace-nowrap shrink-0"
                    style={{
                      color: '#0369A1',
                      backgroundColor: 'rgba(3,105,161,0.1)',
                    }}
                  >
                    <i className="ri-external-link-line mr-1"></i>
                    Open PDF
                  </a>
                </div>
                <div className="flex-1 overflow-hidden bg-[#0f172a]">
                  <iframe
                    src={questionPaperUrl}
                    className="w-full h-full"
                    style={{ border: 'none' }}
                    title="Question Paper PDF"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-700 flex items-center justify-center">
                    <i className="ri-file-unknow-line text-slate-400 text-lg"></i>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    No PDF uploaded yet.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Contact the teacher.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── NOTES TAB ─── */}
        {rightTab === 'notes' && (
          <div className="flex-1 flex flex-col min-h-0 p-4">
            <div className="text-center text-slate-400 text-sm">
              <i className="ri-sticky-note-line text-2xl mb-2 block"></i>
              <p>Notes will appear here</p>
              <p className="text-xs text-slate-500 mt-1">
                Use the Note tool on the sheet to add notes
              </p>
            </div>
          </div>
        )}

        {/* ─── TOTAL & FINAL PREVIEW ─── */}
        <div className="border-t border-slate-700 px-3 py-2 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Round 2 Total:</span>
            <span className="text-xs font-bold text-white tabular-nums">
              {totalRound2}
              <span className="text-[10px] font-normal text-slate-500">
                {' '}
                / {totalMax}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between bg-violet-500/10 rounded px-2 py-1.5">
            <span className="text-[10px] text-violet-300">
              Final Marks ({RULE_LABELS[finalMarksRule] || finalMarksRule}):
            </span>
            <span className="text-sm font-bold text-violet-300 tabular-nums">
              {finalMarks}
            </span>
          </div>
        </div>

        {/* ─── ACTION BUTTONS ─── */}
        {!readOnly && (
          <div className="px-2.5 pb-3 space-y-1.5 pt-1 shrink-0">
            <button
              onClick={onSubmitRecheck}
              disabled={!canSubmit}
              className="w-full py-2 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Recheck
            </button>
            <button
              onClick={onEscalateFurther}
              className="w-full py-2 text-xs font-semibold rounded bg-violet-600 text-white hover:bg-violet-500 cursor-pointer transition-colors whitespace-nowrap"
            >
              Escalate Further
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
