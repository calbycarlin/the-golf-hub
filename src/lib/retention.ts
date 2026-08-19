// Mirrors EVENT_RETENTION_DAYS (server-only, used by the cleanup cron) so
// the client can display an accurate deletion date without a round trip.
// Keep both env vars set to the same value.
const DEFAULT_RETENTION_DAYS = 30;

export function getRetentionDays(): number {
  return Number(process.env.NEXT_PUBLIC_EVENT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
}

export function getDeletionDate(createdAt: string): Date {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + getRetentionDays());
  return date;
}

export function formatDeletionDate(createdAt: string): string {
  return getDeletionDate(createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
