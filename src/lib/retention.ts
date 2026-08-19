// Mirrors EVENT_RETENTION_DAYS (server-only, used by the cleanup cron) so
// the client can display an accurate deletion date without a round trip.
// Keep both env vars set to the same value.
const DEFAULT_RETENTION_DAYS = 30;

export interface RetentionAnchor {
  event_date: string | null;
  created_at: string;
}

export function getRetentionDays(): number {
  return Number(process.env.NEXT_PUBLIC_EVENT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
}

/** The event date if one was set (the round actually happening), otherwise creation date. */
export function getRetentionAnchorDate({ event_date, created_at }: RetentionAnchor): Date {
  return new Date(event_date ?? created_at);
}

export function getDeletionDate(anchor: RetentionAnchor): Date {
  const date = getRetentionAnchorDate(anchor);
  date.setDate(date.getDate() + getRetentionDays());
  return date;
}

export function formatDeletionDate(anchor: RetentionAnchor): string {
  return getDeletionDate(anchor).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
