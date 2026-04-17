'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import {
  FaSearch, FaEllipsisV, FaCar, FaVideo, FaTrash, FaCopy, FaCheck, FaExternalLinkAlt, FaPaperPlane
} from 'react-icons/fa';
import UKPhoneInput from '@/components/UKPhoneInput';

interface StockItem {
  _id: string;
  id?: string;
  advertiserId: string;
  make: string;
  model: string;
  registration?: string;
  derivative?: string;
  year?: number;
  price?: number;
  mileage?: number;
  colour?: string;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  images?: string[];
  lifecycleState?: string;
  updatedAt: string;
  // Fallback for nesting
  vehicle?: {
    make: string;
    model: string;
    registration?: string;
    derivative?: string;
    mileage?: number;
    odometerReadingMiles?: number;
    year?: number;
    price?: number;
  };
  media?: { images?: { href?: string; url?: string }[] };
}

interface Video {
  _id: string;
  title?: string;
  registration?: string;
  make?: string;
  model?: string;
  uploadedBy?: { name?: string; username?: string };
}

export default function AdminStockPage() {
  return (
    <ProtectedRoute role="admin">
      <DashboardLayout>
        <AdminStockContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function AdminStockContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals
  const [reserveLinkModalOpen, setReserveLinkModalOpen] = useState(false);
  const [reserveLinkItem, setReserveLinkItem] = useState<StockItem | null>(null);
  const [reserveLink, setReserveLink] = useState('');
  const [savingReserveLink, setSavingReserveLink] = useState(false);

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);

  const [vehicleMetadata, setVehicleMetadata] = useState<Record<string, any>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchVehicleMetadata = useCallback(async (registration: string) => {
    const norm = registration.replace(/\s/g, '').toUpperCase();
    try {
      const res = await fetch(`/api/vehicle-metadata/${norm}`, { headers: { Authorization: `Bearer ${user?.token}` } });
      if (res.ok) return await res.json();
    } catch {
      console.error('Failed to fetch vehicle metadata');
    }
    return { registration: norm, reserveLink: '' };
  }, [user?.token]);

  const fetchAllVehicleMetadata = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/vehicle-metadata', { headers: { Authorization: `Bearer ${user.token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const metadataMap: Record<string, any> = {};
      (Array.isArray(data) ? data : []).forEach((item: { registration?: string }) => {
        if (item.registration) {
          metadataMap[item.registration.replace(/\s/g, '').toUpperCase()] = item;
        }
      });
      setVehicleMetadata((prev) => ({ ...prev, ...metadataMap }));
    } catch {
      console.error('Failed to fetch vehicle metadata');
    }
  }, [user?.token]);

  const fetchStock = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/autotrader/stock', { headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.stock || data.results || [];
      setStock(items);
      if (data.lastSync || data.lastSyncTime) setLastSync(data.lastSync || data.lastSyncTime);
    } catch (err: any) {
      showToast(err.message || 'Failed to map stock', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  const fetchVideos = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/videos', { headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      setVideos(data.videos || data);
    } catch (error) {
      console.error('Failed to fetch videos', error);
    }
  }, [user]);

  useEffect(() => {
    fetchStock();
    fetchVideos();
    fetchAllVehicleMetadata();
  }, [fetchStock, fetchVideos, fetchAllVehicleMetadata]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/autotrader/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      showToast(`Sync complete — ${data.count || 0} vehicles updated`, 'success');
      fetchStock();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally { setSyncing(false); }
  };

  const getVehicleData = (item: StockItem) => {
    const mileage =
      item.mileage ||
      item.vehicle?.mileage ||
      item.vehicle?.odometerReadingMiles ||
      0;
    return {
      make: item.make || item.vehicle?.make || '',
      model: item.model || item.vehicle?.model || '',
      registration: item.registration || item.vehicle?.registration || '',
      derivative: item.derivative || item.vehicle?.derivative || '',
      mileage,
      image: item.images?.[0] || item.media?.images?.[0]?.url || item.media?.images?.[0]?.href || '',
    };
  };

  const getMatchingVideos = (item: StockItem) => {
    const vData = getVehicleData(item);
    const stockReg = (vData.registration || '').replace(/\s/g, '').toUpperCase();
    if (!stockReg) return [];

    return videos.filter(video => {
      if (video.registration) {
        return video.registration.replace(/\s/g, '').toUpperCase() === stockReg;
      }
      return (video.title || '').replace(/\s/g, '').toUpperCase().includes(stockReg);
    });
  };

  const copyToClipboard = async (videoId: string) => {
    const video = videos.find((v) => v._id === videoId);
    let shareId = '';
    try {
      const res = await fetch(`/api/videos/${videoId}/share`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        shareId = data.shareId || '';
      }
    } catch {
      console.error('Failed to register share');
    }
    const refName =
      user?.role === 'admin'
        ? 'Eesa Nasim'
        : user?.name ||
          user?.username ||
          video?.uploadedBy?.name ||
          video?.uploadedBy?.username ||
          'Admin';
    let link = `${window.location.origin}/view/${videoId}?ref=${encodeURIComponent(refName)}`;
    if (shareId) link += `&s=${shareId}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(videoId);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
    setActiveMenu(null);
  };

  const handleActionClick = (e: React.MouseEvent, uniqueId: string) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === uniqueId ? null : uniqueId);
  };

  const handleDeleteVideo = async (video: Video) => {
    if (!window.confirm(`Are you sure you want to delete the video for ${video.title || 'this vehicle'}?`)) return;
    try {
      const res = await fetch(`/api/videos/${video._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (!res.ok) throw new Error('Failed to delete video');
      setVideos(prev => prev.filter(v => v._id !== video._id));
      showToast('Video deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleSaveReserveLink = async () => {
    if (!reserveLinkItem) return;
    const vData = getVehicleData(reserveLinkItem);
    const normReg = (vData.registration || '').replace(/\s/g, '').toUpperCase();
    setSavingReserveLink(true);
    try {
      const res = await fetch(`/api/vehicle-metadata/${normReg}/reserve-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ reserveLink })
      });
      if (!res.ok) throw new Error('Failed to save reserve link');
      showToast('Reserve link saved!', 'success');
      setVehicleMetadata(prev => ({ ...prev, [normReg]: { ...prev[normReg], reserveLink } }));
      setReserveLinkModalOpen(false);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingReserveLink(false);
    }
  };

  // Filter & Pagination logic
  const filteredStock = stock.filter(item => {
    const vData = getVehicleData(item);
    const searchString = searchTerm.toLowerCase();
    const make = vData.make.toLowerCase();
    const model = vData.model.toLowerCase();
    const reg = vData.registration.toLowerCase();
    const matchesSearch = make.includes(searchString) || model.includes(searchString) || reg.includes(searchString);

    const matches = getMatchingVideos(item);
    const hasVideo = matches.length > 0;
    const matchesFilter = filterStatus === 'All' ||
      (filterStatus === 'With Video' && hasVideo) ||
      (filterStatus === 'No Video' && !hasVideo);

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredStock.length / ITEMS_PER_PAGE);
  const paginatedStock = filteredStock.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startEntry = filteredStock.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endEntry = Math.min(currentPage * ITEMS_PER_PAGE, filteredStock.length);

  const handleCloseSendModal = () => {
    setSendModalOpen(false);
    setSelectedVideo(null);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const handleSendVideo = async () => {
    if (!selectedVideo) return;
    if (!sendForm.name.trim() || (!sendForm.email && !sendForm.mobile)) {
      showToast('Please enter customer name and email or mobile', 'error');
      return;
    }
    setSending(true);
    try {
      const refName =
        user?.role === 'admin'
          ? 'Eesa Nasim'
          : user?.name ||
            user?.username ||
            selectedVideo.uploadedBy?.name ||
            selectedVideo.uploadedBy?.username ||
            '';
      const videoLink = `${window.location.origin}/view/${selectedVideo._id}?ref=${encodeURIComponent(refName)}`;
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          email: sendForm.email,
          mobile: sendForm.mobile?.replace(/\D/g, ''),
          videoLink,
          vehicleDetails: {
            make: selectedVideo.make || '',
            model: selectedVideo.model || '',
            registration: selectedVideo.registration,
          },
          customerName: sendForm.name,
          customerTitle: sendForm.title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || (data as { error?: string }).error || 'Failed to send');
      showToast('Video link sent successfully!', 'success');
      handleCloseSendModal();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800">Stock Status</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your vehicle inventory and video status.</p>
          {lastSync && <p className="text-xs text-gray-400 mt-0.5">Last sync: {new Date(lastSync).toLocaleString()}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-3 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            {['All', 'With Video', 'No Video'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => { setFilterStatus(status); setCurrentPage(1); }}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition ${filterStatus === status ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50">Vehicle</th>
                  <th className="hidden md:table-cell px-6 py-4 bg-gray-50">Details</th>
                  <th className="hidden lg:table-cell px-6 py-4 bg-gray-50">Reserve Link</th>
                  <th className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4 bg-gray-50">Status</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-right bg-gray-50">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedStock.length > 0 ? (
                  paginatedStock.map((item, index) => {
                    const vData = getVehicleData(item);
                    const normReg = (vData.registration || '').replace(/\s/g, '').toUpperCase();
                    const uniqueId = `${item.id || item._id}-${index}`;
                    const matchingVideos = getMatchingVideos(item);
                    const videoExists = matchingVideos.length > 0;
                    const imageUrl = item.media?.images?.[0]?.href || item.media?.images?.[0]?.url || vData.image;

                    return (
                      <tr
                        key={uniqueId}
                        className={`transition relative ${videoExists ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-4">
                            <div className="w-12 h-9 sm:w-16 sm:h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                              {imageUrl ? (
                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full text-gray-400">
                                  <FaCar size={16} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-800 text-xs sm:text-sm truncate">{vData.make} {vData.model}</h3>
                              <p className="text-xs text-blue-600 font-mono font-medium">{vData.registration || '—'}</p>
                              {/* Details inline on small screens */}
                              <div className="md:hidden mt-1 space-y-0.5">
                                <p className="text-xs text-gray-500 truncate">{vData.derivative || ''}</p>
                                {vData.mileage ? <p className="text-xs text-gray-400">{vData.mileage.toLocaleString()} mi</p> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">{vData.derivative || '—'}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
                                {vData.mileage ? `${vData.mileage.toLocaleString()} miles` : '—'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-6 py-4">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!normReg) {
                                showToast('No registration plate found for this vehicle.', 'error');
                                return;
                              }
                              let metadata = vehicleMetadata[normReg];
                              if (!metadata) {
                                metadata = await fetchVehicleMetadata(normReg);
                                setVehicleMetadata((prev) => ({ ...prev, [normReg]: metadata }));
                              }
                              setReserveLinkItem(item);
                              setReserveLink((metadata as { reserveLink?: string })?.reserveLink || '');
                              setReserveLinkModalOpen(true);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                              normReg && vehicleMetadata[normReg]?.reserveLink
                                ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            🔒 {normReg && vehicleMetadata[normReg]?.reserveLink ? 'Edit Link' : 'Add Link'}
                          </button>
                        </td>
                        <td className="hidden sm:table-cell px-4 sm:px-6 py-3 sm:py-4">
                          {videoExists ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {matchingVideos.length} Video{matchingVideos.length > 1 ? 's' : ''}
                              </span>
                              {matchingVideos[0]?.uploadedBy && (
                                <p className="text-xs text-gray-500">
                                  by {matchingVideos[0].uploadedBy.name || matchingVideos[0].uploadedBy.username}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              No Video
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                          <div className="relative inline-block">
                            {videoExists ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleActionClick(e, uniqueId)}
                                  className={`p-2 rounded-full transition ${activeMenu === uniqueId ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                >
                                  <FaEllipsisV />
                                </button>
                                {activeMenu === uniqueId && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} aria-hidden />
                                    <div className="absolute w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-fade-in origin-top-right right-0 mt-1">
                                      {matchingVideos.map((vid, idx) => (
                                        <div key={vid._id}>
                                          {matchingVideos.length > 1 && (
                                            <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50 uppercase tracking-wider">
                                              Video {idx + 1}
                                            </div>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(vid._id)}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition"
                                          >
                                            {copiedId === vid._id ? <FaCheck size={14} className="text-green-500" /> : <FaCopy size={14} className="text-gray-400" />}
                                            {copiedId === vid._id ? 'Copied!' : 'Copy Link'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              window.open(`/view/${vid._id}`, '_blank');
                                              setActiveMenu(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition"
                                          >
                                            <FaExternalLinkAlt size={14} className="text-gray-400" /> Open Video
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedVideo(vid);
                                              setSendModalOpen(true);
                                              setActiveMenu(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md flex items-center gap-2 transition"
                                          >
                                            <FaPaperPlane size={14} className="text-purple-500/70" /> Send to Customer
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleDeleteVideo(vid);
                                              setActiveMenu(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition"
                                          >
                                            <FaTrash size={14} className="text-red-500/70" /> Delete Video
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-300 text-sm select-none">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 text-sm">
                      No stock found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 sm:p-4 border-t border-gray-100 flex items-center justify-between text-xs sm:text-sm text-gray-500 flex-wrap gap-2">
          <p>
            <span className="font-medium text-gray-800">{startEntry}-{endEntry}</span> of{' '}
            <span className="font-medium text-gray-800">{filteredStock.length}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 border rounded font-medium ${
                  currentPage === page ? 'bg-blue-50 text-blue-600 border-blue-100' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {sendModalOpen && selectedVideo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Send Video Link</h3>
              <button type="button" onClick={handleCloseSendModal} className="text-gray-400 hover:text-gray-600 transition">
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <select
                    value={sendForm.title}
                    onChange={(e) => setSendForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Miss">Miss</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={sendForm.name}
                    onChange={(e) => setSendForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="John Smith"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={sendForm.email}
                  onChange={(e) => setSendForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <UKPhoneInput value={sendForm.mobile} onChange={(v) => setSendForm((p) => ({ ...p, mobile: v }))} />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseSendModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendVideo}
                  disabled={sending || (!sendForm.email && !sendForm.mobile)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reserveLinkModalOpen && reserveLinkItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-emerald-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                🔒 {vehicleMetadata[(getVehicleData(reserveLinkItem).registration || '').replace(/\s/g, '').toUpperCase()]?.reserveLink ? 'Edit' : 'Add'} Reserve Car Link
              </h3>
              <button type="button" onClick={() => setReserveLinkModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition">
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                  {getVehicleData(reserveLinkItem).make} {getVehicleData(reserveLinkItem).model} — {getVehicleData(reserveLinkItem).registration}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reserve Car Link URL</label>
                <input
                  type="url"
                  value={reserveLink}
                  onChange={(e) => setReserveLink(e.target.value)}
                  placeholder="https://example.com/reserve"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">When customers click &quot;Reserve Car&quot;, they&apos;ll be redirected to this URL.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setReserveLinkModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReserveLink}
                  disabled={savingReserveLink}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-50"
                >
                  {savingReserveLink ? 'Saving...' : 'Save Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
