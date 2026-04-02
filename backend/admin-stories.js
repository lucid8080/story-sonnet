import dotenv from 'dotenv';
import { verifyBearerToken } from './lib/clerk-verify.js';
import { getProfileByUserId } from './lib/profile.js';
import { getSql } from './lib/db.js';

dotenv.config();

export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
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

  const body = req.body || {};
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid story id' });
  }

  try {
    const sql = getSql();
    const existing = await sql`
      select * from public.stories where id = ${id} limit 1
    `;
    if (!existing.length) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const cur = existing[0];
    const title = typeof body.title === 'string' ? body.title : cur.title;
    const is_published =
      typeof body.is_published === 'boolean' ? body.is_published : cur.is_published;
    const is_premium =
      typeof body.is_premium === 'boolean' ? body.is_premium : cur.is_premium;
    const duration_label =
      typeof body.duration_label === 'string' ? body.duration_label : cur.duration_label;

    const updated = await sql`
      update public.stories
      set
        title = ${title},
        is_published = ${is_published},
        is_premium = ${is_premium},
        duration_label = ${duration_label},
        updated_at = now()
      where id = ${id}
      returning *
    `;

    return res.status(200).json({ data: updated[0] });
  } catch (e) {
    console.error('[admin-stories] error', e);
    return res.status(500).json({ error: 'Update failed' });
  }
}
