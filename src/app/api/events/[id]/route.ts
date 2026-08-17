import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HostAuthError, requireHostToken } from "@/lib/hostAuth";

interface HoleInput {
  holeNumber: number;
  par: number;
  strokeIndex: number;
}

interface PatchEventBody {
  name?: string;
  courseName?: string;
  eventDate?: string | null;
  holes?: HoleInput[];
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id: eventId } = await ctx.params;
  const hostToken = request.headers.get("x-host-token");
  const admin = createAdminClient();

  try {
    await requireHostToken(admin, eventId, hostToken);

    const body: PatchEventBody = await request.json();

    const eventPatch: Record<string, unknown> = {};
    if (body.name !== undefined) eventPatch.name = body.name.trim();
    if (body.courseName !== undefined) eventPatch.course_name = body.courseName.trim();
    if (body.eventDate !== undefined) eventPatch.event_date = body.eventDate || null;

    if (Object.keys(eventPatch).length > 0) {
      const { error } = await admin.from("events").update(eventPatch).eq("id", eventId);
      if (error) throw new HostAuthError(error.message, 500);
    }

    if (body.holes?.length) {
      const { error } = await admin.from("holes").upsert(
        body.holes.map((h) => ({
          event_id: eventId,
          hole_number: h.holeNumber,
          par: h.par,
          stroke_index: h.strokeIndex,
        })),
        { onConflict: "event_id,hole_number" }
      );
      if (error) throw new HostAuthError(error.message, 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HostAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
