import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createClerkClient } from '@clerk/backend';
import { verifyBearerToken } from '../lib/clerk-verify.js';
import { getSql } from '../lib/db.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30',
});

const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const auth = await verifyBearerToken(authHeader);

    if (!auth?.userId) {
      return res.status(401).json({ error: 'Missing or invalid auth token' });
    }

    const sql = getSql();
    let profiles = await sql`
      select * from public.profiles where id = ${auth.userId} limit 1
    `;
    let profile = profiles[0];

    if (!profile && clerk) {
      const user = await clerk.users.getUser(auth.userId);
      const email = user.emailAddresses?.[0]?.emailAddress ?? null;
      const fullName = user.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
        : user.username || null;
      const inserted = await sql`
        insert into public.profiles (id, email, full_name, updated_at)
        values (${auth.userId}, ${email}, ${fullName}, now())
        on conflict (id) do update set
          email = coalesce(excluded.email, public.profiles.email),
          full_name = coalesce(excluded.full_name, public.profiles.full_name),
          updated_at = now()
        returning *
      `;
      profile = inserted[0];
    }

    if (!profile) {
      return res.status(400).json({ error: 'Profile not found; open /account once after sign-in.' });
    }

    let customerId = profile.stripe_customer_id;
    const email = profile.email;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: {
          clerk_user_id: auth.userId,
        },
      });
      customerId = customer.id;

      await sql`
        update public.profiles
        set stripe_customer_id = ${customerId}, updated_at = now()
        where id = ${auth.userId}
      `;
    }

    const { returnUrlSuccess, returnUrlCancel } = req.body || {};

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: returnUrlSuccess || `${process.env.SITE_URL}/billing/success`,
      cancel_url: returnUrlCancel || `${process.env.SITE_URL}/billing/cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[Stripe] create-checkout-session error', error);
    return res.status(500).json({ error: 'Unable to start checkout' });
  }
}
