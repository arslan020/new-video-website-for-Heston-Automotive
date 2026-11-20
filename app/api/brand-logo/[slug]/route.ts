import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
    return new Response(null, { status: 404 });
  }

  const upstream = await fetch(
    `https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/${slug}.png`,
    { next: { revalidate: 86400 } },
  );
  if (!upstream.ok) return new Response(null, { status: 404 });

  return new Response(await upstream.arrayBuffer(), {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
