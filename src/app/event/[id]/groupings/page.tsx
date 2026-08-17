"use client";

import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEvent } from "@/lib/eventContext";
import { createPublicClient } from "@/lib/supabase/client";
import { apiClient, ApiError } from "@/lib/apiClient";
import { GroupBuilder } from "@/components/GroupBuilder";
import type { GroupBuilderState, GroupDraft } from "@/lib/draftTypes";
import type { GroupPlayerRow, GroupRow, PlayerRow } from "@/lib/supabase/types";

interface ViewGroup extends GroupRow {
  members: { player: PlayerRow; isPlayerA: boolean }[];
}

export default function GroupingsPage() {
  const { eventId, isHost, hostToken } = useEvent();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<GroupPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [builderState, setBuilderState] = useState<GroupBuilderState>({ groups: [], players: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createPublicClient();
    const [{ data: playersData }, { data: groupsData }] = await Promise.all([
      supabase.from("players").select("*").eq("event_id", eventId).order("created_at"),
      supabase.from("groups").select("*").eq("event_id", eventId).order("sort_order"),
    ]);
    const groupIds = (groupsData ?? []).map((g) => g.id);
    const { data: gpData } = groupIds.length
      ? await supabase.from("group_players").select("*").in("group_id", groupIds)
      : { data: [] };

    setPlayers((playersData as PlayerRow[]) ?? []);
    setGroups((groupsData as GroupRow[]) ?? []);
    setGroupPlayers((gpData as GroupPlayerRow[]) ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the awaits inside `load`,
    // deferred past this synchronous effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const supabase = createPublicClient();
    const channel = supabase
      .channel(`groupings-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `event_id=eq.${eventId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `event_id=eq.${eventId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_players" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  function startEditing() {
    const groupsDraft: GroupDraft[] = groups.map((g) => ({ id: g.id, name: g.name, teeTime: g.tee_time ?? "" }));
    const playersDraft = players.map((p) => {
      const gp = groupPlayers.find((x) => x.player_id === p.id);
      return {
        id: p.id,
        name: p.name,
        handicap: p.playing_handicap,
        groupIndex: gp ? groups.findIndex((g) => g.id === gp.group_id) : -1,
        isPlayerA: gp?.is_player_a ?? false,
      };
    });

    setBuilderState({ groups: groupsDraft, players: playersDraft });
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!hostToken) return;
    setError(null);

    const { groups: groupsDraft, players: playersDraft } = builderState;
    if (playersDraft.some((p) => !p.name.trim())) {
      setError("Every player needs a name.");
      return;
    }
    for (let gi = 0; gi < groupsDraft.length; gi++) {
      const inGroup = playersDraft.filter((p) => p.groupIndex === gi);
      if (inGroup.length > 0 && !inGroup.some((p) => p.isPlayerA)) {
        setError(`Group "${groupsDraft[gi].name}" needs a Player A selected.`);
        return;
      }
    }

    setSaving(true);
    try {
      const { players: savedPlayers } = await apiClient.put(
        `/api/events/${eventId}/players`,
        { players: playersDraft.map((p) => ({ id: p.id, name: p.name, playingHandicap: p.handicap })) },
        hostToken
      );

      await apiClient.put(
        `/api/events/${eventId}/groupings`,
        {
          groups: groupsDraft.map((g, gi) => ({
            id: g.id,
            name: g.name,
            teeTime: g.teeTime || null,
            players: playersDraft
              .map((p, pi) => ({ ...p, savedId: savedPlayers[pi].id }))
              .filter((p) => p.groupIndex === gi)
              .map((p) => ({ playerId: p.savedId, isPlayerA: p.isPlayerA })),
          })),
        },
        hostToken
      );

      await load();
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save groupings.");
    } finally {
      setSaving(false);
    }
  }

  const viewGroups: ViewGroup[] = groups.map((g) => ({
    ...g,
    members: groupPlayers
      .filter((gp) => gp.group_id === g.id)
      .map((gp) => ({ player: players.find((p) => p.id === gp.player_id)!, isPlayerA: gp.is_player_a }))
      .filter((m) => m.player)
      .sort((a, b) => (b.isPlayerA ? 1 : 0) - (a.isPlayerA ? 1 : 0) || a.player.name.localeCompare(b.player.name)),
  }));

  const unassigned = players.filter((p) => !groupPlayers.some((gp) => gp.player_id === p.id));

  return (
    <Container>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">Groupings</h1>
        {isHost && !editing && (
          <Button variant="outline" size="md" onClick={startEditing}>
            Edit
          </Button>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-navy/50">Loading…</p>
      ) : editing ? (
        <div className="mt-4 flex flex-col gap-6">
          <Card>
            <h2 className="text-lg font-bold text-navy">Groups &amp; Players</h2>
            <p className="mt-1 text-xs text-navy/50">
              Add, remove, or move players between groups. Mark one Player A per group.
            </p>
            <div className="mt-4">
              <GroupBuilder state={builderState} onChange={setBuilderState} />
            </div>
          </Card>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Groupings"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {viewGroups.length === 0 && (
            <Card>
              <p className="text-sm text-navy/50">No groups set up yet.</p>
            </Card>
          )}
          {viewGroups.map((g) => (
            <Card key={g.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-navy">{g.name}</h2>
                {g.tee_time && <span className="text-sm text-navy/50">Tee {g.tee_time}</span>}
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {g.members.map(({ player, isPlayerA }) => (
                  <li key={player.id} className="flex items-center justify-between text-sm">
                    <span className="text-navy">{player.name}</span>
                    <span className="flex items-center gap-2 text-navy/50">
                      HCP {player.playing_handicap}
                      {isPlayerA && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase text-navy">
                          Player A
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {g.members.length === 0 && <li className="text-sm text-navy/40">No players yet</li>}
              </ul>
            </Card>
          ))}
          {unassigned.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-navy/70">Unassigned</h2>
              <ul className="mt-2 flex flex-col gap-1">
                {unassigned.map((p) => (
                  <li key={p.id} className="text-sm text-navy/60">
                    {p.name}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </Container>
  );
}
