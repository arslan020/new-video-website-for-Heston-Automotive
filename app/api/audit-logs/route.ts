import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin') return forbiddenResponse();

  try {
    await connectDB();
    const url = new URL(req.url);
    const pageSize = 50;
    const page = Number(url.searchParams.get('pageNumber')) || 1;

    const count = await AuditLog.countDocuments({});
    const logs = await AuditLog.find({})
      .populate('user', 'name username email role')
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(pageSize * (page - 1));

    return Response.json({ logs, page, pages: Math.ceil(count / pageSize), total: count });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
