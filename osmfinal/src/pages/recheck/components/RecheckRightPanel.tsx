import { useState, useEffect, useCallback } from "react";

export type RecheckTab = "recheckMarks" | "questions" | "answerSheet";

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
  totalRound2: number;
  totalMax: number;
  finalMarks: number;
  finalMarksRule: "higher" | "recheck_marks" | "average";
  rightTab: RecheckTab;
  hasModelAnswer: boolean;
  saveIndicatorText?: string;
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

interface QPaperQuestion {
  q: string;
  sub: string[];
}

const questionPaperPages: QPaperQuestion[][] = [
  [
    {
      q: "Q1. Define input and output devices. Give two examples each. (12 marks)",
      sub: [
        "(a) Define input device with example (3 marks)",
        "(b) Define output device with example (3 marks)",
        "(c) Difference between input and output (3 marks)",
        "(d) Give 4 examples of each (3 marks)",
      ],
    },
    {
      q: "Q2. Explain basic functions of a computer with diagram. (12 marks)",
      sub: [],
    },
  ],
  [
    {
      q: "Q3. Differentiate between RAM and ROM. (11 marks)",
      sub: [],
    },
    {
      q: "Q4. What is an operating system? List its functions. (15 marks)",
      sub: [],
    },
    {
      q: "Q5. Explain number systems used in computers. (8 marks)",
      sub: [],
    },
  ],
  [
    {
      q: "Q6. Write short notes on CPU, ALU, Control Unit. (12 marks)",
      sub: [],
    },
    {
      q: "Q7. Explain primary and secondary memory. (10 marks)",
      sub: [],
    },
  ],
];

interface ModelAnswerItem {
  label: string;
  marks: number;
  text: string;
}

const modelAnswerPages: ModelAnswerItem[][] = [
  [
    { label: "Q1(i)", marks: 3, text: "Award 1 mark per correct point. Max 3." },
    { label: "Q1(ii)", marks: 3, text: "Input→Processing→Output→Storage. 1 mark per function." },
    { label: "Q1(iii)", marks: 3, text: "Any 2 input devices with explanation. 1.5 marks each." },
    { label: "Q1(iv)", marks: 3, text: "Any 2 output devices with explanation. 1.5 marks each." },
  ],
  [
    { label: "Q2(i)", marks: 4, text: "Input vs Output difference. 2 marks per side." },
    { label: "Q2(ii)", marks: 4, text: "RAM=volatile+r/w, ROM=non-volatile+read only. 2 marks per side." },
    { label: "Q2(iii)", marks: 4, text: "Valid explanation. Award marks for correct concept." },
  ],
  [
    { label: "Q3(i)", marks: 3, text: "Define each function clearly. 1 mark per function with proper naming." },
    { label: "Q3(ii)", marks: 3, text: "Diagram carries 2 marks, explanation carries 1 mark." },
    { label: "Q3(iii)", marks: 3, text: "Award marks for correct steps shown. Method carries weight." },
    { label: "Q3(iv)", marks: 3, text: "Short answer expected. Key concept = full marks." },
  ],
  [
    { label: "Q4(i)", marks: 5, text: "Full definition with examples = 5 marks. Partial = 3 marks." },
    { label: "Q4(ii)", marks: 5, text: "List all 5 functions. 1 mark each. Missing = deduct 1." },
    { label: "Q4(iii)", marks: 5, text: "Explain each function with an example. No example = max 3." },
  ],
  [
    { label: "Q5(i)", marks: 2, text: "Name all 4 number systems. 0.5 marks each." },
    { label: "Q5(ii)", marks: 2, text: "Binary to decimal conversion steps must be shown." },
    { label: "Q5(iii)", marks: 2, text: "Octal and hexadecimal explained with base values." },
    { label: "Q5(iv)", marks: 2, text: "One application of each number system." },
    { label: "Q6(i)", marks: 4, text: "CPU definition and block diagram. Diagram = 1.5 marks." },
    { label: "Q6(ii)", marks: 4, text: "ALU explanation with all arithmetic and logic functions." },
    { label: "Q6(iii)", marks: 4, text: "Control Unit with timing and control signals diagram." },
    { label: "Q7(i)", marks: 3, text: "Primary memory types (RAM/ROM). 1.5 marks with characteristics." },
    { label: "Q7(ii)", marks: 3, text: "Secondary memory with comparison table. 3 devices = full." },
  ],
];

