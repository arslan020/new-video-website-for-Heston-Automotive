import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function HEAD(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const cfUrl = req.nextUrl.searchParams.get('cf');
  if (!cfUrl) return NextResponse.json({ message: 'Missing cf' }, { status: 400 });

  const res = await fetch(cfUrl, {
    method: 'HEAD',
    headers: { 'Tus-Resumable': '1.0.0' },
  });

  // direct_upload URLs don't support HEAD — return offset 0 for a fresh upload
  if (!res.ok) {
    return new NextResponse(null, {
      status: 200,
      headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': '0' },
    });
  }

  const responseHeaders = new Headers();
  for (const h of ['Tus-Resumable', 'Upload-Offset', 'Upload-Length']) {
    const v = res.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }
  return new NextResponse(null, { status: res.status, headers: responseHeaders });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const cfUrl = req.nextUrl.searchParams.get('cf');
  if (!cfUrl) return NextResponse.json({ message: 'Missing cf' }, { status: 400 });

  const body = await req.arrayBuffer();

  // Forward all TUS headers that tus-js-client sends
  const headers: Record<string, string> = {
    'Tus-Resumable': '1.0.0',
    'Content-Type': 'application/offset+octet-stream',
    'Content-Length': String(body.byteLength),
  };
  for (const h of ['Upload-Offset', 'Upload-Length', 'Upload-Checksum']) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  const res = await fetch(cfUrl, { method: 'PATCH', headers, body });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Cloudflare PATCH ${res.status}:`, text);
    return new NextResponse(text, { status: res.status });
  }

  const responseHeaders = new Headers();
  for (const h of ['Tus-Resumable', 'Upload-Offset', 'Upload-Expires']) {
    const v = res.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }
  return new NextResponse(null, { status: res.status, headers: responseHeaders });
}

// tus-js-client sends DELETE to terminate uploads — acknowledge it gracefully
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  return new NextResponse(null, { status: 204 });
}
