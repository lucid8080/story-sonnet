import { getSql } from './db.js';

export async function loadAllStoriesWithEpisodes() {
  const sql = getSql();
  const stories = await sql`
    select * from public.stories order by created_at desc
  `;
  if (!stories.length) return { stories: [], episodesByStoryId: {} };
  const idSet = new Set(stories.map((s) => s.id));
  const episodes = (await sql`
    select * from public.episodes order by story_id, episode_number asc
  `).filter((ep) => idSet.has(ep.story_id));
  const episodesByStoryId = {};
  for (const ep of episodes) {
    if (!episodesByStoryId[ep.story_id]) episodesByStoryId[ep.story_id] = [];
    episodesByStoryId[ep.story_id].push(ep);
  }
  return { stories, episodesByStoryId };
}

export async function loadStoryBySlug(slug) {
  const sql = getSql();
  const rows = await sql`
    select * from public.stories where slug = ${slug} limit 1
  `;
  const story = rows[0];
  if (!story) return null;
  const episodes = await sql`
    select * from public.episodes
    where story_id = ${story.id}
    order by episode_number asc
  `;
  return { story, episodes };
}

/**
 * @param {{ isAdmin?: boolean, isSubscriber?: boolean }} access
 */
export function filterStoryRowsForAccess(story, episodes, access) {
  const { isAdmin, isSubscriber } = access;
  if (isAdmin) {
    return { story, episodes };
  }
  const canSeeStory =
    story.is_published &&
    (!story.is_premium || isSubscriber);
  if (!canSeeStory) {
    return null;
  }
  const filteredEps = (episodes || []).filter(
    (ep) =>
      ep.is_published &&
      (!ep.is_premium || isSubscriber)
  );
  return { story, episodes: filteredEps };
}
