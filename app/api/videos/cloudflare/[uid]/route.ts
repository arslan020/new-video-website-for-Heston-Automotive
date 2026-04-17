import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { deleteFromCloudflareStream } from '@/lib/cloudflareStream';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const { uid } = await params;
  if (!uid) return Response.json({ message: 'Missing uid' }, { status: 400 });

  try {
    await deleteFromCloudflareStream(uid);
    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false });
  }
}
