import jwt from 'jsonwebtoken';
import { connectDB } from './mongodb';
import User, { IUser } from '@/models/User';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET!;

export function signToken(id: string) {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): { id: string } {
  return jwt.verify(token, JWT_SECRET) as { id: string };
}

export async function getUserFromRequest(req: NextRequest): Promise<IUser | null> {
  let token: string | null = null;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    const url = new URL(req.url);
    token = url.searchParams.get('token');
  }

  if (!token) return null;

  try {
    const decoded = verifyToken(token);
    await connectDB();
    const user = await User.findById(decoded.id).select('-password');
    return user;
  } catch {
    return null;
  }
}

export function unauthorizedResponse(message = 'Not authorized') {
  return Response.json({ message }, { status: 401 });
}

export function forbiddenResponse(message = 'Not authorized as an admin') {
  return Response.json({ message }, { status: 403 });
}
