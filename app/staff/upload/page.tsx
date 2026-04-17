'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/components/ToastProvider';

type UploadMode = 'file' | 'youtube';

interface VehicleInfo {
  make?: string;
  model?: string;
  colour?: string;
  year?: string;
  fuelType?: string;
  transmission?: string;
}

export default function UploadPage() {
  return (
    <ProtectedRoute role="staff">
      <DashboardLayout>
        <UploadContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function UploadContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<UploadMode>('file');
  const [title, setTitle] = useState('');
  const [registration, setRegistration] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({});
  const [lookingUp, setLookingUp] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [done, setDone] = useState(false);

  const handleRegLookup = async () => {
    const reg = registration.trim().toUpperCase();
    if (!reg) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/vehicle-metadata/${encodeURIComponent(reg)}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVehicleInfo(data);
        if (!title) setTitle(`${data.make || ''} ${data.model || ''} ${reg}`.trim());
      }
    } catch { /* silent */ }
    finally { setLookingUp(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && !title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  const resetForm = () => {
    setTitle('');
    setRegistration('');
    setVehicleInfo({});
    setYoutubeUrl('');
    setSelectedFile(null);
    setProgress(0);
    setProgressMsg('');
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!title.trim()) { showToast('Title is required', 'error'); return; }

    if (mode === 'youtube') {
      if (!youtubeUrl.trim()) { showToast('YouTube URL is required', 'error'); return; }
      setUploading(true);
      setProgressMsg('Saving YouTube video...');
      try {
        const res = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          body: JSON.stringify({
            title: title.trim(),
            registration: registration.trim().toUpperCase(),
            make: vehicleInfo.make,
            model: vehicleInfo.model,
            colour: vehicleInfo.colour,
            year: vehicleInfo.year,
            fuelType: vehicleInfo.fuelType,
            transmission: vehicleInfo.transmission,
            youtubeUrl: youtubeUrl.trim(),
          }),
        });
        if (!res.ok) throw new Error('Upload failed');
        setDone(true);
        showToast('YouTube video saved successfully!', 'success');
      } catch { showToast('Failed to save video', 'error'); }
      finally { setUploading(false); setProgressMsg(''); }
      return;
    }

    if (!selectedFile) { showToast('Please select a video file', 'error'); return; }

    setUploading(true);
    setProgress(0);
    setProgressMsg('Uploading...');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', title.trim());
    formData.append('registration', registration.trim().toUpperCase());
    if (vehicleInfo.make) formData.append('make', vehicleInfo.make);
    if (vehicleInfo.model) formData.append('model', vehicleInfo.model);
    if (vehicleInfo.colour) formData.append('colour', vehicleInfo.colour);
    if (vehicleInfo.year) formData.append('year', vehicleInfo.year);
    if (vehicleInfo.fuelType) formData.append('fuelType', vehicleInfo.fuelType);
    if (vehicleInfo.transmission) formData.append('transmission', vehicleInfo.transmission);

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { jobId } = await res.json();

      // SSE progress tracking
      const evtSource = new EventSource(`/api/videos/progress/${jobId}?token=${user?.token}`);
      evtSource.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.progress !== undefined) setProgress(Math.round(d.progress));
        if (d.message) setProgressMsg(d.message);
        if (d.done) {
          evtSource.close();
          setDone(true);
          setUploading(false);
          showToast('Video uploaded successfully!', 'success');
        }
        if (d.error) {
          evtSource.close();
          setUploading(false);
          showToast(d.message || 'Upload failed', 'error');
        }
      };
      evtSource.onerror = () => {
        evtSource.close();
        setUploading(false);
        showToast('Lost connection during upload', 'error');
      };
    } catch {
      setUploading(false);
      showToast('Failed to start upload', 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 px-0 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Upload Video</h1>
        <p className="text-sm text-gray-500 mt-1">Add a new vehicle video to the portal</p>
      </div>

      {done ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-10 text-center">
          <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">✅</div>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Upload Complete!</h2>
          <p className="text-sm text-gray-500 mt-2">Your video has been saved successfully.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-5 sm:mt-6">
            <button onClick={resetForm} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm">
              Upload Another
            </button>
            <a href="/staff/videos" className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition text-sm text-center">
              View My Videos
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Mode Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`flex-1 py-3.5 text-sm font-medium transition ${mode === 'file' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              📁 File Upload
            </button>
            <button
              type="button"
              onClick={() => setMode('youtube')}
              className={`flex-1 py-3.5 text-sm font-medium transition ${mode === 'youtube' ? 'bg-red-50 text-red-600 border-b-2 border-red-500' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ▶ YouTube URL
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Registration Lookup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Registration Plate</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRegLookup())}
                  placeholder="e.g. AB12 CDE"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm uppercase tracking-widest font-mono"
                />
                <button
                  type="button"
                  onClick={handleRegLookup}
                  disabled={lookingUp || !registration.trim()}
                  className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition"
                >
                  {lookingUp ? '...' : 'Lookup'}
                </button>
              </div>
              {vehicleInfo.make && (
                <p className="mt-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                  ✓ {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model} · {vehicleInfo.colour} · {vehicleInfo.fuelType} · {vehicleInfo.transmission}
                </p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Video Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2023 BMW 3 Series Walk-Around"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Source-specific input */}
            {mode === 'youtube' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">YouTube URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Video File <span className="text-red-500">*</span></label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition"
                >
                  {selectedFile ? (
                    <div>
                      <p className="text-2xl mb-2">🎬</p>
                      <p className="font-medium text-gray-700">{selectedFile.name}</p>
                      <p className="text-sm text-gray-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      <p className="text-xs text-blue-500 mt-2">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-3">📁</p>
                      <p className="text-gray-600 font-medium">Click to select a video</p>
                      <p className="text-sm text-gray-400 mt-1">MP4, MOV, AVI, WebM supported</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{progressMsg || 'Uploading...'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">Please keep this page open until complete</p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition text-sm"
            >
              {uploading ? 'Uploading...' : mode === 'youtube' ? 'Save YouTube Video' : 'Upload Video'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
