'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { startCloudflareUpload } from '@/lib/cloudflareUploadClient';
import {
  FaVideo, FaTimes, FaSearch, FaGasPump, FaCog, FaPalette, FaCalendar,
  FaCloudUploadAlt, FaCheck,
} from 'react-icons/fa';

export default function RegistrationUploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [lookupRegistration, setLookupRegistration] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [fetchedVehicle, setFetchedVehicle] = useState<any>(null);
  const [smartMileage, setSmartMileage] = useState('');
  const [smartReserveLink, setSmartReserveLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUidRef = useRef<string | null>(null);
  const uploadHandleRef = useRef<{ abort: () => void } | null>(null);

  const cleanupPending = () => {
    uploadHandleRef.current?.abort();
    uploadHandleRef.current = null;
    if (pendingUidRef.current) {
      fetch(`/api/videos/cloudflare/${pendingUidRef.current}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user?.token}` },
      }).catch(() => {});
      pendingUidRef.current = null;
    }
  };

  useEffect(() => () => { cleanupPending(); }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const close = () => {
    cleanupPending();
    onClose();
  };

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    if (!lookupRegistration.trim()) {
      showToast('Please enter registration', 'error');
      return;
    }
    setLookupLoading(true);
    setFetchedVehicle(null);
    try {
      const res = await fetch(`/api/autotrader/lookup/${lookupRegistration.replace(/\s/g, '')}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Lookup failed');
      if (!data.vehicle) {
        showToast('Vehicle not found', 'error');
        return;
      }
      setFetchedVehicle(data.vehicle);
      if (data.vehicle.odometerReadingMiles) setSmartMileage(String(data.vehicle.odometerReadingMiles));
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !fetchedVehicle || uploading) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const upload = startCloudflareUpload({
        token: user?.token || '',
        file: selectedFile,
        title: `${fetchedVehicle.make} ${fetchedVehicle.model} - ${fetchedVehicle.registration}`,
        onProgress: setUploadProgress,
        onReady: (uid) => {
          pendingUidRef.current = uid;
        },
      });
      uploadHandleRef.current = upload;
      const uid = await upload.done;
      uploadHandleRef.current = null;
      pendingUidRef.current = null;
      setUploadProgress(100);

      const saveRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          cloudflareVideoId: uid,
          title: `${fetchedVehicle.make} ${fetchedVehicle.model} - ${fetchedVehicle.registration}`,
          registration: fetchedVehicle.registration,
          make: fetchedVehicle.make,
          model: fetchedVehicle.model,
          vehicleDetails: fetchedVehicle,
          mileage: smartMileage,
          reserveCarLink: smartReserveLink,
          originalName: selectedFile.name,
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save video');

      setUploadSuccess(true);
      onUploaded?.();
      setTimeout(() => onClose(), 2500);
    } catch (err: any) {
      if (err.message !== 'Upload cancelled') showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const fieldClass = 'h-11 w-full rounded-xl border border-white/80 bg-white/70 px-3 text-sm text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#0B3D73] focus:bg-white focus:ring-2 focus:ring-[#0B3D73]/15';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/40 p-4 backdrop-blur-md">
      <div className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-[0_30px_80px_-30px_rgba(11,61,115,0.55)] backdrop-blur-xl animate-fade-in ${fetchedVehicle ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/70 bg-white/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white/70 text-[#0B3D73] shadow-sm">
              <FaVideo size={15} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0B3D73]">Videos</p>
              <h3 className="text-base font-semibold text-[#0F172A]">Find vehicle and upload</h3>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/60 text-slate-500 transition hover:bg-white hover:text-[#0F172A]">
            <FaTimes size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {!fetchedVehicle ? (
            <div className="py-4">
              <div className="mb-6 text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/80 bg-white/70 text-[#0B3D73] shadow-sm">
                  <FaSearch size={18} />
                </span>
                <h4 className="text-xl font-semibold tracking-tight text-[#0F172A]">Enter registration</h4>
                <p className="mt-1 text-sm text-slate-500">Motor Desk will fill the car details.</p>
              </div>
              <form onSubmit={handleLookup} className="flex gap-2">
                <input
                  type="text"
                  value={lookupRegistration}
                  onChange={(event) => setLookupRegistration(event.target.value.toUpperCase())}
                  placeholder="AB12 CDE"
                  className="h-12 flex-1 rounded-xl border border-[#d6de48] bg-[#f5e76b] px-4 text-center text-lg font-bold uppercase tracking-[0.18em] text-[#0F172A] outline-none shadow-inner placeholder:text-[#0F172A]/35 focus:ring-2 focus:ring-[#0B3D73]/20"
                  autoFocus
                />
                <button type="submit" disabled={lookupLoading} className="h-12 rounded-xl bg-[#0B3D73] px-5 text-sm font-semibold text-white transition hover:bg-[#072A50] disabled:opacity-50">
                  {lookupLoading ? 'Looking...' : 'Lookup'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/80 bg-white/55 p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-semibold tracking-tight text-[#0F172A]">{fetchedVehicle.make} {fetchedVehicle.model}</h2>
                    <p className="truncate text-sm text-slate-500">{fetchedVehicle.derivative || 'Vehicle details'}</p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-[#d6de48] bg-[#f5e76b] px-3 py-1.5 text-sm font-bold tracking-[0.14em] text-[#0F172A]">{fetchedVehicle.registration}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  {[
                    { icon: FaGasPump, label: 'Fuel', value: fetchedVehicle.fuelType },
                    { icon: FaCog, label: 'Gearbox', value: fetchedVehicle.transmissionType },
                    { icon: FaPalette, label: 'Colour', value: fetchedVehicle.colour },
                    { icon: FaCalendar, label: 'Registered', value: formatDate(fetchedVehicle.firstRegistrationDate) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-[#0F172A]">
                      <item.icon className="shrink-0 text-[#0B3D73]" size={12} />
                      <span className="truncate">{item.value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setFetchedVehicle(null)} className="mt-4 text-xs font-semibold text-[#0B3D73] hover:underline">Search again</button>
              </div>

              {!uploadSuccess ? (
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-[#0F172A]">Upload video</h4>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Mileage
                      <input type="number" value={smartMileage} onChange={(event) => setSmartMileage(event.target.value)} className={`${fieldClass} mt-1.5`} placeholder="45000" />
                    </label>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Reserve link
                      <input type="url" value={smartReserveLink} onChange={(event) => setSmartReserveLink(event.target.value)} className={`${fieldClass} mt-1.5`} placeholder="https://" />
                    </label>
                  </div>
                  <div
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      const file = event.dataTransfer.files[0];
                      if (file && file.type.startsWith('video/')) setSelectedFile(file);
                      else showToast('Please select a valid video file', 'error');
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`mb-4 cursor-pointer rounded-2xl border border-dashed p-8 text-center transition ${isDragging ? 'border-[#0B3D73] bg-[#0B3D73]/5' : 'border-slate-300/80 bg-white/40 hover:border-[#0B3D73]/40 hover:bg-white/70'}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file && file.type.startsWith('video/')) setSelectedFile(file);
                        else showToast('Please select a valid video', 'error');
                      }}
                    />
                    <FaCloudUploadAlt className={`mx-auto mb-3 ${isDragging ? 'text-[#0B3D73]' : 'text-slate-400'}`} size={28} />
                    {selectedFile ? (
                      <div>
                        <p className="mb-1 text-sm font-medium text-[#0F172A]">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <p className="mt-2 text-xs text-slate-400">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 text-sm font-medium text-[#0F172A]">Drop a video here, or click to browse</p>
                        <p className="text-xs text-slate-500">MP4, MOV, AVI and other video files</p>
                      </div>
                    )}
                  </div>
                  {uploading && (
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Uploading...</span>
                        <span className="font-semibold text-[#0B3D73]">{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/80">
                        <div className="h-1.5 rounded-full bg-[#0B3D73] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-slate-500">Large files can take a few minutes. Keep this page open.</p>
                    </div>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={close} className="h-11 rounded-xl border border-white/80 bg-white/70 px-5 text-sm font-semibold text-slate-600 transition hover:bg-white">Cancel</button>
                    <button type="button" onClick={handleUpload} disabled={!selectedFile || uploading} className="flex h-11 items-center gap-2 rounded-xl bg-[#0B3D73] px-5 text-sm font-semibold text-white transition hover:bg-[#072A50] disabled:opacity-50">
                      {uploading ? 'Uploading...' : <><FaCloudUploadAlt /> Start upload</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                    <FaCheck size={22} />
                  </div>
                  <h3 className="text-xl font-semibold text-[#0F172A]">Video uploaded</h3>
                  <p className="mt-1 text-sm text-slate-500">Linked to {fetchedVehicle.registration}</p>
                  <button type="button" onClick={close} className="mt-6 h-11 rounded-xl bg-[#0B3D73] px-6 text-sm font-semibold text-white hover:bg-[#072A50]">Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
