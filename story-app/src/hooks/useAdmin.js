import { useMemo } from 'react';
import { useAuth } from './useAuth.js';

export function useAdmin() {
  const { profile } = useAuth();
  const clerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  const isAdmin = useMemo(() => {
    if (!clerkConfigured) return true;
    return profile?.role === 'admin';
  }, [profile?.role, clerkConfigured]);

  return {
    isAdmin,
  };
}
