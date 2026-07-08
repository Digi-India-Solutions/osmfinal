// src/pages/recheck/RecheckDashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePageLoading } from '@/hooks/usePageLoading';
import recheckQueueService from '@/api/recheckQueue';
import type { RecheckRequest } from '@/api/recheckQueue';

export default function RecheckDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loading = usePageLoading();

  const [requests, setRequests] = useState<RecheckRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    escalated: 0,
  });

  // ─── FETCH REQUESTS ──────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all requests (no status filter)
      const response = await recheckQueueService.getMyRequests();
      console.log('📥 Dashboard requests:', response);

      if (response.success) {
        setRequests(response.data.items || []);
        setStats(
          response.data.stats || {
            pending: 0,
            completed: 0,
            escalated: 0,
          },
        );
      }
    } catch (error) {
      console.error('Fetch dashboard requests error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // ─── FILTER REQUESTS ─────────────────────────────────────────

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const completedRequests = requests.filter(
    (r) => r.status === 'completed' || r.status === 'rejected',
  );
  const escalatedRequests = requests.filter((r) => r.status === 'escalated');

  const pendingCount = pendingRequests.length;
  const completedCount = completedRequests.length;
  const escalatedCount = escalatedRequests.length;
  const totalCount = requests.length;

  // ─── GET RECENT REQUESTS ─────────────────────────────────────

  const recentPending = pendingRequests.slice(0, 5);
  const recentCompleted = completedRequests.slice(0, 5);

  // ─── LOADING ──────────────────────────────────────────────────

  if (loading || isLoading) return <LoadingSpinner fullPage />;

  // ─── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-white rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-semibold">
              {currentUser?.name?.charAt(0) || 'R'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Welcome back, {currentUser?.name || 'Rechecker'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Review recheck requests and verify first-round evaluations.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Pending Rechecks
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {pendingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="ri-time-line text-lg text-amber-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Completed
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {completedCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="ri-check-double-line text-lg text-emerald-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Escalated
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {escalatedCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <i className="ri-alert-line text-lg text-amber-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-sm text-gray-500 whitespace-nowrap">
                Total Assigned
              </p>
              <p className="text-2xl font-bold text-violet-600">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <i className="ri-inbox-line text-lg text-violet-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Pending & Completed Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Rechecks */}
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">
              Pending Rechecks
            </h4>
            <button
              onClick={() => navigate('/recheck/queue?tab=pending')}
              className="text-xs font-medium text-violet-600 hover:text-violet-700 cursor-pointer whitespace-nowrap transition-colors"
            >
              View All →
            </button>
          </div>
          {recentPending.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              No pending rechecks
            </p>
          ) : (
            <div className="space-y-3">
              {recentPending.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {req.exam_name || `Exam #${req.exam_id}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {req.student_name || 'Unknown'} (Roll{' '}
                        {req.roll_no || '—'})
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {req.created_at
                          ? new Date(req.created_at).toLocaleDateString()
                          : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                      {req.reason || 'No reason provided'}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/recheck/marking/${req.id}`)}
                    className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ml-3"
                  >
                    Start Recheck
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Completed */}
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900">
              Recent Completed
            </h4>
            <button
              onClick={() => navigate('/recheck/queue?tab=completed')}
              className="text-xs font-medium text-violet-600 hover:text-violet-700 cursor-pointer whitespace-nowrap transition-colors"
            >
              View All →
            </button>
          </div>
          {recentCompleted.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              No completed rechecks yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentCompleted.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {req.student_name || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {req.exam_name || 'Unknown Exam'}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {req.finalMarksRule || 'higher'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/recheck/marking/${req.id}`)}
                    className="text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ml-3"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Escalated Section */}
      {escalatedCount > 0 && (
        <div className="bg-white rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Escalated Requests
            </h4>
            <button
              onClick={() => navigate('/recheck/queue?tab=escalated')}
              className="text-xs font-medium text-violet-600 hover:text-violet-700 cursor-pointer whitespace-nowrap transition-colors"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">
                    Student
                  </th>
                  <th className="text-left py-2 font-medium text-gray-500">
                    Exam
                  </th>
                  <th className="text-left py-2 font-medium text-gray-500">
                    Reason
                  </th>
                  <th className="text-right py-2 font-medium text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests
                  .filter((r) => r.status === 'escalated')
                  .slice(0, 5)
                  .map((req) => (
                    <tr
                      key={req.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      <td className="py-2.5 text-gray-900 font-medium">
                        {req.student_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 text-gray-500">
                        {req.exam_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 text-gray-400 truncate max-w-[150px]">
                        {req.reason || '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => navigate(`/recheck/marking/${req.id}`)}
                          className="text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
