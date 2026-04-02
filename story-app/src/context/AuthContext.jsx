import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAuth as useClerkAuth,
  useSignIn,
  useSignUp,
  useUser,
} from '@clerk/clerk-react';
import { registerAuthTokenGetter } from '../lib/authToken.js';
import { AuthContext } from './auth-context.js';

function AuthProviderInner({ children }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { user } = useUser();
  const { signIn, setActive: setSignInSession, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpSession, isLoaded: signUpLoaded } = useSignUp();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    registerAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    let ignore = false;

    async function syncProfile() {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setProfile(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          if (!ignore) setProfile(null);
          return;
        }
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text();
          console.error('[Auth] /api/me failed', res.status, text);
          if (!ignore) setError('Could not load profile');
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setProfile(data.profile ?? null);
          setError(null);
        }
      } catch (e) {
        console.error('[Auth] profile sync error', e);
        if (!ignore) setError(e?.message || 'Profile error');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    syncProfile();
    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, getToken, user?.id]);

  const signUpWithEmail = useCallback(
    async ({ email, password, fullName }) => {
      if (!signUpLoaded || !signUp) return { error: 'Auth not ready.' };
      setError(null);
      try {
        await signUp.create({
          emailAddress: email,
          password,
        });
        if (fullName) {
          const parts = fullName.trim().split(/\s+/);
          await signUp.update({
            firstName: parts[0] || undefined,
            lastName: parts.slice(1).join(' ') || undefined,
          });
        }
        if (signUp.status === 'complete' && signUp.createdSessionId) {
          await setSignUpSession({ session: signUp.createdSessionId });
        }
        return {};
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Sign up failed';
        setError(msg);
        return { error: msg };
      }
    },
    [signUpLoaded, signUp, setSignUpSession]
  );

  const signInWithEmail = useCallback(
    async ({ email, password }) => {
      if (!signInLoaded || !signIn) return { error: 'Auth not ready.' };
      setError(null);
      try {
        const result = await signIn.create({
          identifier: email,
          password,
        });
        if (result.status === 'complete' && result.createdSessionId) {
          await setSignInSession({ session: result.createdSessionId });
        }
        return {};
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Sign in failed';
        setError(msg);
        return { error: msg };
      }
    },
    [signInLoaded, signIn, setSignInSession]
  );

  const signInWithProvider = useCallback(
    async (provider) => {
      if (!signInLoaded || !signIn) return { error: 'Auth not ready.' };
      setError(null);
      const strategy =
        provider === 'google'
          ? 'oauth_google'
          : provider === 'apple'
            ? 'oauth_apple'
            : null;
      if (!strategy) {
        return { error: 'Unsupported provider.' };
      }
      try {
        await signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: `${window.location.origin}/sso-callback`,
          redirectUrlComplete: '/',
        });
        return {};
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'OAuth failed';
        setError(msg);
        return { error: msg };
      }
    },
    [signInLoaded, signIn]
  );

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await clerkSignOut();
      setProfile(null);
      return {};
    } catch (e) {
      const msg = e?.message || 'Sign out failed';
      setError(msg);
      return { error: msg };
    }
  }, [clerkSignOut]);

  const requestPasswordReset = useCallback(
    async (email) => {
      if (!signInLoaded || !signIn) return { error: 'Auth not ready.' };
      setError(null);
      try {
        await signIn.create({
          strategy: 'reset_password_email_code',
          identifier: email,
        });
        return {};
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Could not start reset';
        setError(msg);
        return { error: msg };
      }
    },
    [signInLoaded, signIn]
  );

  const value = useMemo(
    () => ({
      supabase: null,
      session: null,
      user: user
        ? {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? null,
          }
        : null,
      profile,
      loading: !isLoaded || loading,
      error,
      signUpWithEmail,
      signInWithEmail,
      signInWithProvider,
      signOut,
      requestPasswordReset,
      getToken,
    }),
    [
      user,
      profile,
      isLoaded,
      loading,
      error,
      signUpWithEmail,
      signInWithEmail,
      signInWithProvider,
      signOut,
      requestPasswordReset,
      getToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthProviderStatic({ children }) {
  const value = useMemo(
    () => ({
      supabase: null,
      session: null,
      user: null,
      profile: null,
      loading: false,
      error: null,
      signUpWithEmail: async () => ({ error: 'Clerk is not configured.' }),
      signInWithEmail: async () => ({ error: 'Clerk is not configured.' }),
      signInWithProvider: async () => ({ error: 'Clerk is not configured.' }),
      signOut: async () => ({}),
      requestPasswordReset: async () => ({ error: 'Clerk is not configured.' }),
      getToken: async () => null,
    }),
    []
  );

  useEffect(() => {
    registerAuthTokenGetter(async () => null);
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    console.warn(
      '[Auth] VITE_CLERK_PUBLISHABLE_KEY is missing. Auth and API-backed stories are disabled.'
    );
    return <AuthProviderStatic>{children}</AuthProviderStatic>;
  }

  return <AuthProviderInner>{children}</AuthProviderInner>;
}
