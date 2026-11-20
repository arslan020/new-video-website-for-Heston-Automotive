'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { PageTitle } from '@/components/ui/PageTitle';
import { startCloudflareUpload } from '@/lib/cloudflareUploadClient';
import { brandLogoUrl } from '@/lib/brandLogo';
import type { MotorDeskStockVehicle } from '@/lib/motordesk';
import { FaTimes, FaCheck, FaCar, FaExternalLinkAlt, FaPaperPlane, FaCloudUploadAlt, FaGasPump, FaCog, FaPalette } from 'react-icons/fa';
import MotorDeskCustomerSearch from '@/components/MotorDeskCustomerSearch';
import UKPhoneInput from '@/components/UKPhoneInput';

type Mode = 'stock' | 'sold';
const PAGE_SIZE = 20;

function regKey(value: string) {
  return value.replace(/\s/g, '').toUpperCase();
}

function isLiveVideo(video: { deletedAt?: string; videoUrl?: string; cloudflareVideoId?: string; youtubeVideoId?: string }) {
  return !video.deletedAt && Boolean(video.videoUrl || video.cloudflareVideoId || video.youtubeVideoId);
}

function indexVideos(videos: LinkedVideo[]) {
  const linked: Record<string, LinkedVideo> = {};
  for (const video of videos) {
    if (!isLiveVideo(video)) continue;
    const reg = regKey(String(video.registration || ''));
    if (reg && !linked[reg]) linked[reg] = video;
  }
  return linked;
}

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

function Thumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex h-14 w-20 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
        <FaCar size={18} />
      </span>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className="h-14 w-20 rounded-lg object-cover" />;
}

function statusClass(status: string) {
  if (status === 'for-sale') return 'bg-green-600';
  if (status === 'reserved') return 'bg-amber-500';
  if (status === 'sold') return 'bg-sky-600';
  return 'bg-slate-500';
}

