// Transactional email via Resend — a thin send() + branded bilingual templates.
// The edge functions generate a secure Supabase set-password link and pass it here.
// RESEND_API_KEY + EMAIL_FROM are function secrets (never in the repo/client).
// If no key is configured (or the domain isn't verified yet), send() fails softly so
// callers can still surface the link for the owner/admin to hand over manually.

export type EmailLocale = "en" | "ar";

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// Read secrets lazily (not at import time) so importing the templates needs no env perm.
export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const from = Deno.env.get("EMAIL_FROM") ?? "WashFlow <noreply@washflow.khalidelewa.com>";
  if (!apiKey) return { ok: false, error: "no_api_key" };
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
  if (!res.ok) {
    let msg = `http_${res.status}`;
    try {
      const b = await res.json();
      msg = (b?.message as string) ?? msg;
    } catch (_) { /* keep status */ }
    return { ok: false, error: msg };
  }
  const b = await res.json().catch(() => ({} as Record<string, unknown>));
  return { ok: true, id: (b?.id as string) ?? undefined };
}

// ── Branded bilingual templates ───────────────────────────────────────────────
// Inline styles only (email clients strip <style>). Teal accent matches the app.

const TEAL = "#0d9488";

interface Copy {
  subject: string;
  dir: "ltr" | "rtl";
  heading: string;
  body: string;
  cta: string;
  ignore: string;
}

function shell(c: Copy, actionUrl: string): { subject: string; html: string } {
  const align = c.dir === "rtl" ? "right" : "left";
  const html = `<!doctype html><html dir="${c.dir}"><body style="margin:0;background:#f1f5f9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:${TEAL};padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;">WashFlow</span>
      </td></tr>
      <tr><td style="padding:28px;text-align:${align};color:#0f172a;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">${c.heading}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">${c.body}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${TEAL};">
          <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${c.cta}</a>
        </td></tr></table>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">${c.ignore}</p>
      </td></tr>
    </table>
    <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#94a3b8;text-align:center;">WashFlow · carwash operations</p>
  </td></tr></table>
</body></html>`;
  return { subject: c.subject, html };
}

export function renderInviteEmail(v: { name?: string; businessName?: string; actionUrl: string; locale: EmailLocale }): { subject: string; html: string } {
  const who = v.businessName ? ` — ${v.businessName}` : "";
  const en: Copy = {
    subject: "Welcome to WashFlow — set your password",
    dir: "ltr",
    heading: `Welcome${v.name ? `, ${v.name}` : ""}!`,
    body: `Your WashFlow account${who} is ready. Click below to set your password and sign in.`,
    cta: "Set your password",
    ignore: "If you weren't expecting this, you can safely ignore this email. The link expires after a while.",
  };
  const ar: Copy = {
    subject: "مرحباً بك في WashFlow — عيّن كلمة المرور",
    dir: "rtl",
    heading: `مرحباً${v.name ? ` يا ${v.name}` : ""}!`,
    body: `حسابك في WashFlow${v.businessName ? ` — ${v.businessName}` : ""} جاهز. اضغط بالأسفل لتعيين كلمة المرور وتسجيل الدخول.`,
    cta: "تعيين كلمة المرور",
    ignore: "إذا لم تكن تتوقع هذه الرسالة، يمكنك تجاهلها بأمان. تنتهي صلاحية الرابط بعد فترة.",
  };
  return shell(v.locale === "ar" ? ar : en, v.actionUrl);
}

export function renderResetEmail(v: { name?: string; actionUrl: string; locale: EmailLocale }): { subject: string; html: string } {
  const en: Copy = {
    subject: "Reset your WashFlow password",
    dir: "ltr",
    heading: "Reset your password",
    body: `A password reset was requested for your WashFlow account${v.name ? ` (${v.name})` : ""}. Click below to choose a new password.`,
    cta: "Reset password",
    ignore: "If you didn't request this, you can safely ignore this email. The link expires after a while.",
  };
  const ar: Copy = {
    subject: "إعادة تعيين كلمة مرور WashFlow",
    dir: "rtl",
    heading: "إعادة تعيين كلمة المرور",
    body: `تم طلب إعادة تعيين كلمة المرور لحسابك في WashFlow${v.name ? ` (${v.name})` : ""}. اضغط بالأسفل لاختيار كلمة مرور جديدة.`,
    cta: "إعادة تعيين كلمة المرور",
    ignore: "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان. تنتهي صلاحية الرابط بعد فترة.",
  };
  return shell(v.locale === "ar" ? ar : en, v.actionUrl);
}
