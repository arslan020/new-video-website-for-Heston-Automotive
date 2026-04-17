import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { progressClients, completedJobs } from '@/app/api/videos/route';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const { jobId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const completed = completedJobs.get(jobId);
      if (completed) {
        completedJobs.delete(jobId);
        if (completed.done) {
          controller.enqueue(`event: done\ndata: {}\n\n`);
        } else {
          controller.enqueue(`event: error\ndata: ${JSON.stringify({ message: completed.message })}\n\n`);
        }
        controller.close();
        return;
      }

      const heartbeat = setInterval(() => {
        try { controller.enqueue(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
      }, 15000);

      progressClients.set(jobId, { controller, heartbeat });

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        progressClients.delete(jobId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
