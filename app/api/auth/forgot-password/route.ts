import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { sendEmail } from '@/lib/email';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const raw = typeof body.email === 'string' ? body.email.trim() : '';
    if (!raw) {
      return Response.json({ message: 'Please enter your email address' }, { status: 400 });
    }

    // Case-insensitive match (same emails may be stored with different casing)
    const user = await User.findOne({
      email: new RegExp(`^${escapeRegex(raw)}$`, 'i'),
    });

    // Match CRA: do not reveal whether the email exists
    if (!user) {
      return Response.json({ message: 'Email could not be sent' }, { status: 404 });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save();

    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <h2>Password Reset Request</h2>
            <p>You have requested a password reset. Please click the link below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a>
            <p>If you did not request this, please ignore this email.</p>
            <p>This link will expire in 10 minutes.</p>
          </div>
        `,
      });
      return Response.json({ success: true, data: 'Email sent' });
    } catch (emailErr) {
      console.error('[forgot-password] sendEmail:', emailErr);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      try {
        await user.save();
      } catch (revertErr) {
        console.error('[forgot-password] revert token save:', revertErr);
      }
      const msg =
        emailErr instanceof Error ? emailErr.message : 'Email could not be sent';
      return Response.json({ message: msg }, { status: 500 });
    }
  } catch (err) {
    console.error('[forgot-password]', err);
    const message =
      err instanceof Error ? err.message : 'Server Error';
    return Response.json({ message }, { status: 500 });
  }
}
