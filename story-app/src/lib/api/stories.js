import { getAuthToken } from '../authToken.js';
import { stories as staticStories } from '../../data.js';

function parseDurationToSeconds(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();

  const mmSsMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (mmSsMatch) {
    const minutes = Number(mmSsMatch[1]);
    const seconds = Number(mmSsMatch[2]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
  }

  const minMatch = trimmed.match(/^(\d+)\s*(m|min|mins|minute|minutes)$/);
  if (minMatch) {
    const minutes = Number(minMatch[1]);
    if (Number.isFinite(minutes)) {
      return minutes * 60;
    }
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber * 60;
  }

  return null;
}

function computeAverageDuration(episodes) {
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return null;
  }

  const seconds = episodes
    .map((ep) => parseDurationToSeconds(ep.duration))
    .filter((v) => v != null);

  if (seconds.length === 0) {
    return null;
  }

  const avgSeconds = seconds.reduce((sum, v) => sum + v, 0) / seconds.length;
  const avgMinutes = Math.round(avgSeconds / 60);

  if (!Number.isFinite(avgMinutes) || avgMinutes <= 0) {
    return null;
  }

  return avgMinutes === 1 ? '~1 min' : `~${avgMinutes} min`;
}

function mapDbStoryToApp(story, episodes) {
  const averageDurationLabel = computeAverageDuration(episodes);

  return {
    id: story.id,
    slug: story.slug,
    seriesTitle: story.series_title,
    title: story.title,
    ageGroup: story.age_group,
    durationLabel: story.duration_label,
    averageDurationLabel,
    summary: story.summary,
    cover: story.cover_url,
    accent: story.accent,
    isPremium: story.is_premium,
    isPublished: story.is_published,
    episodes: (episodes || []).map((ep) => ({
      id: ep.id,
      label: ep.label || `Episode ${ep.episode_number}`,
      title: ep.title,
      duration: ep.duration,
      audioSrc: ep.audio_url,
      description: ep.description,
      isPremium: ep.is_premium,
      isPublished: ep.is_published,
    })),
  };
}

const apiConfigured = () => !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

async function apiHeaders() {
  const headers = { Accept: 'application/json' };
  const token = await getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchStories() {
  if (!apiConfigured()) {
    return staticStories;
  }

  try {
    const res = await fetch('/api/stories', { headers: await apiHeaders() });
    if (!res.ok) {
      console.warn('[stories] API failed', res.status);
      return staticStories;
    }
    const data = await res.json();
    const list = data.stories || [];
    if (!list.length) {
      return staticStories;
    }
    return list.map(({ story, episodes }) => mapDbStoryToApp(story, episodes));
  } catch (e) {
    console.warn('[stories] Falling back to static data.', e);
    return staticStories;
  }
}

export async function fetchStoryBySlug(slug) {
  if (!apiConfigured()) {
    return staticStories.find((s) => s.slug === slug) || null;
  }

  try {
    const res = await fetch(`/api/stories?slug=${encodeURIComponent(slug)}`, {
      headers: await apiHeaders(),
    });
    if (!res.ok) {
      return staticStories.find((s) => s.slug === slug) || null;
    }
    const data = await res.json();
    if (!data.story) {
      return staticStories.find((s) => s.slug === slug) || null;
    }
    return mapDbStoryToApp(data.story, data.episodes || []);
  } catch (e) {
    console.warn('[stories] fetchStoryBySlug failed', e);
    return staticStories.find((s) => s.slug === slug) || null;
  }
}

export async function updateStoryMeta({ id, title, is_published, is_premium, duration_label }) {
  if (!apiConfigured()) {
    console.warn('[stories] updateStoryMeta: Neon API not configured; no-op.');
    throw new Error('Updating stories requires Clerk and backend /api routes.');
  }

  if (!id) {
    throw new Error('updateStoryMeta requires a story id.');
  }

  const token = await getAuthToken();
  if (!token) {
    throw new Error('You must be signed in as admin to update stories.');
  }

  const payload = {};
  if (typeof title === 'string') payload.title = title;
  if (typeof is_published === 'boolean') payload.is_published = is_published;
  if (typeof is_premium === 'boolean') payload.is_premium = is_premium;
  if (typeof duration_label === 'string') payload.duration_label = duration_label;

  if (Object.keys(payload).length === 0) {
    return { data: null, error: null };
  }

  const res = await fetch('/api/admin/stories', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id, ...payload }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Update failed');
    console.error('[stories] updateStoryMeta failed', err);
    return { data: null, error: err };
  }

  return { data: body.data, error: null };
}
