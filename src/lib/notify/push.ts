/**
 * VAPID key encoder — Phase 2 will pass this to pushManager.subscribe().
 *
 * Converts a URL-safe base64 string (the VAPID public key as returned by the
 * key-generation tool) into a Uint8Array suitable for the Web Push API.
 *
 * Pure and side-effect-free so it can be unit-tested in Vitest without a DOM.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  // Normalise URL-safe base64 to standard base64 and add padding.
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")

  const binary = atob(base64Std)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
