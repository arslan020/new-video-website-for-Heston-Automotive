'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import {
  FaCar, FaVideo, FaCopy, FaCheckCircle, FaCheck, FaPlus, FaCloudUploadAlt,
  FaTimes, FaFile, FaSearch, FaGasPump, FaCog, FaCalendar, FaPalette,
  FaBolt, FaLeaf, FaTachometerAlt, FaUsers, FaEllipsisV, FaExternalLinkAlt, FaPaperPlane, FaTrash, FaLink
} from 'react-icons/fa';

interface StockItem {
  _id?: string;
  id?: string;
  advertiserId?: string;
  make?: string;
  model?: string;
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
  vehicle?: any;
  media?: any;
  highlights?: string[];
  features?: string[];
}

interface Video {
  _id: string;
  title: string;
  registration?: string;
  uploadedBy?: { name?: string; username?: string };
}

const ITEMS_PER_PAGE = 10;

export default function StaffStockPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <StockContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StockContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // States
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // vehicle metadata dict
  const [vehicleMetadata, setVehicleMetadata] = useState<Record<string, any>>({});

  // Reserve Link Modal
  const [reserveLinkModalOpen, setReserveLinkModalOpen] = useState(false);
  const [reserveLinkItem, setReserveLinkItem] = useState<StockItem | null>(null);
  const [reserveLink, setReserveLink] = useState('');
  const [savingReserveLink, setSavingReserveLink] = useState(false);

  // Send Modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);

  // Smart Upload Modal
  const [smartUploadOpen, setSmartUploadOpen] = useState(false);
  const [lookupRegistration, setLookupRegistration] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [fetchedVehicle, setFetchedVehicle] = useState<any>(null);
  const [smartMileage, setSmartMileage] = useState('');
  const [smartReserveLink, setSmartReserveLink] = useState('');

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'server' | 'cloudflare'>('server');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct Upload Modal
  const [directUploadOpen, setDirectUploadOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<StockItem | null>(null);

  // Methods
  const getVehicleData = useCallback((item: StockItem) => ({
    make: item.make || item.vehicle?.make || '',
    model: item.model || item.vehicle?.model || '',
    registration: item.registration || item.vehicle?.registration || '',
    derivative: item.derivative || item.vehicle?.derivative || '',
    mileage: item.mileage || item.vehicle?.mileage || item.vehicle?.odometerReadingMiles || 0,
    image: item.images?.[0] || item.media?.images?.[0]?.url || item.media?.images?.[0]?.href || '',
  }), []);

  const fetchStock = useCallback(async () => {
    if (!user?.token) return;
    setLoadingStock(true);
    try {
      const res = await fetch('/api/autotrader/stock', { headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      setStock(Array.isArray(data) ? data : data.stock || data.results || []);
      if (data.lastSync || data.lastSyncTime) setLastSyncTime(data.lastSync || data.lastSyncTime);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally { setLoadingStock(false); }
  }, [user, showToast]);

  const fetchVideos = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/videos?all=true', { headers: { Authorization: `Bearer ${user.token}` } });
      const data = await res.json();
      setVideos(data.videos || data);
    } catch (error) { console.error(error); }
  }, [user]);

  const fetchAllMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicle-metadata');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                if (item.registration) map[item.registration.replace(/\s/g, '').toUpperCase()] = item;
            });
        }
        setVehicleMetadata(map);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    fetchStock();
    fetchVideos();
    fetchAllMetadata();
  }, [fetchStock, fetchVideos, fetchAllMetadata]);

  const getMatchingVideos = (item: StockItem) => {
    const vData = getVehicleData(item);
    const stockReg = (vData.registration || '').replace(/\s/g, '').toUpperCase();
    if (!stockReg) return [];
    return videos.filter(video => (video.registration ? (video.registration.replace(/\s/g, '').toUpperCase() === stockReg) : (video.title || '').replace(/\s/g, '').toUpperCase().includes(stockReg)));
  };

  const copyToClipboard = async (videoId: string) => {
    const video = videos.find((v) => v._id === videoId);
    let shareId = '';
    try {
      const shareRes = await fetch(`/api/videos/${videoId}/share`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (shareRes.ok) {
        const data = await shareRes.json();
        shareId = data.shareId || '';
      }
    } catch {
      console.error('Failed to register share link');
    }
    const refName =
      user?.name ||
      user?.username ||
      video?.uploadedBy?.name ||
      video?.uploadedBy?.username ||
      'Staff';
    let link = `${window.location.origin}/view/${videoId}?ref=${encodeURIComponent(refName)}`;
    if (shareId) link += `&s=${shareId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied!', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleDeleteVideo = async (video: Video) => {
    if (!window.confirm(`Delete the video for ${video.title || 'this vehicle'}?`)) return;
    try {
      const res = await fetch(`/api/videos/${video._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user?.token}` } });
      if (!res.ok) throw new Error('Delete failed');
      setVideos(prev => prev.filter(v => v._id !== video._id));
      showToast('Video deleted', 'success');
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  // Upload Logic
  const resetUploadState = () => {
      setSelectedFile(null);
      setUploadSuccess(false);
      setUploadProgress(0);
      setUploadPhase('server');
      setLookupLoading(false);
      setSmartMileage('');
      setSmartReserveLink('');
  };

  const handleLookup = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!lookupRegistration.trim()) { showToast('Please enter registration', 'error'); return; }
      setLookupLoading(true); setFetchedVehicle(null);
      try {
          const res = await fetch(`/api/autotrader/lookup/${lookupRegistration.replace(/\s/g, '')}`, { headers: { Authorization: `Bearer ${user?.token}` } });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || data.error || 'Lookup failed');
          if (data.vehicle) {
              setFetchedVehicle(data.vehicle);
              if (data.vehicle.odometerReadingMiles) setSmartMileage(data.vehicle.odometerReadingMiles.toString());
          } else {
              showToast('Vehicle not found', 'error');
          }
      } catch (err: any) {
          showToast(err.message, 'error');
      } finally {
          setLookupLoading(false);
      }
  };

  const processUpload = async (formData: FormData) => {
      setUploading(true); setUploadProgress(0); setUploadPhase('server');
      try {
          // Manual XMLHttpRequest for upload progress tracking
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/videos', true);
          xhr.setRequestHeader('Authorization', `Bearer ${user?.token}`);
          
          const uploadPromise = new Promise((resolve, reject) => {
             xhr.upload.onprogress = (e) => {
                 if (e.lengthComputable) {
                     const percent = Math.round((e.loaded * 100) / e.total);
                     setUploadProgress(Math.round(percent / 2)); // 0-50%
                 }
             };
             xhr.onload = () => {
                 if (xhr.status >= 200 && xhr.status < 300) {
                     resolve(JSON.parse(xhr.responseText));
                 } else {
                     reject(new Error(xhr.responseText));
                 }
             };
             xhr.onerror = () => reject(new Error('Network error during upload'));
          });
          
          xhr.send(formData);
          const data: any = await uploadPromise;

          if (!data.jobId) { // Fallback for old API without SSE
              setUploadProgress(100);
              setUploadSuccess(true);
              fetchVideos();
              setTimeout(() => {
                  setSmartUploadOpen(false); setDirectUploadOpen(false); resetUploadState();
              }, 2500);
              return;
          }

          // Phase 2: SSE from Cloudflare
          setUploadProgress(50);
          setUploadPhase('cloudflare');

          await new Promise<void>((resolve, reject) => {
              const es = new EventSource(`/api/videos/progress/${data.jobId}?token=${user?.token}`);
              es.addEventListener('progress', (e: any) => {
                  try {
                      const msg = JSON.parse(e.data);
                      setUploadProgress(50 + Math.round(msg.percent / 2));
                  } catch (err) {}
              });
              es.addEventListener('done', () => { es.close(); setUploadProgress(100); resolve(); });
              es.addEventListener('error', (e: any) => { es.close(); reject(new Error('Cloudflare upload tracking failed')); });
          });

          setUploadSuccess(true);
          fetchVideos();
          setTimeout(() => {
              setSmartUploadOpen(false); setDirectUploadOpen(false); resetUploadState();
          }, 2500);

      } catch (err: any) {
          showToast(err.message || 'Upload failed', 'error');
      } finally {
          setUploading(false);
      }
  };

  const handleSmartUpload = () => {
      if (!selectedFile || !fetchedVehicle) return;
      const fd = new FormData();
      fd.append('video', selectedFile);
      fd.append('title', `${fetchedVehicle.make} ${fetchedVehicle.model} - ${fetchedVehicle.registration}`);
      fd.append('make', fetchedVehicle.make); fd.append('model', fetchedVehicle.model); fd.append('registration', fetchedVehicle.registration);
      fd.append('vehicleDetails', JSON.stringify(fetchedVehicle));
      fd.append('mileage', smartMileage);
      fd.append('reserveCarLink', smartReserveLink);
      processUpload(fd);
  };

  const handleDirectUpload = () => {
      if (!selectedFile || !selectedStockItem) return;
      const v = getVehicleData(selectedStockItem);
      const fd = new FormData();
      fd.append('video', selectedFile);
      fd.append('title', `${v.make} ${v.model} - ${v.registration}`);
      fd.append('make', v.make); fd.append('model', v.model); fd.append('registration', v.registration);
      // Construct a faux vehicleDetails object
      const vd = {
         registration: v.registration, make: v.make, model: v.model, derivative: v.derivative, 
         odometerReadingMiles: v.mileage, provider: 'AutoTrader', rawData: selectedStockItem
      };
      fd.append('vehicleDetails', JSON.stringify(vd));
      processUpload(fd);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('video/')) setSelectedFile(file);
      else showToast('Please select a valid video', 'error');
  };

  // Actions Modals
  const handleOpenReserveModal = async (item: StockItem) => {
      const vData = getVehicleData(item);
      const normReg = (vData.registration || '').replace(/\s/g, '').toUpperCase();
      let reserveUrl = '';
      if (vehicleMetadata[normReg]) reserveUrl = vehicleMetadata[normReg].reserveLink;
      else {
          try {
              const res = await fetch(`/api/vehicle-metadata/${normReg}`, { headers: { Authorization: `Bearer ${user?.token}` }});
              if (res.ok) {
                  const data = await res.json(); reserveUrl = data.reserveLink || '';
                  setVehicleMetadata(prev => ({ ...prev, [normReg]: data }));
              }
          } catch {}
      }
      setReserveLinkItem(item); setReserveLink(reserveUrl); setReserveLinkModalOpen(true); setActiveMenu(null);
  };

  const handleSaveReserve = async () => {
      if (!reserveLinkItem) return;
      setSavingReserveLink(true);
      const normReg = (getVehicleData(reserveLinkItem).registration || '').replace(/\s/g, '').toUpperCase();
      try {
          const res = await fetch(`/api/vehicle-metadata/${normReg}/reserve-link`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
              body: JSON.stringify({ reserveLink })
          });
          if (!res.ok) throw new Error('Failed');
          showToast('Reserve link saved!', 'success');
          setVehicleMetadata(prev => ({ ...prev, [normReg]: { ...prev[normReg], reserveLink }}));
          setReserveLinkModalOpen(false);
      } catch { showToast('Failed to save', 'error'); } 
      finally { setSavingReserveLink(false); }
  };

  const handleSendLink = async () => {
    if (!selectedVideo) return;
    if (!sendForm.email && !sendForm.mobile) { showToast('Provide email or mobile', 'error'); return; }
    setSending(true);
    let shareId = '';
    try {
      const shareRes = await fetch(`/api/videos/${selectedVideo._id}/share`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (shareRes.ok) shareId = (await shareRes.json()).shareId;
      
      const payload: any = { 
          videoLink: `${window.location.origin}/view/${selectedVideo._id}${shareId ? `?s=${shareId}` : ''}`, 
          customerName: sendForm.name, customerTitle: sendForm.title 
      };
      if (sendForm.email) payload.email = sendForm.email;
      if (sendForm.mobile) payload.mobile = sendForm.mobile.replace(/\D/g, '');

      const res = await fetch('/api/send-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Send failed');
      showToast('Video sent!', 'success');
      setSendModalOpen(false);
    } catch (err: any) { showToast(err.message, 'error'); } 
    finally { setSending(false); }
  };

  // Filter & Pagination
  const filteredStock = stock.filter(item => {
      const v = getVehicleData(item);
      const s = searchTerm.toLowerCase();
      const matchesSearch = v.make.toLowerCase().includes(s) || v.model.toLowerCase().includes(s) || v.registration.toLowerCase().includes(s);
      const hasVid = getMatchingVideos(item).length > 0;
      const matchesFilter = filterStatus === 'All' || (filterStatus === 'With Video' && hasVid) || (filterStatus === 'No Video' && !hasVid);
      return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredStock.length / ITEMS_PER_PAGE);
  const paginatedStock = filteredStock.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startEntry = filteredStock.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endEntry = Math.min(currentPage * ITEMS_PER_PAGE, filteredStock.length);

  return (
    <div className="w-full px-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
              <h1 className="text-3xl font-bold text-gray-800">All Vehicles</h1>
              <p className="text-gray-500 mt-1">Manage inventory and upload videos.</p>
              {lastSyncTime && <p className="text-xs text-gray-400 mt-1">Last sync: {new Date(lastSyncTime).toLocaleString()}</p>}
          </div>
          <button type="button" onClick={() => { setSmartUploadOpen(true); resetUploadState(); setLookupRegistration(''); setFetchedVehicle(null); }} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition flex items-center gap-2">
              <FaVideo /> Upload Video via Registration
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
                  {['All', 'With Video', 'No Video'].map(s => (
                      <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${filterStatus === s ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{s}</button>
                  ))}
              </div>
              <div className="relative flex-1 sm:max-w-xs">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="text" placeholder="Search vehicles..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
          </div>

          {loadingStock ? (
              <div className="flex justify-center py-12"><div className="spinner" /></div>
          ) : (
             <div className="overflow-x-auto lg:overflow-visible">
                 <table className="w-full text-left border-collapse min-w-[700px]">
                     <thead>
                         <tr className="bg-gray-50 border-b border-gray-200">
                             <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                             <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Vehicle</th>
                             <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Details</th>
                             <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                             <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                         </tr>
                     </thead>
                     <tbody>
                        {paginatedStock.map((item, index) => {
                            const v = getVehicleData(item);
                            const matchingVideos = getMatchingVideos(item);
                            const hasVid = matchingVideos.length > 0;
                            const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                            const uId = item._id || item.id || `item-${globalIndex}`;
                            return (
                                <tr key={uId} className={`group border-b border-gray-100 transition-colors relative ${hasVid ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-white hover:bg-gray-50'}`}>
                                    <td className="px-5 py-3.5 text-xs text-gray-300 font-medium">{globalIndex}</td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                           <div className={`w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border ${hasVid ? 'border-emerald-200' : 'border-gray-200'} bg-gray-100 shadow-sm`}>
                                              {v.image ? <img src={v.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><FaCar size={22}/></div>}
                                           </div>
                                           <div>
                                               <h3 className="font-semibold text-gray-900 text-sm">{v.make} {v.model}</h3>
                                               <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">{v.registration || 'NO REG'}</span>
                                           </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 hidden lg:table-cell max-w-xs">
                                        <p className="text-sm text-gray-600 truncate">{v.derivative}</p>
                                        {!!v.mileage && <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full border border-gray-200"><FaTachometerAlt size={9}/> {v.mileage.toLocaleString()} miles</span>}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        {hasVid ? (
                                            <div>
                                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200"><FaVideo size={9} /> {matchingVideos.length} Video{matchingVideos.length > 1 ? 's': ''}</span>
                                              {matchingVideos[0].uploadedBy && <p className="text-xs text-gray-400 mt-1 pl-0.5">by {matchingVideos[0].uploadedBy.name || matchingVideos[0].uploadedBy.username}</p>}
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-400 text-xs font-medium rounded-full border border-gray-200"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span> No Video</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="relative inline-block">
                                            <button onClick={() => setActiveMenu(activeMenu === uId ? null : uId)} className={`p-2 rounded-full transition ${activeMenu === uId ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><FaEllipsisV /></button>
                                            {activeMenu === uId && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
                                                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-fade-in origin-top-right">
                                                        {hasVid ? (
                                                            <>
                                                              <button onClick={() => { copyToClipboard(matchingVideos[0]._id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium"><FaCopy className="text-gray-400"/> Copy Link</button>
                                                              <button onClick={() => { setSelectedVideo(matchingVideos[0]); setSendModalOpen(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium"><FaPaperPlane /> Send to Customer</button>
                                                              <div className="border-t border-gray-100 my-1"/>
                                                              <button onClick={() => handleOpenReserveModal(item)} className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2 font-medium"><FaLink /> Reserve Link</button>
                                                              <div className="border-t border-gray-100 my-1"/>
                                                              <button onClick={() => { handleDeleteVideo(matchingVideos[0]); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"><FaTrash className="text-red-400"/> Delete Video</button>
                                                            </>
                                                        ) : (
                                                            <>
                                                              <button onClick={() => { setSelectedStockItem(item); setDirectUploadOpen(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md flex items-center gap-2 font-medium transition"><FaCloudUploadAlt size={16}/> Upload Video</button>
                                                              <div className="border-t border-gray-100 my-1"/>
                                                              <button onClick={() => handleOpenReserveModal(item)} className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2 font-medium"><FaLink /> Reserve Link</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {paginatedStock.length === 0 && (<tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No vehicles found.</td></tr>)}
                     </tbody>
                 </table>
             </div>
          )}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <p>
              Showing{' '}
              <span className="font-medium text-gray-800">{startEntry}-{endEntry}</span> of{' '}
              <span className="font-medium text-gray-800">{filteredStock.length}</span> entries
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
                    currentPage === page
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : 'border-gray-200 hover:bg-gray-50'
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

      {/* Smart Upload Modal */}
      {smartUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up my-auto">
                 <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex justify-center items-center"><FaVideo size={14}/></div>
                        <h2 className="text-xl font-bold text-gray-800">Smart Video Upload</h2>
                    </div>
                    <button onClick={() => setSmartUploadOpen(false)} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-500 transition text-gray-500"><FaTimes /></button>
                 </div>
                 <div className="p-6">
                    {uploadSuccess ? (
                        <div className="py-12 text-center text-green-600">
                           <FaCheckCircle className="mx-auto text-6xl mb-4" />
                           <h3 className="text-2xl font-bold text-gray-800">Upload Complete!</h3>
                           <p className="mt-2 text-gray-500">Your video is ready to be shared</p>
                        </div>
                    ) : uploading ? (
                        <div className="py-12 px-8">
                            <div className="mb-2 flex justify-between items-center">
                               <span className="font-medium text-gray-700">{uploadPhase === 'server' ? 'Processing server upload...' : 'Encoding globally with Cloudflare...'}</span>
                               <span className="font-bold text-blue-600">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 mb-6 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 relative" style={{width: `${uploadProgress}%`}}>
                                    <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden"><div className="w-full h-full bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem', animation: 'progress-stripes 1s linear infinite' }}/></div>
                                </div>
                            </div>
                        </div>
                    ) : !fetchedVehicle ? (
                        <div>
                            <form onSubmit={handleLookup} className="mb-8">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Registration Plate</label>
                                <div className="flex gap-3">
                                   <input type="text" value={lookupRegistration} onChange={e => setLookupRegistration(e.target.value.toUpperCase())} placeholder="e.g. AB12CDE" className="flex-1 px-4 py-3 border-2 border-yellow-400 bg-yellow-50/30 rounded-xl text-lg font-bold uppercase tracking-widest focus:ring-4 focus:ring-yellow-400/20 focus:border-yellow-500 focus:outline-none transition shadow-sm" />
                                   <button type="submit" disabled={lookupLoading || !lookupRegistration} className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold transition disabled:opacity-50">
                                       {lookupLoading ? <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : 'Lookup'}
                                   </button>
                                </div>
                            </form>
                            <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                                <FaCheckCircle className="text-blue-500 mt-1 flex-shrink-0" />
                                <div className="text-sm text-gray-600"><p className="font-semibold text-gray-800 mb-1">How it works</p><p>We query the DVLA database to automatically populate all technical specifications, saving you from manual data entry.</p></div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Vehicle Match Card */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                                <div className="flex items-center gap-4">
                                     <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex justify-center items-center flex-shrink-0"><FaCar size={20}/></div>
                                     <div>
                                         <h3 className="font-bold text-gray-900">{fetchedVehicle.make} {fetchedVehicle.model}</h3>
                                         <p className="text-sm text-gray-500 truncate max-w-xs">{fetchedVehicle.derivative || `${fetchedVehicle.transmissionType} • ${fetchedVehicle.fuelType}`}</p>
                                     </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="px-3 py-1 bg-yellow-400 text-gray-900 font-bold uppercase tracking-widest text-sm rounded shadow-sm border border-yellow-500">{fetchedVehicle.registration}</span>
                                    <button onClick={() => setFetchedVehicle(null)} className="text-xs text-blue-600 hover:underline font-medium">Wrong vehicle?</button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Current Mileage</label><input type="number" value={smartMileage} onChange={e=>setSmartMileage(e.target.value)} placeholder="e.g. 45000" className="w-full px-4 py-2 border border-gray-200 rounded-lg" /></div>
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Reserve Link (Optional)</label><input type="url" value={smartReserveLink} onChange={e=>setSmartReserveLink(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 border border-gray-200 rounded-lg" /></div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Video File</label>
                                <div 
                                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                   onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                   onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f && f.type.startsWith('video/')) setSelectedFile(f); else showToast('Invalid video format', 'error'); }}
                                   className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                                >
                                    <input type="file" ref={fileInputRef} accept="video/mp4,video/quicktime,video/*" onChange={handleFileSelect} className="hidden" />
                                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex justify-center items-center mx-auto mb-4"><FaCloudUploadAlt size={28} /></div>
                                    <h4 className="text-lg font-semibold text-gray-800 mb-1">Drag & Drop your video</h4>
                                    <p className="text-sm text-gray-500 mb-4">or click to browse from your device</p>
                                    <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm">Browse Files</button>
                                </div>
                                {selectedFile && <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center"><div className="flex items-center gap-3"><FaFile className="text-blue-500" /><div className="max-w-[200px] sm:max-w-xs md:max-w-sm truncate"><p className="text-sm font-semibold text-gray-800 truncate">{selectedFile.name}</p><p className="text-xs text-gray-500">{(selectedFile.size / (1024*1024)).toFixed(2)} MB</p></div></div><button onClick={()=>setSelectedFile(null)} className="text-red-500 hover:text-red-700 p-1 bg-white rounded-md shadow-sm"><FaTimes/></button></div>}
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => setSmartUploadOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button><button onClick={handleSmartUpload} disabled={!selectedFile} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"><FaCloudUploadAlt/> Start Upload</button></div>
                        </div>
                    )}
                 </div>
              </div>
          </div>
      )}

      {/* Direct Upload Header */}
      {directUploadOpen && selectedStockItem && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-20 pb-20">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up my-auto">
                 <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex justify-center items-center"><FaVideo size={14}/></div>
                        <h2 className="text-xl font-bold text-gray-800">Upload Video</h2>
                    </div>
                    <button onClick={() => { setDirectUploadOpen(false); resetUploadState(); }} className="text-gray-400 hover:text-gray-700"><FaTimes /></button>
                 </div>
                 <div className="p-6">
                    {uploadSuccess ? (
                        <div className="py-12 text-center text-green-600">
                           <FaCheckCircle className="mx-auto text-6xl mb-4" />
                           <h3 className="text-2xl font-bold text-gray-800">Upload Complete!</h3>
                        </div>
                    ) : uploading ? (
                        <div className="py-12 px-8">
                            <div className="mb-2 flex justify-between items-center">
                               <span className="font-medium text-gray-700">{uploadPhase === 'server' ? 'Uploading to server...' : 'Encoding with Cloudflare...'}</span>
                               <span className="font-bold text-blue-600">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 mb-6"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{width: `${uploadProgress}%`}}/></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <p className="text-sm font-semibold text-gray-800 mb-1">Automating for:</p>
                                <p className="text-lg font-bold text-blue-600">{getVehicleData(selectedStockItem).make} {getVehicleData(selectedStockItem).model} <span className="text-gray-500 text-base font-normal">({getVehicleData(selectedStockItem).registration})</span></p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Video File</label>
                                <div 
                                   onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                   onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                   onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f && f.type.startsWith('video/')) setSelectedFile(f); else showToast('Invalid video file', 'error'); }}
                                   className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <input type="file" ref={fileInputRef} accept="video/mp4,video/quicktime,video/*" onChange={handleFileSelect} className="hidden" />
                                    <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 shadow-sm">Browse Files</button>
                                </div>
                                {selectedFile && <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center"><p className="text-sm font-semibold truncate">{selectedFile.name}</p><button onClick={()=>setSelectedFile(null)} className="text-red-500"><FaTimes/></button></div>}
                            </div>
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-3"><button onClick={() => { setDirectUploadOpen(false); resetUploadState(); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button onClick={handleDirectUpload} disabled={!selectedFile} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-50">Upload</button></div>
                        </div>
                    )}
                 </div>
             </div>
         </div>
      )}

      {/* Reserve Link Modal */}
      {reserveLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800">Add Reserve Link</h3><button onClick={() => setReserveLinkModalOpen(false)} className="text-gray-400 font-bold">&times;</button></div>
            <div className="p-6">
               <p className="text-sm text-gray-600 mb-4">Add a reservation link for <strong>{(reserveLinkItem ? getVehicleData(reserveLinkItem) : {} as any).registration}</strong>.</p>
               <input type="url" value={reserveLink} onChange={(e) => setReserveLink(e.target.value)} placeholder="https://..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
               <div className="mt-6 flex justify-end gap-3"><button onClick={() => setReserveLinkModalOpen(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={handleSaveReserve} disabled={savingReserveLink} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow disabled:opacity-50">{savingReserveLink ? 'Saving...' : 'Save Link'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-left">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center"><div><h3 className="font-bold text-lg text-gray-800">Send Video to Customer</h3><p className="text-xs text-gray-500 mt-1 truncate max-w-[250px]">{selectedVideo?.title}</p></div><button onClick={() => setSendModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition">&times;</button></div>
            <div className="flex-1 overflow-y-auto p-6"><div className="space-y-4">
               <div className="flex gap-4">
                 <div className="w-1/3"><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Title</label><select value={sendForm.title} onChange={e => setSendForm(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm"><option value="Mr">Mr</option><option value="Mrs">Mrs</option><option value="Miss">Miss</option><option value="Ms">Ms</option><option value="Dr">Dr</option></select></div>
                 <div className="w-2/3"><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Customer Name</label><input type="text" value={sendForm.name} onChange={e => setSendForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John Smith" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" /></div>
               </div>
               <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Mobile Number</label><div className="flex border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500"><span className="bg-gray-50 px-3 py-2.5 border-r border-gray-200 text-sm text-gray-600 font-medium">+44</span><input type="tel" value={sendForm.mobile} onChange={e => setSendForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '') }))} placeholder="7700 900000" className="flex-1 px-3 py-2.5 border-none focus:ring-0 text-sm" /></div></div>
               <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Email Address</label><input type="email" value={sendForm.email} onChange={e => setSendForm(p => ({ ...p, email: e.target.value }))} placeholder="customer@example.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm" /></div>
            </div></div>
            <div className="p-6 border-t border-gray-100 bg-gray-50"><button onClick={handleSendLink} disabled={sending} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">{sending ? 'Sending...' : 'Send Video'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
