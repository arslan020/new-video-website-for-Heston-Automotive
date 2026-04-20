import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { deleteFromCloudflareStream } from '@/lib/cloudflareStream';
import mongoose from 'mongoose';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const { name, cloudflareVideoId } = await req.json();

    if (!name || !cloudflareVideoId) {
      return Response.json({ message: 'name and cloudflareVideoId required' }, { status: 400 });
    }

    const thumbnailUrl = `https://videodelivery.net/${cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&height=200`;
    const newSubPart = {
      _id: new mongoose.Types.ObjectId(),
      name: name.trim(),
      cloudflareVideoId,
      thumbnailUrl,
      createdAt: new Date(),
    };

    await Video.findByIdAndUpdate(id, { $push: { subParts: newSubPart } });

    return Response.json(newSubPart, { status: 201 });
  } catch (err) {
    console.error('subparts POST error:', err);
    return Response.json({ message: 'Failed to add sub part' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const { subPartId } = await req.json();

    const video = await Video.findById(id);
    if (video) {
      const subPart = video.subParts?.find((sp: any) => sp._id.toString() === subPartId);
      if (subPart?.cloudflareVideoId) {
        await deleteFromCloudflareStream(subPart.cloudflareVideoId);
      }
      await Video.findByIdAndUpdate(id, { $pull: { subParts: { _id: new mongoose.Types.ObjectId(subPartId) } } });
    }

    return Response.json({ message: 'Sub part deleted' });
  } catch (err) {
    console.error('subparts DELETE error:', err);
    return Response.json({ message: 'Failed to delete sub part' }, { status: 500 });
  }
}
