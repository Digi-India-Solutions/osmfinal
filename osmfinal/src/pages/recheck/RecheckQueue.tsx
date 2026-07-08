// src/pages/recheck/RecheckQueue.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import recheckQueueService from '@/api/recheckQueue';
import type { RecheckRequest } from '@/api/recheckQueue';

type TabKey = 'pending' | 'completed' | 'escalated'; // ✅ Add 'escalated'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'escalated', label: 'Escalated' }, // ✅ Add this
];

export default function RecheckQueue() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [requests, setRequests] = useState<RecheckRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    escalated: 0, // ✅ Add this
  });
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

  // ─── FETCH REQUESTS ──────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // ✅ If activeTab is 'escalated', fetch with status 'escalated'
      const status = activeTab === 'escalated' ? 'escalated' : activeTab;
      const response = await recheckQueueService.getMyRequests(
        activeTab === 'pending'
          ? 'pending'
          : activeTab === 'escalated'
            ? 'escalated'
            : 'completed',
      );

      console.log('📥 Recheck requests response:', response);

      if (response.success) {
        setRequests(response.data.items || []);
        setStats(
          response.data.stats || {
            pending: 0,
            completed: 0,
            escalated: 0,
          },
        );
      } else {
        showToast(response.message || 'Failed to load requests', 'error');
      }
    } catch (error) {
      console.error('Fetch recheck requests error:', error);
      showToast('Failed to load requests', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ─── GET TAB COUNT ──────────────────────────────────────────

  const getTabCount = (key: TabKey): number => {
    const map: Record<TabKey, number> = {
      pending: stats.pending,
      completed: stats.completed,
      escalated: stats.escalated || 0,
    };
    return map[key] || 0;
  };

  // ─── HANDLE START MARKING ──────────────────────────────────

  const handleStartMarking = (requestId: number) => {
    navigate(`/recheck/marking/${requestId}`);
  };

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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

      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
          Recheck Queue
        </h2>
      </div>

      <div className="bg-white rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] text-gray-400">
                  {getTabCount(tab.key)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-inbox-line text-gray-400 text-2xl"></i>
          </div>
          <p className="text-sm font-medium text-gray-700">
            No {activeTab} recheck requests
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {activeTab === 'pending'
              ? 'No pending recheck requests assigned to you.'
              : activeTab === 'escalated'
                ? 'No escalated recheck requests.'
                : 'No completed recheck requests.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Student
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Exam
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isEscalated = request.status === 'escalated';

                  return (
                    <tr
                      key={request.id}
                      className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                        #{request.id}
                      </td>
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">
                        {request.student_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {request.exam_name || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap max-w-[150px] truncate">
                        {request.reason || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={request.status} />
                        {isEscalated && (
                          <span className="ml-1.5 text-[10px] text-gray-400">
                            {request.escalated_by_name || 'Escalated'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {request.status === 'pending' ? (
                          <button
                            onClick={() => handleStartMarking(request.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Start Recheck
                          </button>
                        ) : request.status === 'escalated' ? (
                          <button
                            onClick={() => handleStartMarking(request.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            View Escalated
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartMarking(request.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
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
        </div>
      )}
    </div>
  );
}
