/**
 * Pure order-preserving union of id arrays — dedupes across all input lists.
 * Iterates lists left-to-right; first occurrence of each id wins.
 */
export function dedupeIds(...lists: string[][]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const list of lists) {
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id)
        result.push(id)
      }
    }
  }
  return result
}
