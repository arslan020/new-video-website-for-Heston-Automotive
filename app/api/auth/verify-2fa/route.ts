import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { userId, code } = await req.json();

    const user = await User.findById(userId);

    if (
      user &&
      user.twoFactorCode === code &&
      user.twoFactorCodeExpire &&
      user.twoFactorCodeExpire > new Date()
    ) {
      user.twoFactorCode = undefined;
      user.twoFactorCodeExpire = undefined;
      await user.save();

      return Response.json({
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
        token: signToken(user._id.toString()),
      });
    }

    return Response.json({ message: 'Invalid or expired verification code' }, { status: 400 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}
