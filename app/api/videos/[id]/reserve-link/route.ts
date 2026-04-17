import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin') return forbiddenResponse();

  try {
    await connectDB();
    const { id } = await params;
    const { reserveCarLink } = await req.json();
    const video = await Video.findById(id);

    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    video.reserveCarLink = reserveCarLink || '';
    await video.save();

    return Response.json({ message: 'Reserve car link updated successfully', video });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update reserve car link' }, { status: 500 });
  }
}
