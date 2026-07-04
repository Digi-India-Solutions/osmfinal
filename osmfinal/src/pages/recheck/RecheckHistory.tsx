// src/pages/recheck/RecheckHistory.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import recheckQueueService, { RecheckRequest } from '@/api/recheckQueue';

// Helper function for rule labels
const RULE_LABELS: Record<string, { label: string; bg: string; text: string }> =
  {
    higher: {
      label: 'Higher of two',
      bg: 'bg-blue-100',
      text: 'text-blue-700',
    },
    recheck_marks: {
      label: 'Recheck Marks',
      bg: 'bg-violet-100',
      text: 'text-violet-700',
    },
    average: {
      label: 'Average of two',
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
    },
  };

function getFinalMarksRuleBadge(rule: string): {
  label: string;
  bg: string;
  text: string;
} {
  return (
    RULE_LABELS[rule] || {
      label: rule || 'Unknown',
      bg: 'bg-gray-100',
      text: 'text-gray-700',
    }
  );
}

function computeFinalMarks(
  round1Total: number,
  round2Total: number,
  rule: 'higher' | 'recheck_marks' | 'average',
): number {
  switch (rule) {
    case 'higher':
      return Math.max(round1Total, round2Total);
    case 'recheck_marks':
      return round2Total;
    case 'average':
      return Math.round((round1Total + round2Total) / 2);
    default:
      return round2Total;
  }
}

export default function RecheckHistory() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [requests, setRequests] = useState<RecheckRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── FETCH COMPLETED RECHECK REQUESTS ────────────────────────

  const fetchCompletedRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ Fetch all requests with status 'completed'
      const response = await recheckQueueService.getMyRequests('completed');

      console.log('📥 Completed recheck requests:', response);

      if (response.success) {
        setRequests(response.data.items || []);
      } else {
        showToast(
          response.message || 'Failed to load recheck history',
          'error',
        );
      }
    } catch (error) {
      console.error('Fetch recheck history error:', error);
      showToast('Failed to load recheck history', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedRequests();
  }, [fetchCompletedRequests]);

  // ─── HANDLERS ─────────────────────────────────────────────────

  const handleViewRequest = (requestId: number) => {
    navigate(`/recheck/marking/${requestId}?mode=readonly`);
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          <i
            className={
              toast.type === 'error' ? 'ri-error-warning-line' : 'ri-check-line'
            }
          ></i>
          {toast.message}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Recheck History</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          View completed recheck evaluations and mark differences.
        </p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState
            icon="ri-history-line"
            title="No completed rechecks"
            description="No completed rechecks yet. Completed recheck evaluations will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Req ID
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Exam
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Student
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Roll No
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    Round 1
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    Round 2
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    Final
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    Difference
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Rule
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Date
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  // ✅ Use real data from API
                  const round1Total = req.current_marks || 0;

                  // Round 2 marks - from recheck marking
                  // If we have marks_data from recheck, use it
                  let round2Total = 0;
                  let finalMarksRule = 'higher';
                  let finalMarks = 0;

                  // If request has recheck markings data
                  if (req.marks_data) {
                    // Calculate round2 from marks_data
                    const marksData = req.marks_data || {};
                    round2Total = Object.values(marksData).reduce(
                      (sum: number, val: any) => sum + (Number(val) || 0),
                      0,
                    );
                  }

                  // Use stored final marks rule or default
                  if (req.finalMarksRule) {
                    finalMarksRule = req.finalMarksRule;
                  }

                  // Compute final marks
                  finalMarks = computeFinalMarks(
                    round1Total,
                    round2Total,
                    finalMarksRule as 'higher' | 'recheck_marks' | 'average',
                  );

                  const diff = finalMarks - round1Total;
                  const ruleBadge = getFinalMarksRuleBadge(finalMarksRule);

                  // Format date
                  const dateStr =
                    req.completed_at || req.updated_at || req.created_at;
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleViewRequest(req.id)}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-gray-900 tabular-nums">
                        #{String(req.id).padStart(3, '0')}
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {req.exam_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        {req.student_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono">
                        {req.roll_no || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono tabular-nums">
                        {round1Total}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 font-mono tabular-nums">
                        {round2Total}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 font-semibold tabular-nums">
                        {finalMarks}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {diff > 0 ? (
                          <span className="text-emerald-600 font-semibold whitespace-nowrap">
                            +{diff}
                          </span>
                        ) : diff < 0 ? (
                          <span className="text-rose-600 font-semibold whitespace-nowrap">
                            {diff}
                          </span>
                        ) : (
                          <span className="text-gray-400 whitespace-nowrap">
                            No change
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${ruleBadge.bg} ${ruleBadge.text}`}
                        >
                          {ruleBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-xs font-medium text-violet-600 whitespace-nowrap">
                          View →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
