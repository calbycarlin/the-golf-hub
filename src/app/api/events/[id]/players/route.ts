import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HostAuthError, requireHostToken } from "@/lib/hostAuth";

interface PlayerInput {
  id?: string;
  name: string;
  playingHandicap: number;
}

/** Full replace of the event's player roster: updates existing, inserts new, deletes missing. */
export async function PUT(request: Request, ctx: RouteContext<"/api/events/[id]/players">) {
  const { id: eventId } = await ctx.params;
  const hostToken = request.headers.get("x-host-token");
  const admin = createAdminClient();

  try {
    await requireHostToken(admin, eventId, hostToken);

    const body: { players: PlayerInput[] } = await request.json();
    const players = body.players ?? [];

    if (players.some((p) => !p.name?.trim())) {
      throw new HostAuthError("Every player needs a name", 400);
    }

    const { data: existing, error: existingError } = await admin
      .from("players")
      .select("id")
      .eq("event_id", eventId);
    if (existingError) throw new HostAuthError(existingError.message, 500);

    const incomingIds = new Set(players.filter((p) => p.id).map((p) => p.id));
    const toDelete = (existing ?? []).filter((p) => !incomingIds.has(p.id)).map((p) => p.id);
    if (toDelete.length) {
      const { error } = await admin.from("players").delete().in("id", toDelete);
      if (error) throw new HostAuthError(error.message, 500);
    }

    for (const p of players.filter((p) => p.id)) {
      const { error } = await admin
        .from("players")
        .update({ name: p.name.trim(), playing_handicap: p.playingHandicap })
        .eq("id", p.id);
      if (error) throw new HostAuthError(error.message, 500);
    }

    // Insert new players as a single multi-row statement so Postgres'
    // RETURNING preserves input order — that lets the caller zip the
    // response back up with its original (index-aligned) draft array.
    const newIndexes: number[] = [];
    const newRows: { event_id: string; name: string; playing_handicap: number }[] = [];
    players.forEach((p, i) => {
      if (!p.id) {
        newIndexes.push(i);
        newRows.push({ event_id: eventId, name: p.name.trim(), playing_handicap: p.playingHandicap });
      }
    });

    const insertedIds: string[] = [];
    if (newRows.length) {
      const { data, error } = await admin.from("players").insert(newRows).select("id");
      if (error) throw new HostAuthError(error.message, 500);
      insertedIds.push(...(data ?? []).map((d) => d.id as string));
    }

    const resultPlayers = players.map((p, i) => {
      if (p.id) return { id: p.id, name: p.name.trim(), playingHandicap: p.playingHandicap };
      const newIndex = newIndexes.indexOf(i);
      return { id: insertedIds[newIndex], name: p.name.trim(), playingHandicap: p.playingHandicap };
    });

    return NextResponse.json({ players: resultPlayers });
  } catch (err) {
    if (err instanceof HostAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
