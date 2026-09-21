import { env } from "../../config/env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Sends through Resend's REST API. Failures never break the calling flow (an account was still created,
 * a reset was still requested) — they are logged without message bodies, which may contain secrets.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY || env.NODE_ENV === "test") {
    if (env.NODE_ENV !== "test") {
      console.info(`[mailer] RESEND_API_KEY not set — skipped "${message.subject}" to ${message.to}`);
    }
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });
    if (!response.ok) {
      console.error(`[mailer] provider rejected "${message.subject}" (${response.status})`);
    }
  } catch (error) {
    console.error(`[mailer] failed to send "${message.subject}"`, (error as Error).message);
  }
}

export const emailTemplates = {
  passwordReset(resetUrl: string) {
    return {
      subject: "Reset your SchoolOS password",
      html: `<h2>Password reset</h2><p>We received a request to reset your SchoolOS password.</p>
        <p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p>
        <p>This link expires in 1 hour. If you did not ask for it, you can ignore this e-mail.</p>`,
    };
  },
  welcome(firstName: string, schoolName: string, role: string, loginUrl: string) {
    return {
      subject: `Your ${schoolName} account is ready`,
      html: `<h2>Welcome to ${escapeHtml(schoolName)}</h2><p>Hello ${escapeHtml(firstName)}, an account has been created for you as <strong>${escapeHtml(role)}</strong>.</p>
        <p><a href="${escapeHtml(loginUrl)}">Sign in to SchoolOS</a></p>
        <p>Your school administrator will share your temporary password with you. You will be asked to change it the first time you sign in.</p>`,
    };
  },
};
