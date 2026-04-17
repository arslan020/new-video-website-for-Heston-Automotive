import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET!;

export async function verifyTokenEdge(token: string): Promise<{ id: string }> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as { id: string };
}
