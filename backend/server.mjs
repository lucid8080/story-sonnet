/**
 * Local dev server for /api routes. Point Vite proxy here (see story-app/vite.config.js).
 */
import express from 'express';
import dotenv from 'dotenv';

import me from './me.js';
import storiesApi from './stories-api.js';
import adminStats from './admin-stats.js';
import adminUploads from './admin-uploads.js';
import adminStories from './admin-stories.js';
import upload from './upload.js';
import createCheckoutSession from './stripe/create-checkout-session.js';
import createCustomerPortal from './stripe/create-customer-portal.js';
import stripeWebhook from './stripe/stripe-webhook.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);

app.post(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => stripeWebhook(req, res)
);

app.post('/api/upload', (req, res) => upload(req, res));

app.use(express.json());

app.get('/api/me', (req, res) => me(req, res));
app.get('/api/stories', (req, res) => storiesApi(req, res));
app.get('/api/admin/stats', (req, res) => adminStats(req, res));
app.get('/api/admin/uploads', (req, res) => adminUploads(req, res));
app.patch('/api/admin/stories', (req, res) => adminStories(req, res));
app.post('/api/create-checkout-session', (req, res) => createCheckoutSession(req, res));
app.post('/api/create-customer-portal', (req, res) => createCustomerPortal(req, res));

app.listen(port, () => {
  console.log(`[story-sonnet-api] listening on http://localhost:${port}`);
});
