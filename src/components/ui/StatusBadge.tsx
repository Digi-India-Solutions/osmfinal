import { type FC } from "react";

const statusMap: Record<string, { bg: string; text: string; label: string }> = {
  uploaded:              { bg: "bg-gray-100",         text: "text-gray-700",       label: "Uploaded" },
  assigned:              { bg: "bg-sky-100",          text: "text-sky-700",        label: "Assigned" },
  checking:              { bg: "bg-amber-100",        text: "text-amber-700",      label: "Checking" },
  checked:               { bg: "bg-emerald-100",      text: "text-emerald-700",    label: "Checked" },
  recheck:               { bg: "bg-violet-100",       text: "text-violet-700",     label: "Recheck" },
  rechecked:             { bg: "bg-teal-100",         text: "text-teal-700",       label: "Rechecked" },
  done:                  { bg: "bg-emerald-100",      text: "text-emerald-800",    label: "Done" },
  pending:               { bg: "bg-amber-100",        text: "text-amber-700",      label: "Pending" },
  completed:             { bg: "bg-emerald-100",      text: "text-emerald-700",    label: "Completed" },
  requested_by_teacher:  { bg: "bg-orange-100",       text: "text-orange-700",     label: "Teacher Disputed" },
  published:             { bg: "bg-indigo-100",       text: "text-indigo-700",     label: "Published" },
  active:                { bg: "bg-emerald-100",      text: "text-emerald-700",    label: "Active" },
  archived:              { bg: "bg-rose-100",         text: "text-rose-700",       label: "Archived" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const config = statusMap[status] ?? statusMap.uploaded;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${config.bg} ${config.text} ${className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;