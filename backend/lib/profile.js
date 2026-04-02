import { getSql } from './db.js';

export async function getProfileByUserId(userId) {
  const sql = getSql();
  const rows = await sql`
    select * from public.profiles where id = ${userId} limit 1
  `;
  return rows[0] ?? null;
}

export async function upsertProfileFromClerk({ userId, email, fullName }) {
  const sql = getSql();
  const rows = await sql`
    insert into public.profiles (id, email, full_name, updated_at)
    values (${userId}, ${email ?? null}, ${fullName ?? null}, now())
    on conflict (id) do update set
      email = coalesce(excluded.email, public.profiles.email),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now()
    returning *
  `;
  return rows[0];
}
