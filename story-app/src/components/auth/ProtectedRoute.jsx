import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (!clerkConfigured) {
    return children;
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
