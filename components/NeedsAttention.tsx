'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type SaleVehicle = { vehicleType: string; soldAt: string | null; daysTo90: number };
type VideoRow = { registration?: string; createdAt: string; deletedAt?: string; videoUrl?: string; cloudflareVideoId?: string; youtubeVideoId?: string };
type StockRow = { vehicle?: { registration?: string } };

const boxClass = 'flex items-center justify-between gap-3 rounded-lg border border-[#F3D6D6] bg-[#FDF2F2] px-4 py-3 text-left transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#E7B4B4] hover:bg-[#FBEAEA] hover:shadow-sm';

export default function NeedsAttention({
  stockHref,
  videosHref,
  daysHref,
}: {
  stockHref: string;
  videosHref: string;
  daysHref: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [carsWithoutVideo, setCarsWithoutVideo] = useState(0);
  const [agedOver90, setAgedOver90] = useState(0);
  const [stillToSell, setStillToSell] = useState(0);
  const [next90Label, setNext90Label] = useState('');

  const load = useCallback(async () => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    try {
      const [stockRes, videoRes, saleRes] = await Promise.all([
        fetch('/api/autotrader/stock', { headers }),
        fetch('/api/videos?all=true', { headers }),
        fetch('/api/sale-window', { headers }),
      ]);
      const stockData = await stockRes.json();
      const videoData = await videoRes.json();
      const saleData = await saleRes.json();
      const stock: StockRow[] = stockData.results || [];
      const videos: VideoRow[] = (Array.isArray(videoData) ? videoData : videoData.videos || []).filter((video: VideoRow) => !video.deletedAt && Boolean(video.videoUrl || video.cloudflareVideoId || video.youtubeVideoId));
      const sales: SaleVehicle[] = Array.isArray(saleData.vehicles) ? saleData.vehicles : [];

      const stockRegs = new Set(stock.map((item) => (item.vehicle?.registration || '').replace(/\s/g, '').toUpperCase()).filter(Boolean));
      const videoRegs = new Set(videos.map((video) => (video.registration || '').replace(/\s/g, '').toUpperCase()).filter(Boolean));
      setCarsWithoutVideo(stock.filter((item) => {
        const reg = (item.vehicle?.registration || '').replace(/\s/g, '').toUpperCase();
        return !reg || !videoRegs.has(reg);
      }).length);
      setAgedOver90(videos.filter((video) => {
        const reg = (video.registration || '').replace(/\s/g, '').toUpperCase();
        const sold = Boolean(reg && stockRegs.size > 0 && !stockRegs.has(reg));
        if (sold) return false;
        const days = Math.floor((Date.now() - new Date(video.createdAt).getTime()) / 86400000);
        return days > 90;
      }).length);

      const unsoldStock = sales.filter((vehicle) => !vehicle.soldAt && vehicle.vehicleType !== 'Demo');
      setStillToSell(unsoldStock.length);
      if (!unsoldStock.length) {
        setNext90Label('');
        return;
      }
      const next90 = Math.min(...unsoldStock.map((vehicle) => vehicle.daysTo90));
      setNext90Label(
        next90 < 0
          ? `${Math.abs(next90)} ${Math.abs(next90) === 1 ? 'day' : 'days'} over`
          : next90 === 0
            ? 'Due today'
            : `${next90} ${next90 === 1 ? 'day' : 'days'} left`
      );
    } catch (error) {
      console.error('Failed to load needs attention', error);
    }
  }, [user?.token]);

  useEffect(() => {
    load();
  }, [load]);

  if (carsWithoutVideo === 0 && agedOver90 === 0 && stillToSell === 0) return null;

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-3 border-b border-[#EEF1F5] px-4 py-3">
        <span className="h-8 w-1 shrink-0 rounded-full bg-[#0B3D73]" />
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold leading-5 text-[#0F172A]">
            <FaExclamationTriangle className="text-[#92400E]" size={14} />
            Needs attention
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">Items that need a look</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
        {carsWithoutVideo > 0 && (
          <button type="button" onClick={() => router.push(stockHref)} className={boxClass}>
            <span>
              <span className="block text-sm font-semibold text-[#0F172A]">{carsWithoutVideo} {carsWithoutVideo === 1 ? 'car has' : 'cars have'} no video</span>
              <span className="mt-0.5 block text-xs text-[#64748B]">Upload from Browse vehicles</span>
            </span>
            <span className="shrink-0"><Badge tone="amber">Stock</Badge></span>
          </button>
        )}
        {agedOver90 > 0 && (
          <button type="button" onClick={() => router.push(videosHref)} className={boxClass}>
            <span>
              <span className="block text-sm font-semibold text-[#0F172A]">{agedOver90} {agedOver90 === 1 ? 'video' : 'videos'} older than 90 days</span>
              <span className="mt-0.5 block text-xs text-[#64748B]">Still in stock, refresh or reshare</span>
            </span>
            <span className="shrink-0"><Badge tone="red">Aged</Badge></span>
          </button>
        )}
        {stillToSell > 0 && next90Label && (
          <button type="button" onClick={() => router.push(daysHref)} className={boxClass}>
            <span>
              <span className="block text-sm font-semibold text-[#0F172A]">Next Changan 90-day mark</span>
              <span className="mt-0.5 block text-xs text-[#64748B]">{next90Label} · {stillToSell} still to sell</span>
            </span>
            <span className="shrink-0"><Badge tone="grey">Changan</Badge></span>
          </button>
        )}
      </div>
    </Card>
  );
}
