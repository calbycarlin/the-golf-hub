"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient } from "@/lib/supabase/client";
import { calculateStableford, calculateStrokePlay, type StablefordSummary, type StrokePlaySummary } from "@/lib/scoring";
import { rankByValue } from "@/lib/ranking";
import type { GroupPlayerRow, GroupRow, HoleRow, HoleScoreRow, PlayerRow, ScoringFormat } from "@/lib/supabase/types";

export type LeaderboardRow =
  | { format: "stableford"; player: PlayerRow; groupName: string | null; summary: StablefordSummary; rank: number; tied: boolean }
  | { format: "stroke_play"; player: PlayerRow; groupName: string | null; summary: StrokePlaySummary; rank: number; tied: boolean };

const POLL_MS = 8000;

export function useLeaderboardData(eventId: string, scoringFormat: ScoringFormat) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [holeCount, setHoleCount] = useState(18);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createPublicClient();
    const [{ data: playersData }, { data: holesData }, { data: groupsData }] = await Promise.all([
      supabase.from("players").select("*").eq("event_id", eventId),
      supabase.from("holes").select("*").eq("event_id", eventId).order("hole_number"),
      supabase.from("groups").select("*").eq("event_id", eventId),
    ]);

    const players = (playersData as PlayerRow[]) ?? [];
    const holes = (holesData as HoleRow[]) ?? [];
    const groups = (groupsData as GroupRow[]) ?? [];
    const playerIds = players.map((p) => p.id);
    const groupIds = groups.map((g) => g.id);

    const [{ data: gpData }, { data: scoresData }] = await Promise.all([
      groupIds.length
        ? supabase.from("group_players").select("*").in("group_id", groupIds)
        : Promise.resolve({ data: [] as GroupPlayerRow[] }),
      playerIds.length
        ? supabase.from("hole_scores").select("*").in("player_id", playerIds)
        : Promise.resolve({ data: [] as HoleScoreRow[] }),
    ]);

    const groupPlayers = (gpData as GroupPlayerRow[]) ?? [];
    const scores = (scoresData as HoleScoreRow[]) ?? [];
    const holeInfos = holes.map((h) => ({ holeNumber: h.hole_number, par: h.par, strokeIndex: h.stroke_index }));

    const summaries = players.map((player) => {
      const playerScores = scores
        .filter((s) => s.player_id === player.id)
        .map((s) => ({ holeNumber: s.hole_number, strokes: s.strokes }));
      const gp = groupPlayers.find((g) => g.player_id === player.id);
      const groupName = gp ? groups.find((g) => g.id === gp.group_id)?.name ?? null : null;

      if (scoringFormat === "stroke_play") {
        const summary = calculateStrokePlay(player.playing_handicap, holeInfos, playerScores);
        return { format: "stroke_play" as const, player, groupName, summary };
      }
      const summary = calculateStableford(player.playing_handicap, holeInfos, playerScores);
      return { format: "stableford" as const, player, groupName, summary };
    });

    // Stableford: higher points win. Stroke Play: lower net strokes win.
    const ranked =
      scoringFormat === "stroke_play"
        ? rankByValue(summaries, (s) => (s.summary as StrokePlaySummary).netTotal, "asc")
        : rankByValue(summaries, (s) => (s.summary as StablefordSummary).total, "desc");

    setRows(ranked.map((r) => ({ ...r.item, rank: r.rank, tied: r.tied })) as LeaderboardRow[]);
    setHoleCount(holes.length || 18);
    setLoading(false);
  }, [eventId, scoringFormat]);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the awaits inside `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, POLL_MS);

    const supabase = createPublicClient();
    const channel = supabase
      .channel(`leaderboard-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hole_scores" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `event_id=eq.${eventId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_players" }, load)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  return { rows, holeCount, loading };
}
