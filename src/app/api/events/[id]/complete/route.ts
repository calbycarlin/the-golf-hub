import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HostAuthError, requireHostToken } from "@/lib/hostAuth";

export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]/complete">) {
  const { id: eventId } = await ctx.params;
  const hostToken = request.headers.get("x-host-token");
  const admin = createAdminClient();

  try {
    await requireHostToken(admin, eventId, hostToken);

    const { error } = await admin.from("events").update({ status: "complete" }).eq("id", eventId);
    if (error) throw new HostAuthError(error.message, 500);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HostAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
