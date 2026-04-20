'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';
import { useSearchParams } from 'next/navigation';
import {
  FaSearch, FaVideo, FaCopy, FaTrash, FaEye, FaCalendar,
  FaUser, FaPlay, FaTimes, FaExternalLinkAlt, FaPaperPlane, FaLink, FaPlus, FaSpinner, FaPuzzlePiece
} from 'react-icons/fa';
import UKPhoneInput from '@/components/UKPhoneInput';
import * as tus from 'tus-js-client';

interface SubPart {
  _id: string;
  name: string;
  cloudflareVideoId: string;
  thumbnailUrl?: string;
}

interface Video {
  _id: string;
  title: string;
  originalName?: string;
  registration?: string;
  make?: string;
  model?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  videoSource: string;
  cloudflareVideoId?: string;
  youtubeVideoId?: string;
  viewCount: number;
  views: any[];
  createdAt: string;
  uploadedBy?: { _id?: string; name?: string; username: string };
  durationParams?: { duration?: number };
  deletedAt?: string;
  subParts?: SubPart[];
}

interface StockItem {
  vehicle?: { registration?: string };
  registration?: string;
}

const ITEMS_PER_PAGE = 10;

function SubPartRow({ sp, onPlay, onDelete }: { sp: SubPart; onPlay: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onPlay}
        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium hover:bg-indigo-100 transition-colors max-w-[130px]"
        title={sp.name}
      >
        <FaPlay size={7} className="flex-shrink-0" />
        <span className="truncate">{sp.name}</span>
      </button>
      {hovered && (
        <button
          type="button"
          onClick={onDelete}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
          title="Delete"
        >
          <FaTimes size={9} />
        </button>
      )}
    </div>
  );
}

