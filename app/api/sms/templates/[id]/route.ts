import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import SmsTemplate from '@/models/SmsTemplate';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  const { id } = await params;
  await connectDB();
  await SmsTemplate.findByIdAndDelete(id);
  return Response.json({ ok: true });
}
