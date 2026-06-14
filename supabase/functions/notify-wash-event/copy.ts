// copy.ts — tiny server-side i18n for push notification text.
//
// Keyed by the subscription's stored `lang` (en/ar). The body embeds the
// plate when known. PURE — no I/O — so it can be unit-tested.

import type { WashEvent } from "./classify.ts";

type Lang = "en" | "ar";

const TITLE: Record<Lang, string> = {
  en: "WashFlow",
  ar: "واش فلو",
};

interface CopyEntry {
  // body(plate) — plate may be empty when unknown.
  body: (plate: string) => string;
}

const COPY: Record<Lang, Record<WashEvent["type"], CopyEntry>> = {
  en: {
    queued: { body: (p) => (p ? `New wash queued — ${p}` : "New wash queued") },
    completed: { body: (p) => (p ? `Wash completed — ${p}` : "Wash completed") },
    done_unpaid: {
      body: (p) =>
        p ? `Wash done, payment due — ${p}` : "Wash done, payment due",
    },
  },
  ar: {
    queued: {
      body: (p) => (p ? `غسيل جديد في الانتظار — ${p}` : "غسيل جديد في الانتظار"),
    },
    completed: {
      body: (p) => (p ? `اكتمل الغسيل — ${p}` : "اكتمل الغسيل"),
    },
    done_unpaid: {
      body: (p) =>
        p ? `انتهى الغسيل، الدفع مستحق — ${p}` : "انتهى الغسيل، الدفع مستحق",
    },
  },
};

function normalizeLang(lang: string | null | undefined): Lang {
  return lang === "ar" ? "ar" : "en";
}

export interface PushCopy {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** Build the title/body/url/tag for a notification in the subscriber's language. */
export function buildPushCopy(
  event: WashEvent,
  lang: string | null | undefined,
): PushCopy {
  const l = normalizeLang(lang);
  const plate = event.plate ?? "";
  return {
    title: TITLE[l],
    body: COPY[l][event.type].body(plate),
    url: "/app/queue",
    // Coalesce repeated notifications about the same wash+type on the device.
    tag: `wash-${event.washId}-${event.type}`,
  };
}
