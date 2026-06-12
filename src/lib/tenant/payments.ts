import { supabase } from "@/lib/supabase"

export async function recordPayment(tenantId: string, washOrderId: string, input: { amount: number; method: "cash" | "card" | "transfer" }): Promise<void> {
  const { error } = await supabase.from("payments").insert({
    tenant_id: tenantId, wash_order_id: washOrderId, amount: input.amount, method: input.method,
  })
  if (error) throw error
}
