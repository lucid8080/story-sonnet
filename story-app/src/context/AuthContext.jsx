import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAuth as useClerkAuth,
  useSignIn,
  useSignUp,
  useUser,
} from '@clerk/clerk-react';
import { registerAuthTokenGetter } from '../lib/authToken.js';
import { AuthContext } from './auth-context.js';

function clerkErrMessage(err) {
  if (!err) return null;
  const first = err.errors?.[0];
  return (
    first?.longMessage ||
    first?.message ||
    err.message ||
    (typeof err === 'string' ? err : null) ||
    'Request failed'
  );
}

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
        const parts = fullName?.trim() ? fullName.trim().split(/\s+/) : [];
        const firstName = parts[0] || undefined;
        const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

        const { error: pwError } = await signUp.password({
          emailAddress: email,
          password,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        });
        if (pwError) {
          const msg = clerkErrMessage(pwError) || 'Sign up failed';
          setError(msg);
          return { error: msg };
        }

        if (signUp.status === 'complete' && signUp.createdSessionId) {
          if (typeof signUp.finalize === 'function') {
            const { error: finError } = await signUp.finalize();
            if (finError) {
              const msg = clerkErrMessage(finError) || 'Could not complete sign-up';
              setError(msg);
              return { error: msg };
            }
          } else {
            await setSignUpSession({ session: signUp.createdSessionId });
          }
          return {};
        }

        const unverified = signUp.unverifiedFields ?? [];
        const emailPending = unverified.some((f) => {
          if (f === 'email_address') return true;
          if (typeof f === 'string') return f.includes('email');
          return f?.name === 'email_address';
        });
        if (emailPending && typeof signUp.verifications?.sendEmailCode === 'function') {
          const { error: sendErr } = await signUp.verifications.sendEmailCode();
          if (sendErr) {
            const msg = clerkErrMessage(sendErr) || 'Could not send verification email';
            setError(msg);
            return { error: msg };
          }
          return { needsEmailVerification: true };
        }

        const msg =
          signUp.missingFields?.length > 0
            ? `Sign-up needs more information (${signUp.missingFields.map((x) => x?.name || x).join(', ')}).`
            : 'Sign-up is not complete yet. Check your email or try again.';
        setError(msg);
        return { error: msg };
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Sign up failed';
        setError(msg);
        return { error: msg };
      }
    },
    [signUpLoaded, signUp, setSignUpSession]
  );

  const verifySignUpEmailCode = useCallback(
    async ({ code }) => {
      if (!signUpLoaded || !signUp) return { error: 'Auth not ready.' };
      setError(null);
      try {
        const { error: vError } = await signUp.verifications.verifyEmailCode({ code });
        if (vError) {
          const msg = clerkErrMessage(vError) || 'Invalid code';
          setError(msg);
          return { error: msg };
        }
        if (signUp.status === 'complete' && signUp.createdSessionId) {
          if (typeof signUp.finalize === 'function') {
            const { error: finError } = await signUp.finalize();
            if (finError) {
              const msg = clerkErrMessage(finError) || 'Could not complete sign-up';
              setError(msg);
              return { error: msg };
            }
          } else {
            await setSignUpSession({ session: signUp.createdSessionId });
          }
          return {};
        }
        const msg = 'Email verified but sign-up is not complete yet. Try again or contact support.';
        setError(msg);
        return { error: msg };
      } catch (e) {
        const msg = e?.errors?.[0]?.message || e?.message || 'Verification failed';
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
        const { error: pwError } = await signIn.password({
          identifier: email,
          password,
        });
        if (pwError) {
          const msg = clerkErrMessage(pwError) || 'Sign in failed';
          setError(msg);
          return { error: msg };
        }

        const sessionId = signIn.createdSessionId;
        if (sessionId) {
          if (typeof signIn.finalize === 'function') {
            const { error: finError } = await signIn.finalize();
            if (finError) {
              const msg = clerkErrMessage(finError) || 'Could not complete sign-in';
              setError(msg);
              return { error: msg };
            }
          } else {
            await setSignInSession({ session: sessionId });
          }
          return {};
        }

        const sf = signIn.supportedSecondFactors ?? [];
        if (sf.length > 0) {
          const msg =
            'This account requires an extra sign-in step (for example two-factor authentication). Complete sign-in using your provider’s instructions, or ask an admin to adjust MFA settings.';
          setError(msg);
          return { error: msg };
        }

        const msg =
          'Sign-in did not finish. If you just signed up, confirm your email from the verification message, then try again.';
        setError(msg);
        return { error: msg };
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
        const { error: createErr } = await signIn.create({ identifier: email });
        if (createErr) {
          const msg = clerkErrMessage(createErr) || 'Could not start reset';
          setError(msg);
          return { error: msg };
        }
        const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode();
        if (sendErr) {
          const msg = clerkErrMessage(sendErr) || 'Could not start reset';
          setError(msg);
          return { error: msg };
        }
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
      verifySignUpEmailCode,
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
      verifySignUpEmailCode,
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
      verifySignUpEmailCode: async () => ({ error: 'Clerk is not configured.' }),
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
