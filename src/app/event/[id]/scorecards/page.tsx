"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { useEvent } from "@/lib/eventContext";
import { createPublicClient } from "@/lib/supabase/client";
import type { GroupPlayerRow, GroupRow, HoleRow, PlayerRow } from "@/lib/supabase/types";

export default function ScorecardsPage() {
  const { eventId } = useEvent();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [groupPlayers, setGroupPlayers] = useState<GroupPlayerRow[]>([]);
  const [holeCount, setHoleCount] = useState(18);
  const [thruByGroup, setThruByGroup] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createPublicClient();
      const [{ data: groupsData }, { data: holesData }] = await Promise.all([
        supabase.from("groups").select("*").eq("event_id", eventId).order("sort_order"),
        supabase.from("holes").select("*").eq("event_id", eventId),
      ]);
      const groupIds = (groupsData ?? []).map((g) => g.id);
      const [{ data: gpData }, { data: playersData }, { data: scores }] = await Promise.all([
        groupIds.length
          ? supabase.from("group_players").select("*").in("group_id", groupIds)
          : Promise.resolve({ data: [] as GroupPlayerRow[] }),
        supabase.from("players").select("*").eq("event_id", eventId),
        groupIds.length
          ? supabase.from("hole_scores").select("group_id, hole_number, strokes").in("group_id", groupIds)
          : Promise.resolve({ data: [] as { group_id: string; hole_number: number; strokes: number | null }[] }),
      ]);

      if (cancelled) return;
      setGroups((groupsData as GroupRow[]) ?? []);
      setPlayers((playersData as PlayerRow[]) ?? []);
      setGroupPlayers((gpData as GroupPlayerRow[]) ?? []);
      setHoleCount((holesData as HoleRow[])?.length || 18);

      const thru: Record<string, Set<number>> = {};
      for (const s of scores ?? []) {
        if (s.strokes == null) continue;
        thru[s.group_id] ??= new Set();
        thru[s.group_id].add(s.hole_number);
      }
      setThruByGroup(Object.fromEntries(Object.entries(thru).map(([k, v]) => [k, v.size])));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <Container>
      <h1 className="text-xl font-bold text-navy">Scorecards</h1>
      <p className="mt-1 text-sm text-navy/60">Tap your group to enter scores on the course.</p>

      {loading ? (
        <p className="mt-4 text-navy/50">Loading…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {groups.length === 0 && (
            <Card>
              <p className="text-sm text-navy/50">No groups set up yet — check back once the host has arranged groupings.</p>
            </Card>
          )}
          {groups.map((g) => {
            const names = groupPlayers
              .filter((gp) => gp.group_id === g.id)
              .map((gp) => players.find((p) => p.id === gp.player_id)?.name)
              .filter(Boolean);
            const thru = thruByGroup[g.id] ?? 0;

            return (
              <Card key={g.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-navy">{g.name}</p>
                  <p className="truncate text-sm text-navy/50">{names.join(", ") || "No players"}</p>
                  <p className="mt-1 text-xs font-semibold text-accent-hover">
                    Thru {thru}/{holeCount}
                  </p>
                </div>
                <LinkButton href={`/event/${eventId}/score/${g.id}`} variant="accent" size="md" className="shrink-0">
                  Enter Scores
                </LinkButton>
              </Card>
            );
          })}
        </div>
      )}
    </Container>
  );
}
