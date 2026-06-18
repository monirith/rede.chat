import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, createVerify, createPublicKey } from "node:crypto";

// End-to-end test for scripts/gen-apple-secret.mjs.
// Generates a throw-away ES256 keypair, runs the script, then decodes and
// signature-verifies the JWT against the public half — proving Apple's spec is
// honoured (header alg/kid, claims iss/sub/aud/iat/exp, raw R||S signature).

const TEAM_ID = "TESTTEAM00";
const SERVICES_ID = "chat.rede.test";
const KEY_ID = "ABCDEFGHIJ";

function b64urlToBuf(s: string) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

describe("scripts/gen-apple-secret.mjs", () => {
  let jwt: string;
  let publicKey: ReturnType<typeof createPublicKey>;
  let tmpDir: string;

  beforeAll(() => {
    const { privateKey: privKey, publicKey: pubKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    publicKey = pubKey;
    tmpDir = mkdtempSync(join(tmpdir(), "apple-secret-test-"));
    const p8Path = join(tmpDir, `AuthKey_${KEY_ID}.p8`);
    writeFileSync(p8Path, privKey.export({ type: "pkcs8", format: "pem" }) as string);

    const res = spawnSync(
      process.execPath,
      [
        join(__dirname, "..", "scripts", "gen-apple-secret.mjs"),
        "--p8", p8Path,
        "--kid", KEY_ID,
        "--team", TEAM_ID,
        "--services", SERVICES_ID,
        "--days", "30",
      ],
      { encoding: "utf8" },
    );
    if (res.status !== 0) {
      throw new Error(`gen-apple-secret exited ${res.status}: ${res.stderr}`);
    }
    jwt = res.stdout.trim();
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("produces a three-segment JWT", () => {
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("has the Apple-required header (alg=ES256, kid)", () => {
    const [headerB64] = jwt.split(".");
    const header = JSON.parse(b64urlToBuf(headerB64).toString("utf8"));
    expect(header).toMatchObject({ alg: "ES256", kid: KEY_ID });
  });

  it("has the Apple-required claims (iss/sub/aud/iat<exp)", () => {
    const [, payloadB64] = jwt.split(".");
    const claims = JSON.parse(b64urlToBuf(payloadB64).toString("utf8"));
    expect(claims.iss).toBe(TEAM_ID);
    expect(claims.sub).toBe(SERVICES_ID);
    expect(claims.aud).toBe("https://appleid.apple.com");
    expect(claims.iat).toBeTypeOf("number");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("rejects --days > 180 (Apple's hard ceiling)", () => {
    const res = spawnSync(
      process.execPath,
      [
        join(__dirname, "..", "scripts", "gen-apple-secret.mjs"),
        "--p8", "/dev/null", "--kid", KEY_ID, "--team", TEAM_ID,
        "--services", SERVICES_ID, "--days", "200",
      ],
      { encoding: "utf8" },
    );
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/6 months/);
  });

  it("signature verifies against the public key (raw R||S, not DER)", () => {
    const [h, p, s] = jwt.split(".");
    const signed = Buffer.from(`${h}.${p}`);
    const sig = b64urlToBuf(s);
    // crypto.verify with dsaEncoding 'ieee-p1363' matches the JOSE raw format
    // the generator script emits.
    const verifier = createVerify("SHA256");
    verifier.update(signed);
    const ok = verifier.verify(
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      sig,
    );
    expect(ok).toBe(true);
  });
});
