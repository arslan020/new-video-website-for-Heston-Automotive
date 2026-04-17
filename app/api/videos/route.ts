import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { uploadToCloudflareStream } from '@/lib/cloudflareStream';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

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

  // File upload (multipart)
  try {
    await connectDB();
    const formData = await req.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return Response.json({ message: 'No video file provided' }, { status: 400 });
    }

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const uploadsDir = path.join(os.tmpdir(), 'video-uploads');
    if (!existsSync(uploadsDir)) await mkdir(uploadsDir, { recursive: true });

    const tempPath = path.join(uploadsDir, `${jobId}-${file.name}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, buffer);

    // Run background upload
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 500));

        const cloudflareVideo = await uploadToCloudflareStream(tempPath, {
          title: (formData.get('title') as string) || file.name,
          onProgress: (percentage) => {
            const client = progressClients.get(jobId);
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
          originalName: file.name,
          title: (formData.get('title') as string) || file.name,
          registration: (formData.get('registration') as string) || undefined,
          make: (formData.get('make') as string) || undefined,
          model: (formData.get('model') as string) || undefined,
          mileage: formData.get('mileage') ? Number(formData.get('mileage')) : undefined,
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

        const client = progressClients.get(jobId);
        if (client) {
          try { client.controller.enqueue(`event: done\ndata: {}\n\n`); client.controller.close(); } catch {}
          clearInterval(client.heartbeat);
          progressClients.delete(jobId);
        } else {
          completedJobs.set(jobId, { done: true });
          setTimeout(() => completedJobs.delete(jobId), 60000);
        }
      } catch (bgErr: unknown) {
        try { await unlink(tempPath); } catch {}
        const msg = bgErr instanceof Error ? bgErr.message : 'Upload failed';
        const client = progressClients.get(jobId);
        if (client) {
          try { client.controller.enqueue(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`); client.controller.close(); } catch {}
          clearInterval(client.heartbeat);
          progressClients.delete(jobId);
        } else {
          completedJobs.set(jobId, { error: true, message: msg });
          setTimeout(() => completedJobs.delete(jobId), 60000);
        }
      }
    })();

    return Response.json({ jobId }, { status: 202 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Video upload failed' }, { status: 500 });
  }
}
