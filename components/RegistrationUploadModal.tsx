'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as tus from 'tus-js-client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUidRef = useRef<string | null>(null);

  const cleanupPending = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
      const urlRes = await fetch('/api/cloudflare/tus-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
        body: JSON.stringify({
          title: `${fetchedVehicle.make} ${fetchedVehicle.model} - ${fetchedVehicle.registration}`,
          fileSize: selectedFile.size,
        }),
      });
      if (!urlRes.ok) throw new Error('Failed to create upload slot');
      const { tusUrl, uid } = await urlRes.json();
      pendingUidRef.current = uid;

      await new Promise<void>((resolve, reject) => {
        let cancelled = false;
        const upload = new tus.Upload(selectedFile, {
          uploadUrl: tusUrl,
          chunkSize: 50 * 1024 * 1024,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          onProgress(bytesUploaded, bytesTotal) {
            setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
          },
          onSuccess() {
            abortControllerRef.current = null;
            resolve();
          },
          onError(err) {
            abortControllerRef.current = null;
            if (cancelled) reject(new Error('Upload cancelled'));
            else reject(err);
          },
        });
        const controller = new AbortController();
        abortControllerRef.current = controller;
        controller.signal.addEventListener('abort', () => {
          cancelled = true;
          upload.abort();
        });
        upload.start();
      });

      setUploadProgress(100);
      pendingUidRef.current = null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-gray-900 p-5 text-white">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <FaVideo className="text-blue-400" /> Find Vehicle & Upload
          </h3>
          <button type="button" onClick={close} className="text-gray-400 transition hover:text-white">
            <FaTimes size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!fetchedVehicle ? (
            <div className="mx-auto max-w-md py-8">
              <div className="mb-6 text-center">
                <FaSearch className="mx-auto mb-3 text-blue-600" size={32} />
                <h4 className="text-xl font-bold text-gray-800">Enter Registration</h4>
                <p className="text-sm text-gray-500">We&apos;ll fetch the car details automatically.</p>
              </div>
              <form onSubmit={handleLookup}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupRegistration}
                    onChange={(event) => setLookupRegistration(event.target.value.toUpperCase())}
                    placeholder="AB12 CDE"
                    className="flex-1 rounded-lg border-2 border-gray-300 px-4 py-3 text-lg font-bold uppercase tracking-wider focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button type="submit" disabled={lookupLoading} className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
                    {lookupLoading ? 'Please Wait...' : 'Lookup'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{fetchedVehicle.make} {fetchedVehicle.model}</h2>
                    <p className="text-gray-600">{fetchedVehicle.derivative}</p>
                  </div>
                  <span className="rounded border-2 border-black bg-yellow-400 px-3 py-1 text-lg font-bold tracking-wider text-black">{fetchedVehicle.registration}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div className="flex items-center gap-2"><FaGasPump className="text-gray-400" /> {fetchedVehicle.fuelType || 'N/A'}</div>
                  <div className="flex items-center gap-2"><FaCog className="text-gray-400" /> {fetchedVehicle.transmissionType || 'N/A'}</div>
                  <div className="flex items-center gap-2"><FaPalette className="text-gray-400" /> {fetchedVehicle.colour || 'N/A'}</div>
                  <div className="flex items-center gap-2"><FaCalendar className="text-gray-400" /> {formatDate(fetchedVehicle.firstRegistrationDate)}</div>
                </div>
                <button type="button" onClick={() => setFetchedVehicle(null)} className="mt-4 text-xs font-medium text-blue-600 hover:underline">Not the right car? Search again</button>
              </div>

              {!uploadSuccess ? (
                <div className="border-t pt-2">
                  <h4 className="mb-3 font-bold text-gray-700">Upload Video File</h4>
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Mileage</label>
                      <input type="number" value={smartMileage} onChange={(event) => setSmartMileage(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" placeholder="e.g. 45000" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700">Reserve Car Link</label>
                      <input type="url" value={smartReserveLink} onChange={(event) => setSmartReserveLink(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
                    </div>
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
                    className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
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
                    <FaCloudUploadAlt className={`mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} size={40} />
                    {selectedFile ? (
                      <div>
                        <p className="mb-1 font-medium text-green-600">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <p className="mt-2 text-xs text-gray-400">Click to change file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 font-medium text-gray-700">Drop video file here or click to browse</p>
                        <p className="text-sm text-gray-500">Supports MP4, MOV, AVI and other video formats</p>
                      </div>
                    )}
                  </div>
                  {uploading && (
                    <div className="mb-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Uploading directly to Cloudflare...</span>
                        <span className="font-medium text-blue-600">{uploadProgress}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-amber-600">Large files may take a few minutes. Please keep this page open</p>
                    </div>
                  )}
                  <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={close} className="rounded-lg px-5 py-2.5 text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="button" onClick={handleUpload} disabled={!selectedFile || uploading} className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-bold text-white transition hover:bg-green-700 disabled:opacity-50">
                      {uploading ? 'Uploading...' : <><FaCloudUploadAlt /> Start Upload</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <FaCheck className="text-green-600" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Success!</h3>
                  <p className="mb-6 text-gray-500">Video uploaded and linked to {fetchedVehicle.registration}</p>
                  <button type="button" onClick={close} className="font-bold text-blue-600 hover:underline">Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
