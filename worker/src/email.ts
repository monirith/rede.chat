// Transactional email for auth (OTP codes).
//
// Set EMAIL_PROVIDER to:
//   "purelymail" | "smtp"          SMTP over Cloudflare sockets (PurelyMail)
//   "resend" | "postmark" | "mailgun"   simple REST APIs
// Defaults to "resend".
//
// Secrets (wrangler secret put):
//   EMAIL_PROVIDER   "purelymail" for the current PurelyMail setup
//   EMAIL_FROM       verified sender, e.g. "rede <gruezi@rede.chat>"
//   EMAIL_API_KEY    REST API key, OR the SMTP password for purelymail/smtp
//   EMAIL_USER       SMTP username (purelymail/smtp); defaults to the EMAIL_FROM address
//   EMAIL_SMTP_HOST  optional; defaults to smtp.purelymail.com for purelymail
//   EMAIL_SMTP_PORT  optional; defaults to 465 (implicit TLS)
//   MAILGUN_DOMAIN   only if EMAIL_PROVIDER=mailgun

import type { Env } from "./types";

type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

export async function sendOtpEmail(env: Env, email: string, otp: string, type: OtpType): Promise<void> {
  const subject =
    type === "sign-in" ? `Dein rede Login-Code: ${otp}` : `Dein rede Bestätigungscode: ${otp}`;
  const { html, text } = renderOtp(otp);
  const from = env.EMAIL_FROM || "rede <login@rede.chat>";
  const provider = (env.EMAIL_PROVIDER || "resend").toLowerCase();

  if (!env.EMAIL_API_KEY) {
    // Fail loud in logs but do not throw raw secrets. In dev with no key set,
    // surface the code so local testing still works.
    console.warn(`[email] EMAIL_API_KEY not set; OTP for ${email} is ${otp} (dev fallback)`);
    return;
  }

  // SMTP transports (PurelyMail) go over Cloudflare sockets, not fetch.
  if (provider === "purelymail" || provider === "smtp") {
    const host = env.EMAIL_SMTP_HOST || (provider === "purelymail" ? "smtp.purelymail.com" : "");
    const port = parseInt(env.EMAIL_SMTP_PORT || "465", 10);
    if (!host) throw new Error("EMAIL_SMTP_HOST required for smtp provider");
    // Parse "Name <addr@host>" into a structured sender; SMTP needs a bare
    // address in MAIL FROM, not the whole display string.
    const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const fromUser = m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
    const username = env.EMAIL_USER || fromUser.email;
    // Lazy-imported so test envs (Node, no `cloudflare:sockets`) can import
    // this module without pulling the SMTP transport.
    const { WorkerMailer } = await import("worker-mailer");
    await WorkerMailer.send(
      {
        host,
        port,
        secure: port === 465,        // implicit TLS on 465, STARTTLS on 587
        startTls: port === 587,
        authType: ["plain", "login"],
        credentials: { username, password: env.EMAIL_API_KEY },
      },
      { from: fromUser, to: email, subject, text, html }
    );
    return;
  }

  let res: Response;
  switch (provider) {
    case "resend":
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.EMAIL_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, to: [email], subject, html, text }),
      });
      break;

    case "postmark":
      res = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "X-Postmark-Server-Token": env.EMAIL_API_KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          From: from,
          To: email,
          Subject: subject,
          HtmlBody: html,
          TextBody: text,
          MessageStream: "outbound",
        }),
      });
      break;

    case "mailgun": {
      const domain = env.MAILGUN_DOMAIN;
      if (!domain) throw new Error("MAILGUN_DOMAIN required for mailgun provider");
      const form = new URLSearchParams({ from, to: email, subject, html, text });
      res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${env.EMAIL_API_KEY}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      break;
    }

    default:
      throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`email send failed (${provider} ${res.status}): ${detail.slice(0, 300)}`);
  }
}

// Plain, Swiss-facing copy. No em dashes, no "Expat" wording.
function renderOtp(otp: string): { html: string; text: string } {
  const text = [
    "Dein Login-Code für rede:",
    "",
    otp,
    "",
    "Der Code ist 10 Minuten gültig. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f7f9;margin:0;padding:32px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #eceef1">
    <p style="margin:0 0 16px;font-size:15px;color:#111">Dein Login-Code für <strong>rede</strong>:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;margin:24px 0;color:#111">${otp}</div>
    <p style="margin:16px 0 0;font-size:13px;color:#667">Der Code ist 10 Minuten gültig. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>
  </div>
</body></html>`;

  return { html, text };
}
