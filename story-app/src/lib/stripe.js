// Frontend helpers for talking to the Stripe backend.
// Send Clerk session token so the API can identify the user.

import { getAuthToken } from './authToken.js';

const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

async function postJson(path, body) {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = await getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body ?? {}),
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  return res.json();
}

export async function startCheckout() {
  const { url } = await postJson('/api/create-checkout-session', {
    returnUrlSuccess: `${siteUrl}/billing/success`,
    returnUrlCancel: `${siteUrl}/billing/cancel`,
  });

  if (url) {
    window.location.href = url;
  }
}

export async function openCustomerPortal() {
  const { url } = await postJson('/api/create-customer-portal', {
    returnUrl: `${siteUrl}/account`,
  });

  if (url) {
    window.location.href = url;
  }
}
