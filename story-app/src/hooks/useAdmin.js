import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from './useAuth.js';

export function useAdmin() {
  const { profile } = useAuth();
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!clerkConfigured && import.meta.env.DEV && !warnedRef.current) {
      warnedRef.current = true;
      console.warn(
        '[useAdmin] VITE_CLERK_PUBLISHABLE_KEY is missing; treating isAdmin as false (admin UI hidden).'
      );
    }
  }, [clerkConfigured]);

  const isAdmin = useMemo(() => {
    if (!clerkConfigured) return false;
    return profile?.role === 'admin';
  }, [profile?.role, clerkConfigured]);

  return {
    isAdmin,
  };
}
