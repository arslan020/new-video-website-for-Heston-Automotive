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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: '$createdAt' },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            action: '$action',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const days: { date: string; label: string; uploads: number; deletions: number; other: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        uploads: 0,
        deletions: 0,
        other: 0,
        total: 0,
      });
    }

    logs.forEach((entry) => {
      const dayEntry = days.find((d) => d.date === entry._id.date);
      if (dayEntry) {
        if (entry._id.action === 'UPLOAD_VIDEO') dayEntry.uploads += entry.count;
        else if (entry._id.action === 'DELETE_VIDEO') dayEntry.deletions += entry.count;
        else dayEntry.other += entry.count;
        dayEntry.total += entry.count;
      }
    });

    return Response.json(days);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch weekly stats' }, { status: 500 });
  }
}
