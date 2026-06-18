import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendOtpEmail } from "../src/email";
import type { Env } from "../src/types";

// Minimal Env stub. Each test overrides the email-related fields.
function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as unknown as D1Database,
    GEMINI_API_KEY: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    GEMINI_MODEL: "",
    APP_ORIGIN: "https://rede.chat",
    WELCOME_SECONDS: "600",
    ANON_WELCOME_SECONDS: "60",
    BETTER_AUTH_SECRET: "x",
    EMAIL_API_KEY: "test-key",
    EMAIL_FROM: "rede <login@rede.chat>",
    ...overrides,
  };
}

describe("sendOtpEmail — HTTP transport selection", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to Resend when no provider is set", async () => {
    await sendOtpEmail(baseEnv(), "u@example.com", "123456", "sign-in");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("routes to Postmark when EMAIL_PROVIDER=postmark", async () => {
    await sendOtpEmail(
      baseEnv({ EMAIL_PROVIDER: "postmark" }),
      "u@example.com", "123456", "sign-in",
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect((init.headers as Record<string, string>)["X-Postmark-Server-Token"]).toBe("test-key");
  });

  it("routes to Mailgun when EMAIL_PROVIDER=mailgun and uses the configured domain", async () => {
    await sendOtpEmail(
      baseEnv({ EMAIL_PROVIDER: "mailgun", MAILGUN_DOMAIN: "mg.rede.chat" }),
      "u@example.com", "123456", "sign-in",
    );
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mailgun.net/v3/mg.rede.chat/messages");
  });

  it("throws on unknown providers", async () => {
    await expect(
      sendOtpEmail(baseEnv({ EMAIL_PROVIDER: "notreal" }), "u@example.com", "123456", "sign-in"),
    ).rejects.toThrow(/Unknown EMAIL_PROVIDER/);
  });

  it("logs and returns without sending if EMAIL_API_KEY is missing (dev fallback)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendOtpEmail(
      baseEnv({ EMAIL_API_KEY: undefined as unknown as string }),
      "u@example.com", "123456", "sign-in",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("surfaces upstream failures with the provider name and status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 422 }));
    await expect(
      sendOtpEmail(baseEnv(), "u@example.com", "123456", "sign-in"),
    ).rejects.toThrow(/email send failed \(resend 422\)/);
  });
});
