-- rede.chat D1 schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                  -- "dev_<uuid>" for anonymous, or kept stable after sign-in
  name TEXT,                            -- display name, user-editable
  email TEXT,                           -- NULL until user signs in or buys credits
  auth_sub TEXT,                        -- Better Auth user id, set when user signs in
  credits INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_session_date TEXT,
  welcome_credits_granted_at TEXT,      -- ISO timestamp; set once per user, prevents double-granting
  ip_hash TEXT,                         -- Hashed CF-Connecting-IP. Used to throttle the anonymous welcome bonus per IP.
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_ip_hash ON users(ip_hash) WHERE ip_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_sub ON users(auth_sub) WHERE auth_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dialect TEXT NOT NULL,
  scenario TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  credits_deducted INTEGER NOT NULL DEFAULT 0,
  feedback_json TEXT,
  -- Note: transcript content stays on the user's device, never persisted server-side.
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_dialect ON sessions(user_id, dialect);

CREATE TABLE IF NOT EXISTS vocabulary (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dialect TEXT NOT NULL,
  expression TEXT NOT NULL,
  standard_german TEXT NOT NULL,
  explanation TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now')),
  source_session_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (source_session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_user ON vocabulary(user_id, dialect, saved_at DESC);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_checkout_id TEXT UNIQUE NOT NULL,
  amount_chf INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id, created_at DESC);
