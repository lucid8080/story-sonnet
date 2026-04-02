import dotenv from 'dotenv';
import { verifyBearerToken } from './lib/clerk-verify.js';
import { getProfileByUserId } from './lib/profile.js';
import {
  loadAllStoriesWithEpisodes,
  loadStoryBySlug,
  filterStoryRowsForAccess,
} from './lib/stories-query.js';

dotenv.config();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let isSubscriber = false;
  let isAdmin = false;

  const auth = await verifyBearerToken(req.headers.authorization);
  if (auth?.userId) {
    try {
      const profile = await getProfileByUserId(auth.userId);
      if (profile) {
        if (profile.role === 'admin') isAdmin = true;
        const st = profile.subscription_status;
        if (st === 'active' || st === 'trialing') isSubscriber = true;
      }
    } catch (e) {
      console.warn('[stories-api] profile lookup failed', e?.message);
    }
  }

  let slug = typeof req.query?.slug === 'string' ? req.query.slug : null;
  if (!slug && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      slug = u.searchParams.get('slug');
    } catch {
      slug = null;
    }
  }

  try {
    if (slug) {
      const row = await loadStoryBySlug(slug);
      if (!row) {
        return res.status(200).json({ story: null });
      }
      const filtered = filterStoryRowsForAccess(row.story, row.episodes, {
        isAdmin,
        isSubscriber,
      });
      if (!filtered) {
        return res.status(200).json({ story: null });
      }
      return res.status(200).json({
        story: filtered.story,
        episodes: filtered.episodes,
      });
    }

    const { stories, episodesByStoryId } = await loadAllStoriesWithEpisodes();
    const out = [];
    for (const story of stories) {
      const eps = episodesByStoryId[story.id] || [];
      const filtered = filterStoryRowsForAccess(story, eps, {
        isAdmin,
        isSubscriber,
      });
      if (filtered) {
        out.push({
          story: filtered.story,
          episodes: filtered.episodes,
        });
      }
    }
    return res.status(200).json({ stories: out });
  } catch (e) {
    console.error('[stories-api] error', e);
    return res.status(500).json({ error: 'Failed to load stories' });
  }
}
