import { assertEquals } from "jsr:@std/assert@1";
import {
  classifyWashEvent,
  type WashOrderRecord,
  type WebhookPayload,
} from "./classify.ts";

function record(over: Partial<WashOrderRecord> = {}): WashOrderRecord {
  return {
    id: "w1",
    status: "waiting",
    tenant_id: "t1",
    price: 50,
    plate_number: "أبج 123",
    ...over,
  };
}

Deno.test("queued: INSERT with status waiting", () => {
  const payload: WebhookPayload = {
    type: "INSERT",
    record: record({ status: "waiting" }),
    old_record: null,
  };
  assertEquals(classifyWashEvent(payload), {
    type: "queued",
    washId: "w1",
    plate: "أبج 123",
    price: 50,
  });
});

Deno.test("null: INSERT with status in_progress (not waiting)", () => {
  const payload: WebhookPayload = {
    type: "INSERT",
    record: record({ status: "in_progress" }),
    old_record: null,
  };
  assertEquals(classifyWashEvent(payload), null);
});

Deno.test("completed: UPDATE old!=done -> new=done", () => {
  const payload: WebhookPayload = {
    type: "UPDATE",
    record: record({ status: "done", price: 75 }),
    old_record: record({ status: "in_progress" }),
  };
  assertEquals(classifyWashEvent(payload), {
    type: "completed",
    washId: "w1",
    plate: "أبج 123",
    price: 75,
  });
});

Deno.test("null: unrelated UPDATE (waiting -> in_progress)", () => {
  const payload: WebhookPayload = {
    type: "UPDATE",
    record: record({ status: "in_progress" }),
    old_record: record({ status: "waiting" }),
  };
  assertEquals(classifyWashEvent(payload), null);
});

Deno.test("null: already-done UPDATE (done -> done)", () => {
  const payload: WebhookPayload = {
    type: "UPDATE",
    record: record({ status: "done" }),
    old_record: record({ status: "done" }),
  };
  assertEquals(classifyWashEvent(payload), null);
});

Deno.test("plate/price are undefined when absent on the record", () => {
  const payload: WebhookPayload = {
    type: "INSERT",
    record: { id: "w2", status: "waiting", tenant_id: "t1", price: null },
    old_record: null,
  };
  assertEquals(classifyWashEvent(payload), {
    type: "queued",
    washId: "w2",
    plate: undefined,
    price: undefined,
  });
});
