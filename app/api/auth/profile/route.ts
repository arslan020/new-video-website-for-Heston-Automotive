import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getUserFromRequest, unauthorizedResponse, signToken } from '@/lib/auth';

export async function PUT(req: NextRequest) {
  const currentUser = await getUserFromRequest(req);
  if (!currentUser) return unauthorizedResponse();

  try {
    await connectDB();
    const { username, email, name, phoneNumber, currentPassword, newPassword } = await req.json();

    const user = await User.findById(currentUser._id);
    if (!user) return Response.json({ message: 'User not found' }, { status: 404 });

    if (!currentPassword) {
      return Response.json({ message: 'Current password is required' }, { status: 400 });
    }

    const isValid = await user.matchPassword(currentPassword);
    if (!isValid) {
      return Response.json({ message: 'Current password is incorrect' }, { status: 401 });
    }

    if (!username && !email && !name && !phoneNumber && !newPassword) {
      return Response.json({ message: 'Please provide a field to update' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (username && username !== user.username) {
      const exists = await User.findOne({ username, _id: { $ne: user._id } });
      if (exists) return Response.json({ message: 'Username already taken' }, { status: 400 });
      updateData.username = username;
    }

    if (name && name !== user.name) updateData.name = name;

    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id: { $ne: user._id } });
      if (exists) return Response.json({ message: 'Email already in use' }, { status: 400 });
      updateData.email = email;
    }

    if (phoneNumber !== undefined && phoneNumber !== user.phoneNumber) {
      updateData.phoneNumber = phoneNumber;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return Response.json({ message: 'New password must be at least 6 characters' }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    const updated = await User.findByIdAndUpdate(user._id, updateData, { new: true, runValidators: false });

    return Response.json({
      _id: updated!._id,
      name: updated!.name,
      username: updated!.username,
      email: updated!.email,
      phoneNumber: updated!.phoneNumber,
      role: updated!.role,
      token: signToken(updated!._id.toString()),
      message: 'Profile updated successfully',
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update profile' }, { status: 500 });
  }
}
