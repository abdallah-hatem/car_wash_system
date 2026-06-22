// classify.ts — PURE event classification for the wash_orders Database Webhook.
//
// No I/O: given the webhook payload it decides whether (and what) to notify.
// The payment check that distinguishes a fully-paid "completed" wash from a
// "done_unpaid" one needs a DB read, so it is NOT done here — index.ts upgrades
// a `completed` result to `done_unpaid` after querying payments. This keeps the
// classification deterministic and trivially unit-testable.

/** Shape of a wash_orders row as delivered by a Supabase Database Webhook. */
export interface WashOrderRecord {
  id: string;
  status: "waiting" | "in_progress" | "done" | "cancelled";
  tenant_id: string;
  price: number | string | null;
  // The webhook delivers the full row; we only read the fields below, but
  // allow anything else through.
  [key: string]: unknown;
}

/** The Supabase Database Webhook payload for INSERT / UPDATE on a table. */
export interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record: WashOrderRecord | null;
  old_record: WashOrderRecord | null;
}

/** The result of classifying a row change into a notifiable event. */
export interface WashEvent {
  /** `completed` may be upgraded to `done_unpaid` by index.ts after a payment check. */
  type: "queued" | "completed" | "done_unpaid";
  washId: string;
  plate?: string;
  price?: number;
}

function plateOf(record: WashOrderRecord): string | undefined {
  // Webhooks deliver the base row only (no joins), so a denormalized
  // plate_number column is used if present; otherwise undefined.
  const p = record["plate_number"];
  return typeof p === "string" && p.length > 0 ? p : undefined;
}

function priceOf(record: WashOrderRecord): number | undefined {
  if (record.price === null || record.price === undefined) return undefined;
  const n = Number(record.price);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Classify a wash_orders row change.
 *
 * - INSERT with status `waiting`            → `queued`
 * - UPDATE where old.status !== 'done'
 *   and new.status === 'done'               → `completed`
 *   (index.ts refines `completed` → `done_unpaid` when paid < price)
 * - anything else                           → null (no notification)
 */
export function classifyWashEvent(payload: WebhookPayload): WashEvent | null {
  const record = payload.record;
  if (!record) return null;

  if (payload.type === "INSERT") {
    if (record.status === "waiting") {
      return {
        type: "queued",
        washId: record.id,
        plate: plateOf(record),
        price: priceOf(record),
      };
    }
    return null;
  }

  if (payload.type === "UPDATE") {
    const wasDone = payload.old_record?.status === "done";
    const isDone = record.status === "done";
    if (!wasDone && isDone) {
      return {
        type: "completed",
        washId: record.id,
        plate: plateOf(record),
        price: priceOf(record),
      };
    }
    return null;
  }

  return null;
}
