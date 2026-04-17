import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    await connectDB();
    const { shareId } = await params;
    const log = await AuditLog.findById(shareId);

    if (!log || !log.metadata) {
      return Response.json({ message: 'Customer info not found' }, { status: 404 });
    }

    const { customerName, sentToEmail, sentToMobile, sentTo } = log.metadata as Record<string, string>;
    return Response.json({
      name: customerName || '',
      email: sentToEmail || (sentTo && sentTo.includes('@') ? sentTo : '') || '',
      phone: sentToMobile || (sentTo && !sentTo.includes('@') ? sentTo : '') || '',
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch customer info' }, { status: 500 });
  }
}
