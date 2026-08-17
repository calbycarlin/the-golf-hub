import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HostAuthError, requireHostToken } from "@/lib/hostAuth";

interface GroupInput {
  id?: string;
  name: string;
  teeTime?: string | null;
  players: { playerId: string; isPlayerA: boolean }[];
}

/**
 * Full replace of the event's groupings. Existing group rows are updated
 * in place (and only truly-removed groups are deleted) rather than
 * drop-and-recreate, because deleting a group cascades to hole_scores —
 * we don't want to silently wipe scores that were already entered just
 * because the host tweaked a group name or membership.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/events/[id]/groupings">) {
  const { id: eventId } = await ctx.params;
  const hostToken = request.headers.get("x-host-token");
  const admin = createAdminClient();

  try {
    await requireHostToken(admin, eventId, hostToken);

    const body: { groups: GroupInput[] } = await request.json();
    const groups = body.groups ?? [];

    for (const g of groups) {
      if (!g.name?.trim()) throw new HostAuthError("Every group needs a name", 400);
      if (g.players.length > 0 && !g.players.some((p) => p.isPlayerA)) {
        throw new HostAuthError(`Group "${g.name}" needs a Player A`, 400);
      }
    }

    const { data: existingGroups, error: existingError } = await admin
      .from("groups")
      .select("id")
      .eq("event_id", eventId);
    if (existingError) throw new HostAuthError(existingError.message, 500);

    const incomingIds = new Set(groups.filter((g) => g.id).map((g) => g.id));
    const toDelete = (existingGroups ?? []).filter((g) => !incomingIds.has(g.id)).map((g) => g.id);
    if (toDelete.length) {
      const { error } = await admin.from("groups").delete().in("id", toDelete);
      if (error) throw new HostAuthError(error.message, 500);
    }

    const groupIds: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      if (g.id) {
        const { error } = await admin
          .from("groups")
          .update({ name: g.name.trim(), tee_time: g.teeTime || null, sort_order: i })
          .eq("id", g.id);
        if (error) throw new HostAuthError(error.message, 500);
        groupIds.push(g.id);
      } else {
        const { data, error } = await admin
          .from("groups")
          .insert({ event_id: eventId, name: g.name.trim(), tee_time: g.teeTime || null, sort_order: i })
          .select("id")
          .single();
        if (error) throw new HostAuthError(error.message, 500);
        groupIds.push(data.id as string);
      }
    }

    // group_players carries no score data, so it's safe to fully replace.
    const remainingGroupIds = groupIds;
    if (remainingGroupIds.length) {
      const { error } = await admin.from("group_players").delete().in("group_id", remainingGroupIds);
      if (error) throw new HostAuthError(error.message, 500);
    }

    const groupPlayerRows = groups.flatMap((g, i) =>
      g.players.map((p) => ({
        group_id: groupIds[i],
        player_id: p.playerId,
        is_player_a: p.isPlayerA,
      }))
    );
    if (groupPlayerRows.length) {
      const { error } = await admin.from("group_players").insert(groupPlayerRows);
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
