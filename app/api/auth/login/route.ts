import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { username, password } = await req.json();
    const identifier = username;

    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${identifier}$`, 'i') } },
        { email: { $regex: new RegExp(`^${identifier}$`, 'i') } },
      ],
    });

    if (!user || !(await user.matchPassword(password))) {
      return Response.json({ message: 'Invalid username/email or password' }, { status: 401 });
    }

    if (user.isTwoFactorEnabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.twoFactorCode = otp;
      user.twoFactorCodeExpire = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      try {
        await sendEmail({
          to: user.email,
          subject: 'Your Login Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
              <h2>Login Verification</h2>
              <p>Please use the following code to complete your login:</p>
              <h1 style="color: #2563EB; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
              <p>This code will expire in 10 minutes.</p>
              <p>If you did not attempt to login, please contact support immediately.</p>
            </div>
          `,
        });
      } catch {
        return Response.json({ message: 'Failed to send verification code' }, { status: 500 });
      }

      return Response.json({ requireTwoFactor: true, userId: user._id });
    }

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
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}
