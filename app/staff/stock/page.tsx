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
  const [uploadPhase, setUploadPhase] = useState<'cloudflare'>('cloudflare');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pendingUidRef = useRef<string | null>(null);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try { return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return 'N/A'; }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) setSelectedFile(f);
    else showToast('Please select a valid video file', 'error');
  };

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
      if (xhrRef.current) { xhrRef.current.abort(); xhrRef.current = null; }
      if (pendingUidRef.current) {
          fetch(`/api/videos/cloudflare/${pendingUidRef.current}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${user?.token}` },
          }).catch(() => {});
          pendingUidRef.current = null;
      }
      setSelectedFile(null);
      setUploadSuccess(false);
      setUploadProgress(0);
      setUploading(false);
      setUploadPhase('cloudflare');
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

  const processUpload = async (meta: {
      file: File;
      title: string;
      registration?: string;
      make?: string;
      model?: string;
      vehicleDetails?: any;
      mileage?: string;
      reserveCarLink?: string;
      originalName?: string;
  }) => {
      setUploading(true); setUploadProgress(0); setUploadPhase('cloudflare');
      try {
          // Step 1: get a direct Cloudflare upload URL (tiny request, no file — bypasses Vercel limit)
          const urlRes = await fetch('/api/cloudflare/direct-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
              body: JSON.stringify({ title: meta.title }),
          });
          if (!urlRes.ok) throw new Error('Failed to get upload URL');
          const { uploadURL, uid } = await urlRes.json();
          pendingUidRef.current = uid;

          // Step 2: upload file directly from browser to Cloudflare via XHR form POST (bypasses Vercel)
          await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhrRef.current = xhr;
              const fd = new FormData();
              fd.append('file', meta.file);
              xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
              };
              xhr.onload = () => {
                  xhrRef.current = null;
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else reject(new Error(`Cloudflare upload failed (${xhr.status}): ${xhr.responseText}`));
              };
              xhr.onerror = () => { xhrRef.current = null; reject(new Error('Network error during upload')); };
              xhr.onabort = () => { xhrRef.current = null; reject(new Error('Upload cancelled')); };
              xhr.open('POST', uploadURL);
              xhr.send(fd);
          });

          setUploadProgress(100);
          pendingUidRef.current = null;

          // Step 3: save video metadata in our DB (small JSON request — no file)
          const saveRes = await fetch('/api/videos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
              body: JSON.stringify({
                  cloudflareVideoId: uid,
                  title: meta.title,
                  registration: meta.registration,
                  make: meta.make,
                  model: meta.model,
                  vehicleDetails: meta.vehicleDetails,
                  mileage: meta.mileage,
                  reserveCarLink: meta.reserveCarLink,
                  originalName: meta.originalName || meta.file.name,
              }),
          });
          if (!saveRes.ok) throw new Error('Failed to save video');

          setUploadSuccess(true);
          fetchVideos();
          setTimeout(() => {
              setSmartUploadOpen(false); setDirectUploadOpen(false); resetUploadState();
          }, 2500);

      } catch (err: any) {
          if (err.message !== 'Upload cancelled') {
              showToast(err.message || 'Upload failed', 'error');
          }
      } finally {
          setUploading(false);
      }
  };

  const handleSmartUpload = () => {
      if (!selectedFile || !fetchedVehicle) return;
      processUpload({
          file: selectedFile,
          title: `${fetchedVehicle.make} ${fetchedVehicle.model} - ${fetchedVehicle.registration}`,
          make: fetchedVehicle.make,
          model: fetchedVehicle.model,
          registration: fetchedVehicle.registration,
          vehicleDetails: fetchedVehicle,
          mileage: smartMileage,
          reserveCarLink: smartReserveLink,
          originalName: selectedFile.name,
      });
  };

  const handleDirectUpload = () => {
      if (!selectedFile || !selectedStockItem) return;
      const v = getVehicleData(selectedStockItem);
      const sv = selectedStockItem.vehicle || selectedStockItem;
      const vehicleDetails = {
          registration: v.registration,
          make: v.make,
          model: v.model,
          derivative: v.derivative,
          fuelType: sv.fuelType || '',
          transmissionType: sv.transmissionType || sv.transmission || '',
          colour: sv.colour || '',
          bhp: sv.enginePowerBHP || sv.bhp || '',
          engineSize: sv.engineCapacityCC || sv.engineSize || '',
          firstRegistrationDate: sv.firstRegistrationDate || '',
          odometerReadingMiles: sv.odometerReadingMiles || v.mileage || 0,
          enginePowerBHP: sv.enginePowerBHP || '',
          accelerationSeconds: sv.accelerationSeconds || '',
          topSpeedMPH: sv.topSpeedMPH || '',
          fuelEconomyWLTPCombinedMPG: sv.fuelEconomyWLTPCombinedMPG || '',
          fuelEconomyNEDCCombinedMPG: sv.fuelEconomyNEDCCombinedMPG || '',
          co2EmissionGPKM: sv.co2EmissionGPKM || '',
          emissionClass: sv.emissionClass || '',
          doors: sv.doors || '',
          seats: sv.seats || '',
          bootSpaceSeatsUpLitres: sv.bootSpaceSeatsUpLitres || '',
          minimumKerbWeightKG: sv.minimumKerbWeightKG || '',
          insuranceGroup: sv.insuranceGroup || '',
          previousOwners: sv.previousOwners || '',
          motExpiryDate: sv.motExpiryDate || '',
          serviceHistory: sv.serviceHistory || '',
          highlights: selectedStockItem.highlights || [],
          features: selectedStockItem.features || [],
          provider: 'AutoTrader',
          rawData: selectedStockItem,
      };
      processUpload({
          file: selectedFile,
          title: `${v.make} ${v.model} - ${v.registration}`,
          make: v.make,
          model: v.model,
          registration: v.registration,
          vehicleDetails,
          originalName: selectedFile.name,
      });
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

  // Derived values for Direct Upload modal
  const directVd = selectedStockItem ? getVehicleData(selectedStockItem) : null;
  const directBrandLogo = directVd
    ? `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${directVd.make.toLowerCase().replace(/\s+/g, '-')}.png`
    : '';

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
                                        {hasVid ? (
                                            <div className="relative inline-block">
                                                <button onClick={() => setActiveMenu(activeMenu === uId ? null : uId)} className={`p-2 rounded-full transition ${activeMenu === uId ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}><FaEllipsisV /></button>
                                                {activeMenu === uId && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)}></div>
                                                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-fade-in origin-top-right">
                                                            <button onClick={() => { handleDeleteVideo(matchingVideos[0]); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md flex items-center gap-2 transition font-medium"><FaTrash size={14} /> Delete Video</button>
                                                            {matchingVideos.map((vid, idx) => (
                                                                <div key={vid._id} className="border-t border-gray-50 mt-1 pt-1">
                                                                    {matchingVideos.length > 1 && <div className="px-4 py-1.5 text-xs font-bold text-gray-400 bg-gray-50 uppercase tracking-wider">Video {idx + 1}</div>}
                                                                    <button onClick={() => { copyToClipboard(vid._id); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition"><FaCopy size={14} className="text-gray-400" /> Copy Link</button>
                                                                    <button onClick={() => { window.open(`/view/${vid._id}`, '_blank'); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2 transition"><FaExternalLinkAlt size={14} className="text-gray-400" /> Open Video</button>
                                                                    <button onClick={() => { setSelectedVideo(vid); setSendModalOpen(true); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md flex items-center gap-2 transition font-medium"><FaPaperPlane size={14} className="text-purple-500/70" /> Send to Customer</button>
                                                                </div>
                                                            ))}
                                                            <div className="border-t border-gray-100 mt-1 pt-1">
                                                                <button onClick={() => { handleOpenReserveModal(item); setActiveMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-md flex items-center gap-2 transition">
                                                                    <span>🔒</span> {vehicleMetadata[(v.registration || '').replace(/\s/g, '').toUpperCase()]?.reserveLink ? 'Edit Reserve Link' : 'Add Reserve Link'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <button onClick={() => { setSelectedStockItem(item); setDirectUploadOpen(true); setActiveMenu(null); }} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm hover:shadow-md">
                                                <FaCloudUploadAlt /> Upload
                                            </button>
                                        )}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gray-900 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FaVideo className="text-blue-400" /> Find Vehicle & Upload
              </h3>
              <button onClick={() => { setSmartUploadOpen(false); resetUploadState(); setLookupRegistration(''); setFetchedVehicle(null); }} className="text-gray-400 hover:text-white transition"><FaTimes size={24} /></button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 flex-1">
              {!fetchedVehicle ? (
                <div className="max-w-md mx-auto py-8">
                  <div className="text-center mb-6">
                    <FaSearch className="mx-auto text-blue-600 mb-3" size={32} />
                    <h4 className="text-xl font-bold text-gray-800">Enter Registration</h4>
                    <p className="text-sm text-gray-500">We'll fetch the car details automatically.</p>
                  </div>
                  <form onSubmit={handleLookup}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={lookupRegistration}
                        onChange={(e) => setLookupRegistration(e.target.value.toUpperCase())}
                        placeholder="AB12 CDE"
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      <button type="submit" disabled={lookupLoading} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50">
                        {lookupLoading ? 'Please Wait...' : 'Lookup'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Vehicle Details Card */}
                  <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">{fetchedVehicle.make} {fetchedVehicle.model}</h2>
                        <p className="text-gray-600">{fetchedVehicle.derivative}</p>
                      </div>
                      <span className="bg-yellow-400 text-black px-3 py-1 rounded font-bold text-lg tracking-wider border-2 border-black">{fetchedVehicle.registration}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2"><FaGasPump className="text-gray-400" /> {fetchedVehicle.fuelType || 'N/A'}</div>
                      <div className="flex items-center gap-2"><FaCog className="text-gray-400" /> {fetchedVehicle.transmissionType || 'N/A'}</div>
                      <div className="flex items-center gap-2"><FaPalette className="text-gray-400" /> {fetchedVehicle.colour || 'N/A'}</div>
                      <div className="flex items-center gap-2"><FaCalendar className="text-gray-400" /> {formatDate(fetchedVehicle.firstRegistrationDate)}</div>
                    </div>
                    <button onClick={() => setFetchedVehicle(null)} className="text-xs text-blue-600 mt-4 font-medium hover:underline">← Not the right car? Search again</button>
                  </div>

                  {!uploadSuccess ? (
                    <div className="border-t pt-2">
                      <h4 className="font-bold text-gray-700 mb-3">Upload Video File</h4>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Mileage</label>
                          <input type="number" value={smartMileage} onChange={(e) => setSmartMileage(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 45000" onClick={(e) => e.stopPropagation()} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Reserve Car Link</label>
                          <input type="url" value={smartReserveLink} onChange={(e) => setSmartReserveLink(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="https://..." onClick={(e) => e.stopPropagation()} />
                        </div>
                      </div>

                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-4 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                      >
                        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
                        <FaCloudUploadAlt className={`mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} size={40} />
                        {selectedFile ? (
                          <div>
                            <p className="text-green-600 font-medium mb-1">✓ {selectedFile.name}</p>
                            <p className="text-sm text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                            <p className="text-xs text-gray-400 mt-2">Click to change file</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-700 font-medium mb-1">Drop video file here or click to browse</p>
                            <p className="text-sm text-gray-500">Supports MP4, MOV, AVI and other video formats</p>
                          </div>
                        )}
                      </div>

                      {uploading && (
                        <div className="space-y-2 mb-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">☁️ Uploading directly to Cloudflare...</span>
                            <span className="text-blue-600 font-medium">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          {uploadPhase === 'cloudflare' && <p className="text-xs text-amber-600">⚠️ Large files may take a few minutes — please keep this page open</p>}
                        </div>
                      )}

                      {uploadError && <div className="mt-3 text-red-600 text-sm font-medium text-center">{uploadError}</div>}

                      <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => { setSmartUploadOpen(false); resetUploadState(); setLookupRegistration(''); setFetchedVehicle(null); }} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button onClick={handleSmartUpload} disabled={!selectedFile || uploading} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2">
                          {uploading ? 'Uploading...' : <><FaCloudUploadAlt /> Start Upload</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FaCheck className="text-green-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Success!</h3>
                      <p className="text-gray-500 mb-6">Video uploaded and linked to {fetchedVehicle.registration}</p>
                      <button onClick={() => { setSmartUploadOpen(false); resetUploadState(); setLookupRegistration(''); setFetchedVehicle(null); }} className="text-blue-600 font-bold hover:underline">Close</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Direct Upload Modal */}
      {directUploadOpen && selectedStockItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header — light */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <img src={directBrandLogo} alt={directVd!.make} className="w-10 h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div>
                  <h3 className="font-bold text-gray-800 text-base leading-tight">Upload Video</h3>
                  <p className="text-xs text-gray-400">{directVd!.make} {directVd!.model}</p>
                </div>
              </div>
              <button onClick={() => { setDirectUploadOpen(false); setSelectedStockItem(null); setSelectedFile(null); setUploadError(''); resetUploadState(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
                <FaTimes size={14} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {uploadSuccess ? (
                <div className="text-center py-14 px-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCheck className="text-green-500" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Upload Complete!</h3>
                  <p className="text-sm text-gray-500 mb-6">{directVd!.make} {directVd!.model} — {directVd!.registration}</p>
                  <button onClick={() => { setDirectUploadOpen(false); setSelectedStockItem(null); setSelectedFile(null); setUploadError(''); resetUploadState(); }}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition">Done</button>
                </div>
              ) : (
                <div className="p-8 space-y-5">
                  {/* Vehicle card */}
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 flex items-center gap-5">
                    <img src={directBrandLogo} alt={directVd!.make} className="w-28 h-28 object-contain flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-gray-900 text-lg">{directVd!.make} {directVd!.model}</span>
                        <span className="bg-yellow-400 text-black text-sm font-bold px-3 py-1 rounded border border-yellow-600 tracking-wide">{directVd!.registration}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 truncate">{directVd!.derivative}</p>
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {(selectedStockItem.vehicle?.fuelType || selectedStockItem.fuelType) && (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaGasPump size={11} className="text-gray-400" />{selectedStockItem.vehicle?.fuelType || selectedStockItem.fuelType}</span>
                        )}
                        {(selectedStockItem.vehicle?.transmissionType || selectedStockItem.transmission) && (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaCog size={11} className="text-gray-400" />{selectedStockItem.vehicle?.transmissionType || selectedStockItem.transmission}</span>
                        )}
                        {(selectedStockItem.vehicle?.colour || selectedStockItem.colour) && (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaPalette size={11} className="text-gray-400" />{selectedStockItem.vehicle?.colour || selectedStockItem.colour}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {uploading && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" />
                          <span className="text-sm font-medium text-gray-700">Uploading video...</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)' }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 text-center">Do not close this tab until the upload finishes</p>
                    </div>
                  )}

                  {/* Drop zone */}
                  <div
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${isDragging ? 'border-blue-400 bg-blue-50' : selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
                    {selectedFile ? (
                      <>
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FaCheck className="text-green-500" size={22} />
                        </div>
                        <p className="font-semibold text-green-700 text-base">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500 mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Click to change</p>
                      </>
                    ) : (
                      <>
                        <FaCloudUploadAlt className="mx-auto mb-3 text-gray-300" size={48} />
                        <p className="text-base font-medium text-gray-600">Drop video here or <span className="text-blue-500">browse</span></p>
                        <p className="text-sm text-gray-400 mt-1">MP4, MOV, AVI — up to 3GB</p>
                      </>
                    )}
                  </div>

                  {uploadError && <p className="text-sm text-red-500 text-center">{uploadError}</p>}
                </div>
              )}
            </div>

            {/* Footer */}
            {!uploadSuccess && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => { setDirectUploadOpen(false); setSelectedStockItem(null); setSelectedFile(null); setUploadError(''); resetUploadState(); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                <button onClick={handleDirectUpload} disabled={!selectedFile || uploading}
                  className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition flex items-center gap-2">
                  {uploading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading...</> : <><FaCloudUploadAlt size={13} /> Start Upload</>}
                </button>
              </div>
            )}
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
