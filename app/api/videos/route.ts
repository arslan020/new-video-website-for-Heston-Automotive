import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { uploadToCloudflareStream } from '@/lib/cloudflareStream';
import { mkdir, unlink } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import Busboy from 'busboy';
import { Readable } from 'stream';

// In-memory SSE progress store
export const progressClients = new Map<string, { controller: ReadableStreamDefaultController; heartbeat: NodeJS.Timeout }>();
export const completedJobs = new Map<string, { done?: boolean; error?: boolean; message?: string }>();

function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const url = new URL(req.url);
    const all = url.searchParams.get('all');

    const query: Record<string, unknown> = {};
    if (user.role !== 'admin' && all !== 'true') {
      query.uploadedBy = user._id;
    }

    const videos = await Video.find(query)
      .populate('uploadedBy', 'username name')
      .populate({ path: 'views.shareId', select: 'suspended createdAt metadata user', populate: { path: 'user', select: 'name username' } })
      .sort({ createdAt: -1 });

    return Response.json(videos);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const contentType = req.headers.get('content-type') || '';

  // YouTube URL upload
  if (contentType.includes('application/json')) {
    try {
      await connectDB();
      const body = await req.json();
      const { youtubeUrl } = body;

      if (!youtubeUrl) {
        return Response.json({ message: 'No video file or YouTube URL provided' }, { status: 400 });
      }

      const youtubeVideoId = extractYouTubeId(youtubeUrl);
      if (!youtubeVideoId) {
        return Response.json({ message: 'Invalid YouTube URL or video ID' }, { status: 400 });
      }

      const video = await Video.create({
        uploadedBy: user._id,
        videoUrl: `https://www.youtube.com/embed/${youtubeVideoId}`,
        videoSource: 'youtube',
        youtubeVideoId,
        title: body.title || 'YouTube Video',
        registration: body.registration || undefined,
        make: body.make || undefined,
        model: body.model || undefined,
        vehicleDetails: body.vehicleDetails || undefined,
        mileage: body.mileage || undefined,
        reserveCarLink: body.reserveCarLink || undefined,
        thumbnailUrl: `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`,
      });

      await AuditLog.create({
        action: 'UPLOAD_VIDEO',
        user: user._id,
        details: `Uploaded YouTube video: ${video.title} (${video.registration || 'No Reg'})`,
        targetId: video._id?.toString(),
        metadata: { registration: video.registration },
      });

      return Response.json(video, { status: 201 });
    } catch (err) {
      console.error(err);
      return Response.json({ message: 'Video upload failed' }, { status: 500 });
    }
  }

  // File upload (multipart) — stream to disk via busboy (no memory buffering, 3GB limit)
  try {
    await connectDB();

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const uploadsDir = path.join(os.tmpdir(), 'video-uploads');
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    // Parse multipart form with busboy, streaming file straight to disk
    const fields: Record<string, string> = {};
    let tempPath = '';
    let originalName = '';

    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({
        headers: Object.fromEntries(req.headers),
        limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 3 GB
      });

      busboy.on('field', (name: string, value: string) => { fields[name] = value; });

      busboy.on('file', (_field: string, fileStream: NodeJS.ReadableStream, info: { filename: string }) => {
        originalName = info.filename;
        const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        tempPath = path.join(uploadsDir, `${jobId}-${safeName}`);
        const writeStream = createWriteStream(tempPath);
        fileStream.pipe(writeStream);
        writeStream.on('finish', () => {});
        writeStream.on('error', reject);
        fileStream.on('error', reject);
      });

      busboy.on('finish', resolve);
      busboy.on('error', reject);

      // Pipe Web ReadableStream → Node.js Readable → busboy
      if (req.body) {
        Readable.fromWeb(req.body as import('stream/web').ReadableStream).pipe(busboy);
      } else {
        reject(new Error('No request body'));
      }
    });

    if (!tempPath || !originalName) {
      return Response.json({ message: 'No video file provided' }, { status: 400 });
    }

    // Respond immediately with jobId so frontend can open SSE
    const responseJobId = jobId;

    // Run background upload
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 500));

        const cloudflareVideo = await uploadToCloudflareStream(tempPath, {
          title: fields.title || originalName,
          onProgress: (percentage) => {
            const client = progressClients.get(responseJobId);
            if (client) {
              try {
                client.controller.enqueue(`event: progress\ndata: ${JSON.stringify({ percent: percentage })}\n\n`);
              } catch {}
            }
          },
        });

        const video = await Video.create({
          uploadedBy: user._id,
          videoUrl: cloudflareVideo.videoUrl,
          videoSource: 'cloudflare',
          cloudflareVideoId: cloudflareVideo.videoId,
          originalName,
          title: fields.title || originalName,
          registration: fields.registration || undefined,
          make: fields.make || undefined,
          model: fields.model || undefined,
          vehicleDetails: fields.vehicleDetails ? JSON.parse(fields.vehicleDetails) : undefined,
          mileage: fields.mileage ? Number(fields.mileage) : undefined,
          reserveCarLink: fields.reserveCarLink || undefined,
          thumbnailUrl: cloudflareVideo.thumbnail,
        });

        try { await unlink(tempPath); } catch {}

        await AuditLog.create({
          action: 'UPLOAD_VIDEO',
          user: user._id,
          details: `Uploaded video: ${video.title} (${video.registration || 'No Reg'})`,
          targetId: video._id?.toString(),
          metadata: { registration: video.registration },
        });

        const client = progressClients.get(responseJobId);
        if (client) {
          try { client.controller.enqueue(`event: done\ndata: {}\n\n`); client.controller.close(); } catch {}
          clearInterval(client.heartbeat);
          progressClients.delete(responseJobId);
        } else {
          completedJobs.set(responseJobId, { done: true });
          setTimeout(() => completedJobs.delete(responseJobId), 60000);
        }
      } catch (bgErr: unknown) {
        try { await unlink(tempPath); } catch {}
        const msg = bgErr instanceof Error ? bgErr.message : 'Upload failed';
        const client = progressClients.get(responseJobId);
        if (client) {
          try { client.controller.enqueue(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`); client.controller.close(); } catch {}
          clearInterval(client.heartbeat);
          progressClients.delete(responseJobId);
        } else {
          completedJobs.set(responseJobId, { error: true, message: msg });
          setTimeout(() => completedJobs.delete(responseJobId), 60000);
        }
      }
    })();

    return Response.json({ jobId }, { status: 202 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Video upload failed' }, { status: 500 });
  }
}
