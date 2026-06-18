// Generate the Apple "Sign in with Apple" client secret (an ES256 JWT).
//
// Apple requires the OAuth client_secret to be a short-lived JWT signed with
// your .p8 key. Max lifetime is 6 months, so this must be re-run and the
// secret re-uploaded before it expires.
//
// Usage:
//   node scripts/gen-apple-secret.mjs \
//     --p8 /path/to/AuthKey_XXXX.p8 \
//     --kid J9ZBZ63LMA \
//     --team TEAMID1234 \
//     --services chat.rede.signin \
//     [--days 180]
//
// Prints the JWT to stdout. Pipe it into:
//   node scripts/gen-apple-secret.mjs ... | npx wrangler secret put APPLE_CLIENT_SECRET

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const p8Path = arg("p8");
const kid = arg("kid");
const team = arg("team");
const services = arg("services");
const days = parseInt(arg("days", "180"), 10);

if (!p8Path || !kid || !team || !services) {
  console.error("Missing required args. Need --p8 --kid --team --services");
  process.exit(1);
}
if (days > 180) {
  console.error("Apple rejects secrets valid for more than 6 months (180 days).");
  process.exit(1);
}

const privateKey = readFileSync(p8Path, "utf8");

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid };
const payload = {
  iss: team,
  iat: now,
  exp: now + days * 24 * 60 * 60,
  aud: "https://appleid.apple.com",
  sub: services,
};

const signingInput =
  b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));

// ES256 = ECDSA P-256 + SHA-256, JOSE wants raw R||S (not DER).
const der = createSign("SHA256").update(signingInput).sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
const jwt = signingInput + "." + b64url(der);

process.stdout.write(jwt);
process.stderr.write(
  `\nApple client secret generated. Expires ${new Date(payload.exp * 1000).toISOString()} (${days} days).\n`
);
