// src/pages/checker/components/ThumbnailPanel.tsx

import { useMemo } from 'react';

interface ThumbnailPanelProps {
  currentPage: number;
  blankPages: Set<number>;
  selectedThumbnails: Set<number>;
  onThumbnailClick: (page: number) => void;
  onBlankToggle: (page: number) => void;
  onApplyBlank: () => void;
  onResetBlank?: () => void;
  onClearAllBlank?: () => void;
  totalPages: number;
  pdfPageImages?: Record<number, string>;
  pdfPageCount?: number;
  isPdfMode?: boolean;
  dragOverPage?: number | null;
}

function getPageLines(pageNum: number): number[] {
  const count = 6 + (pageNum % 5);
  return Array.from({ length: count }, (_, i) => {
    const seed = (pageNum * 31 + i * 17) % 100;
    return 20 + (seed % 60);
  });
}

export default function ThumbnailPanel({
  currentPage,
  blankPages,
  selectedThumbnails,
  onThumbnailClick,
  onBlankToggle,
  onApplyBlank,
  onResetBlank,
  onClearAllBlank,
  totalPages,
  pdfPageImages = {},
  pdfPageCount = 0,
  isPdfMode = false,
  dragOverPage = null,
}: ThumbnailPanelProps) {
  const selectedCount = selectedThumbnails.size;
  const blankCount = blankPages.size;

  const actualTotalPages =
    isPdfMode && pdfPageCount > 0 ? pdfPageCount : totalPages;

  const pageLineMap = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (let i = 1; i <= actualTotalPages; i++) {
      map[i] = getPageLines(i);
    }
    return map;
  }, [actualTotalPages]);

  return (
    <aside className="w-[180px] shrink-0 bg-[#1e293b] flex flex-col border-r border-slate-700">
      {/* ─── HEADER WITH CONTROLS ─── */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-700">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Pages
          </span>
          <span className="text-[10px] text-slate-500">{blankCount} blank</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={onApplyBlank}
            disabled={selectedCount === 0}
            className="flex-1 py-1 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap text-center"
            title="Apply blank/unblank to selected pages"
          >
            <i className="ri-check-line mr-0.5 text-[8px]"></i> Apply
          </button>

          {onResetBlank && (
            <button
              onClick={onResetBlank}
              className="py-1 px-2 text-[10px] font-medium bg-slate-600/30 text-slate-400 rounded hover:bg-slate-600/50 cursor-pointer transition-colors whitespace-nowrap"
              title="Reset to default (pages 1-2 blank)"
            >
              <i className="ri-refresh-line text-[8px]"></i>
            </button>
          )}

          {onClearAllBlank && (
            <button
              onClick={onClearAllBlank}
              className="py-1 px-2 text-[10px] font-medium bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/30 cursor-pointer transition-colors whitespace-nowrap"
              title="Clear all blank markings"
            >
              <i className="ri-close-line text-[8px]"></i>
            </button>
          )}
        </div>

        <div className="text-[9px] text-slate-500 mt-1">
          Click to select • Double-click to toggle
        </div>
      </div>

      {/* ─── THUMBNAILS LIST ─── */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {Array.from({ length: actualTotalPages }, (_, i) => i + 1).map(
          (page) => {
            const isCurrent = page === currentPage;
            const isBlank = blankPages.has(page);
            const isSelected = selectedThumbnails.has(page);
            const hasImage = isPdfMode && !!pdfPageImages[page];
            const isDragOver = dragOverPage === page;

            let borderColor = 'border-transparent';
            if (isCurrent) borderColor = 'border-sky-500';
            else if (isSelected) borderColor = 'border-amber-500';
            else if (isDragOver) borderColor = 'border-sky-400 border-dashed';

            return (
              <div
                key={page}
                data-thumbnail-page={page}
                className={`relative border-2 ${borderColor} rounded cursor-pointer transition-all ${
                  isBlank ? 'opacity-50' : ''
                } ${isCurrent ? 'shadow-md shadow-sky-500/20' : ''} ${
                  isDragOver ? 'bg-sky-500/10' : ''
                }`}
              >
                {/* Page content */}
                <div
                  onClick={() => onThumbnailClick(page)}
                  onDoubleClick={() => onBlankToggle(page)}
                  className="bg-white/90 p-1 rounded-sm select-none"
                >
                  {hasImage ? (
                    <img
                      src={pdfPageImages[page]}
                      alt={`Page ${page}`}
                      className="w-full h-auto rounded-sm"
                      draggable={false}
                    />
                  ) : isPdfMode ? (
                    <div className="h-16 bg-slate-200 rounded-sm animate-pulse flex items-center justify-center">
                      <i className="ri-file-pdf-line text-slate-400 text-xs"></i>
                    </div>
                  ) : (
                    <div className="space-y-[2px] py-0.5">
                      {(pageLineMap[page] || getPageLines(page)).map((w, j) => (
                        <div
                          key={j}
                          className="h-[3px] bg-slate-300 rounded-full"
                          style={{ width: `${w}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Blank overlay */}
                {isBlank && (
                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-bold text-amber-400 bg-black/60 px-1.5 py-0.5 rounded">
                      BLANK
                    </span>
                  </div>
                )}

                {/* Checkbox for selection */}
                <label
                  className="absolute top-0.5 left-0.5 flex items-center gap-1 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onBlankToggle(page)}
                    className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 accent-amber-500 cursor-pointer"
                  />
                </label>

                {/* Page label + blank badge */}
                <div className="flex items-center justify-between px-1 py-0.5">
                  <span
                    className={`text-[10px] tabular-nums ${
                      isCurrent
                        ? 'text-sky-400 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {page}
                  </span>
                  {isBlank && (
                    <span className="text-[9px] font-medium text-amber-400 bg-amber-500/15 px-1 rounded">
                      Blank
                    </span>
                  )}
                  {isCurrent && !isBlank && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>

      {/* ─── FOOTER STATS ─── */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-700 text-[10px] text-slate-500 flex justify-between">
        <span>Total: {actualTotalPages}</span>
        <span>
          Blank: {blankCount} · Sel: {selectedCount}
        </span>
      </div>
    </aside>
  );
}
