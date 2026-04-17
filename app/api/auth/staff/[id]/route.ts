import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getUserFromRequest(req);
  if (!currentUser) return unauthorizedResponse();
  if (currentUser.role !== 'admin') return forbiddenResponse();

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const user = await User.findById(id);

    if (!user) return Response.json({ message: 'User not found' }, { status: 404 });

    user.username = body.username || user.username;
    user.name = body.name || user.name;
    user.email = body.email || user.email;
    user.phoneNumber = body.phoneNumber || user.phoneNumber;
    if (body.isTwoFactorEnabled !== undefined) user.isTwoFactorEnabled = body.isTwoFactorEnabled;
    if (body.password) user.password = body.password;

    const updated = await user.save();

    return Response.json({
      _id: updated._id,
      username: updated.username,
      name: updated.name,
      email: updated.email,
      phoneNumber: updated.phoneNumber,
      role: updated.role,
      isTwoFactorEnabled: updated.isTwoFactorEnabled,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getUserFromRequest(req);
  if (!currentUser) return unauthorizedResponse();
  if (currentUser.role !== 'admin') return forbiddenResponse();

  try {
    await connectDB();
    const { id } = await params;
    const user = await User.findById(id);

    if (!user) return Response.json({ message: 'User not found' }, { status: 404 });

    await Video.deleteMany({ uploadedBy: user._id });
    await user.deleteOne();

    return Response.json({ message: 'User and all associated data removed' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}
