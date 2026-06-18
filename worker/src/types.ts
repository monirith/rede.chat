export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  GEMINI_MODEL: string;
  APP_ORIGIN: string;
  WELCOME_SECONDS: string;
  ANON_WELCOME_SECONDS: string;

  // --- Self-hosted auth (Better Auth) ---
  // Random 32+ byte string; signs sessions. `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Apple "Sign in with Apple": CLIENT_ID is the Services ID (web) or bundle id;
  // CLIENT_SECRET is the signed JWT generated from your .p8 key (see SETUP).
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;

  // --- Transactional email (OTP) ---
  EMAIL_PROVIDER?: string; // "purelymail" | "smtp" | "resend" (default) | "postmark" | "mailgun"
  EMAIL_API_KEY?: string;  // REST key, or SMTP password for purelymail/smtp
  EMAIL_FROM?: string;
  EMAIL_USER?: string;     // SMTP username (purelymail/smtp)
  EMAIL_SMTP_HOST?: string;
  EMAIL_SMTP_PORT?: string;
  MAILGUN_DOMAIN?: string;

  // Salt for hashing anonymous-user IPs. Optional; defaults to a constant
  // string if unset, which is fine for the throttling use case here.
  IP_HASH_SALT?: string;
  // In-App Purchase verification (mobile clients). Optional — only required
  // when the corresponding platform actually attempts a purchase.
  APPLE_SHARED_SECRET?: string;
  IOS_BUNDLE_ID?: string;
  ANDROID_PACKAGE_NAME?: string;
  GOOGLE_PLAY_SA_JSON?: string;
}

export interface SessionStartMessage {
  type: "start";
  dialect: string;
  scenario: string;
}

export interface SessionStopMessage {
  type: "stop";
}

export type ClientMessage = SessionStartMessage | SessionStopMessage;

export interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  auth_sub: string | null;
  seconds: number;
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
  welcome_credits_granted_at: string | null;
  ip_hash: string | null;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  dialect: string;
  scenario: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  tokens_input: number;
  tokens_output: number;
  seconds_used: number;
  feedback_json: string | null;
  transcript_text: string | null;
}
