import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email transport.
 *
 * One place decides *how* mail is sent: Gmail/SMTP (nodemailer), Resend (HTTP),
 * or a console fallback for local development. Selection is automatic based on
 * the environment, with `EMAIL_TRANSPORT` as an override.
 */

export type TransportId = "gmail" | "resend" | "console";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendResult = {
  ok: boolean;
  /** Which transport actually handled it: "gmail" | "resend" | "console". */
  channel: TransportId | "dev-log";
  error?: string;
};

export function activeTransport(): TransportId {
  const forced = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
  if (forced === "gmail" || forced === "resend" || forced === "console") return forced;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "gmail";
  if (process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL) return "resend";
  return "console";
}

export function emailFrom(): string {
  return (
    process.env.MAIL_FROM ??
    process.env.ALERT_FROM_EMAIL ??
    "Radar <noreply@localhost>"
  );
}

let transporter: Transporter | null = null;

function smtpTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port,
      secure: (process.env.SMTP_SECURE ?? String(port === 465)) === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const transport = activeTransport();

  if (transport === "console") {
    console.log(`[email:dev-log] to=${message.to} subject="${message.subject}"`);
    return { ok: true, channel: "dev-log" };
  }

  if (transport === "gmail") {
    try {
      await smtpTransporter().sendMail({
        from: emailFrom(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true, channel: "gmail" };
    } catch (error) {
      return {
        ok: false,
        channel: "gmail",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Resend (HTTP API)
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, channel: "resend", error: "RESEND_API_KEY is not set" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, channel: "resend", error: `Resend ${response.status}: ${detail}` };
    }
    return { ok: true, channel: "resend" };
  } catch (error) {
    return {
      ok: false,
      channel: "resend",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Send a plain test email — used by the "send test email" button in settings. */
export async function sendTestEmail(to: string): Promise<SendResult> {
  return sendEmail({
    to,
    subject: "Radar test email",
    text: "This is a test email from Radar.\n\nIf you can read this, your email transport is working.",
    html: `<p style="font-family:system-ui,sans-serif">This is a test email from <strong>Radar</strong>.</p><p style="font-family:system-ui,sans-serif">If you can read this, your email transport is working.</p>`,
  });
}
