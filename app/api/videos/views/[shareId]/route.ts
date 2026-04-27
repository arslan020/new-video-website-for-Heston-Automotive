import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import mongoose from 'mongoose';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { shareId } = await params;

    if (!mongoose.Types.ObjectId.isValid(shareId)) {
      return Response.json({ message: 'Invalid shareId' }, { status: 400 });
    }

    const oid = new mongoose.Types.ObjectId(shareId);

    // Count how many view entries will be removed per video, then pull them and decrement viewCount
    const videos = await Video.find({ 'views.shareId': oid }, { 'views.$': 0, viewCount: 1, views: 1 });
    for (const video of videos) {
      const removeCount = video.views.filter(
        (v) => v.shareId?.toString() === shareId
      ).length;
      await Video.updateOne(
        { _id: video._id },
        {
          $pull: { views: { shareId: oid } },
          $inc: { viewCount: -removeCount },
        }
      );
    }

    return Response.json({ message: 'Views deleted' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to delete views' }, { status: 500 });
  }
}
