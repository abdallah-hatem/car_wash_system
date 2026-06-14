// notify-wash-event edge function — receives a Supabase Database Webhook for
// public.wash_orders (INSERT + UPDATE) and sends web push to the affected
// tenant's subscribers.
//
// Flow:
//   1. (optional) verify a shared WEBHOOK_SECRET header.
//   2. classify the row change (pure, ./classify.ts).
//   3. for a `completed` (→done) transition, query payments with the
//      service_role and downgrade to `done_unpaid` when paid < price.
//   4. load that tenant's push_subscriptions with the service_role
//      (bypasses RLS — server-side only).
//   5. send each subscription a push via web-push using the VAPID keypair;
//      prune any subscription that returns 404/410 (gone).
//   6. return a JSON summary.
//
// verify_jwt is disabled (config.toml) — Database Webhooks call this with the
// project anon/service key as an apikey header, not a user JWT; we own auth via
// the optional WEBHOOK_SECRET instead.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@^3";
import { corsHeaders } from "../_shared/cors.ts";
import { classifyWashEvent, type WebhookPayload } from "./classify.ts";
import { buildPushCopy } from "./copy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // 1. Optional shared-secret guard. When WEBHOOK_SECRET is set, the Database
  //    Webhook must send a matching `x-webhook-secret` header.
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-webhook-secret") ?? "";
    if (provided !== WEBHOOK_SECRET) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "vapid_not_configured" }, 500);
  }

  // 2. Parse + classify.
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const event = classifyWashEvent(payload);
  if (!event) {
    return json({ ok: true, classified: null, sent: 0, pruned: 0 }, 200);
  }

  const tenantId = payload.record?.tenant_id;
  if (!tenantId) {
    return json({ error: "missing_tenant" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Refine completed → done_unpaid using the payments total for this wash.
  if (event.type === "completed" && typeof event.price === "number") {
    const { data: pays, error: payErr } = await admin
      .from("payments")
      .select("amount")
      .eq("wash_order_id", event.washId);
    if (!payErr) {
      const paid = (pays ?? []).reduce(
        (sum, p) => sum + Number((p as { amount: number }).amount),
        0,
      );
      if (paid < event.price) {
        event.type = "done_unpaid";
      }
    }
    // On a payments query error we keep `completed` (fail safe: still notify).
  }

  // 4. Load this tenant's subscriptions (service_role bypasses RLS).
  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,lang")
    .eq("tenant_id", tenantId);
  if (subErr) {
    return json({ error: "subscriptions_query_failed" }, 500);
  }

  const subscriptions = (subs ?? []) as SubscriptionRow[];

  // 5. Send + prune dead subscriptions.
  let sent = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const copy = buildPushCopy(event, sub.lang);
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      const body = JSON.stringify({
        title: copy.title,
        body: copy.body,
        url: copy.url,
        tag: copy.tag,
      });
      try {
        await webpush.sendNotification(pushSubscription, body);
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          deadIds.push(sub.id);
        }
        // Other errors (network, 4xx) are swallowed per-subscription so one bad
        // endpoint can't fail the whole batch.
      }
    }),
  );

  if (deadIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", deadIds);
  }

  return json(
    {
      ok: true,
      classified: event.type,
      washId: event.washId,
      subscriptions: subscriptions.length,
      sent,
      pruned: deadIds.length,
    },
    200,
  );
});
