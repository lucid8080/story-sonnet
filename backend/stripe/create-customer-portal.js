import Stripe from 'stripe';
import dotenv from 'dotenv';
import { verifyBearerToken } from '../lib/clerk-verify.js';
import { getSql } from '../lib/db.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30',
});

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
    const profiles = await sql`
      select * from public.profiles where id = ${auth.userId} limit 1
    `;
    const profile = profiles[0];

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found for this user.' });
    }

    const { returnUrl } = req.body || {};

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl || `${process.env.SITE_URL}/account`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('[Stripe] create-customer-portal error', error);
    return res.status(500).json({ error: 'Unable to open customer portal' });
  }
}
