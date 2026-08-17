const KEY_PREFIX = "golfhub:hostToken:";

export function getStoredHostToken(eventId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_PREFIX + eventId);
}

export function storeHostToken(eventId: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + eventId, token);
}

export function hostLink(eventId: string, token: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/event/${eventId}?host=${token}`;
}
