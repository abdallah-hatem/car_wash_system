import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { sendEmail, renderInviteEmail, renderResetEmail } from "./email.ts";

Deno.test("sendEmail: fails soft when no API key is configured", async () => {
  // RESEND_API_KEY is unset in the test env -> caller can still surface the link.
  const r = await sendEmail("x@y.test", "Subj", "<p>hi</p>");
  assertEquals(r.ok, false);
  assertEquals(r.error, "no_api_key");
});

Deno.test("renderInviteEmail (en): subject + LTR + CTA + the action link", () => {
  const { subject, html } = renderInviteEmail({
    name: "Sam", businessName: "Acme Wash", actionUrl: "https://app.test/set#tok=abc", locale: "en",
  });
  assertStringIncludes(subject.toLowerCase(), "password");
  assertStringIncludes(html, 'dir="ltr"');
  assertStringIncludes(html, "https://app.test/set#tok=abc");
  assertStringIncludes(html, "Set your password");
  assertStringIncludes(html, "Acme Wash");
});

Deno.test("renderInviteEmail (ar): RTL + Arabic CTA + the action link", () => {
  const { html } = renderInviteEmail({ name: "سام", actionUrl: "https://app.test/set#tok=xyz", locale: "ar" });
  assertStringIncludes(html, 'dir="rtl"');
  assertStringIncludes(html, "تعيين كلمة المرور");
  assertStringIncludes(html, "https://app.test/set#tok=xyz");
});

Deno.test("renderResetEmail (en + ar): reset copy + the action link", () => {
  const en = renderResetEmail({ actionUrl: "https://app.test/reset#tok=1", locale: "en" });
  assertStringIncludes(en.subject.toLowerCase(), "reset");
  assertStringIncludes(en.html, "Reset password");
  assertStringIncludes(en.html, "https://app.test/reset#tok=1");

  const ar = renderResetEmail({ actionUrl: "https://app.test/reset#tok=2", locale: "ar" });
  assertStringIncludes(ar.html, 'dir="rtl"');
  assertStringIncludes(ar.html, "إعادة تعيين كلمة المرور");
  assertStringIncludes(ar.html, "https://app.test/reset#tok=2");
});
