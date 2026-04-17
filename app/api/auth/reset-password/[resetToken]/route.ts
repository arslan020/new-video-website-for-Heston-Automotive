import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ resetToken: string }> }) {
  try {
    await connectDB();
    const { resetToken } = await params;
    const { password } = await req.json();

    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) return Response.json({ message: 'Invalid token' }, { status: 400 });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return Response.json({
      success: true,
      data: 'Password reset success',
      token: signToken(user._id.toString()),
      _id: user._id,
      username: user.username,
      role: user.role,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server Error' }, { status: 500 });
  }
}
