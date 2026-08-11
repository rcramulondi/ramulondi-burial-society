import "server-only";
import { Resend } from "resend";

let client: Resend | null | undefined;

/**
 * Lazily constructed, undefined until first use so a missing API key doesn't
 * crash module load (e.g. during build) — only sendEmail() itself checks it.
 */
function getClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  client = apiKey ? new Resend(apiKey) : null;
  return client;
}

export type EmailAttachment = { filename: string; content: Buffer };

/**
 * Sends an email via Resend. No-ops (logs a warning, returns ok:false)
 * rather than throwing when RESEND_API_KEY isn't configured, so the rest of
 * the app — payment recording in particular — never breaks because email
 * isn't set up yet. Callers that email as a side effect of a financial write
 * should treat a false return as non-fatal.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not configured — skipped email to ${input.to} ("${input.subject}").`);
    return { ok: false, error: "Email is not configured." };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.warn(`[email] EMAIL_FROM not configured — skipped email to ${input.to} ("${input.subject}").`);
    return { ok: false, error: "Email is not configured." };
  }

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });

  if (error) {
    console.error(`[email] Failed to send to ${input.to}:`, error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
