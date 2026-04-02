import dotenv from 'dotenv';
import { verifyBearerToken } from './lib/clerk-verify.js';
import { getProfileByUserId } from './lib/profile.js';
import { getSql } from './lib/db.js';

dotenv.config();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyBearerToken(req.headers.authorization);
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const profile = await getProfileByUserId(auth.userId);
  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      select * from public.uploads
      order by created_at desc
      limit 25
    `;
    return res.status(200).json({ uploads: rows });
  } catch (e) {
    console.error('[admin-uploads] error', e);
    return res.status(500).json({ error: 'Failed to load uploads' });
  }
}