const RULE_LABELS: Record<string, string> = {
  higher: "Higher of two",
  recheck_marks: "Recheck Marks",
  average: "Average of two",
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
  hasModelAnswer,
  saveIndicatorText = "Auto-saves every 30s",
  saveIndicatorFresh = false,
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
  const [displayValue, setDisplayValue] = useState("");

  const activeMark = marks.find((m) => m.id === activeMarkId);
  const activeMax = activeMark?.max ?? 0;
  const totalQuestions = computeVisibleCount(marks);
  const totalQuestionPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);

  useEffect(() => {
    if (activeMark) {
      setDisplayValue(activeMark.round2 !== null ? String(activeMark.round2) : "");
    } else {
      setDisplayValue("");
    }
  }, [activeMarkId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startIdx = questionPage * QUESTIONS_PER_PAGE;
  const visibleMarks = marks.slice(startIdx, startIdx + QUESTIONS_PER_PAGE);
  const displayStart = startIdx + 1;
  const displayEnd = Math.min(startIdx + QUESTIONS_PER_PAGE, totalQuestions);

  const displayNumeric = displayValue === "" ? 0 : parseFloat(displayValue) || 0;
  const hasDecimal = displayValue.includes(".");
  const isEmpty = displayValue === "";

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
    setDisplayValue((prev) => prev + ".");
  }, [hasDecimal, isEmpty]);

  const handleHalf = useCallback(() => {
    setDisplayValue((prev) => {
      const current = prev === "" ? 0 : parseFloat(prev) || 0;
      const next = current + 0.5;
      if (next > activeMax) return prev;
      const s = String(next);
      return s.endsWith(".0") ? String(Math.floor(next)) : s;
    });
  }, [activeMax]);

  const handleBackspace = useCallback(() => {
    setDisplayValue((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setDisplayValue("");
    if (activeMarkId) {
      onClearStampValue(activeMarkId);
    }
  }, [activeMarkId, onClearStampValue]);

  const handleAddMark = useCallback(() => {
    if (!activeMarkId || isEmpty) return;
    const num = parseFloat(displayValue) || 0;
    const capped = Math.min(num, activeMax);
    onRound2Update(activeMarkId, capped);
    onRequestAddMark(activeMarkId, capped);
  }, [activeMarkId, isEmpty, displayValue, activeMax, onRound2Update, onRequestAddMark]);

  const digitDisabled = (digit: number) => digit > activeMax;
  const halfDisabled = displayNumeric + 0.5 > activeMax;
  const decimalDisabled = hasDecimal || isEmpty;

  const tabs: { key: RecheckTab; icon: string; label: string }[] = [
    { key: "recheckMarks", icon: "ri-list-check", label: "Recheck Marks" },
    { key: "questions", icon: "ri-file-list-3-line", label: "Q. Paper" },
    { key: "answerSheet", icon: "ri-check-double-line", label: "Ans. Sheet" },
  ];

  const canSubmit = totalRound2 > 0;

  return (
    <aside className="flex-1 min-h-0 bg-[#1e293b] flex flex-col border-l border-slate-700">
      {/* ─── THREE TABS ─── */}
      <div className="flex border-b border-slate-700">
        {tabs.map((tab) => {
          const isActive = rightTab === tab.key;
          const activeColor = "#7C3AED";
          return (
            <button
              key={tab.key}
              onClick={() => onRightTabChange(tab.key)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer whitespace-nowrap"
              style={{
                color: isActive ? activeColor : "#94a3b8",
                borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
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
        <span className={`text-[10px] transition-colors duration-300 ${saveIndicatorFresh ? "text-emerald-400" : "text-slate-500"}`}>
          {saveIndicatorFresh && <i className="ri-check-line mr-1"></i>}
          {saveIndicatorText}
        </span>
      </div>

      {/* ─── CONTENT AREA ─── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* ─── RECHECK MARKS TAB ─── */}
        {rightTab === "recheckMarks" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Question nav */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-700/50 shrink-0">
              <button
                onClick={() => onQuestionPageChange(Math.max(0, questionPage - 1))}
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
                const round2Str = m.round2 !== null ? String(m.round2) : "—";

                return (
                  <div
                    key={m.id}
                    onClick={() => onActiveMarkChange(m.id)}
                    className={`px-1.5 py-1.5 border-b border-slate-700/30 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-violet-500/15 border-l-[3px] border-l-violet-400"
                        : "border-l-[3px] border-l-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="grid grid-cols-[36px_22px_32px_32px_1fr] items-center gap-0.5 text-[11px]">
                      <span className="text-slate-300 font-medium truncate">
                        {m.criterion}
                      </span>
                      <span className="text-center text-slate-500">{m.max}</span>
                      <span className="text-center text-slate-500 font-mono tabular-nums bg-slate-800 rounded px-1 py-0.5 text-[10px]">
                        {round1Str}
                      </span>
                      <span className={`text-center font-mono tabular-nums text-[12px] ${
                        m.round2 !== null ? "text-white font-bold" : "text-slate-500"
                      }`}>
                        {round2Str}
                      </span>
                      <input
                        type="text"
                        value={m.remark}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onRemarkUpdate(m.id, e.target.value)}
                        placeholder="—"
                        className="w-full h-5 px-1 text-[10px] rounded border border-slate-600 bg-slate-800 text-slate-300 outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── SHARED NUMPAD ─── */}
            <div className="border-t border-slate-700 px-2.5 py-2 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-400">Entering marks for:</span>
                {activeMark ? (
                  <span className="text-[10px] font-semibold text-white bg-violet-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {activeMark.criterion}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">—</span>
                )}
              </div>

              <div className="flex items-baseline justify-between mb-2.5">
                <span className={`text-2xl font-mono tabular-nums font-bold ${isEmpty ? "text-slate-500" : "text-white"}`}>
                  {isEmpty ? "—" : displayValue}
                </span>
                <span className="text-[10px] text-slate-400">
                  max {activeMax}
                </span>
              </div>

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
            </div>
          </div>
        )}

        {/* ─── QUESTION PAPER TAB ─── */}
        {rightTab === "questions" && (
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questionPaperPages.map((questions, pageIdx) => (
              <div
                key={pageIdx}
                className="bg-white rounded-sm shadow-sm overflow-hidden shrink-0"
              >
                {pageIdx === 0 && (
                  <div className="px-3 pt-3 pb-2 border-b border-slate-200">
                    <div className="text-[8px] text-slate-500 font-medium tracking-wide uppercase text-center leading-relaxed">
                      ARKA JAIN University
                    </div>
                    <div className="text-[9px] text-slate-700 font-semibold text-center mt-0.5 leading-relaxed">
                      Mathematics Mid-Term 2025
                    </div>
                    <div className="text-[8px] text-slate-500 text-center mt-0.5">
                      Max Marks: 100 &nbsp;|&nbsp; Duration: 3 Hours
                    </div>
                  </div>
                )}
                {pageIdx > 0 && (
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="text-[9px] font-semibold text-slate-500">
                      Question Paper — Page {pageIdx + 1}
                    </span>
                  </div>
                )}
                <div className="px-3 py-2.5 space-y-3">
                  {questions.map((item, qIdx) => (
                    <div key={qIdx}>
                      <p className="text-[11px] text-slate-800 font-semibold leading-relaxed">
                        {item.q}
                      </p>
                      {item.sub.length > 0 && (
                        <div className="mt-1 pl-3 space-y-0.5">
                          {item.sub.map((sub, sIdx) => (
                            <p key={sIdx} className="text-[10px] text-slate-600 leading-relaxed">
                              {sub}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {pageIdx === questionPaperPages.length - 1 && (
                    <p className="text-[9px] text-slate-400 italic border-t border-slate-100 pt-2 mt-2">
                      Note: All questions are compulsory. Draw neat diagrams where necessary.
                      Figures to the right indicate full marks.
                    </p>
                  )}
                </div>
                <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-[8px] text-slate-400">Question Paper</span>
                  <span className="text-[8px] text-slate-400">
                    Page {pageIdx + 1} of {questionPaperPages.length}
                  </span>
                </div>
              </div>
            ))}
            <div className="h-1 shrink-0" />
          </div>
        )}

        {/* ─── ANSWER SHEET TAB ─── */}
        {rightTab === "answerSheet" && (
          <div className="flex-1 flex flex-col min-h-0">
            {hasModelAnswer ? (
              <>
                <div className="shrink-0 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "#EAF3DE" }}>
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <i className="ri-shield-check-line text-sm" style={{ color: "#27500A" }}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium" style={{ color: "#27500A" }}>
                      Model answer sheet — uploaded by teacher
                    </p>
                  </div>
                  <span
                    className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0"
                    style={{ color: "#27500A", backgroundColor: "rgba(99,153,34,0.15)" }}
                  >
                    Confidential
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {modelAnswerPages.map((items, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="bg-white rounded-sm shadow-sm overflow-hidden shrink-0"
                    >
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-700">
                          Model Answer — Page {pageIdx + 1}
                        </span>
                        <span className="text-[8px] font-medium text-slate-400">
                          Confidential
                        </span>
                      </div>
                      <div className="px-3 py-2.5 space-y-2">
                        {items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="text-[10px] leading-relaxed pl-2.5 py-1.5 rounded-r"
                            style={{
                              backgroundColor: "#f0fdf4",
                              borderLeft: "2px solid #639922",
                            }}
                          >
                            <span className="font-semibold text-slate-800">
                              {item.label}
                            </span>{" "}
                            <span className="text-slate-500 text-[9px]">
                              ({item.marks} marks):
                            </span>{" "}
                            <span className="text-slate-600">{item.text}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50">
                        <span className="text-[8px] text-slate-400">Model Answer</span>
                        <span className="text-[8px] text-slate-400">Page {pageIdx + 1}</span>
                      </div>
                    </div>
                  ))}
                  <div className="h-1 shrink-0" />
                </div>
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

        {/* ─── TOTAL & FINAL PREVIEW ─── */}
        <div className="border-t border-slate-700 px-3 py-2 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Round 2 Total:</span>
            <span className="text-xs font-bold text-white tabular-nums">
              {totalRound2}
              <span className="text-[10px] font-normal text-slate-500"> / {totalMax}</span>
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
      </div>
    </aside>
  );
}