export default function MyVideosPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <Suspense fallback={<div className="p-8 pb-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
            <MyVideosContent />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function MyVideosContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockRegs, setStockRegs] = useState<Set<string>>(new Set());
  const [vehicleMetadata, setVehicleMetadata] = useState<Record<string, any>>({});

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'instock' | 'sold'>('instock');
  const [currentPage, setCurrentPage] = useState(1);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Modals
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [videoForSend, setVideoForSend] = useState<Video | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);

  const [reserveLinkModalOpen, setReserveLinkModalOpen] = useState(false);
  const [reserveLinkVideo, setReserveLinkVideo] = useState<Video | null>(null);
  const [reserveLink, setReserveLink] = useState('');
  const [savingReserveLink, setSavingReserveLink] = useState(false);

  // Sub Parts
  const [subPartModalVideo, setSubPartModalVideo] = useState<Video | null>(null);
  const [subPartName, setSubPartName] = useState('');
  const [subPartFile, setSubPartFile] = useState<File | null>(null);
  const [subPartUploading, setSubPartUploading] = useState(false);
  const [subPartUploadProgress, setSubPartUploadProgress] = useState(0);
  const [playingSubPart, setPlayingSubPart] = useState<SubPart | null>(null);

  const isAdmin = user?.role === 'admin';

  const fetchVideos = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const url = '/api/videos?all=true';
      const res = await fetch(url, { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  const fetchStock = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch('/api/autotrader/stock', { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.stock || data.results || [];
        const regs = new Set(
          items.map((item: StockItem) => {
            const reg = item.vehicle?.registration || item.registration || '';
            return reg.replace(/\s/g, '').toUpperCase();
          }).filter(Boolean) as string[]
        );
        setStockRegs(regs);
      }
    } catch (error) {
      console.error('Failed to fetch stock', error);
    }
  }, [user]);

  const fetchAllVehicleMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicle-metadata');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        if (Array.isArray(data)) {
            data.forEach(item => {
                if (item.registration) {
                    map[item.registration.replace(/\s/g, '').toUpperCase()] = item;
                }
            });
        }
        setVehicleMetadata(map);
      }
    } catch (error) {
      console.error('Failed to fetch vehicle metadata', error);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
    fetchAllVehicleMetadata();
    fetchStock();
  }, [fetchVideos, fetchAllVehicleMetadata, fetchStock]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle URL "Jump To Video"
  useEffect(() => {
    const videoId = searchParams.get('videoId');
    if (!videoId || loading || videos.length === 0) return;

    const allFiltered = videos.filter(video => {
      const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
      const isSoldVideo = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
      return stockFilter === 'sold' ? isSoldVideo : !isSoldVideo;
    });

    const idx = allFiltered.findIndex(v => v._id === videoId);
    if (idx === -1) {
      const soldIdx = videos.findIndex(v => v._id === videoId);
      if (soldIdx !== -1) {
        const normReg = (videos[soldIdx].registration || '').replace(/\s/g, '').toUpperCase();
        const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
        setStockFilter(isSold ? 'sold' : 'instock');
      }
      return;
    }

    const page = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    setCurrentPage(page);
    setHighlightedId(videoId);

    setTimeout(() => {
        const ref = rowRefs.current[videoId];
        if (ref) {
           ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => setHighlightedId(null), 2500);
    }, 150);
  }, [searchParams, videos, loading, stockRegs, stockFilter]);

  const copyLink = async (video: Video) => {
    let shareId = '';
    try {
      const res = await fetch(`/api/videos/${video._id}/share`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        shareId = data.shareId;
      }
    } catch (error) {
      console.error('Failed to register share link:', error);
    }

    const baseUrl = window.location.origin;
    let link = `${baseUrl}/view/${video._id}`;
    if (shareId) link += `?s=${shareId}`;

    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy. URL: ' + link, 'error');
    }
  };

  const handleDelete = async (video: Video) => {
    if (!window.confirm(`Are you sure you want to delete "${video.title}"?`)) return;
    try {
      const res = await fetch(`/api/videos/${video._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (!res.ok) throw new Error('Failed to delete video');
      setVideos(prev => prev.filter(v => v._id !== video._id));
      showToast('Video deleted successfully', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddSubPart = async () => {
    if (!subPartModalVideo || !subPartName.trim() || !subPartFile) return;
    const videoId = subPartModalVideo._id;
    const partName = subPartName.trim();
    setSubPartUploading(true);
    setSubPartUploadProgress(0);
    try {
      const createRes = await fetch('/api/cloudflare/tus-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ title: subPartName, fileSize: subPartFile.size }),
      });
      if (!createRes.ok) throw new Error('Failed to create upload');
      const { tusUrl, uid } = await createRes.json();

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(subPartFile, {
          uploadUrl: tusUrl,
          chunkSize: 50 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          onProgress: (uploaded: number, total: number) => {
            setSubPartUploadProgress(Math.round((uploaded / total) * 100));
          },
          onSuccess: () => resolve(),
          onError: (e: Error) => reject(e),
        });
        upload.start();
      });

      const saveRes = await fetch(`/api/videos/${videoId}/subparts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ name: partName, cloudflareVideoId: uid }),
      });
      if (!saveRes.ok) throw new Error('Failed to save sub part');
      const newSubPart: SubPart = await saveRes.json();

      setVideos(prev => prev.map(v =>
        v._id === videoId
          ? { ...v, subParts: [...(v.subParts || []), newSubPart] }
          : v
      ));
      setSubPartModalVideo(null);
      setSubPartName('');
      setSubPartFile(null);
      showToast('Sub part added', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setSubPartUploading(false);
      setSubPartUploadProgress(0);
    }
  };

  const handleDeleteSubPart = async (videoId: string, subPartId: string) => {
    try {
      await fetch(`/api/videos/${videoId}/subparts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({ subPartId }),
      });
      setVideos(prev => prev.map(v =>
        v._id === videoId
          ? { ...v, subParts: (v.subParts || []).filter(sp => sp._id !== subPartId) }
          : v
      ));
      showToast('Sub part deleted', 'success');
    } catch {
      showToast('Failed to delete sub part', 'error');
    }
  };

  const handleCloseSendModal = () => {
    setSendModalOpen(false);
    setVideoForSend(null);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
  };

  const openSendModal = (video: Video) => {
    setVideoForSend(video);
    setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
    setSendModalOpen(true);
  };

  const handleSendLink = async () => {
    if (!videoForSend) return;
    if (!sendForm.name.trim() || (!sendForm.email && !sendForm.mobile)) {
      showToast('Please enter customer name and email or mobile', 'error');
      return;
    }

    setSending(true);
    try {
      const refName =
        user?.name ||
        user?.username ||
        videoForSend.uploadedBy?.name ||
        videoForSend.uploadedBy?.username ||
        '';
      const videoLink = `${window.location.origin}/view/${videoForSend._id}?ref=${encodeURIComponent(refName)}`;
      const payload: Record<string, unknown> = {
        videoLink,
        customerName: sendForm.name,
        customerTitle: sendForm.title,
        vehicleDetails: videoForSend.make
          ? { make: videoForSend.make, model: videoForSend.model, registration: videoForSend.registration }
          : undefined,
      };
      if (sendForm.email) payload.email = sendForm.email;
      if (sendForm.mobile) payload.mobile = sendForm.mobile.replace(/\D/g, '');

      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to send link');

      showToast('Video link sent successfully!', 'success');
      handleCloseSendModal();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send video', 'error');
    } finally {
      setSending(false);
    }
  };

  const openReserveLinkModal = async (video: Video) => {
    const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
    if (!normReg) {
      showToast('Video has no registration.', 'error');
      return;
    }
    
    let reserveUrl = '';
    if (vehicleMetadata[normReg]) {
      reserveUrl = vehicleMetadata[normReg].reserveLink;
    } else {
      try {
        const res = await fetch(`/api/vehicle-metadata/${normReg}`, {
          headers: { Authorization: `Bearer ${user?.token}` } 
        });
        if (res.ok) {
          const data = await res.json();
          reserveUrl = data.reserveLink || '';
          setVehicleMetadata(prev => ({ ...prev, [normReg]: data }));
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    setReserveLinkVideo(video);
    setReserveLink(reserveUrl);
    setReserveLinkModalOpen(true);
  };

  const handleSaveReserveLink = async () => {
    if (!reserveLinkVideo) return;
    const normReg = (reserveLinkVideo.registration || '').replace(/\s/g, '').toUpperCase();
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

  const filteredVideos = videos.filter((video) => {
    const searchStr = searchTerm.toLowerCase();
    const title = (video.title || '').toLowerCase();
    const reg = (video.registration || '').toLowerCase();
    const make = (video.make || '').toLowerCase();
    const model = (video.model || '').toLowerCase();
    const matchesSearch =
      title.includes(searchStr) ||
      reg.includes(searchStr) ||
      make.includes(searchStr) ||
      model.includes(searchStr);

    const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
    const isSoldVideo = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
    const matchesFilter =
      (stockFilter === 'sold' && isSoldVideo) ||
      (stockFilter === 'instock' && !isSoldVideo);

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredVideos.length / ITEMS_PER_PAGE);
  const paginatedVideos = filteredVideos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const carBrandLogoMap: Record<string, string> = {
    'audi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/320px-Audi-Logo_2016.svg.png',
    'bmw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/200px-BMW.svg.png',
    'mercedes-benz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/200px-Mercedes-Logo.svg.png',
    'mercedes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/200px-Mercedes-Logo.svg.png',
    'volkswagen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/200px-Volkswagen_logo_2019.svg.png',
    'ford': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/320px-Ford_logo_flat.svg.png',
    'toyota': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Toyota_carlogo.svg/200px-Toyota_carlogo.svg.png',
    'honda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Honda.svg/200px-Honda.svg.png',
    'lexus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Lexus_division_emblem.svg/320px-Lexus_division_emblem.svg.png',
    'vauxhall': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/24/Vauxhall_Motors_logo.svg/320px-Vauxhall_Motors_logo.svg.png',
    'skoda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Skoda_auto_logo.svg/320px-Skoda_auto_logo.svg.png',
    'porsche': 'https://upload.wikimedia.org/wikipedia/de/thumb/9/9b/Porsche_logo.svg/200px-Porsche_logo.svg.png',
    'volvo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Volvo_cars_logo.svg/320px-Volvo_cars_logo.svg.png',
    'seat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/SEAT_logo_2012.svg/320px-SEAT_logo_2012.svg.png',
    'nissan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Nissan-logo.svg/320px-Nissan-logo.svg.png',
    'hyundai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Hyundai_Motor_Company_logo.svg/320px-Hyundai_Motor_Company_logo.svg.png',
    'kia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.svg/320px-Kia-logo.svg.png',
    'mazda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Mazda_logo.svg/320px-Mazda_logo.svg.png',
    'jaguar': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Jaguar_logo.svg/320px-Jaguar_logo.svg.png',
    'land': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Land_Rover_logo.svg/320px-Land_Rover_logo.svg.png',
    'range': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Land_Rover_logo.svg/320px-Land_Rover_logo.svg.png',
    'mini': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/MINI_logo.svg/200px-MINI_logo.svg.png',
    'peugeot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Logo_Peugeot.svg/200px-Logo_Peugeot.svg.png',
    'renault': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Renault_2021_Text.svg/320px-Renault_2021_Text.svg.png',
    'fiat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Fiat-Logo.svg/200px-Fiat-Logo.svg.png',
    'tesla': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Tesla_Motors.svg/200px-Tesla_Motors.svg.png',
    'jeep': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jeep_logo.svg/320px-Jeep_logo.svg.png',
    'subaru': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Subaru_Corporation_logo.svg/320px-Subaru_Corporation_logo.svg.png',
    'mitsubishi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mitsubishi_logo.svg/200px-Mitsubishi_logo.svg.png',
  };

  const getCarBrandLogo = (title: string): string | null => {
    const make = (title || '').split(' ')[0].toLowerCase().trim();
    return carBrandLogoMap[make] || null;
  };

  const getThumbnail = (video: Video) => {
    if (video.thumbnailUrl) return video.thumbnailUrl;
    if (video.videoSource === 'cloudflare' && video.cloudflareVideoId) {
        return `https://customer-8bi7472qxin61gj7.cloudflarestream.com/${video.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=0s&height=300`;
    }
    return '';
  };

  const instockTabCount = videos.filter((v) => {
    const r = (v.registration || '').replace(/\s/g, '').toUpperCase();
    return !r || stockRegs.size === 0 || stockRegs.has(r);
  }).length;
  const soldTabCount = videos.filter((v) => {
    const r = (v.registration || '').replace(/\s/g, '').toUpperCase();
    return !!(r && stockRegs.size > 0 && !stockRegs.has(r));
  }).length;

  const brandLogoUrl = (make?: string) => {
    if (!make) return null;
    const slug = make.toLowerCase().trim().replace(/\s+/g, '-');
    return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`;
  };

  const thumbSrc = (video: Video) => {
    if (video.deletedAt) return null;
    if (video.thumbnailUrl) return video.thumbnailUrl;
    if (video.videoSource === 'cloudflare' && video.cloudflareVideoId) {
      return `https://videodelivery.net/${video.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&height=120`;
    }
    if (video.youtubeVideoId) {
      return `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`;
    }
    return getThumbnail(video);
  };

  return (
    <div className="w-full px-3 sm:px-6">
      <header className="mb-4 sm:mb-6 md:mb-8 border-b pb-4 border-gray-200">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">My Uploaded Videos</h1>
            <p className="text-sm text-gray-500 mt-1 hidden sm:block">Manage and share your car videos.</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="relative hidden sm:block w-48 md:w-64">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="bg-blue-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-center">
              <p className="text-xs text-gray-600">Videos</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{videos.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="sm:hidden mb-6">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-16 text-center">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <FaVideo className="text-gray-400" size={48} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No videos uploaded yet</h3>
          <p className="text-gray-500 mb-6">Upload your first car video to get started!</p>
          <a
            href="/staff/upload"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm"
          >
            Upload Video
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1 px-4 pt-4 pb-3 border-b border-gray-100">
            {[
              { label: 'With Videos', value: 'instock' as const, count: instockTabCount },
              { label: 'Sold', value: 'sold' as const, count: soldTabCount },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => { setStockFilter(tab.value); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  stockFilter === tab.value
                    ? tab.value === 'sold'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-500 hover:bg-gray-50 border border-transparent'
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    stockFilter === tab.value
                      ? tab.value === 'sold'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="hidden sm:table-cell px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                  <th className="px-3 sm:px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Video</th>
                  <th className="px-3 sm:px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Views</th>
                  <th className="hidden md:table-cell px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Reserve Link</th>
                  <th className="hidden lg:table-cell px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sub Parts</th>
                  <th className="px-3 sm:px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVideos.length > 0 ? (
                  paginatedVideos.map((video, index) => {
                    const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
                    const hasReserveLink = !!vehicleMetadata[normReg]?.reserveLink;
                    const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                    const isSold = !!(normReg && stockRegs.size > 0 && !stockRegs.has(normReg));
                    const isDeleted = !!video.deletedAt || (!video.videoUrl && !video.cloudflareVideoId && !video.youtubeVideoId);
                    let displayName = video.title || video.originalName || 'Untitled Video';
                    if (video.registration) {
                      const regPattern = new RegExp(`\\s*-\\s*${video.registration}`, 'i');
                      displayName = displayName.replace(regPattern, '');
                    }
                    return (
                      <tr
                        key={video._id}
                        ref={(el) => { rowRefs.current[video._id] = el; }}
                        className={`group border-b border-gray-100 transition-colors ${
                          highlightedId === video._id
                            ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                            : 'bg-white hover:bg-gray-50/80'
                        }`}
                      >
                        <td className="hidden sm:table-cell px-5 py-3.5 text-xs text-gray-300 font-medium">{globalIndex}</td>
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <button
                              type="button"
                              className={`w-16 h-11 sm:w-20 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 cursor-pointer group/thumb relative flex items-center justify-center shadow-sm ${!thumbSrc(video) && brandLogoUrl(video.make) ? 'bg-white' : 'bg-gray-900'}`}
                              onClick={() => setSelectedVideo(video)}
                            >
                              {thumbSrc(video) ? (
                                <img
                                  src={thumbSrc(video)!}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).src =
                                      'https://via.placeholder.com/160x90?text=Video';
                                  }}
                                />
                              ) : brandLogoUrl(video.make) ? (
                                <img
                                  src={brandLogoUrl(video.make)!}
                                  alt={video.make}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    const el = e.target as HTMLImageElement;
                                    el.onerror = null;
                                    el.style.display = 'none';
                                    el.parentElement!.innerHTML = `<span class="text-xs font-bold text-gray-400 uppercase">${video.make?.slice(0, 3) ?? ''}</span>`;
                                  }}
                                />
                              ) : (
                                <FaVideo className="text-gray-600" size={16} />
                              )}
                              {!isDeleted && (
                                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 transition-all flex items-center justify-center">
                                  <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow">
                                    <FaPlay className="text-gray-800 ml-0.5" size={10} />
                                  </div>
                                </div>
                              )}
                            </button>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[200px] md:max-w-[220px] leading-tight">{displayName}</h3>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {video.registration && (
                                  <span className="px-1.5 sm:px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-xs rounded-md border border-blue-100">
                                    {video.registration}
                                  </span>
                                )}
                                {isSold && (
                                  <span className="px-1.5 sm:px-2 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded-md border border-red-200">
                                    Sold
                                  </span>
                                )}
                                <span className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                                  <FaCalendar size={9} />
                                  {new Date(video.createdAt).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                                {video.uploadedBy && (
                                  <span className="hidden sm:flex items-center gap-1 text-xs text-purple-500 font-medium">
                                    <FaUser size={9} />
                                    {video.uploadedBy.name || video.uploadedBy.username}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5">
                          <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold border border-blue-100">
                            <FaEye size={10} />
                            {video.viewCount || 0}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3.5">
                          {!isDeleted && (
                            <button
                              type="button"
                              onClick={() => openReserveLinkModal(video)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                hasReserveLink
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <FaLink size={10} />
                              {hasReserveLink ? 'Edit Link' : 'Add Link'}
                            </button>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-5 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            {(video.subParts || []).map(sp => (
                              <SubPartRow
                                key={sp._id}
                                sp={sp}
                                onPlay={() => setPlayingSubPart(sp)}
                                onDelete={() => handleDeleteSubPart(video._id, sp._id)}
                              />
                            ))}
                            {!isDeleted && (
                              <button
                                type="button"
                                onClick={() => { setSubPartModalVideo(video); setSubPartName(''); setSubPartFile(null); }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 border border-dashed border-gray-300 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors w-fit"
                              >
                                <FaPlus size={8} /> Add Part
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5 text-right">
                          {isDeleted ? (
                            <button
                              type="button"
                              onClick={() => window.open(`${window.location.origin}/view/${video._id}`, '_blank')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              title="View Record"
                            >
                              <FaExternalLinkAlt size={10} /> View
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => openSendModal(video)}
                                className="p-1.5 text-blue-600 hover:bg-white rounded-md transition-colors"
                                title="Send to Customer"
                              >
                                <FaPaperPlane size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => copyLink(video)}
                                className="p-1.5 text-blue-600 hover:bg-white rounded-md transition-colors"
                                title="Copy Link"
                              >
                                <FaCopy size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => window.open(`${window.location.origin}/view/${video._id}`, '_blank')}
                                className="hidden sm:block p-1.5 text-emerald-600 hover:bg-white rounded-md transition-colors"
                                title="Open Video"
                              >
                                <FaExternalLinkAlt size={12} />
                              </button>
                              {(isAdmin || video.uploadedBy?._id === user?._id) && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(video)}
                                  className="p-1.5 text-red-500 hover:bg-white rounded-md transition-colors"
                                  title="Delete Video"
                                >
                                  <FaTrash size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500 font-medium text-sm">
                      No videos found matching &quot;{searchTerm}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50 gap-2 flex-wrap">
              <p className="text-xs sm:text-sm text-gray-500">
                <span className="font-semibold text-gray-700">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredVideos.length)}
                </span>{' '}
                of <span className="font-semibold text-gray-700">{filteredVideos.length}</span>
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <span className="text-xs sm:text-sm text-gray-500 font-medium px-1 sm:px-2">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {sendModalOpen && (
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
                  onClick={handleSendLink}
                  disabled={sending || (!sendForm.email && !sendForm.mobile)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-4 p-0"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl sm:max-w-3xl w-full overflow-hidden shadow-2xl animate-fade-in max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                {(() => {
                  const make = selectedVideo.make || (selectedVideo.title || selectedVideo.originalName || '').split(' ')[0];
                  const logoUrl = `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${make.toLowerCase().replace(/\s+/g, '-')}.png`;
                  return (
                    <img
                      src={logoUrl}
                      alt={make}
                      className="w-10 h-10 object-contain flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  );
                })()}
                <div>
                  <h3 className="font-bold text-gray-900 text-base line-clamp-1">
                    {selectedVideo.title || selectedVideo.originalName || 'Video Preview'}
                  </h3>
                  {selectedVideo.registration && (
                    <span className="text-xs font-mono text-blue-600">{selectedVideo.registration}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center">
              {selectedVideo.videoSource === 'cloudflare' || selectedVideo.videoSource === 'youtube' ? (
                <iframe
                  src={selectedVideo.videoUrl}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={selectedVideo.title}
                />
              ) : (
                <video src={selectedVideo.videoUrl} controls autoPlay className="w-full max-h-[70vh]" />
              )}
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <FaEye className="text-blue-500" size={13} />
                    <span className="font-semibold text-gray-700">{selectedVideo.viewCount || 0}</span>
                    <span>views</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FaCalendar className="text-gray-400" size={12} />
                    <span>
                      {new Date(selectedVideo.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoForSend(selectedVideo);
                      setSendModalOpen(true);
                      setSelectedVideo(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-sm font-semibold rounded-xl transition"
                  >
                    <FaPaperPlane size={13} /> Send Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyLink(selectedVideo);
                      setSelectedVideo(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-semibold rounded-xl transition"
                  >
                    <FaCopy size={13} /> Copy Link
                  </button>
                </div>
              </div>
              {selectedVideo.views && selectedVideo.views.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <FaEye className="text-blue-500" size={13} />
                    Who Viewed This Link
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {[...selectedVideo.views].reverse().map((view: Record<string, unknown>, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5 text-sm border border-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <FaUser size={12} className="text-blue-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {(view.viewerName as string) || (view.customerName as string) || 'Unknown Customer'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(view.viewerEmail as string) ||
                                (view.viewerMobile as string) ||
                                (view.customerEmail as string) ||
                                'No contact info'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-400 flex-shrink-0 ml-4">
                          <p>
                            {view.viewedAt
                              ? new Date(view.viewedAt as string).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : ''}
                          </p>
                          <p>
                            {view.viewedAt
                              ? new Date(view.viewedAt as string).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub Part Upload Modal */}
      {subPartModalVideo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FaPuzzlePiece className="text-indigo-500" size={16} /> Add Sub Part
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{subPartModalVideo.title}</p>
              </div>
              <button type="button" onClick={() => setSubPartModalVideo(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <FaTimes size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Part Name</label>
                <input
                  type="text"
                  value={subPartName}
                  onChange={e => setSubPartName(e.target.value)}
                  placeholder="e.g. Engine, Interior, Boot..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Video File</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => setSubPartFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              {subPartUploading && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Uploading...</span>
                    <span>{subPartUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${subPartUploadProgress}%` }} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleAddSubPart}
                disabled={subPartUploading || !subPartName.trim() || !subPartFile}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {subPartUploading ? <><FaSpinner className="animate-spin" size={13} /> Uploading...</> : <><FaPlus size={12} /> Upload Sub Part</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub Part Video Player Modal */}
      {playingSubPart && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
          <div className="bg-black rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-3 bg-gray-900">
              <span className="text-white font-semibold text-sm flex items-center gap-2">
                <FaPuzzlePiece className="text-indigo-400" size={13} /> {playingSubPart.name}
              </span>
              <button type="button" onClick={() => setPlayingSubPart(null)} className="p-1.5 rounded-lg hover:bg-gray-700">
                <FaTimes size={14} className="text-gray-300" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={`https://customer-8bi7472qxin61gj7.cloudflarestream.com/${playingSubPart.cloudflareVideoId}/iframe?autoplay=true`}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {reserveLinkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] sm:p-4 p-0">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-emerald-50">
              <h3 className="text-xl font-bold text-gray-800">
                🔒{' '}
                {vehicleMetadata[(reserveLinkVideo?.registration || '').replace(/\s/g, '').toUpperCase()]?.reserveLink
                  ? 'Edit'
                  : 'Add'}{' '}
                Reserve Car Link
              </h3>
              <button
                type="button"
                onClick={() => {
                  setReserveLinkModalOpen(false);
                  setReserveLinkVideo(null);
                  setReserveLink('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <FaTimes size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video</label>
                <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                  {reserveLinkVideo?.title || 'Untitled'}
                  {reserveLinkVideo?.registration && (
                    <span className="ml-2 text-xs font-mono text-blue-600">({reserveLinkVideo.registration})</span>
                  )}
                </p>
              </div>
              {!reserveLinkVideo?.registration && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-700">
                    ⚠️ This video has no registration number — reserve link requires one.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reserve Car Link URL</label>
                <input
                  type="url"
                  value={reserveLink}
                  onChange={(e) => setReserveLink(e.target.value)}
                  placeholder="https://example.com/reserve"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Customers will be redirected here when they click &quot;Reserve Car&quot;.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReserveLinkModalOpen(false);
                    setReserveLinkVideo(null);
                    setReserveLink('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReserveLink}
                  disabled={savingReserveLink || !reserveLinkVideo?.registration}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
