import dotenv from 'dotenv';
import { createClerkClient } from '@clerk/backend';
import { verifyBearerToken } from './lib/clerk-verify.js';
import { upsertProfileFromClerk } from './lib/profile.js';

dotenv.config();

const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyBearerToken(req.headers.authorization);
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let email = null;
    let fullName = null;
    if (clerk) {
      const user = await clerk.users.getUser(auth.userId);
      email = user.emailAddresses?.[0]?.emailAddress ?? null;
      fullName = user.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
        : user.username || null;
    }

    const profile = await upsertProfileFromClerk({
      userId: auth.userId,
      email,
      fullName,
    });
    return res.status(200).json({ profile });
  } catch (e) {
    console.error('[me] error', e);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
}
