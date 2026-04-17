'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  FaEye,
  FaUser,
  FaCalendar,
  FaPhone,
  FaEnvelope,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaBan,
  FaCheckCircle,
  FaPaperPlane,
  FaClock,
} from 'react-icons/fa';

const DATE_FILTERS = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
] as const;

interface ShareIdPopulated {
  _id?: string;
  suspended?: boolean;
  createdAt?: string;
  user?: { name?: string; username?: string };
  metadata?: { expiresAt?: string };
}

interface ViewEntry {
  shareId?: ShareIdPopulated | string;
  viewedAt: string;
  viewerName?: string;
  viewerEmail?: string;
  viewerMobile?: string;
}

interface Video {
  _id: string;
  title?: string;
  originalName?: string;
  registration?: string;
  make?: string;
  model?: string;
  views?: ViewEntry[];
  uploadedBy?: { name?: string; username?: string };
}

interface FlatView extends ViewEntry {
  videoTitle: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  uploadedBy?: { name?: string; username?: string };
}

interface GroupedView extends FlatView {
  count: number;
  allTimes: string[];
}

interface Props {
  isAdmin: boolean;
}

export default function CustomerViewsContent({ isAdmin }: Props) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [suspendedMap, setSuspendedMap] = useState<Record<string, boolean>>({});
  const [suspendLoading, setSuspendLoading] = useState<Record<string, boolean>>({});
  const [stockRegs, setStockRegs] = useState<Set<string>>(new Set());

  const fetchVideos = useCallback(async () => {
    if (!user?.token) return;
    try {
      const url = isAdmin ? '/api/videos?all=true' : '/api/videos';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${user.token}` } });
      const data: Video[] = await res.json();
      setVideos(data);

      const initialSuspendedMap: Record<string, boolean> = {};
      data.forEach((video) => {
        (video.views || []).forEach((v) => {
          const sid = v.shareId && typeof v.shareId === 'object' ? v.shareId._id : (v.shareId as string | undefined);
          if (sid) {
            const suspended =
              typeof v.shareId === 'object' && v.shareId ? (v.shareId as ShareIdPopulated).suspended ?? false : false;
            initialSuspendedMap[sid] = suspended;
          }
        });
      });
      setSuspendedMap(initialSuspendedMap);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchVideos();
    const fetchStock = async () => {
      if (!user?.token) return;
      try {
        const res = await fetch('/api/autotrader/stock', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        const regs = new Set<string>(
          (data.results || [])
            .map((item: { vehicle?: { registration?: string } }) =>
              (item.vehicle?.registration || '').replace(/\s/g, '').toUpperCase()
            )
            .filter((r: string): r is string => Boolean(r))
        );
        setStockRegs(regs);
      } catch (error) {
        console.error('Failed to fetch stock', error);
      }
    };
    fetchStock();
  }, [fetchVideos, user?.token]);

  const handleToggleSuspend = async (
    shareIdObj: string | ShareIdPopulated | undefined,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const sId =
      shareIdObj && typeof shareIdObj === 'object' ? shareIdObj._id : shareIdObj;
    if (!sId) return;

    setSuspendLoading((prev) => ({ ...prev, [sId]: true }));
    try {
      const res = await fetch(`/api/audit-logs/${sId}/suspend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      setSuspendedMap((prev) => ({ ...prev, [sId]: data.suspended }));
    } catch (err) {
      console.error('Failed to toggle suspension:', err);
      alert('Failed to change link status. Please try again.');
    } finally {
      setSuspendLoading((prev) => ({ ...prev, [sId]: false }));
    }
  };

  const allViews: FlatView[] = videos
    .flatMap((video) =>
      (video.views || []).map((view) => ({
        ...view,
        videoTitle: video.title || video.originalName || 'Untitled Video',
        registration: video.registration || null,
        make: video.make || null,
        model: video.model || null,
        uploadedBy: video.uploadedBy,
      }))
    )
    .sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());

  const applyDateFilter = (views: FlatView[]) => {
    if (dateFilter === 'all') return views;
    const now = new Date();
    return views.filter((v) => {
      const d = new Date(v.viewedAt);
      if (dateFilter === 'today') return d.toDateString() === now.toDateString();
      if (dateFilter === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return d >= startOfWeek;
      }
      if (dateFilter === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const applySearch = (views: FlatView[]) => {
    if (!searchQuery.trim()) return views;
    const q = searchQuery.toLowerCase().trim();
    return views.filter(
      (v) =>
        (v.viewerName || '').toLowerCase().includes(q) ||
        (v.viewerEmail || '').toLowerCase().includes(q) ||
        (v.viewerMobile || '').includes(q) ||
        (v.make || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q) ||
        (v.registration || '').toLowerCase().includes(q)
    );
  };

  const filteredViews = applySearch(applyDateFilter(allViews));

  const groupedViews = filteredViews.reduce<Record<string, GroupedView>>((acc, view) => {
    const key = `${view.viewerEmail || ''}-${view.viewerMobile || ''}-${view.viewerName || ''}-${view.registration || view.videoTitle}`;
    if (!acc[key]) {
      acc[key] = { ...view, count: 1, allTimes: [view.viewedAt] };
    } else {
      acc[key].count += 1;
      acc[key].allTimes.push(view.viewedAt);
      if (new Date(view.viewedAt) > new Date(acc[key].viewedAt)) {
        acc[key].viewedAt = view.viewedAt;
      }
    }
    return acc;
  }, {});

  const groupedRows = Object.entries(groupedViews).sort(
    ([, a], [, b]) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
  );

  const totalPages = Math.ceil(groupedRows.length / ITEMS_PER_PAGE);
  const paginatedRows = groupedRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalViews = allViews.length;
  const uniqueCustomers = new Set(
    allViews.map((v) => v.viewerEmail || v.viewerMobile || v.viewerName)
  ).size;
  const todayViews = allViews.filter((v) => {
    const d = new Date(v.viewedAt);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showAdminColumn = isAdmin;

  return (
    <div className="w-full px-6">
      <header className="mb-6 md:mb-8 border-b pb-4 border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Customer Views</h1>
            <p className="text-sm md:text-base text-gray-500 mt-1">
              Track who opened your shared video links and when.
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Total Views</p>
          <p className="text-3xl font-bold text-blue-600">{totalViews}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Unique Customers</p>
          <p className="text-3xl font-bold text-indigo-600">{uniqueCustomers}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">Viewed Today</p>
          <p className="text-3xl font-bold text-emerald-600">{todayViews}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <FaSearch size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone or vehicle…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setDateFilter(f.value);
                setCurrentPage(1);
              }}
              className={`px-4 py-2.5 text-sm rounded-xl border font-medium transition ${
                dateFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {(searchQuery || dateFilter !== 'all') && (
        <p className="text-xs text-gray-400 mb-3">
          Showing <span className="font-semibold text-gray-600">{groupedRows.length}</span> result
          {groupedRows.length !== 1 ? 's' : ''}
          {searchQuery && (
            <>
              {' '}
              for <span className="font-semibold text-gray-600">&quot;{searchQuery}&quot;</span>
            </>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : groupedRows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <FaEye className="text-gray-300" size={36} />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {searchQuery || dateFilter !== 'all' ? 'No results found' : 'No views recorded yet'}
          </h3>
          <p className="text-sm text-gray-400">
            {searchQuery || dateFilter !== 'all'
              ? 'Try adjusting your search or date filter.'
              : "When a customer opens a link you've sent via email or SMS, their details will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</th>
                  {showAdminColumn && (
                    <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sent By</th>
                  )}
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Viewed</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Expires</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Views</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(([key, view], rowIndex) => {
                  const globalRowIndex = (currentPage - 1) * ITEMS_PER_PAGE + rowIndex + 1;
                  const isExpanded = expandedGroups[key];
                  const hasMultiple = view.count > 1;
                  const shareIdRaw = view.shareId && typeof view.shareId === 'object' ? view.shareId : undefined;
                  const shareIdStr =
                    shareIdRaw && typeof shareIdRaw === 'object' && '_id' in shareIdRaw
                      ? shareIdRaw._id
                      : (view.shareId as string | undefined);
                  const isSuspended = shareIdStr
                    ? (suspendedMap[shareIdStr] ?? (shareIdRaw && typeof shareIdRaw === 'object' ? shareIdRaw.suspended : false) ?? false)
                    : false;
                  const isTogglingThis = shareIdStr ? (suspendLoading[shareIdStr] ?? false) : false;
                  const normViewReg = (view.registration || '').replace(/\s/g, '').toUpperCase();
                  const isSold = Boolean(normViewReg && stockRegs.size > 0 && !stockRegs.has(normViewReg));

                  return (
                    <Fragment key={key}>
                      <tr
                        className={`group border-b border-gray-100 transition-colors ${
                          hasMultiple ? 'cursor-pointer' : ''
                        } ${isSuspended ? 'bg-red-50/30' : 'bg-white hover:bg-gray-50/80'}`}
                        onClick={() => hasMultiple && toggleGroup(key)}
                      >
                        <td className="px-5 py-3.5 text-xs text-gray-300 font-medium">{globalRowIndex}</td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                                isSuspended ? 'bg-red-100' : 'bg-gradient-to-br from-blue-100 to-indigo-200'
                              }`}
                            >
                              <FaUser size={13} className={isSuspended ? 'text-red-500' : 'text-blue-600'} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm leading-tight">
                                  {view.viewerName || 'Unknown'}
                                </span>
                                {isSuspended && (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200">
                                    <FaBan size={8} /> Suspended
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {view.viewerEmail && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <FaEnvelope size={9} /> {view.viewerEmail}
                                  </span>
                                )}
                                {view.viewerMobile && (
                                  <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <FaPhone size={9} /> {view.viewerMobile}
                                  </span>
                                )}
                                {!view.viewerEmail && !view.viewerMobile && (
                                  <span className="text-xs text-gray-300 italic">No contact</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-800 leading-tight">
                            {view.make && view.model ? `${view.make} ${view.model}` : view.videoTitle}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {view.registration && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">
                                {view.registration}
                              </span>
                            )}
                            {isSold && (
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-md border border-red-200">
                                Sold
                              </span>
                            )}
                          </div>
                        </td>

                        {showAdminColumn && (
                          <td className="px-5 py-3.5 text-xs text-gray-500">
                            {shareIdRaw && typeof shareIdRaw === 'object' && shareIdRaw.user
                              ? shareIdRaw.user.name || shareIdRaw.user.username
                              : view.uploadedBy?.name || view.uploadedBy?.username || '—'}
                          </td>
                        )}

                        <td className="px-5 py-3.5">
                          <p className="text-sm font-medium text-gray-700">
                            {new Date(view.viewedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <FaClock size={9} />
                            {new Date(view.viewedAt).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          {shareIdRaw && typeof shareIdRaw === 'object' && shareIdRaw.createdAt ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <FaPaperPlane size={9} />
                                {new Date(shareIdRaw.createdAt).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              {shareIdRaw.metadata?.expiresAt ? (
                                (() => {
                                  const isExpired = new Date() > new Date(shareIdRaw.metadata!.expiresAt as string);
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                        isExpired
                                          ? 'bg-red-50 text-red-600 border-red-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isExpired ? 'bg-red-500' : 'bg-emerald-500'
                                        }`}
                                      />
                                      {isExpired ? 'Expired' : 'Expires'}{' '}
                                      {new Date(shareIdRaw.metadata!.expiresAt as string).toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                      })}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span className="text-xs text-gray-300 italic">No expiry</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                hasMultiple
                                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                                  : 'bg-gray-50 text-gray-400 border-gray-200'
                              }`}
                            >
                              <FaEye size={9} /> {view.count}x
                            </span>
                            {hasMultiple &&
                              (isExpanded ? (
                                <FaChevronUp size={10} className="text-gray-400" />
                              ) : (
                                <FaChevronDown size={10} className="text-gray-400" />
                              ))}
                          </div>
                        </td>

                        <td
                          className="px-5 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {shareIdStr ? (
                            <button
                              type="button"
                              onClick={(e) => handleToggleSuspend(shareIdStr, e)}
                              disabled={isTogglingThis}
                              title={isSuspended ? 'Enable this link' : 'Suspend this link'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                isSuspended
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              } ${isTogglingThis ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {isTogglingThis ? (
                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : isSuspended ? (
                                <>
                                  <FaCheckCircle size={10} /> Enable
                                </>
                              ) : (
                                <>
                                  <FaBan size={10} /> Suspend
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 italic">No token</span>
                          )}
                        </td>
                      </tr>

                      {hasMultiple &&
                        isExpanded &&
                        view.allTimes.map((time, i) => (
                          <tr
                            key={`${key}-expanded-${i}`}
                            className="bg-blue-50/30 border-b border-blue-100/60"
                          >
                            <td
                              className="px-5 py-2 pl-14"
                              colSpan={showAdminColumn ? 3 : 2}
                            >
                              <span className="text-xs text-gray-400 italic">
                                View #{view.count - i}
                              </span>
                            </td>
                            {showAdminColumn && <td />}
                            <td className="px-5 py-2">
                              <div className="flex items-center gap-2">
                                <FaCalendar size={10} className="text-blue-400" />
                                <span className="text-xs text-gray-600">
                                  {new Date(time).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}{' '}
                                  <span className="text-gray-400">
                                    {new Date(time).toLocaleTimeString('en-GB', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </span>
                              </div>
                            </td>
                            <td />
                            <td />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/60">
              <p className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-700">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                  {Math.min(currentPage * ITEMS_PER_PAGE, groupedRows.length)}
                </span>{' '}
                of <span className="font-semibold text-gray-700">{groupedRows.length}</span> results
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-sm rounded-lg border transition font-medium ${
                      page === currentPage
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:bg-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
