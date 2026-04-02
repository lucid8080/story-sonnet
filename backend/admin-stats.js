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
    const [storiesRow] = await sql`
      select count(*)::int as c from public.stories
    `;
    const [episodesRow] = await sql`
      select count(*)::int as c from public.episodes
    `;
    const profiles = await sql`
      select id, subscription_status from public.profiles
    `;
    const [uploadsRow] = await sql`
      select count(*)::int as c from public.uploads
    `;

    const activeSubscribers = profiles.filter(
      (p) => p.subscription_status === 'active'
    ).length;

    return res.status(200).json({
      stories: Number(storiesRow?.c ?? 0),
      episodes: Number(episodesRow?.c ?? 0),
      users: profiles.length,
      activeSubscribers,
      uploads: Number(uploadsRow?.c ?? 0),
    });
  } catch (e) {
    console.error('[admin-stats] error', e);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
}
