import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Flips a fresh event from "setup" to "in_progress". No host token required:
 * per spec, only "Mark Event Complete" is a host-only control, and this
 * transition just reflects that a group started entering scores on the
 * course. Idempotent — a no-op if the event isn't in "setup".
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/events/[id]/start">) {
  const { id: eventId } = await ctx.params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("events")
    .update({ status: "in_progress" })
    .eq("id", eventId)
    .eq("status", "setup");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
