/**
 * A8 — human gate matching (brakes.human_gates are action patterns).
 * Patterns are matched case-insensitively as substrings of the action.
 */

export function matchesGate(action: string, humanGates: readonly string[]): boolean {
  const lower = action.toLowerCase();
  return humanGates.some((pattern) => lower.includes(pattern.toLowerCase()));
}
