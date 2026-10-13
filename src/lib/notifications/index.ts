import { formatMoney } from "@/lib/flights/types";
import { formatDate } from "@/lib/utils/format";
import type { AlertKind, AlertPayload, DispatchResult } from "./types";

export type { AlertKind, AlertPayload, DispatchResult } from "./types";

const HEADLINE: Record<AlertKind, string> = {
  target: "Price target hit",
  drop: "Price dropped",
  "all-time-low": "New lowest price",
};

function humanRoute(payload: AlertPayload): string {
  return `${payload.originLabel} (${payload.origin}) → ${payload.destinationLabel} (${payload.destination})`;
}

function subject(payload: AlertPayload): string {
  const price = formatMoney({ amountMinor: payload.priceMinor, currency: payload.currency });
  return `${HEADLINE[payload.kind]}: ${payload.origin} → ${payload.destination} at ${price}`;
}

function textBody(payload: AlertPayload): string {
  const price = formatMoney({ amountMinor: payload.priceMinor, currency: payload.currency });
  const lines = [
    `${HEADLINE[payload.kind]} — ${humanRoute(payload)}`,
    "",
    `Price:   ${price}`,
  ];
  if (payload.previousLowMinor !== undefined) {
    lines.push(
      `Previous low: ${formatMoney({
        amountMinor: payload.previousLowMinor,
        currency: payload.currency,
      })}`,
    );
  }
  lines.push(
    `Departs: ${formatDate(payload.departDate)}${
      payload.returnDate ? ` → ${formatDate(payload.returnDate)}` : ""
    }`,
    `Trip:    ${payload.tripType} · ${payload.cabin} · ${payload.adults} traveller(s)`,
    "",
    `Watch: ${payload.watchLabel}`,
  );
  return lines.join("\n");
}

function htmlBody(payload: AlertPayload): string {
  const price = formatMoney({ amountMinor: payload.priceMinor, currency: payload.currency });
  const previous =
    payload.previousLowMinor !== undefined
      ? `<p style="margin:4px 0;color:#71717a">Previous low: ${formatMoney({
          amountMinor: payload.previousLowMinor,
          currency: payload.currency,
        })}</p>`
      : "";
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto">
    <p style="text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#71717a;margin:0 0 8px">
      Radar alert
    </p>
    <h1 style="font-size:20px;margin:0 0 4px">${HEADLINE[payload.kind]}</h1>
    <p style="margin:0 0 16px;color:#52525b">${humanRoute(payload)}</p>
    <p style="font-size:28px;font-weight:600;margin:0">${price}</p>
    ${previous}
    <p style="margin:16px 0 0;color:#3f3f46">
      Departs ${formatDate(payload.departDate)}${
        payload.returnDate ? ` → returns ${formatDate(payload.returnDate)}` : ""
      }<br>
      ${payload.tripType} · ${payload.cabin} · ${payload.adults} traveller(s)
    </p>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0">
    <p style="color:#71717a;font-size:12px;margin:0">Watch: ${payload.watchLabel}</p>
  </div>`;
}

async function sendViaResend(
  payload: AlertPayload,
  opts: { apiKey: string; from: string },
): Promise<DispatchResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: payload.toEmail,
      subject: subject(payload),
      text: textBody(payload),
      html: htmlBody(payload),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, channel: "email", error: `Resend ${response.status}: ${detail}` };
  }
  return { ok: true, channel: "email" };
}

/**
 * Dispatch an alert.
 *
 * If Resend credentials are configured we send an email; otherwise we log it,
 * so the whole alert pipeline is exercisable locally with no account.
 */
export async function dispatchAlert(payload: AlertPayload): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (apiKey && from) {
    try {
      return await sendViaResend(payload, { apiKey, from });
    } catch (error) {
      return { ok: false, channel: "email", error: String(error) };
    }
  }

  console.log(
    `[alert:dev-log] ${subject(payload)}\n${textBody(payload)}\n(to: ${payload.toEmail})`,
  );
  return { ok: true, channel: "dev-log" };
}

/** Send a sign-in magic link. Falls back to logging it in development. */
export async function sendMagicLinkEmail(input: {
  to: string;
  url: string;
}): Promise<DispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  const text = [
    "Sign in to Radar",
    "",
    `Open this link to sign in: ${input.url}`,
    "",
    "The link expires in 15 minutes and can only be used once.",
    "If you didn't request it, you can ignore this email.",
  ].join("\n");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto">
    <h1 style="font-size:20px;margin:0 0 12px">Sign in to Radar</h1>
    <p style="color:#3f3f46;margin:0 0 16px">Click the button below to sign in.</p>
    <p style="margin:0 0 16px">
      <a href="${input.url}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Sign in</a>
    </p>
    <p style="color:#71717a;font-size:12px;margin:0">This link expires in 15 minutes and can only be used once.</p>
  </div>`;

  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: "Sign in to Radar",
          text,
          html,
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return { ok: false, channel: "email", error: `Resend ${response.status}: ${detail}` };
      }
      return { ok: true, channel: "email" };
    } catch (error) {
      return { ok: false, channel: "email", error: String(error) };
    }
  }

  console.log(`[magic-link:dev-log] ${input.to}\n  ${input.url}`);
  return { ok: true, channel: "dev-log" };
}
