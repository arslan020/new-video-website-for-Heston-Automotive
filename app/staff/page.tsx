'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { FaLink, FaCar, FaEye, FaTimes, FaUser } from 'react-icons/fa';
import NeedsAttention from '@/components/NeedsAttention';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { RegChip } from '@/components/ui/RegChip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageTitle } from '@/components/ui/PageTitle';
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
    make?: string;
    deletedAt?: string;
}

function videoName(video: Video) {
    let displayName = video.title || video.originalName || 'Untitled Video';
    if (video.registration) {
        displayName = displayName.replace(new RegExp(`\\s*-\\s*${video.registration}`, 'i'), '');
    }
    return displayName;
}

function hasPlayableVideo(video: Video) {
    return !video.deletedAt && Boolean(video.videoUrl || video.cloudflareVideoId || video.youtubeVideoId);
}

function videoThumb(video: Video) {
    const isDeleted = !!video.deletedAt || (!video.videoUrl && !video.cloudflareVideoId && !video.youtubeVideoId);
    if (isDeleted) return null;
    return video.thumbnailUrl ||
        (video.videoSource === 'cloudflare' && video.cloudflareVideoId
            ? `https://videodelivery.net/${video.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&height=200`
            : video.youtubeVideoId
                ? `https://img.youtube.com/vi/${video.youtubeVideoId}/mqdefault.jpg`
                : null);
}

function brandLogo(video: Video) {
    if (!video.make) return null;
    const slug = video.make.toLowerCase().trim().replace(/\s+/g, '-');
    return `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`;
}

