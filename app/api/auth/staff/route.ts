import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin') return forbiddenResponse();

  await connectDB();
  const staff = await User.find({ role: 'staff' }).select('-password');
  return Response.json(staff);
}

export async function POST(req: NextRequest) {
  const currentUser = await getUserFromRequest(req);
  if (!currentUser) return unauthorizedResponse();
  if (currentUser.role !== 'admin') return forbiddenResponse();

  try {
    await connectDB();
    const { username, name, password, email, phoneNumber } = await req.json();

    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      return Response.json({ message: 'User or Email already exists' }, { status: 400 });
    }

    const newUser = await User.create({ username, name, password, email, phoneNumber, role: 'staff' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://video.hestonautomotive.com';
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Heston Automotive - Account Created',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <h2 style="color: #2563EB;">Welcome to Heston Automotive!</h2>
            <p>Your staff account has been created. Here are your login credentials:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
              <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${frontendUrl}">${frontendUrl}</a></p>
            </div>
            <p><strong>Important:</strong> Please change your password after your first login.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr);
    }

    return Response.json(
      { _id: newUser._id, username: newUser.username, name: newUser.name, email: newUser.email, phoneNumber: newUser.phoneNumber, role: newUser.role },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}
