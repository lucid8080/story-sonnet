import Stripe from 'stripe';
import dotenv from 'dotenv';
import { getSql } from '../lib/db.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30',
});

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe] Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        await handleSubscriptionChange(customerId, subscriptionId, 'active');
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        await handleSubscriptionChange(customerId, subscription.id, status);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await handleSubscriptionChange(customerId, subscription.id, 'canceled');
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe] Webhook handler error', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleSubscriptionChange(customerId, subscriptionId, status) {
  let profileStatus = 'free';
  if (status === 'active' || status === 'trialing') {
    profileStatus = 'active';
  } else if (status === 'past_due' || status === 'unpaid') {
    profileStatus = 'past_due';
  } else if (status === 'canceled' || status === 'incomplete_expired') {
    profileStatus = 'canceled';
  }

  const sql = getSql();
  const profiles = await sql`
    select id from public.profiles
    where stripe_customer_id = ${customerId}
    limit 1
  `;

  if (!profiles || profiles.length === 0) {
    return;
  }

  const profile = profiles[0];

  await sql`
    update public.profiles
    set subscription_status = ${profileStatus}, updated_at = now()
    where id = ${profile.id}
  `;
}
