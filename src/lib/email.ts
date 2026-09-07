// src/lib/email.ts
//
// Resend-powered email sender with branded HTML templates.
//
// Usage:
//   await sendConfirmedEmail({ to, name, eventTitle, eventDate, registrationId });
//   await sendWaitlistedEmail({ to, name, eventTitle });
//
// Falls back gracefully to a console.info if RESEND_API_KEY is not set,
// so local dev works without a real API key.

import { Resend } from "resend";

/** Lazily instantiate Resend so the build never fails if the key is absent. */
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}
const FROM   = process.env.FROM_EMAIL ?? "SurgeShield <onboarding@resend.dev>";

// ─── Shared styles ───────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #020207;
  color: #e2e8f0;
  margin: 0;
  padding: 0;
`;

const CARD_STYLE = `
  max-width: 520px;
  margin: 40px auto;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 24px;
  overflow: hidden;
`;

const FOOTER_STYLE = `
  text-align: center;
  padding: 20px;
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  border-top: 1px solid rgba(255,255,255,0.07);
`;

// ─── ICS Helper ────────────────────────────────────────────────────────────────

function formatIcsDate(dateStr: string): string {
  // Convert standard ISO to YYYYMMDDThhmmssZ
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildIcsString(params: {
  eventTitle: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  meetingUrl?: string;
  isVirtual?: boolean;
}): string {
  const { eventTitle, startsAt, endsAt, location, meetingUrl, isVirtual } = params;
  
  const loc = isVirtual ? (meetingUrl ?? "Virtual Event") : (location ?? "Venue TBA");
  const start = formatIcsDate(startsAt);
  // Default end time to 1 hour after start if not provided
  const end = endsAt ? formatIcsDate(endsAt) : formatIcsDate(new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SurgeShield//Registration//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${eventTitle}`,
    `LOCATION:${loc}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

// ─── CONFIRMED email ─────────────────────────────────────────────────────────

export async function sendConfirmedEmail(params: {
  to:             string;
  name:           string;
  eventTitle:     string;
  eventDate?:     string;
  startsAt:       string;
  endsAt?:        string;
  location?:      string;
  meetingUrl?:    string;
  isVirtual?:     boolean;
  registrationId: string;
}): Promise<void> {
  const {
    to, name, eventTitle, eventDate, startsAt, endsAt, location,
    meetingUrl, isVirtual, registrationId,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    console.info(`[email] RESEND_API_KEY not set — skipping real email to ${to}`);
    console.info(`[email] Would send CONFIRMED email: event="${eventTitle}", reg=${registrationId}`);
    return;
  }

  const resend = getResend();

  const locationLine = isVirtual
    ? (meetingUrl ? `<a href="${meetingUrl}" style="color:#a5b4fc;">${meetingUrl}</a>` : "Virtual Event")
    : (location ?? "Venue TBA");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🎉</div>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;">
        You're Confirmed!
      </h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
        Your spot is secured
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">
        Hi <strong style="color:white;">${name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
        Your registration for <strong style="color:white;">${eventTitle}</strong> has been
        <strong style="color:#34d399;">confirmed</strong>. We can't wait to see you there!
      </p>

      <!-- Event details card -->
      <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          ${eventDate ? `
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:90px;">📅 Date</td>
            <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">${eventDate}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${isVirtual ? "🌐 Link" : "📍 Venue"}</td>
            <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">${locationLine}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">🎫 Ref</td>
            <td style="padding:6px 0;color:#e2e8f0;font-size:13px;font-family:monospace;">${registrationId.slice(0, 12)}…</td>
          </tr>
        </table>
      </div>

      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.5;">
        Keep this email as your reference. If anything changes, the organizer will reach out directly.
      </p>
    </div>

    <div style="${FOOTER_STYLE}">
      SurgeShield · Resilient Event Registration · This email was sent to ${to}
    </div>
  </div>
</body>
</html>`;

  const icsString = buildIcsString({
    eventTitle, startsAt, endsAt, location, meetingUrl, isVirtual
  });

  await resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: `✅ You're confirmed for ${eventTitle}`,
    html,
    attachments: [
      {
        filename: 'invite.ics',
        content: Buffer.from(icsString).toString('base64'),
      }
    ]
  });
}

// ─── WAITLISTED email ─────────────────────────────────────────────────────────

export async function sendWaitlistedEmail(params: {
  to:         string;
  name:       string;
  eventTitle: string;
}): Promise<void> {
  const { to, name, eventTitle } = params;

  if (!process.env.RESEND_API_KEY) {
    console.info(`[email] RESEND_API_KEY not set — skipping real email to ${to}`);
    console.info(`[email] Would send WAITLISTED email: event="${eventTitle}"`);
    return;
  }

  const resend = getResend();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:36px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">⏳</div>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;">
        You're on the Waitlist
      </h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">
        We'll notify you immediately if a spot opens
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">
        Hi <strong style="color:white;">${name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
        <strong style="color:white;">${eventTitle}</strong> is currently at full capacity.
        You've been added to the <strong style="color:#fbbf24;">waitlist</strong>.
      </p>

      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#fbbf24;font-weight:600;">What happens next?</p>
        <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
          If another attendee cancels, you'll automatically be moved to confirmed status
          and receive a new email immediately — no action needed on your part.
        </p>
      </div>

      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.3);line-height:1.5;">
        Your spot in the queue is secured. We'll be in touch.
      </p>
    </div>

    <div style="${FOOTER_STYLE}">
      SurgeShield · Resilient Event Registration · This email was sent to ${to}
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: `⏳ Waitlist confirmed for ${eventTitle}`,
    html,
  });
}

// ─── REMINDER email ─────────────────────────────────────────────────────────

export async function sendReminderEmail(params: {
  to:             string;
  name:           string;
  eventTitle:     string;
  eventDate?:     string;
  location?:      string;
  meetingUrl?:    string;
  isVirtual?:     boolean;
  registrationId: string;
}): Promise<void> {
  const {
    to, name, eventTitle, eventDate, location,
    meetingUrl, isVirtual, registrationId,
  } = params;

  if (!process.env.RESEND_API_KEY) {
    console.info(`[email] RESEND_API_KEY not set — skipping real reminder to ${to}`);
    return;
  }

  const resend = getResend();

  const locationLine = isVirtual
    ? (meetingUrl ? `<a href="${meetingUrl}" style="color:#a5b4fc;">${meetingUrl}</a>` : "Virtual Event")
    : (location ?? "Venue TBA");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLE}">
  <div style="${CARD_STYLE}">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);padding:36px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">⏰</div>
      <h1 style="margin:0;font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;">
        Event Reminder
      </h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
        Starting in 24 hours
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">
        Hi <strong style="color:white;">${name}</strong>,
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
        Just a friendly reminder that <strong style="color:white;">${eventTitle}</strong> 
        is coming up in 24 hours. See you soon!
      </p>

      <!-- Event details card -->
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:16px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          ${eventDate ? `
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:90px;">📅 Date</td>
            <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">${eventDate}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">${isVirtual ? "🌐 Link" : "📍 Venue"}</td>
            <td style="padding:6px 0;color:#e2e8f0;font-size:14px;">${locationLine}</td>
          </tr>
        </table>
      </div>
    </div>

    <div style="${FOOTER_STYLE}">
      SurgeShield · Resilient Event Registration · This email was sent to ${to}
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: `⏰ Reminder: ${eventTitle} is starting soon!`,
    html,
  });
}

