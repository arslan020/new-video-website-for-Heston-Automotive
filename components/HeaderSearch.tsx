'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FaSearch, FaCar, FaUser, FaVideo } from 'react-icons/fa';

type Hit = {
  key: string;
  kind: 'Vehicle' | 'Customer' | 'Video';
  title: string;
  detail: string;
  href: string;
};

type StockRow = {
  vehicle?: { registration?: string; make?: string; model?: string; derivative?: string; vin?: string };
  registration?: string;
  make?: string;
  model?: string;
  derivative?: string;
};

type VideoRow = {
  _id: string;
  title?: string;
  registration?: string;
  make?: string;
  model?: string;
  deletedAt?: string;
  views?: { viewerName?: string; viewerEmail?: string; viewerMobile?: string }[];
};

type TrackingRow = {
  stockId: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  make?: string;
  model?: string;
  registration?: string;
  vin?: string;
};

function textOf(...parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function matches(query: string, ...parts: Array<string | undefined | null>) {
  const q = query.trim().toLowerCase();
  const compactQ = q.replace(/\s/g, '');
  const text = textOf(...parts);
  if (!q || !text) return false;
  return text.includes(q) || text.replace(/\s/g, '').includes(compactQ);
}

export default function HeaderSearch() {
  const { user } = useAuth();
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<{ stock: StockRow[]; videos: VideoRow[]; tracking: TrackingRow[] } | null>(null);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);

  const stockPath = user?.role === 'admin' ? '/admin/stock' : '/staff/stock';
  const changanPath = user?.role === 'admin' ? '/admin/changan' : '/staff/changan';
  const viewsPath = user?.role === 'admin' ? '/admin/views' : '/staff/views';
  const canSeeViews = user?.role === 'admin' || user?.canViewCustomerViews !== false;

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || !user?.token) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (!cacheRef.current) {
        setLoading(true);
        const headers = { Authorization: `Bearer ${user.token}` };
        const [stockRes, videoRes, trackRes] = await Promise.all([
          fetch('/api/autotrader/stock', { headers }),
          fetch('/api/videos?all=true', { headers }),
          fetch('/api/vehicle-tracking', { headers }),
        ]);
        const stockData = await stockRes.json().catch(() => ({}));
        const videoData = await videoRes.json().catch(() => ({}));
        const trackData = await trackRes.json().catch(() => []);
        if (cancelled) return;
        cacheRef.current = {
          stock: Array.isArray(stockData) ? stockData : stockData.results || stockData.stock || [],
          videos: Array.isArray(videoData) ? videoData : videoData.videos || [],
          tracking: Array.isArray(trackData) ? trackData : [],
        };
        setLoading(false);
      }
      if (cancelled || !cacheRef.current) return;

      const next: Hit[] = [];
      const seen = new Set<string>();
      const add = (hit: Hit) => {
        if (seen.has(hit.key) || next.filter((item) => item.kind === hit.kind).length >= 5) return;
        seen.add(hit.key);
        next.push(hit);
      };

      cacheRef.current.stock.forEach((item, index) => {
        const vehicle = item.vehicle || item;
        const reg = vehicle.registration || '';
        const make = vehicle.make || '';
        const model = vehicle.model || '';
        if (!matches(query, reg, make, model, vehicle.derivative, vehicle.vin)) return;
        const label = `${make} ${model}`.trim() || 'Vehicle';
        add({
          key: `stock-${reg || index}`,
          kind: 'Vehicle',
          title: label,
          detail: reg || vehicle.derivative || 'In stock',
          href: `${stockPath}?q=${encodeURIComponent(reg || make || query)}`,
        });
      });

      cacheRef.current.tracking.forEach((order) => {
        if (!matches(query, order.customerName, order.customerEmail, order.customerMobile, order.registration, order.make, order.model, order.vin)) return;
        const name = order.customerName || order.customerEmail || order.customerMobile || 'Customer';
        add({
          key: `order-${order.stockId}`,
          kind: 'Customer',
          title: name,
          detail: [order.make, order.model, order.registration].filter(Boolean).join(' ') || 'Changan order',
          href: `${changanPath}?q=${encodeURIComponent(order.customerName || order.registration || query)}`,
        });
      });

      cacheRef.current.videos.forEach((video) => {
        if (video.deletedAt) return;
        if (matches(query, video.registration, video.make, video.model, video.title)) {
          add({
            key: `video-${video._id}`,
            kind: 'Video',
            title: `${video.make || ''} ${video.model || ''}`.trim() || video.title || 'Video',
            detail: video.registration || video.title || 'Uploaded video',
            href: `/staff/videos?q=${encodeURIComponent(video.registration || video.make || query)}`,
          });
        }
        if (!canSeeViews) return;
        (video.views || []).forEach((view, index) => {
          if (!matches(query, view.viewerName, view.viewerEmail, view.viewerMobile)) return;
          const name = view.viewerName || view.viewerEmail || view.viewerMobile || 'Customer';
          add({
            key: `view-${video._id}-${index}-${name}`,
            kind: 'Customer',
            title: name,
            detail: [video.make, video.model, video.registration].filter(Boolean).join(' ') || 'Customer view',
            href: `${viewsPath}?q=${encodeURIComponent(view.viewerName || view.viewerEmail || query)}`,
          });
        });
      });

      setHits(next.sort((a, b) => {
        const order = { Vehicle: 0, Customer: 1, Video: 2 };
        return order[a.kind] - order[b.kind];
      }));
      setActive(0);
    };

    run().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [value, user?.token, stockPath, changanPath, viewsPath, canSeeViews]);

  const go = (hit: Hit) => {
    setOpen(false);
    router.push(hit.href);
  };

  const grouped = (['Vehicle', 'Customer', 'Video'] as const)
    .map((kind) => ({ kind, items: hits.filter((hit) => hit.kind === kind) }))
    .filter((group) => group.items.length > 0);

  let cursor = -1;

  return (
    <div ref={boxRef} className="relative hidden min-w-0 flex-1 sm:block">
      <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" size={14} />
      <input
        type="search"
        value={value}
        placeholder="Search by reg, make or customer"
        aria-label="Search by reg, make or customer"
        aria-expanded={open}
        className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#0B3D73] focus:outline-none"
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (!open || hits.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % hits.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index - 1 + hits.length) % hits.length);
          } else if (event.key === 'Enter' && hits[active]) {
            event.preventDefault();
            go(hits[active]);
          }
        }}
      />
      {open && value.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-2 shadow-lg">
          {loading && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#64748B]">Searching...</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#64748B]">No matches for &quot;{value.trim()}&quot;</p>
          ) : grouped.map((group) => (
            <div key={group.kind} className="py-1">
              <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{group.kind}s</p>
              {group.items.map((hit) => {
                cursor += 1;
                const index = cursor;
                const Icon = hit.kind === 'Customer' ? FaUser : hit.kind === 'Video' ? FaVideo : FaCar;
                return (
                  <button
                    key={hit.key}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(hit)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${index === active ? 'bg-[#EAF0F7]' : 'hover:bg-[#F5F6F8]'}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F6F8] text-[#0B3D73]">
                      <Icon size={12} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#0F172A]">{hit.title}</span>
                      <span className="block truncate text-xs text-[#64748B]">{hit.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
