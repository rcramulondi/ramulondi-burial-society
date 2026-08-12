import "server-only";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null | undefined;

/**
 * Lazily constructed, undefined until first use so a missing app password
 * doesn't crash module load (e.g. during build) — only sendEmail() itself
 * checks it. Uses Gmail's SMTP via an app password (not the account
 * password — see the setup notes in .env.example), since this app doesn't
 * need a dedicated transactional-email service at this scale.
 */
function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  transporter = user && pass ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) : null;
  return transporter;
}

export type EmailAttachment = { filename: string; content: Buffer };

/**
 * Sends an email via Gmail SMTP. No-ops (logs a warning, returns ok:false)
 * rather than throwing when GMAIL_USER/GMAIL_APP_PASSWORD aren't
 * configured, so the rest of the app — payment recording in particular —
 * never breaks because email isn't set up yet. Callers that email as a side
 * effect of a financial write should treat a false return as non-fatal.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const gmail = getTransporter();
  if (!gmail) {
    console.warn(`[email] GMAIL_USER/GMAIL_APP_PASSWORD not configured — skipped email to ${input.to} ("${input.subject}").`);
    return { ok: false, error: "Email is not configured." };
  }

  try {
    await gmail.sendMail({
      from: `Ramulondi Burial Society <${process.env.GMAIL_USER}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error(`[email] Failed to send to ${input.to}:`, e);
    return { ok: false, error: message };
  }
}
