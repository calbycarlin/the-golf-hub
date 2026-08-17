// Shared with the browser (join-code input formatting), unlike codes.ts
// which needs Node's crypto and is server-only.
export const JOIN_CODE_LENGTH = 6;

export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
