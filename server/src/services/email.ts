import { Resend } from 'resend';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'GranStocks <noreply@verify.granstocks.com>';
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

const isEmailEnabled = !!RESEND_API_KEY && RESEND_API_KEY !== 'your_resend_api_key_here';

let resend: Resend | null = null;

function getClient(): Resend {
    if (!resend) {
        if (!isEmailEnabled) {
            throw new Error('[EmailService] RESEND_API_KEY is not configured.');
        }
        resend = new Resend(RESEND_API_KEY);
    }
    return resend;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Logs an outgoing email in dev mode / when email is disabled.
 * Useful for testing flows without a real API key.
 */
function logEmailInDev(subject: string, to: string, body: string) {
    console.log('\n========== [EmailService DEV MODE] ==========');
    console.log(`TO:      ${to}`);
    console.log(`FROM:    ${FROM_EMAIL}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log('=============================================\n');
}

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

function verificationTemplate(url: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
    <h1 style="color:#6366f1;margin-top:0;">GranStocks Analytics</h1>
    <h2 style="color:#f1f5f9;">Verify your email address</h2>
    <p>Click the button below to confirm your email and activate your account.</p>
    <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
      Verify Email
    </a>
    <p style="color:#94a3b8;font-size:13px;margin-top:24px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    <hr style="border:1px solid #334155;margin:24px 0;" />
    <p style="color:#475569;font-size:12px;">GranStocks Analytics · granstocks.com</p>
  </div>
</body>
</html>
`;
}

function passwordResetTemplate(url: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;">
    <h1 style="color:#6366f1;margin-top:0;">GranStocks Analytics</h1>
    <h2 style="color:#f1f5f9;">Reset your password</h2>
    <p>We received a request to reset your GranStocks password. Click the button below to choose a new password.</p>
    <a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
      Reset Password
    </a>
    <p style="color:#94a3b8;font-size:13px;margin-top:24px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <hr style="border:1px solid #334155;margin:24px 0;" />
    <p style="color:#475569;font-size:12px;">GranStocks Analytics · granstocks.com</p>
  </div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const EmailService = {

    /**
     * Send an email verification link to a newly registered user.
     * The `verificationToken` should be a short-lived JWT signed with the user's id.
     */
    async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
        const url = `${APP_ORIGIN}/verify-email?token=${verificationToken}`;
        const subject = 'Verify your GranStocks email address';

        if (!isEmailEnabled) {
            logEmailInDev(subject, to, `Verification URL: ${url}`);
            return;
        }

        try {
            await getClient().emails.send({
                from: FROM_EMAIL,
                to,
                subject,
                html: verificationTemplate(url),
            });
            console.log(`[EmailService] Verification email sent to ${to}`);
        } catch (e: any) {
            console.error(`[EmailService] Failed to send verification email to ${to}: ${e.message}`);
            throw e;
        }
    },

    /**
     * Send a password reset link.
     * The `resetToken` should be a short-lived JWT or opaque token.
     */
    async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
        const url = `${APP_ORIGIN}/reset-password?token=${resetToken}`;
        const subject = 'Reset your GranStocks password';

        if (!isEmailEnabled) {
            logEmailInDev(subject, to, `Password Reset URL: ${url}`);
            return;
        }

        try {
            await getClient().emails.send({
                from: FROM_EMAIL,
                to,
                subject,
                html: passwordResetTemplate(url),
            });
            console.log(`[EmailService] Password reset email sent to ${to}`);
        } catch (e: any) {
            console.error(`[EmailService] Failed to send password reset email to ${to}: ${e.message}`);
            throw e;
        }
    },

    /**
     * Returns true if the email service is configured and ready to send.
     * Useful for health checks and UI feedback.
     */
    isEnabled(): boolean {
        return isEmailEnabled;
    }
};
