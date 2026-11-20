'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { PageTitle } from '@/components/ui/PageTitle';
import UKPhoneInput from '@/components/UKPhoneInput';
import { brandLogoUrl } from '@/lib/brandLogo';
import type { MotorDeskLead } from '@/lib/motordesk';
import { FaCar, FaEnvelope, FaPaperPlane, FaPhone, FaSearch, FaTimes } from 'react-icons/fa';

type LinkedVideo = {
  _id: string;
  title?: string;
  make?: string;
  model?: string;
  registration?: string;
  deletedAt?: string;
  videoUrl?: string;
  cloudflareVideoId?: string;
  youtubeVideoId?: string;
};

type SendState = {
  lead: MotorDeskLead;
  videoId: string;
  title: string;
  name: string;
  email: string;
  mobile: string;
};

const PAGE_SIZE = 20;

function regKey(value: string) {
  return value.replace(/\s/g, '').toUpperCase();
}

function isLiveVideo(video: LinkedVideo) {
  return !video.deletedAt && Boolean(video.videoUrl || video.cloudflareVideoId || video.youtubeVideoId);
}

function indexVideos(videos: LinkedVideo[]) {
  const byReg: Record<string, LinkedVideo> = {};
  const untitled: LinkedVideo[] = [];
  for (const video of videos) {
    if (!isLiveVideo(video)) continue;
    const reg = regKey(String(video.registration || ''));
    if (reg) {
      if (!byReg[reg]) byReg[reg] = video;
    } else {
      untitled.push(video);
    }
  }
  return { byReg, untitled };
}

function videoFor(registration: string, byReg: Record<string, LinkedVideo>, untitled: LinkedVideo[]) {
  const reg = regKey(registration);
  if (!reg) return null;
  if (byReg[reg]) return byReg[reg];
  if (reg.length < 5) return null;
  return untitled.find((video) => regKey(video.title || '').includes(reg)) || null;
}

