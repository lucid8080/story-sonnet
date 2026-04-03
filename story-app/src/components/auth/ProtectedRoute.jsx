import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

function ClerkUnavailable() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-5">
      <div className="max-w-md rounded-2xl bg-white px-6 py-5 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
        <p className="font-semibold text-slate-900">Sign-in is not available</p>
        <p className="mt-2">
          This build is missing <span className="font-mono text-xs">VITE_CLERK_PUBLISHABLE_KEY</span>. Add it to{' '}
          <span className="font-mono text-xs">story-app/.env.local</span> to use account and admin features.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-50"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkConfigured) {
    return <ClerkUnavailable />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-100">
          Checking your account...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