function Thumb({ video }: { video: Video }) {
    const [failed, setFailed] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const src = videoThumb(video);
    const logo = brandLogo(video);
    if (src && !failed) {
        return (
            <img
                src={src}
                alt=""
                className="h-9 w-14 shrink-0 rounded object-cover"
                onError={() => setFailed(true)}
            />
        );
    }
    if (logo && !logoFailed) {
        return (
            <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded border border-[#E2E8F0] bg-white">
                <img src={logo} alt="" className="h-6 w-6 object-contain" onError={() => setLogoFailed(true)} />
            </span>
        );
    }
    return (
        <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded bg-[#E8ECF1] text-[#64748B]">
            <FaCar size={12} />
        </span>
    );
}

function ageTone(createdAt: string) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
    if (days > 120) return { days, tone: 'red' as const };
    if (days > 60) return { days, tone: 'amber' as const };
    return { days, tone: 'grey' as const };
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
    const [allVideos, setAllVideos] = useState<Video[]>([]);
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
            const [res, resAll] = await Promise.all([
                fetch('/api/videos', { headers: { Authorization: `Bearer ${user?.token}` } }),
                fetch('/api/videos?all=true', { headers: { Authorization: `Bearer ${user?.token}` } }),
            ]);
            const data = await res.json();
            const dataAll = await resAll.json();
            setVideos(Array.isArray(data) ? data : data.videos || []);
            setAllVideos(Array.isArray(dataAll) ? dataAll : dataAll.videos || []);
        } catch (error) {
            console.error(error);
            setVideos([]);
            setAllVideos([]);
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
            showToast('This video has no registration number. Cannot set a reserve link.', 'error');
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

    const topVideos = [...allVideos]
        .filter(v => {
            if (!hasPlayableVideo(v)) return false;
            const reg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            return reg && stockRegs.size > 0 && !stockRegs.has(reg);
        })
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

    const recentVideos = allVideos.filter(v => {
        if (!hasPlayableVideo(v)) return false;
        const normReg = (v.registration || '').replace(/\s/g, '').toUpperCase();
        const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
        return !isSold;
    });

    const agedVideos = [...allVideos]
        .filter(v => {
            if (!hasPlayableVideo(v)) return false;
            const normReg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            const isSold = normReg && stockRegs.size > 0 && !stockRegs.has(normReg);
            return !isSold && (v.viewCount || 0) > 0;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const videosThisWeek = allVideos.filter(v => {
        const uploadDate = new Date(v.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return uploadDate >= weekAgo;
    }).length;

    const totalViews = allVideos
        .filter(v => {
            const reg = (v.registration || '').replace(/\s/g, '').toUpperCase();
            return !reg || stockRegs.size === 0 || stockRegs.has(reg);
        })
        .reduce((sum, v) => sum + (v.viewCount || 0), 0);

    const activeVideos = allVideos.filter(hasPlayableVideo);
    const isSoldVideo = (video: Video) => {
        const reg = (video.registration || '').replace(/\s/g, '').toUpperCase();
        return Boolean(reg && stockRegs.size > 0 && !stockRegs.has(reg));
    };
    const soldVideoCount = activeVideos.filter(isSoldVideo).length;
    const liveVideoCount = activeVideos.length - soldVideoCount;
    const videoRegs = new Set(
        activeVideos.map(video => (video.registration || '').replace(/\s/g, '').toUpperCase()).filter(Boolean)
    );
    const carsWithoutVideo = stock.filter(item => {
        const reg = (item.vehicle?.registration || '').replace(/\s/g, '').toUpperCase();
        return !reg || !videoRegs.has(reg);
    }).length;
    const lastUploadAt = activeVideos.reduce<string | null>((latest, video) => {
        if (!latest || new Date(video.createdAt) > new Date(latest)) return video.createdAt;
        return latest;
    }, null);
    const lastUploadLabel = lastUploadAt
        ? new Date(lastUploadAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : null;

    const recentRows = recentVideos.slice(0, 20);
    const viewedRows = topVideos.slice(0, 20);
    const maxViews = Math.max(1, ...viewedRows.map((video) => video.viewCount || 0));
    const agedRows = agedVideos.slice(0, 20);
    const firstName = (user?.name || 'there').split(' ')[0];

    return (
        <DashboardLayout>
            <div className="w-full pb-8">

                <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <PageTitle title={`${getGreeting()}, ${firstName}`}>{getTodayDate()}</PageTitle>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => router.push('/staff/stock')}
                            className="h-10 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#0F172A]"
                        >
                            Sync stock
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/staff/upload')}
                            className="h-10 rounded-lg bg-[#0B3D73] px-4 text-sm font-medium text-white hover:bg-[#072A50]"
                        >
                            Upload video
                        </button>
                    </div>
                </header>

                <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                    <StatCard
                        label="Cars in stock"
                        value={stock.length}
                        onClick={() => router.push('/staff/stock')}
                        helper={<span className="text-[#92400E]">{carsWithoutVideo} without a video</span>}
                    />
                    <StatCard
                        label="Videos uploaded"
                        value={activeVideos.length}
                        onClick={() => router.push('/staff/videos')}
                        helper={<span className="text-[#64748B]">{liveVideoCount} live · {soldVideoCount} sold</span>}
                    />
                    <StatCard
                        label="Video views"
                        value={totalViews}
                        onClick={() => router.push('/staff/views')}
                        helper={<span className="text-[#0B3D73]">Open customer views</span>}
                    />
                    <StatCard
                        label="Uploads this week"
                        value={videosThisWeek}
                        onClick={() => router.push('/staff/videos')}
                        helper={<span className="text-[#64748B]">{lastUploadLabel ? `Last upload ${lastUploadLabel}` : 'No uploads yet'}</span>}
                    />
                </div>

                <NeedsAttention stockHref="/staff/stock" videosHref="/staff/videos" daysHref="/staff/days-to-sell" />

                {/* Video Tables */}
                {loadingVideos ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-48 animate-pulse rounded-xl border border-[#E2E8F0] bg-white" />
                        ))}
                    </div>
                ) : allVideos.length > 0 && (
                    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
                        <Card className="flex h-full flex-col">
                            <SectionHeader
                                title="Recent Uploads"
                                subtitle="Uploaded videos"
                                action={<button type="button" onClick={() => router.push('/staff/videos')} className="text-sm text-[#0B3D73]">View all</button>}
                            />
                            <div className="h-72 overflow-y-auto">
                                {recentRows.map((video) => (
                                    <div key={video._id} className="flex items-center gap-2.5 border-b border-[#EEF1F5] px-3 py-2 last:border-0">
                                        <button type="button" aria-label={`Preview ${videoName(video)}`} onClick={() => setSelectedVideo(video)} className="shrink-0">
                                            <Thumb video={video} />
                                        </button>
                                        <button type="button" onClick={() => router.push(`/staff/videos?videoId=${video._id}`)} className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-sm font-medium text-[#0F172A]">{videoName(video)}</span>
                                            <span className="mt-0.5 block">{video.registration ? <RegChip value={video.registration} /> : null}</span>
                                        </button>
                                        <span className="shrink-0 text-sm text-[#475569]">{video.viewCount || 0}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card className="flex h-full flex-col">
                            <SectionHeader
                                title="Most viewed videos"
                                subtitle="Sold vehicles, all time"
                                action={<button type="button" onClick={() => router.push('/staff/views')} className="text-sm text-[#0B3D73]">Views</button>}
                            />
                            <div className="h-72 overflow-y-auto">
                                {viewedRows.length === 0 ? (
                                    <p className="px-3 py-6 text-center text-sm text-[#64748B]">No data yet</p>
                                ) : viewedRows.map((video, idx) => (
                                    <button key={video._id} type="button" onClick={() => router.push(`/staff/videos?videoId=${video._id}`)} className="flex w-full items-center gap-2.5 border-b border-[#EEF1F5] px-3 py-2 text-left last:border-0">
                                        <span className="w-4 shrink-0 text-xs text-[#64748B]">{idx + 1}</span>
                                        <Thumb video={video} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className="min-w-0 truncate text-sm font-medium text-[#0F172A]">{videoName(video)}</span>
                                                {video.registration ? <RegChip value={video.registration} /> : null}
                                            </span>
                                            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[#EEF1F5]">
                                                <span className="block h-full rounded-full bg-[#0B3D73]" style={{ width: `${Math.round(((video.viewCount || 0) / maxViews) * 100)}%` }} />
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-sm text-[#475569]">{video.viewCount || 0}</span>
                                    </button>
                                ))}
                            </div>
                        </Card>

                        <Card className="flex h-full flex-col">
                            <SectionHeader
                                title="Aged stock with video"
                                subtitle="In stock with views"
                                action={<button type="button" onClick={() => router.push('/staff/videos')} className="text-sm text-[#0B3D73]">View all</button>}
                            />
                            <div className="h-72 overflow-y-auto">
                                {agedRows.length === 0 ? (
                                    <p className="px-3 py-6 text-center text-sm text-[#64748B]">No aged videos with views</p>
                                ) : agedRows.map((video) => {
                                    const age = ageTone(video.createdAt);
                                    return (
                                        <button key={video._id} type="button" onClick={() => router.push(`/staff/videos?videoId=${video._id}`)} className="flex w-full items-center gap-2.5 border-b border-[#EEF1F5] px-3 py-2 text-left last:border-0">
                                            <Thumb video={video} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-[#0F172A]">{videoName(video)}</span>
                                                <span className="mt-0.5 flex items-center gap-2">
                                                    {video.registration ? <RegChip value={video.registration} /> : null}
                                                    <span className="text-xs text-[#64748B]">{video.viewCount || 0} views</span>
                                                </span>
                                            </span>
                                            <span className="shrink-0"><Badge tone={age.tone}>{age.days}d</Badge></span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>
                )}

            </div>

            {/* Video Preview Modal */}
            {selectedVideo && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 p-0" onClick={() => setSelectedVideo(null)}>
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

                    <div
                        className="relative max-h-[90vh] w-full overflow-y-auto overflow-hidden rounded-t-3xl bg-[#0F172A] sm:max-w-2xl sm:rounded-3xl"
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4 p-0">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden animate-fade-in">
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
                                    <p className="text-xs text-amber-700">This video has no registration number. Reserve link requires a registration to be linked to the vehicle.</p>
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