export default function MotorDeskStockContent({ mode = 'stock', embedded = false }: { mode?: Mode; embedded?: boolean }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<MotorDeskStockVehicle[]>([]);
  const [videosByReg, setVideosByReg] = useState<Record<string, LinkedVideo>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MotorDeskStockVehicle | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [sendVideo, setSendVideo] = useState<LinkedVideo | null>(null);
  const [sendForm, setSendForm] = useState({ title: 'Mr', name: '', email: '', mobile: '' });
  const [sending, setSending] = useState(false);
  const pendingUid = useRef<string | null>(null);
  const uploadRef = useRef<{ abort: () => void } | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [stockRes, videoRes] = await Promise.all([
        fetch('/api/motordesk/vehicles', { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch('/api/videos?all=true', { headers: { Authorization: `Bearer ${user.token}` } }),
      ]);
      const stockData = await stockRes.json();
      if (!stockRes.ok) throw new Error(stockData.message || 'Could not load Motor Desk stock');
      setVehicles(mode === 'sold' ? stockData.sold || [] : stockData.stock || []);
      const videos = await videoRes.json();
      setVideosByReg(indexVideos(Array.isArray(videos) ? videos : videos.videos || []));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load Motor Desk stock', 'error');
    } finally {
      setLoading(false);
    }
  }, [mode, showToast, user?.token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.token) return;
    const refreshVideos = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/videos?all=true', { headers: { Authorization: `Bearer ${user.token}` } })
        .then((response) => response.json())
        .then((videos) => setVideosByReg(indexVideos(Array.isArray(videos) ? videos : videos.videos || [])))
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', refreshVideos);
    return () => document.removeEventListener('visibilitychange', refreshVideos);
  }, [user?.token]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) =>
      [vehicle.registration, vehicle.make, vehicle.model, vehicle.derivative, vehicle.vin]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [query, vehicles]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const sendLink = async () => {
    if (!sendVideo || sending) return;
    if (!sendForm.name.trim() || (!sendForm.email && !sendForm.mobile)) {
      showToast('Please enter customer name and email or mobile', 'error');
      return;
    }
    setSending(true);
    try {
      const refName = user?.name || user?.username || '';
      const payload: Record<string, unknown> = {
        videoLink: `${window.location.origin}/view/${sendVideo._id}?ref=${encodeURIComponent(refName)}`,
        customerName: sendForm.name,
        customerTitle: sendForm.title,
        vehicleDetails: {
          make: sendVideo.make,
          model: sendVideo.model,
          registration: sendVideo.registration,
        },
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
      setSendVideo(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to send video', 'error');
    } finally {
      setSending(false);
    }
  };

  const closeUpload = () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    if (pendingUid.current && user?.token) {
      fetch(`/api/videos/cloudflare/${pendingUid.current}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      }).catch(() => {});
      pendingUid.current = null;
    }
    setSelected(null);
    setFile(null);
    setDragging(false);
    setUploading(false);
    setProgress(0);
    setDone(false);
  };

  const upload = async () => {
    if (!selected || !file || !user?.token || uploading) return;
    setUploading(true);
    setProgress(0);
    try {
      const title = `${selected.make} ${selected.model} - ${selected.registration}`.trim();
      const handle = startCloudflareUpload({
        token: user.token,
        file,
        title,
        onProgress: setProgress,
        onReady: (uid) => { pendingUid.current = uid; },
      });
      uploadRef.current = handle;
      const uid = await handle.done;
      uploadRef.current = null;
      pendingUid.current = null;
      const saveRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cloudflareVideoId: uid,
          title,
          registration: selected.registration,
          make: selected.make,
          model: selected.model,
          mileage: selected.mileage == null ? undefined : String(selected.mileage),
          originalName: file.name,
          vehicleDetails: {
            registration: selected.registration,
            make: selected.make,
            model: selected.model,
            derivative: selected.derivative,
            fuelType: selected.fuelType,
            transmissionType: selected.transmissionType,
            colour: selected.colour,
            odometerReadingMiles: selected.mileage,
            vin: selected.vin,
            provider: 'MotorDesk',
          },
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save video');
      const saved = await saveRes.json();
      setDone(true);
      setVideosByReg((current) => ({
        ...current,
        [regKey(selected.registration)]: {
          _id: String(saved._id || ''),
          title,
          make: selected.make,
          model: selected.model,
          registration: selected.registration,
        },
      }));
      showToast('Video uploaded', 'success');
      setTimeout(() => {
        setSelected(null);
        setFile(null);
        setDone(false);
        setProgress(0);
      }, 1500);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Upload cancelled') {
        showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={embedded ? '' : 'p-4 sm:p-6 lg:p-8'}>
      {embedded ? null : (
        <div className="mb-6">
          <PageTitle title="Motor Desk stock">
            Stock from Motor Desk. Upload a video here and it appears in My Videos. A car marked sold in Motor Desk moves to Sold.
          </PageTitle>
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="Search registration, make or model"
          className="h-11 w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#0B3D73]"
        />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading Motor Desk stock...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">{mode === 'sold' ? 'No Motor Desk vehicles are sold' : 'No Motor Desk stock'}</p>
        ) : (
          <>
          <div className="space-y-3 p-3 lg:hidden">
            {visible.map((vehicle) => {
              const linked = videosByReg[regKey(vehicle.registration)];
              const details = [vehicle.fuelType, vehicle.transmissionType, vehicle.colour, vehicle.mileage == null ? '' : `${vehicle.mileage.toLocaleString('en-GB')} miles`].filter(Boolean).join(' · ');
              return (
                <article key={vehicle.id} className={`rounded-xl border p-3 ${linked ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <Thumb src={vehicle.image} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{vehicle.make} {vehicle.model}</p>
                      <p className="truncate text-xs text-gray-500">{vehicle.derivative}</p>
                      <p className="mt-1 text-sm font-semibold">{vehicle.registration || '-'}</p>
                      {linked ? <span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">1 Video</span> : null}
                    </div>
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize text-white ${statusClass(vehicle.status)}`}>{vehicle.status.replace('-', ' ')}</span>
                  </div>
                  {details ? <p className="mt-2 text-xs text-gray-500">{details}</p> : null}
                  <div className="mt-3">
                    {linked?._id ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => window.open(`${window.location.origin}/view/${linked._id}`, '_blank')} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white text-sm font-medium"><FaExternalLinkAlt size={10} /> View</button>
                        <button type="button" onClick={() => { setSendVideo(linked); setSendForm({ title: 'Mr', name: '', email: '', mobile: '' }); }} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[#0B3D73] text-sm font-medium text-white"><FaPaperPlane size={10} /> Send</button>
                      </div>
                    ) : mode === 'stock' ? (
                      <button type="button" onClick={() => { setSelected(vehicle); setFile(null); setDone(false); setProgress(0); }} className="h-11 w-full rounded-lg bg-[#0B3D73] text-sm font-medium text-white">Upload video</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Photo</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Registration</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((vehicle) => {
                  const linked = videosByReg[regKey(vehicle.registration)];
                  return (
                  <tr key={vehicle.id} className={`border-t border-gray-100 ${linked ? 'bg-emerald-50 hover:bg-emerald-50' : 'bg-white'}`}>
                    <td className="px-4 py-3">
                      <Thumb src={vehicle.image} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{vehicle.make} {vehicle.model}</p>
                      <p className="text-xs text-gray-500">{vehicle.derivative}</p>
                      {linked ? (
                        <span className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">1 Video</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium">{vehicle.registration || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {[vehicle.fuelType, vehicle.transmissionType, vehicle.colour, vehicle.mileage == null ? '' : `${vehicle.mileage.toLocaleString('en-GB')} miles`]
                        .filter(Boolean)
                        .join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize text-white ${statusClass(vehicle.status)}`}>
                        {vehicle.status.replace('-', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {linked?._id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => window.open(`${window.location.origin}/view/${linked._id}`, '_blank')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A]"
                          >
                            <FaExternalLinkAlt size={10} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSendVideo(linked);
                              setSendForm({ title: 'Mr', name: '', email: '', mobile: '' });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3D73] px-3 py-1.5 text-xs font-medium text-white"
                          >
                            <FaPaperPlane size={10} /> Send
                          </button>
                        </div>
                      ) : mode === 'stock' ? (
                        <button
                          type="button"
                          onClick={() => { setSelected(vehicle); setFile(null); setDone(false); setProgress(0); }}
                          className="rounded-lg bg-[#0B3D73] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#072A50]"
                        >
                          Upload video
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
        {!loading && rows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <span>{(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length}</span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="h-11 rounded-lg border border-[#E2E8F0] px-3 disabled:opacity-40 sm:h-9">Previous</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} className="h-11 rounded-lg border border-[#E2E8F0] px-3 disabled:opacity-40 sm:h-9">Next</button>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {brandLogoUrl(selected.make) ? (
                  <img src={brandLogoUrl(selected.make)} alt={selected.make} className="w-10 h-10 object-contain" onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                <div>
                  <h3 className="font-bold text-gray-800 text-base leading-tight">Upload Video</h3>
                  <p className="text-xs text-gray-400">{selected.make} {selected.model}</p>
                </div>
              </div>
              <button type="button" onClick={closeUpload} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <FaTimes size={14} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {done ? (
                <div className="text-center py-14 px-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCheck className="text-green-500" size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Upload Complete!</h3>
                  <p className="text-sm text-gray-500">{selected.make} {selected.model}, {selected.registration}</p>
                </div>
              ) : (
                <div className="p-8 space-y-5">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 flex items-center gap-5">
                    {brandLogoUrl(selected.make) ? (
                      <img src={brandLogoUrl(selected.make)} alt={selected.make} className="w-28 h-28 object-contain flex-shrink-0" onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0B3D73]">
                        <FaCar size={22} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-gray-900 text-lg">{selected.make} {selected.model}</span>
                        {selected.registration ? <span className="bg-yellow-400 text-black text-sm font-bold px-3 py-1 rounded border border-yellow-600 tracking-wide">{selected.registration}</span> : null}
                      </div>
                      {selected.derivative ? <p className="text-sm text-gray-500 mt-1 truncate">{selected.derivative}</p> : null}
                      <div className="flex gap-4 mt-2 flex-wrap">
                        {selected.fuelType ? <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaGasPump size={11} className="text-gray-400" />{selected.fuelType}</span> : null}
                        {selected.transmissionType ? <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaCog size={11} className="text-gray-400" />{selected.transmissionType}</span> : null}
                        {selected.colour ? <span className="inline-flex items-center gap-1.5 text-sm text-gray-500"><FaPalette size={11} className="text-gray-400" />{selected.colour}</span> : null}
                      </div>
                    </div>
                  </div>

                  {uploading ? (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse inline-block" />
                          <span className="text-sm font-medium text-gray-700">Uploading video...</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div className="h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)' }} />
                      </div>
                      <p className="text-xs text-gray-400 text-center">Do not close this tab until the upload finishes</p>
                    </div>
                  ) : null}

                  <div
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      const dropped = event.dataTransfer.files?.[0];
                      if (dropped) setFile(dropped);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                  >
                    <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                    {file ? (
                      <>
                        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FaCheck className="text-green-500" size={22} />
                        </div>
                        <p className="font-semibold text-green-700 text-base">{file.name}</p>
                        <p className="text-sm text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(1)} MB · Click to change</p>
                      </>
                    ) : (
                      <>
                        <FaCloudUploadAlt className="mx-auto mb-3 text-gray-300" size={48} />
                        <p className="text-base font-medium text-gray-600">Drop video here or <span className="text-blue-500">browse</span></p>
                        <p className="text-sm text-gray-400 mt-1">MP4, MOV, AVI, up to 3GB</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {!done ? (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={closeUpload} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="button" onClick={upload} disabled={!file || uploading} className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 flex items-center gap-2">
                  {uploading ? 'Uploading...' : <><FaCloudUploadAlt size={13} /> Start Upload</>}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {sendVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/40 p-4 backdrop-blur-md">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B3D73]">Send</p>
                <h3 className="text-base font-semibold text-[#0F172A]">Send video link</h3>
                <p className="text-sm text-gray-500">{sendVideo.registration}</p>
              </div>
              <button type="button" onClick={() => setSendVideo(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] text-slate-500">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="space-y-4">
              <MotorDeskCustomerSearch
                token={user?.token}
                onSelect={(customer) => setSendForm({
                  title: customer.title || 'Mr',
                  name: customer.name,
                  email: customer.email,
                  mobile: customer.mobile,
                })}
              />
              <div className="grid grid-cols-4 gap-3">
                <label className="text-sm text-gray-700">
                  Title
                  <select value={sendForm.title} onChange={(event) => setSendForm((current) => ({ ...current, title: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-2">
                    <option>Mr</option>
                    <option>Mrs</option>
                    <option>Miss</option>
                    <option>Ms</option>
                    <option>Dr</option>
                  </select>
                </label>
                <label className="col-span-3 text-sm text-gray-700">
                  Customer name
                  <input value={sendForm.name} onChange={(event) => setSendForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3" />
                </label>
              </div>
              <label className="block text-sm text-gray-700">
                Email
                <input type="email" value={sendForm.email} onChange={(event) => setSendForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3" />
              </label>
              <label className="block text-sm text-gray-700">
                Mobile
                <div className="mt-1">
                  <UKPhoneInput value={sendForm.mobile} onChange={(value) => setSendForm((current) => ({ ...current, mobile: value }))} />
                </div>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSendVideo(null)} className="h-10 rounded-lg border border-[#E2E8F0] px-4 text-sm font-medium text-gray-600">Cancel</button>
                <button type="button" onClick={sendLink} disabled={sending || (!sendForm.email && !sendForm.mobile)} className="h-10 rounded-lg bg-[#0B3D73] px-4 text-sm font-medium text-white disabled:opacity-50">
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