function when(created: number) {
  if (!created) return '';
  return new Date(created * 1000).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusClass(status: string) {
  if (status === 'new' || status === 'new_message') return 'bg-[#0B3D73]';
  if (status === 'replied') return 'bg-emerald-600';
  if (status === 'closed') return 'bg-slate-400';
  return 'bg-slate-500';
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function customerName(lead: MotorDeskLead) {
  return [lead.title, lead.name].filter(Boolean).join(' ') || 'Customer';
}

function phoneLabel(mobile: string) {
  if (!mobile) return '';
  const digits = mobile.startsWith('0') ? mobile : `0${mobile}`;
  if (digits.length === 11) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function CarThumb({ image, make }: { image: string; make: string }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = brandLogoUrl(make);
  const showPhoto = Boolean(image) && !photoFailed;
  return (
    <span className={`flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg ${showPhoto ? 'bg-slate-100' : 'border border-[#E2E8F0] bg-white'}`}>
      {showPhoto ? (
        <img src={image} alt="" className="h-full w-full object-cover" onError={() => setPhotoFailed(true)} />
      ) : logo && !logoFailed ? (
        <img src={logo} alt="" className="h-8 w-8 object-contain" onError={() => setLogoFailed(true)} />
      ) : (
        <FaCar className="text-[#0B3D73]" size={16} />
      )}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize leading-none text-white ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function VideoPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      1 Video
    </span>
  );
}

function Plate({ registration }: { registration: string }) {
  if (!registration) return null;
  return (
    <span className="inline-flex rounded border border-yellow-600 bg-yellow-400 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-black">
      {registration}
    </span>
  );
}

function SendButton({ onClick, wide = false }: { onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B3D73] text-sm font-semibold text-white hover:bg-[#072A50] ${wide ? 'h-11 w-full' : 'h-9 px-3 text-xs'}`}
    >
      <FaPaperPlane size={11} /> Send
    </button>
  );
}

export default function LeadsContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<MotorDeskLead[]>([]);
  const [videos, setVideos] = useState<{ byReg: Record<string, LinkedVideo>; untitled: LinkedVideo[] }>({ byReg: {}, untitled: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [missingVideo, setMissingVideo] = useState(false);
  const [send, setSend] = useState<SendState | null>(null);
  const [sending, setSending] = useState(false);

  const loadVideos = useCallback(async (token: string) => {
    const response = await fetch('/api/videos?all=true', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    setVideos(indexVideos(Array.isArray(data) ? data : data.videos || []));
  }, []);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError('');
    try {
      const [leadRes] = await Promise.all([
        fetch('/api/motordesk/leads', { headers: { Authorization: `Bearer ${user.token}` } }),
        loadVideos(user.token),
      ]);
      const data = await leadRes.json();
      if (!leadRes.ok) throw new Error(data.message || 'Could not load leads');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load leads';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [loadVideos, showToast, user?.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.token) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') loadVideos(user.token).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, [loadVideos, user?.token]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.email, lead.mobile, lead.registration, lead.make, lead.model, lead.summary]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [leads, query]);

  const readyCount = useMemo(
    () => leads.filter((lead) => videoFor(lead.registration, videos.byReg, videos.untitled)).length,
    [leads, videos]
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openSend = (lead: MotorDeskLead) => {
    const video = videoFor(lead.registration, videos.byReg, videos.untitled);
    if (!video?._id) {
      setMissingVideo(true);
      return;
    }
    setSend({
      lead,
      videoId: video._id,
      title: lead.title || 'Mr',
      name: lead.name,
      email: lead.email,
      mobile: lead.mobile,
    });
  };

  const sendLink = async () => {
    if (!send || sending) return;
    if (!send.name.trim() || (!send.email && !send.mobile)) {
      showToast('This lead has no email or mobile', 'error');
      return;
    }
    setSending(true);
    try {
      const refName = user?.name || user?.username || '';
      const payload: Record<string, unknown> = {
        videoLink: `${window.location.origin}/view/${send.videoId}?ref=${encodeURIComponent(refName)}`,
        customerName: send.name,
        customerTitle: send.title,
        vehicleDetails: {
          make: send.lead.make,
          model: send.lead.model,
          registration: send.lead.registration,
        },
      };
      if (send.email) payload.email = send.email;
      if (send.mobile) payload.mobile = send.mobile.replace(/\D/g, '');
      const res = await fetch('/api/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string; message?: string }).error || (data as { message?: string }).message || 'Failed to send link');
      showToast('Video link sent successfully!', 'success');
      setSend(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send video', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageTitle title="Leads">
        Latest Motor Desk leads, with the customer and the car they asked about.
      </PageTitle>

      {!loading && !error ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 sm:px-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">Leads</p>
            <p className="mt-1 text-xl font-semibold text-[#0F172A] sm:text-2xl">{leads.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 sm:px-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Ready</p>
            <p className="mt-1 text-xl font-semibold text-emerald-800 sm:text-2xl">{readyCount}</p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 sm:px-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">No video</p>
            <p className="mt-1 text-xl font-semibold text-[#0F172A] sm:text-2xl">{Math.max(0, leads.length - readyCount)}</p>
          </div>
        </div>
      ) : null}

      <div className="relative mt-4 w-full sm:max-w-md">
        <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="Search customer, registration or car"
          className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-3 text-base text-[#0F172A] outline-none focus:border-[#0B3D73] sm:text-sm"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-sm text-[#64748B]">Loading leads...</p>
        ) : error ? (
          <p className="p-8 text-center text-sm font-medium text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#64748B]">{query ? 'No leads match that search' : 'No leads'}</p>
        ) : (
          <>
            <div className="space-y-3 p-3 lg:hidden">
              {visible.map((lead) => {
                const linked = videoFor(lead.registration, videos.byReg, videos.untitled);
                const name = customerName(lead);
                const note = lead.summary || lead.message;
                return (
                  <article key={lead.id} className={`rounded-xl border p-4 ${linked ? 'border-emerald-200 bg-emerald-50' : 'border-[#E2E8F0] bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF0F7] text-sm font-semibold text-[#0B3D73]">
                        {initial(lead.name || name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold text-[#0F172A]">{name}</p>
                          <StatusPill status={lead.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-[#64748B]">{when(lead.created)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <CarThumb image={lead.image} make={lead.make} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#0F172A]">{[lead.make, lead.model].filter(Boolean).join(' ') || 'No car on this lead'}</p>
                        {lead.derivative ? <p className="truncate text-xs text-[#64748B]">{lead.derivative}</p> : null}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Plate registration={lead.registration} />
                          {linked ? <VideoPill /> : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-sm text-[#475569]">
                      <p className="flex items-center gap-2 break-all">
                        <FaEnvelope className="shrink-0 text-slate-400" size={12} />
                        {lead.email || 'No email'}
                      </p>
                      <p className="flex items-center gap-2">
                        <FaPhone className="shrink-0 text-slate-400" size={12} />
                        {phoneLabel(lead.mobile) || 'No mobile'}
                      </p>
                    </div>
                    {note ? <p className="mt-2 line-clamp-2 text-sm text-[#475569]">{note}</p> : null}
                    <div className="mt-3">
                      <SendButton wide onClick={() => openSend(lead)} />
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Car</th>
                    <th className="px-5 py-3 font-semibold">Lead</th>
                    <th className="px-5 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => {
                    const linked = videoFor(lead.registration, videos.byReg, videos.untitled);
                    const name = customerName(lead);
                    const note = lead.summary || lead.message;
                    return (
                      <tr key={lead.id} className={`border-t border-[#E2E8F0] ${linked ? 'bg-emerald-50' : 'bg-white'}`}>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF0F7] text-sm font-semibold text-[#0B3D73]">
                              {initial(lead.name || name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0F172A]">{name}</p>
                              <p className="mt-1 flex items-center gap-2 break-all text-xs text-[#64748B]">
                                <FaEnvelope size={11} className="shrink-0" /> {lead.email || 'No email'}
                              </p>
                              <p className="mt-0.5 flex items-center gap-2 text-xs text-[#64748B]">
                                <FaPhone size={11} className="shrink-0" /> {phoneLabel(lead.mobile) || 'No mobile'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <CarThumb image={lead.image} make={lead.make} />
                            <div className="min-w-0">
                              <p className="font-medium text-[#0F172A]">{[lead.make, lead.model].filter(Boolean).join(' ') || 'No car on this lead'}</p>
                              {lead.derivative ? <p className="mt-0.5 max-w-xs truncate text-xs text-[#64748B]">{lead.derivative}</p> : null}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Plate registration={lead.registration} />
                                {linked ? <VideoPill /> : null}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StatusPill status={lead.status} />
                          <p className="mt-2 text-xs text-[#64748B]">{when(lead.created)}</p>
                          {note ? <p className="mt-1 max-w-xs text-xs leading-5 text-[#475569]">{note}</p> : null}
                        </td>
                        <td className="px-5 py-4 text-right align-top">
                          <SendButton onClick={() => openSend(lead)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && !error && rows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E2E8F0] px-4 py-3 text-sm text-[#475569] sm:flex-row sm:items-center sm:justify-between">
            <span>{(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="h-11 rounded-lg border border-[#E2E8F0] px-3 disabled:opacity-40 sm:h-9">Previous</button>
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} className="h-11 rounded-lg border border-[#E2E8F0] px-3 disabled:opacity-40 sm:h-9">Next</button>
            </div>
          </div>
        ) : null}
      </div>

      {missingVideo ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="w-full rounded-t-2xl bg-white p-6 text-center shadow-2xl sm:max-w-sm sm:rounded-2xl">
            <p className="text-lg font-semibold text-red-600">Upload video first</p>
            <button type="button" onClick={() => setMissingVideo(false)} className="mt-5 h-11 w-full rounded-lg bg-red-600 text-sm font-semibold text-white sm:w-auto sm:px-6">OK</button>
          </div>
        </div>
      ) : null}

      {send ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#0F172A]">Send video link</h3>
                <p className="truncate text-sm text-[#64748B]">{[send.lead.make, send.lead.model, send.lead.registration].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => setSend(null)} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] text-slate-500">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <label className="text-sm text-gray-700">
                  Title
                  <select value={send.title} onChange={(event) => setSend({ ...send, title: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-2 text-base sm:text-sm">
                    <option>Mr</option>
                    <option>Mrs</option>
                    <option>Miss</option>
                    <option>Ms</option>
                    <option>Dr</option>
                  </select>
                </label>
                <label className="col-span-3 text-sm text-gray-700">
                  Customer name
                  <input value={send.name} onChange={(event) => setSend({ ...send, name: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-base sm:text-sm" />
                </label>
              </div>
              <label className="block text-sm text-gray-700">
                Email
                <input type="email" value={send.email} onChange={(event) => setSend({ ...send, email: event.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-base sm:text-sm" />
              </label>
              <label className="block text-sm text-gray-700">
                Mobile
                <div className="mt-1">
                  <UKPhoneInput value={send.mobile} onChange={(value) => setSend({ ...send, mobile: value })} />
                </div>
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSend(null)} className="h-11 rounded-lg border border-[#E2E8F0] px-4 text-sm font-medium text-gray-600">Cancel</button>
                <button type="button" onClick={sendLink} disabled={sending || (!send.email && !send.mobile)} className="h-11 rounded-lg bg-[#0B3D73] px-4 text-sm font-semibold text-white disabled:opacity-50">
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
