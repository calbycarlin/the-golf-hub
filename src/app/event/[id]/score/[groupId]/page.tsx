"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createPublicClient } from "@/lib/supabase/client";
import { confirmPlayerA, isPlayerAConfirmed, clearPlayerAConfirmation } from "@/lib/playerA";
import { dequeueScore, enqueueScore, readQueue } from "@/lib/scoreQueue";
import type { GroupPlayerRow, GroupRow, HoleRow, PlayerRow } from "@/lib/supabase/types";

type ScoreMap = Record<string, number | null>;
const scoreKey = (playerId: string, holeNumber: number) => `${playerId}:${holeNumber}`;

export default function ScoreEntryPage() {
  const params = useParams<{ id: string; groupId: string }>();
  const eventId = params.id;
  const groupId = params.groupId;

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [members, setMembers] = useState<{ player: PlayerRow; isPlayerA: boolean }[]>([]);
  const [holes, setHoles] = useState<HoleRow[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [loading, setLoading] = useState(true);
  const [currentHole, setCurrentHole] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createPublicClient();
    const [{ data: groupData }, { data: gpData }, { data: holesData }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_players").select("*").eq("group_id", groupId),
      supabase.from("holes").select("*").eq("event_id", eventId).order("hole_number"),
    ]);

    const gp = (gpData as GroupPlayerRow[]) ?? [];
    const playerIds = gp.map((g) => g.player_id);
    const { data: playersData } = playerIds.length
      ? await supabase.from("players").select("*").in("id", playerIds)
      : { data: [] as PlayerRow[] };

    const memberList = gp
      .map((g) => ({ player: (playersData as PlayerRow[]).find((p) => p.id === g.player_id)!, isPlayerA: g.is_player_a }))
      .filter((m) => m.player)
      .sort((a, b) => (b.isPlayerA ? 1 : 0) - (a.isPlayerA ? 1 : 0) || a.player.name.localeCompare(b.player.name));

    const { data: scoresData } = playerIds.length
      ? await supabase.from("hole_scores").select("player_id, hole_number, strokes").in("player_id", playerIds)
      : { data: [] as { player_id: string; hole_number: number; strokes: number | null }[] };

    const scoreMap: ScoreMap = {};
    for (const s of scoresData ?? []) scoreMap[scoreKey(s.player_id, s.hole_number)] = s.strokes;
    // local unsynced edits take precedence over what's in the DB
    for (const q of readQueue(groupId)) scoreMap[scoreKey(q.playerId, q.holeNumber)] = q.strokes;

    setGroup(groupData as GroupRow);
    setMembers(memberList);
    setHoles((holesData as HoleRow[]) ?? []);
    setScores(scoreMap);

    const holeNumbers = ((holesData as HoleRow[]) ?? []).map((h) => h.hole_number);
    const firstIncomplete = holeNumbers.find((hn) => memberList.some((m) => scoreMap[scoreKey(m.player.id, hn)] == null));
    setCurrentHole(firstIncomplete ?? holeNumbers[0] ?? 1);
    setLoading(false);
  }, [eventId, groupId]);

  useEffect(() => {
    // Re-sync from localStorage/network whenever the group changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmed(isPlayerAConfirmed(groupId));
    load();
  }, [groupId, load]);

  // Background retry: flush anything queued from a dropped connection.
  const flushing = useRef(false);
  const flushQueue = useCallback(async () => {
    if (flushing.current) return;
    const queue = readQueue(groupId);
    if (queue.length === 0) return;
    flushing.current = true;
    setSyncing(true);
    const supabase = createPublicClient();
    for (const entry of queue) {
      const { error } = await supabase
        .from("hole_scores")
        .upsert(
          { group_id: groupId, player_id: entry.playerId, hole_number: entry.holeNumber, strokes: entry.strokes },
          { onConflict: "player_id,hole_number" }
        );
      if (!error) dequeueScore(groupId, entry.playerId, entry.holeNumber);
    }
    flushing.current = false;
    setSyncing(readQueue(groupId).length > 0);
  }, [groupId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    flushQueue();
    const interval = setInterval(flushQueue, 5000);
    window.addEventListener("online", flushQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", flushQueue);
    };
  }, [flushQueue]);

  const hasStartedEvent = useRef(false);

  function setStrokes(playerId: string, holeNumber: number, strokes: number | null) {
    setScores((s) => ({ ...s, [scoreKey(playerId, holeNumber)]: strokes }));
    enqueueScore(groupId, { playerId, holeNumber, strokes });
    flushQueue();

    if (!hasStartedEvent.current) {
      hasStartedEvent.current = true;
      fetch(`/api/events/${eventId}/start`, { method: "POST" }).catch(() => {});
    }
  }

  const hole = holes.find((h) => h.hole_number === currentHole);

  const holeStatus = useMemo(() => {
    return holes.map((h) => {
      const filled = members.filter((m) => scores[scoreKey(m.player.id, h.hole_number)] != null).length;
      return { holeNumber: h.hole_number, filled, total: members.length };
    });
  }, [holes, members, scores]);

  if (loading) {
    return (
      <Container>
        <p className="text-navy/50">Loading scorecard…</p>
      </Container>
    );
  }

  if (!group) {
    return (
      <Container>
        <p className="text-navy/50">Group not found.</p>
      </Container>
    );
  }

  const playerA = members.find((m) => m.isPlayerA);

  if (!playerA) {
    return (
      <Container>
        <Card>
          <p className="text-navy/70">
            This group doesn&apos;t have a Player A assigned yet. Ask the host to set one on the Groupings page.
          </p>
          <Link href={`/event/${eventId}/groupings`} className="mt-3 inline-block text-sm font-semibold text-accent-hover">
            Go to Groupings →
          </Link>
        </Card>
      </Container>
    );
  }

  if (!confirmed) {
    return (
      <Container className="flex flex-1 flex-col justify-center">
        <Card className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-navy/50">{group.name}</p>
          <h1 className="mt-2 text-xl font-bold text-navy">Are you entering scores as {playerA.player.name}?</h1>
          <p className="mt-2 text-sm text-navy/60">
            Only Player A enters scores for the group. This is honour-system — no password needed.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="accent"
              size="lg"
              onClick={() => {
                confirmPlayerA(groupId);
                setConfirmed(true);
              }}
            >
              Yes, I&apos;m {playerA.player.name}
            </Button>
            <Link href={`/event/${eventId}/scorecards`} className="text-sm font-semibold text-navy/50">
              No, take me back
            </Link>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">{group.name}</h1>
          <p className="text-xs text-navy/50">
            Entering as {playerA.player.name}
            {syncing && <span className="ml-2 text-accent-hover">Syncing…</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearPlayerAConfirmation(groupId);
            setConfirmed(false);
          }}
          className="text-xs font-semibold text-navy/40 underline"
        >
          Not you?
        </button>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2">
        {holeStatus.map((h) => {
          const complete = h.total > 0 && h.filled === h.total;
          const partial = h.filled > 0 && !complete;
          return (
            <button
              key={h.holeNumber}
              onClick={() => setCurrentHole(h.holeNumber)}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                h.holeNumber === currentHole
                  ? "bg-navy text-white"
                  : complete
                    ? "bg-accent/30 text-navy"
                    : partial
                      ? "border-2 border-accent text-navy"
                      : "border border-navy/15 text-navy/40"
              }`}
            >
              {h.holeNumber}
            </button>
          );
        })}
      </div>

      {hole && (
        <Card className="mt-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={currentHole <= 1}
              onClick={() => setCurrentHole((h) => h - 1)}
              className="px-3 py-2 text-2xl text-navy disabled:opacity-20"
              aria-label="Previous hole"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-navy">Hole {hole.hole_number}</p>
              <p className="text-sm text-navy/50">
                Par {hole.par} · Stroke Index {hole.stroke_index}
              </p>
            </div>
            <button
              type="button"
              disabled={currentHole >= holes.length}
              onClick={() => setCurrentHole((h) => h + 1)}
              className="px-3 py-2 text-2xl text-navy disabled:opacity-20"
              aria-label="Next hole"
            >
              ›
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {members.map((m) => {
              const value = scores[scoreKey(m.player.id, hole.hole_number)];
              return (
                <div key={m.player.id} className="flex items-center justify-between gap-3 rounded-xl bg-offwhite p-3">
                  <span className="min-w-0 truncate font-semibold text-navy">{m.player.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStrokes(m.player.id, hole.hole_number, Math.max(1, (value ?? hole.par) - 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold text-navy shadow-sm active:scale-95"
                      aria-label={`Decrease strokes for ${m.player.name}`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={value ?? ""}
                      placeholder="-"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setStrokes(m.player.id, hole.hole_number, raw === "" ? null : Number(raw));
                      }}
                      className="h-11 w-14 rounded-lg border-2 border-navy/15 bg-white text-center text-xl font-bold text-navy focus:border-navy focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setStrokes(m.player.id, hole.hole_number, Math.min(20, (value ?? hole.par) + 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold text-navy shadow-sm active:scale-95"
                      aria-label={`Increase strokes for ${m.player.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {members.map((m) => {
          const thru = holes.filter((h) => scores[scoreKey(m.player.id, h.hole_number)] != null).length;
          const gross = holes.reduce((sum, h) => sum + (scores[scoreKey(m.player.id, h.hole_number)] ?? 0), 0);
          return (
            <div key={m.player.id} className="rounded-xl border border-navy/10 bg-white p-3 text-center">
              <p className="truncate text-xs font-semibold text-navy/60">{m.player.name}</p>
              <p className="text-lg font-bold text-navy">{gross}</p>
              <p className="text-[10px] text-navy/40">thru {thru}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center">
        <Link href={`/event/${eventId}/leaderboard`} className="text-sm font-semibold text-accent-hover">
          View Live Leaderboard →
        </Link>
      </div>
    </Container>
  );
}
