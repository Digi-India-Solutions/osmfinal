interface ThumbnailPanelProps {
  currentPage: number;
  blankPages: Set<number>;
  selectedThumbnails: Set<number>;
  onThumbnailClick: (page: number) => void;
  onBlankToggle: (page: number) => void;
  onApplyBlank: () => void;
  totalPages: number;
}

const pageLines: Record<number, number[]> = {};
for (let i = 1; i <= 18; i++) {
  const count = 6 + (i % 5);
  pageLines[i] = Array.from({ length: count }, () => Math.random() * 60 + 20);
}

export default function ThumbnailPanel({
  currentPage,
  blankPages,
  selectedThumbnails,
  onThumbnailClick,
  onBlankToggle,
  onApplyBlank,
  totalPages,
}: ThumbnailPanelProps) {
  const selectedCount = selectedThumbnails.size;

  return (
    <aside className="w-[130px] shrink-0 bg-[#1e293b] flex flex-col border-r border-slate-700">
      <div className="p-2">
        <button
          onClick={onApplyBlank}
          disabled={selectedCount === 0}
          className="w-full py-1.5 text-xs font-medium rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors whitespace-nowrap"
        >
          {selectedCount > 0 ? `Apply Blank Mark (${selectedCount})` : "Apply Blank Mark"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = page === currentPage;
          const isBlank = blankPages.has(page);
          const isSelected = selectedThumbnails.has(page);

          let borderColor = "border-transparent";
          if (isCurrent) borderColor = "border-sky-500";
          else if (isSelected) borderColor = "border-amber-500";

          return (
            <div
              key={page}
              className={`relative border-2 ${borderColor} rounded cursor-pointer transition-colors ${
                isBlank ? "opacity-50" : ""
              }`}
            >
              <div
                onClick={() => onThumbnailClick(page)}
                className="bg-white/90 p-1 rounded-sm"
              >
                <div className="space-y-[2px] py-0.5">
                  {pageLines[page].map((w, j) => (
                    <div
                      key={j}
                      className="h-[3px] bg-slate-300 rounded-full"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
              </div>

              <label
                className="absolute top-0.5 left-0.5 flex items-center gap-1 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onBlankToggle(page)}
                  className="w-3 h-3 rounded border-slate-500 bg-slate-700 accent-amber-500 cursor-pointer"
                />
              </label>

              <div className="flex items-center justify-between px-1 py-0.5">
                <span className="text-[10px] text-slate-400">Page {page}</span>
                {isBlank && (
                  <span className="text-[9px] font-medium text-amber-400 bg-amber-500/15 px-1 rounded">
                    Blank
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}