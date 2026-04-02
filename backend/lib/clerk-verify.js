import { verifyToken } from '@clerk/backend';

/**
 * @returns {Promise<{ userId: string } | null>}
 */
export async function verifyBearerToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || !process.env.CLERK_SECRET_KEY) {
    return null;
  }
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const userId = payload.sub;
    if (!userId) return null;
    return { userId };
  } catch (e) {
    console.warn('[clerk-verify] Invalid token', e?.message || e);
    return null;
  }
}
