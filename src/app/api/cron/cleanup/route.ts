import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily housekeeping (triggered by Vercel Cron, see vercel.json): deletes
 * any event older than EVENT_RETENTION_DAYS (default 30) along with its
 * photos in Storage. Deleting the `events` row cascades to holes, players,
 * groups, group_players, hole_scores and the `photos` table rows — but not
 * the actual files sitting in the `gallery` bucket, which is why photos
 * are removed from Storage explicitly first.
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
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();

  const { data: expiredEvents, error: eventsError } = await admin
    .from("events")
    .select("id, name, created_at")
    .lt("created_at", cutoff);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  let photosDeleted = 0;
  const deletedEventIds: string[] = [];

  for (const event of expiredEvents ?? []) {
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
    cutoff,
    eventsDeleted: deletedEventIds.length,
    photosDeleted,
  });
}
