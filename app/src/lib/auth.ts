// Self-hosted auth client (Better Auth).
//
// Talks to the Worker's /api/auth/* endpoints. Login methods: passwordless
// email OTP (two steps: request code, then verify code) + Google + Apple.
//
// The session is carried as a bearer token (Better Auth `bearer` plugin), kept
// in localStorage and attached via authHeader(). This keeps the existing
// Authorization: Bearer pattern and the WebSocket `?token=` flow working
// without relying on third-party cookies.

import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { config } from "./config";
import { getDeviceId } from "./device";

const TOKEN_KEY = "rede:auth-token";
const MOCK = import.meta.env.VITE_MOCK === "true";

export const authClient = createAuthClient({
  baseURL: config.workerUrl,
  basePath: "/api/auth",
  plugins: [emailOTPClient()],
  fetchOptions: {
    // Capture the bearer token Better Auth returns on successful sign-in.
    onSuccess(ctx) {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) localStorage.setItem(TOKEN_KEY, token);
    },
    // Send the stored token on every auth request.
    auth: {
      type: "Bearer",
      token: () => localStorage.getItem(TOKEN_KEY) || "",
    },
  },
});

// Minimal session shape the app consumes (callers only read `.user.id` /
// `.user.email` and truthiness).
export interface Session {
  user: { id: string; email: string | null };
}

let currentSession: Session | null = MOCK
  ? { user: { id: "mock-user-1", email: "felix.mueller@example.ch" } }
  : null;

export function getSession(): Session | null {
  return currentSession;
}

export function setSession(s: Session | null) {
  currentSession = s;
}

export async function initAuth(): Promise<Session | null> {
  if (MOCK) return currentSession;
  try {
    const { data } = await authClient.getSession();
    currentSession = data?.user
      ? { user: { id: data.user.id, email: data.user.email ?? null } }
      : null;
  } catch {
    currentSession = null;
  }
  return currentSession;
}

// Step 1 of email login: send a one-time code. Returns an error message or null.
export async function signInWithEmail(email: string): Promise<string | null> {
  const { error } = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });
  return error?.message ?? null;
}

// Step 2 of email login: verify the code. On success the session is loaded.
export async function verifyEmailOtp(email: string, code: string): Promise<string | null> {
  const { error } = await authClient.signIn.emailOtp({ email, otp: code });
  if (error) return error.message ?? "Invalid code";
  await initAuth();
  return null;
}

export type OAuthProvider = "google" | "apple";

export async function signInWithOAuth(provider: OAuthProvider): Promise<string | null> {
  // Redirects to the provider, then back to the app origin. The token is
  // captured on the callback round-trip via onSuccess above.
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: window.location.origin,
  });
  return error?.message ?? null;
}

export async function signOut() {
  try {
    await authClient.signOut();
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
    window.location.href = "/";
  }
}

// Bearer token for transports that can't send headers (the live WebSocket
// passes it as `?token=`). Null when signed out.
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function authHeader(): Record<string, string> {
  // Always send device id; bearer token is added on top when signed in so the
  // Worker can link an anonymous device-user to the account.
  const headers: Record<string, string> = { "X-Device-Id": getDeviceId() };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
