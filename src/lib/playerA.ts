const KEY_PREFIX = "golfhub:playerA:";

/** Remembers the honour-system Player A confirmation for a group on this device. */
export function isPlayerAConfirmed(groupId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_PREFIX + groupId) === "confirmed";
}

export function confirmPlayerA(groupId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + groupId, "confirmed");
}

export function clearPlayerAConfirmation(groupId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_PREFIX + groupId);
}
