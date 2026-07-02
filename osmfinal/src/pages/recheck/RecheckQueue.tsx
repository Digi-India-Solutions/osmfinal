// src/pages/recheck/RecheckQueue.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import recheckQueueService, { RecheckRequest } from '@/api/recheckQueue';

type QueueTab = 'pending' | 'completed';

export default function RecheckQueue() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [activeTab, setActiveTab] = useState<QueueTab>('pending');
  const [requests, setRequests] = useState<RecheckRequest[]>([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0 });
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

  // ─── FETCH RECHECK REQUESTS ────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await recheckQueueService.getMyRequests(activeTab);
      if (response.success) {
        setRequests(response.data.items || []);
        setStats(response.data.stats || { pending: 0, completed: 0 });
      } else {
        showToast(
          response.message || 'Failed to load recheck requests',
          'error',
        );
      }
    } catch (error) {
      console.error('Fetch recheck requests error:', error);
      showToast('Failed to load recheck requests', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ─── HANDLERS ─────────────────────────────────────────────────

  const handleStartRecheck = (requestId: number) => {
    navigate(`/recheck/marking/${requestId}`);
  };

  const tabs: { key: QueueTab; label: string; count: number }[] = [
    { key: 'pending', label: 'Pending', count: stats.pending },
    { key: 'completed', label: 'Completed', count: stats.completed },
  ];

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading) return <LoadingSpinner fullPage />;

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
        <h2 className="text-lg font-semibold text-gray-900">Recheck Queue</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage and process recheck requests assigned to you.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-full p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key
                  ? 'bg-violet-100 text-violet-600'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-400 mt-3">
              Loading recheck requests...
            </p>
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon="ri-inbox-line"
            title="No recheck requests"
            description={
              activeTab === 'pending'
                ? 'No pending recheck requests assigned to you.'
                : 'No completed recheck requests.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Exam
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Sheet / Student
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Requested By
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
                  const isPending = req.status === 'pending';
                  const isCompleted =
                    req.status === 'completed' || req.status === 'rejected';

                  return (
                    <tr
                      key={req.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-gray-900 tabular-nums">
                        #{String(req.id).padStart(3, '0')}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900 font-medium">
                          {req.exam_name || '—'}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {req.exam_subject || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {req.student_name ? (
                          <>
                            <p className="text-gray-900">{req.student_name}</p>
                            <p className="text-[10px] text-gray-400">
                              Roll {req.roll_no}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">Full batch</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[160px]">
                        <p className="text-gray-600 truncate">{req.reason}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                            isPending
                              ? 'bg-amber-100 text-amber-700'
                              : isCompleted
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isPending
                            ? 'Pending'
                            : isCompleted
                              ? 'Completed'
                              : req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {req.requested_by_name || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <button
                            onClick={() => handleStartRecheck(req.id)}
                            className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            Start Recheck
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              navigate(`/recheck/marking/${req.id}`)
                            }
                            className="text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            View
                          </button>
                        )}
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
