'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { FaCloudUploadAlt, FaVideo, FaLink, FaCar, FaEye, FaClock, FaChartLine, FaTimes, FaArrowRight, FaFire, FaTrophy, FaCalendarAlt, FaPlay, FaUser } from 'react-icons/fa';
import { useToast } from '@/components/ToastProvider';

interface VideoView {
    viewerName?: string;
    viewerEmail?: string;
    viewerMobile?: string;
    viewedAt: string;
}

interface Video {
    _id: string;
    title?: string;
    originalName?: string;
    registration?: string;
    videoSource?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    cloudflareVideoId?: string;
    youtubeVideoId?: string;
    viewCount?: number;
    createdAt: string;
    views?: VideoView[];
}

interface StockItem {
    vehicle: {
        registration?: string;
    };
}

interface VehicleMetadata {
    registration?: string;
    reserveLink?: string;
}

const StaffDashboard = () => {
    const router = useRouter();
    const [videos, setVideos] = useState<Video[]>([]);
    const [stock, setStock] = useState<StockItem[]>([]);
    const [loadingVideos, setLoadingVideos] = useState(true);
    const { user } = useAuth();

    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

    const [reserveLinkModalOpen, setReserveLinkModalOpen] = useState(false);
    const [reserveLinkVideo, setReserveLinkVideo] = useState<Video | null>(null);
    const [reserveLink, setReserveLink] = useState('');
    const [savingReserveLink, setSavingReserveLink] = useState(false);
    const [vehicleMetadata, setVehicleMetadata] = useState<Record<string, VehicleMetadata>>({});
    const { showToast } = useToast();

    const fetchVideos = useCallback(async () => {
        if (!user?.token) return;
        try {
            const res = await fetch('/api/videos', { headers: { Authorization: `Bearer ${user?.token}` } });
            const data = await res.json();
            setVideos(Array.isArray(data) ? data : data.videos || []);
        } catch (error) {
            console.error(error);
            setVideos([]);
        } finally {
            setLoadingVideos(false);
        }
    }, [user?.token]);

    const fetchStock = useCallback(async () => {
        try {
            const res = await fetch('/api/autotrader/stock', { headers: { Authorization: `Bearer ${user?.token}` } });
            const data = await res.json();
            setStock(data.results || []);
        } catch (error) {
            console.error('Failed to fetch stock', error);
            setStock([]);
        }
    }, [user?.token]);

    const fetchAllVehicleMetadata = useCallback(async () => {
        try {
            const res = await fetch('/api/vehicle-metadata');
            const data = await res.json();
            const map: Record<string, VehicleMetadata> = {};
            (Array.isArray(data) ? data : []).forEach((item: VehicleMetadata) => {
                if (item.registration) {
                    map[item.registration.replace(/\s/g, '').toUpperCase()] = item;
                }
            });
            setVehicleMetadata(map);
        } catch (error) {
            console.error('Failed to fetch vehicle metadata', error);
        }
    }, []);

    useEffect(() => {
        fetchVideos();
        fetchStock();
        fetchAllVehicleMetadata();
    }, [fetchVideos, fetchStock, fetchAllVehicleMetadata]);

    const openReserveLinkModal = async (video: Video) => {
        const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
        let metadata = vehicleMetadata[normReg];
        if (!metadata && normReg) {
            try {
                const res = await fetch(`/api/vehicle-metadata/${normReg}`);
                const data = await res.json();
                metadata = data;
                setVehicleMetadata(prev => ({ ...prev, [normReg]: data }));
            } catch {
                metadata = { registration: normReg, reserveLink: '' };
            }
        }
        setReserveLinkVideo(video);
        setReserveLink(metadata?.reserveLink || '');
        setReserveLinkModalOpen(true);
    };

    const handleSaveReserveLink = async () => {
        if (!reserveLinkVideo) return;
        const normReg = (reserveLinkVideo.registration || '').replace(/\s/g, '').toUpperCase();
        if (!normReg) {
            showToast('This video has no registration number — cannot set a reserve link.', 'error');
            return;
        }
        setSavingReserveLink(true);
        try {
            await fetch(`/api/vehicle-metadata/${normReg}/reserve-link`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
                body: JSON.stringify({ reserveLink })
            });
            showToast('Reserve link saved successfully.', 'success');
            setVehicleMetadata(prev => ({ ...prev, [normReg]: { ...prev[normReg], reserveLink } }));
            setReserveLinkModalOpen(false);
            setReserveLinkVideo(null);
            setReserveLink('');
        } catch (error) {
            showToast('Failed to save reserve link.', 'error');
        } finally {
            setSavingReserveLink(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const getTodayDate = () => {
        return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const stockRegs = new Set(
        stock.map(item => (item.vehicle?.registration || '').replace(/\s/g, '').toUpperCase()).filter(Boolean)
    );

    const topVideos = [...videos]
        .filter(v => {
            const reg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            return reg && stockRegs.size > 0 && !stockRegs.has(reg);
        })
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    const recentVideos = videos.filter(v => {
        const normReg = (v.registration || '').replace(/\s/g, '').toUpperCase();
        const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
        return !isSold;
    });

    const agedVideos = [...videos]
        .filter(v => {
            const normReg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
            return !isSold && (v.viewCount || 0) > 0;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const videosThisWeek = videos.filter(v => {
        const uploadDate = new Date(v.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return uploadDate >= weekAgo;
    }).length;

    const totalViews = videos
        .filter(v => {
            const reg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            return !reg || stockRegs.size === 0 || stockRegs.has(reg);
        })
        .reduce((sum, v) => sum + (v.viewCount || 0), 0);

    const VideoRow = ({ video, showRank, rank, showDate }: { video: Video; showRank?: boolean; rank?: number; showDate?: boolean }) => {
        const normReg = (video.registration || '').replace(/\s/g, '').toUpperCase();
        const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
        let displayName = video.title || video.originalName || 'Untitled Video';
        if (video.registration) {
            const regPattern = new RegExp(`\\s*-\\s*${video.registration}`, 'i');
            displayName = displayName.replace(regPattern, '');
        }
        return (
            <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/staff/videos?videoId=${video._id}`)}>
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        {showRank && (
                            <span className={`w-5 text-center text-xs font-bold ${rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-amber-600' : 'text-gray-300'}`}>
                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                            </span>
                        )}
                        <div
                            className="w-14 h-10 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 flex items-center justify-center relative group/thumb cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); }}
                        >
                            {video.thumbnailUrl || video.cloudflareVideoId || video.youtubeVideoId ? (
                                <img
                                    src={video.thumbnailUrl ||
                                        (video.videoSource === 'cloudflare'
                                            ? `https://videodelivery.net/${video.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&height=90`
                                            : `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`)}
                                    alt={video.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120x80?text=Video'; }}
                                />
                            ) : (
                                <FaVideo className="text-gray-600" size={14} />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/40 transition-all flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow">
                                    <FaPlay className="text-gray-800 ml-0.5" size={8} />
                                </div>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate max-w-[160px]">{displayName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {video.registration && (
                                    <span className="text-xs font-mono text-blue-600">{video.registration}</span>
                                )}
                                {isSold && (
                                    <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-xs font-semibold rounded border border-red-200">
                                        Sold
                                    </span>
                                )}
                                {showDate && video.createdAt && (
                                    <span className="text-xs text-orange-500 font-medium">
                                        {new Date(video.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                        <FaEye size={10} />
                        {video.viewCount || 0}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <DashboardLayout>
            <div className="w-full px-6 pb-10">

                {/* Header */}
                <header className="mb-6 md:mb-8 border-b pb-5 border-gray-200 animate-fadeIn">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">
                                {getGreeting()}, {user?.name || 'there'} 👋
                            </h1>
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                                <FaCalendarAlt size={11} />
                                {getTodayDate()}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div
                        onClick={() => router.push('/staff/videos')}
                        className="cursor-pointer p-5 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/30 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/10">
                                <FaVideo className="text-white" size={17} />
                            </div>
                            <FaChartLine size={16} className="text-white/60 mt-1" />
                        </div>
                        <div className="mt-4">
                            <div className="text-3xl font-bold leading-tight tracking-tight">{videos.length}</div>
                            <div className="mt-1 text-xs font-medium text-blue-100">Total Videos</div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-blue-100 text-xs">
                            <span>View all</span>
                            <FaArrowRight size={9} />
                        </div>
                    </div>

                    <div
                        onClick={() => router.push('/staff/views')}
                        className="cursor-pointer p-5 bg-purple-500 rounded-2xl shadow-lg shadow-purple-500/30 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/10">
                                <FaEye className="text-white" size={17} />
                            </div>
                            <FaChartLine size={16} className="text-white/60 mt-1" />
                        </div>
                        <div className="mt-4">
                            <div className="text-3xl font-bold leading-tight tracking-tight">{totalViews}</div>
                            <div className="mt-1 text-xs font-medium text-purple-100">Total Views</div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-purple-100 text-xs">
                            <span>Analytics</span>
                            <FaArrowRight size={9} />
                        </div>
                    </div>

                    <div
                        onClick={() => router.push('/staff/videos')}
                        className="cursor-pointer p-5 bg-green-500 rounded-2xl shadow-lg shadow-green-500/30 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/10">
                                <FaClock className="text-white" size={17} />
                            </div>
                            <FaFire size={16} className="text-white/60 mt-1" />
                        </div>
                        <div className="mt-4">
                            <div className="text-3xl font-bold leading-tight tracking-tight">{videosThisWeek}</div>
                            <div className="mt-1 text-xs font-medium text-green-100">Uploaded This Week</div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-green-100 text-xs">
                            <span>Recent uploads</span>
                            <FaArrowRight size={9} />
                        </div>
                    </div>

                    <div
                        onClick={() => router.push('/staff/stock')}
                        className="cursor-pointer p-5 bg-orange-500 rounded-2xl shadow-lg shadow-orange-500/30 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/40"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center border border-white/10">
                                <FaCar className="text-white" size={17} />
                            </div>
                            <FaChartLine size={16} className="text-white/60 mt-1" />
                        </div>
                        <div className="mt-4">
                            <div className="text-3xl font-bold leading-tight tracking-tight">{stock.length}</div>
                            <div className="mt-1 text-xs font-medium text-orange-100">Cars in Stock</div>
                        </div>
                        <div className="mt-3 flex items-center gap-1 text-orange-100 text-xs">
                            <span>View stock</span>
                            <FaArrowRight size={9} />
                        </div>
                    </div>
                </div>

                {/* Video Tables */}
                {loadingVideos ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[0, 1].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                    <div className="h-3 w-32 bg-gray-200 rounded"></div>
                                </div>
                                {[0, 1, 2, 3, 4].map(j => (
                                    <div key={j} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                                        <div className="w-14 h-10 bg-gray-200 rounded-lg flex-shrink-0"></div>
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 w-40 bg-gray-200 rounded"></div>
                                            <div className="h-2.5 w-20 bg-gray-100 rounded"></div>
                                        </div>
                                        <div className="h-5 w-10 bg-gray-100 rounded-full"></div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : videos.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                        {/* Recent Uploads */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900 tracking-tight">Recent Uploads</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Uploaded videos</p>
                                </div>
                                <button onClick={() => router.push('/staff/videos')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                    View all <FaArrowRight size={9} />
                                </button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Video</th>
                                            <th className="px-4 py-3 text-right">Views</th>
                                        </tr>
                                    </thead>
                                </table>
                                <div className="overflow-y-auto max-h-96">
                                    <table className="w-full text-left">
                                        <tbody className="divide-y divide-gray-50">
                                            {recentVideos.map((video) => (
                                                <VideoRow key={video._id} video={video} showRank={false} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Top Performing */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                                        <FaTrophy className="text-yellow-500" size={15} />
                                        Top Performing
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Most viewed videos</p>
                                </div>
                                <button onClick={() => router.push('/staff/views')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                    Views <FaArrowRight size={9} />
                                </button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3">Video</th>
                                            <th className="px-4 py-3 text-right">Views</th>
                                        </tr>
                                    </thead>
                                </table>
                                <div className="overflow-y-auto max-h-96">
                                    <table className="w-full text-left">
                                        <tbody className="divide-y divide-gray-50">
                                            {topVideos.map((video, idx) => (
                                                <VideoRow key={video._id} video={video} showRank={true} rank={idx + 1} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Aged Uploads */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900 tracking-tight flex items-center gap-2">
                                        <FaClock className="text-orange-400" size={14} />
                                        Aged Uploads
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">In stock with views</p>
                                </div>
                                <button onClick={() => router.push('/staff/videos')} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                                    View all <FaArrowRight size={9} />
                                </button>
                            </div>
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
                                {agedVideos.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full py-10 text-center text-gray-400">
                                        <FaClock size={22} className="mb-2 text-gray-300" />
                                        <p className="text-sm">No aged videos with views</p>
                                    </div>
                                ) : (
                                    <>
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-100">
                                                <tr>
                                                    <th className="px-4 py-3">Video</th>
                                                    <th className="px-4 py-3 text-right">Views</th>
                                                </tr>
                                            </thead>
                                        </table>
                                        <div className="overflow-y-auto max-h-96">
                                            <table className="w-full text-left">
                                                <tbody className="divide-y divide-gray-50">
                                                    {agedVideos.map((video) => (
                                                        <VideoRow key={video._id} video={video} showRank={false} showDate={true} />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {videos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100">
                            <FaVideo className="text-blue-400" size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">No videos yet</h3>
                        <p className="text-sm text-gray-500 mb-5">Upload your first vehicle video to get started.</p>
                        <button
                            onClick={() => router.push('/staff/videos')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-blue-700 transition"
                        >
                            <FaCloudUploadAlt size={15} />
                            Upload Video
                        </button>
                    </div>
                )}
            </div>

            {/* Video Preview Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVideo(null)}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                    <div
                        className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
                        style={{ background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setSelectedVideo(null)}
                            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm border border-white/10"
                        >
                            <FaTimes size={14} />
                        </button>

                        {/* Video */}
                        <div className="aspect-video w-full bg-black">
                            {selectedVideo.videoSource === 'cloudflare' || selectedVideo.videoSource === 'youtube' ? (
                                <iframe
                                    src={selectedVideo.videoUrl}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title={selectedVideo.title}
                                />
                            ) : (
                                <video src={selectedVideo.videoUrl} controls autoPlay className="w-full h-full object-contain" />
                            )}
                        </div>

                        {/* Info strip */}
                        <div className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold text-base leading-tight truncate">
                                        {(() => {
                                            let name = selectedVideo.title || selectedVideo.originalName || 'Video Preview';
                                            if (selectedVideo.registration) {
                                                name = name.replace(new RegExp(`\\s*-\\s*${selectedVideo.registration}`, 'i'), '');
                                            }
                                            return name;
                                        })()}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {selectedVideo.registration && (
                                            <span className="px-2 py-0.5 bg-white/10 text-white/80 text-xs font-mono rounded-md border border-white/10">
                                                {selectedVideo.registration}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-white/50 text-xs">
                                            <FaEye size={10} />
                                            {selectedVideo.viewCount || 0} views
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Who Viewed */}
                            {selectedVideo.views && selectedVideo.views.length > 0 && (
                                <div className="mt-4 border-t border-white/10 pt-4">
                                    <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <FaEye size={10} /> Who Viewed This Link
                                    </p>
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scroll">
                                        {[...selectedVideo.views].reverse().map((view, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-3 py-2.5 border border-white/10">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                                                        <FaUser size={11} className="text-blue-300" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-xs font-semibold">{view.viewerName || 'Unknown Customer'}</p>
                                                        <p className="text-white/40 text-xs">{view.viewerEmail || view.viewerMobile || 'No contact info'}</p>
                                                    </div>
                                                </div>
                                                <span className="text-white/40 text-xs shrink-0">
                                                    {new Date(view.viewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reserve Link Modal */}
            {reserveLinkModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 tracking-tight">
                                <FaLink className="text-blue-700" />
                                {vehicleMetadata[(reserveLinkVideo?.registration || '').replace(/\s/g, '').toUpperCase()]?.reserveLink ? 'Manage' : 'Add'} reserve link
                            </h3>
                            <button
                                onClick={() => { setReserveLinkModalOpen(false); setReserveLinkVideo(null); setReserveLink(''); }}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Video</label>
                                <p className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
                                    {reserveLinkVideo?.title || reserveLinkVideo?.originalName || 'Untitled'}
                                    {reserveLinkVideo?.registration && (
                                        <span className="ml-2 text-xs font-mono text-blue-600">({reserveLinkVideo.registration})</span>
                                    )}
                                </p>
                            </div>

                            {!reserveLinkVideo?.registration && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <p className="text-xs text-amber-700">⚠️ This video has no registration number. Reserve link requires a registration to be linked to the vehicle.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reserve Car Link URL</label>
                                <input
                                    type="url"
                                    value={reserveLink}
                                    onChange={(e) => setReserveLink(e.target.value)}
                                    placeholder="https://example.com/reserve"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    When customers click "Reserve Car", they'll be redirected to this URL.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setReserveLinkModalOpen(false); setReserveLinkVideo(null); setReserveLink(''); }}
                                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveReserveLink}
                                    disabled={savingReserveLink || !reserveLinkVideo?.registration}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {savingReserveLink ? 'Saving...' : 'Save Link'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default StaffDashboard;
