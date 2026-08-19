import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRetentionAnchorDate } from "@/lib/retention";

/**
 * Daily housekeeping (triggered by Vercel Cron, see vercel.json): deletes
 * any event whose retention window has passed — EVENT_RETENTION_DAYS
 * (default 30) after its event date, or after creation if no event date
 * was set — along with its photos in Storage. Deleting the `events` row
 * cascades to holes, players, groups, group_players, hole_scores and the
 * `photos` table rows — but not the actual files sitting in the `gallery`
 * bucket, which is why photos are removed from Storage explicitly first.
 *
 * The anchor date (event_date ?? created_at) isn't something Postgres can
 * filter on directly through a single column comparison, and this app's
 * scale doesn't warrant a SQL function for it — so all events are fetched
 * and filtered here instead.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const retentionDays = Number(process.env.EVENT_RETENTION_DAYS) || 30;
  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  const admin = createAdminClient();

  const { data: allEvents, error: eventsError } = await admin
    .from("events")
    .select("id, event_date, created_at");

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const expiredEvents = (allEvents ?? []).filter((event) => {
    const anchor = getRetentionAnchorDate(event).getTime();
    return anchor + retentionMs < now;
  });

  let photosDeleted = 0;
  const deletedEventIds: string[] = [];

  for (const event of expiredEvents) {
    const { data: photos } = await admin.from("photos").select("storage_path").eq("event_id", event.id);

    if (photos?.length) {
      const { error: storageError } = await admin.storage
        .from("gallery")
        .remove(photos.map((p) => p.storage_path));
      // Don't let a storage hiccup block the event deletion below — an
      // orphaned file costs a little space, a stuck event costs a rerun.
      if (!storageError) photosDeleted += photos.length;
    }

    const { error: deleteError } = await admin.from("events").delete().eq("id", event.id);
    if (!deleteError) deletedEventIds.push(event.id);
  }

  return NextResponse.json({
    retentionDays,
    eventsDeleted: deletedEventIds.length,
    photosDeleted,
  });
}
