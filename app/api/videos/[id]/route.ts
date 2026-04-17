import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest } from '@/lib/auth';
import { deleteCloudinaryVideo } from '@/lib/cloudinary';
import { deleteFromCloudflareStream } from '@/lib/cloudflareStream';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const user = await getUserFromRequest(req);
    const url = new URL(req.url);
    const shareId = url.searchParams.get('s');
    const isStaff = user && (user.role === 'admin' || user.role === 'staff');

    const video = await Video.findById(id);
    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    if (!isStaff) {
      if (shareId && shareId !== 'undefined' && shareId !== 'null') {
        try {
          const shareLog = await AuditLog.findById(shareId);
          if (!shareLog || shareLog.targetId?.toString() !== id || !['SHARE_VIDEO_LINK', 'SEND_VIDEO_LINK'].includes(shareLog.action)) {
            return Response.json({ message: 'Invalid or unauthorized video link' }, { status: 403 });
          }
          if (shareLog.suspended) {
            return Response.json({ message: 'This video link has been suspended by the dealer.' }, { status: 403 });
          }
          if (shareLog.metadata?.expiresAt && new Date() > new Date(shareLog.metadata.expiresAt as string)) {
            return Response.json({ message: 'This video link has expired (4-day limit)' }, { status: 403 });
          }

          video.viewCount = (video.viewCount || 0) + 1;
          video.views.push({
            shareId: shareLog._id,
            viewedAt: new Date(),
            viewerName: shareLog.metadata?.customerName as string || undefined,
            viewerEmail: shareLog.metadata?.sentToEmail as string || undefined,
            viewerMobile: shareLog.metadata?.sentToMobile as string || undefined,
          });
          await video.save();
        } catch {
          return Response.json({ message: 'Invalid video link format' }, { status: 403 });
        }
      } else if (video.linkExpiresAt && new Date() > video.linkExpiresAt) {
        return Response.json({ message: 'This video link has expired (4-day limit)' }, { status: 403 });
      }
    }

    return Response.json(video);
  } catch {
    return Response.json({ message: 'Video not found' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return Response.json({ message: 'Not authorized' }, { status: 401 });

  try {
    await connectDB();
    const { id } = await params;
    const video = await Video.findById(id);

    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    if (user.role !== 'admin' && video.uploadedBy.toString() !== user._id.toString()) {
      return Response.json({ message: 'Not authorized to delete this video' }, { status: 403 });
    }

    if (video.videoSource === 'cloudinary' && video.publicId) {
      await deleteCloudinaryVideo(video.publicId);
    } else if (video.videoSource === 'cloudflare' && video.cloudflareVideoId) {
      await deleteFromCloudflareStream(video.cloudflareVideoId);
    }

    await video.deleteOne();

    await AuditLog.create({
      action: 'DELETE_VIDEO',
      user: user._id,
      details: `Deleted video: ${video.title} (${video.registration || 'No Reg'})`,
      targetId: video._id?.toString(),
      metadata: { registration: video.registration },
    });

    return Response.json({ message: 'Video removed successfully' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to delete video' }, { status: 500 });
  }
}
