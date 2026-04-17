'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FaHistory, FaUser, FaTrash, FaVideo } from 'react-icons/fa';

interface AuditUser {
  name?: string;
  username: string;
  email: string;
  role: string;
}

interface AuditLog {
  _id: string;
  action: string;
  details: string;
  user: AuditUser;
  createdAt: string;
}

function ActivityLogsContent() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const fetchLogs = useCallback(
    async (pageNumber = 1) => {
      if (!user?.token) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/audit-logs?pageNumber=${pageNumber}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        setLogs(data.logs || []);
        setPage(data.page ?? pageNumber);
        setPages(data.pages ?? 1);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'DELETE_VIDEO':
        return (
          <div className="p-2 bg-red-100 rounded-full text-red-600">
            <FaTrash size={14} />
          </div>
        );
      case 'UPLOAD_VIDEO':
        return (
          <div className="p-2 bg-green-100 rounded-full text-green-600">
            <FaVideo size={14} />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-full text-gray-600">
            <FaHistory size={14} />
          </div>
        );
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'DELETE_VIDEO':
        return 'text-red-600 font-medium';
      case 'UPLOAD_VIDEO':
        return 'text-green-600 font-medium';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full px-6 pb-12">
        <header className="mb-8 border-b pb-4 border-gray-200">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <FaHistory className="text-blue-600" />
            Activity Logs
          </h1>
          <p className="text-gray-500 mt-1 ml-11">Track staff actions across the portal.</p>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="spinner" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No activity logs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Staff Member</th>
                    <th className="px-6 py-4">Details</th>
                    <th className="px-6 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {getActionIcon(log.action)}
                          <span className={getActionColor(log.action)}>
                            {log.action.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                            <FaUser size={12} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{log.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{log.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page === pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ActivityLogsPage() {
  return (
    <ProtectedRoute role="admin">
      <ActivityLogsContent />
    </ProtectedRoute>
  );
}
