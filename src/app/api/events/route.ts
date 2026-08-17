import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateHostToken, generateJoinCode, hashHostToken } from "@/lib/codes";
import type { ScoringFormat } from "@/lib/supabase/types";

const SCORING_FORMATS: ScoringFormat[] = ["stableford", "stroke_play"];

interface HoleInput {
  holeNumber: number;
  par: number;
  strokeIndex: number;
}

interface PlayerInput {
  name: string;
  playingHandicap: number;
}

interface GroupInput {
  name: string;
  teeTime?: string | null;
  playerIndexes: number[];
  playerAIndex: number;
}

interface CreateEventBody {
  name: string;
  courseName: string;
  eventDate?: string | null;
  scoringFormat?: ScoringFormat;
  holes: HoleInput[];
  players: PlayerInput[];
  groups: GroupInput[];
}

const JOIN_CODE_ATTEMPTS = 10;

export async function POST(request: Request) {
  let body: CreateEventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.courseName?.trim()) {
    return NextResponse.json({ error: "Event name and course name are required" }, { status: 400 });
  }
  if (!Array.isArray(body.holes) || body.holes.length === 0) {
    return NextResponse.json({ error: "At least one hole is required" }, { status: 400 });
  }
  if (!Array.isArray(body.players) || body.players.length === 0) {
    return NextResponse.json({ error: "At least one player is required" }, { status: 400 });
  }

  const scoringFormat: ScoringFormat = SCORING_FORMATS.includes(body.scoringFormat as ScoringFormat)
    ? (body.scoringFormat as ScoringFormat)
    : "stableford";

  const admin = createAdminClient();
  const hostToken = generateHostToken();
  const hostTokenHash = hashHostToken(hostToken);

  let joinCode = "";
  let eventId: string | null = null;

  for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt++) {
    joinCode = generateJoinCode();
    const { data, error } = await admin
      .from("events")
      .insert({
        name: body.name.trim(),
        course_name: body.courseName.trim(),
        event_date: body.eventDate || null,
        join_code: joinCode,
        host_token_hash: hostTokenHash,
        status: "setup",
        scoring_format: scoringFormat,
      })
      .select("id")
      .single();

    if (!error && data) {
      eventId = data.id;
      break;
    }
    // 23505 = unique_violation — join code collision, try again with a new code
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!eventId) {
    return NextResponse.json(
      { error: "Could not generate a unique join code, please try again" },
      { status: 500 }
    );
  }

  try {
    const { error: holesError } = await admin.from("holes").insert(
      body.holes.map((h) => ({
        event_id: eventId,
        hole_number: h.holeNumber,
        par: h.par,
        stroke_index: h.strokeIndex,
      }))
    );
    if (holesError) throw new Error(holesError.message);

    // A single multi-row INSERT ... VALUES ... RETURNING preserves input
    // order in Postgres, so playerIds[i] below still lines up with
    // body.players[i] (and therefore with the groups' playerIndexes)
    // without needing an explicit ORDER BY — which would fail here anyway,
    // since ordering by a column outside the .select() projection isn't
    // valid on an insert/returning query.
    const { data: insertedPlayers, error: playersError } = await admin
      .from("players")
      .insert(
        body.players.map((p) => ({
          event_id: eventId,
          name: p.name.trim(),
          playing_handicap: p.playingHandicap,
        }))
      )
      .select("id");
    if (playersError) throw new Error(playersError.message);

    const playerIds = (insertedPlayers ?? []).map((p) => p.id as string);

    if (body.groups?.length) {
      // Same input-order guarantee as the players insert above — no
      // ORDER BY needed (and, as above, one isn't valid here anyway).
      const { data: insertedGroups, error: groupsError } = await admin
        .from("groups")
        .insert(
          body.groups.map((g, i) => ({
            event_id: eventId,
            name: g.name,
            tee_time: g.teeTime || null,
            sort_order: i,
          }))
        )
        .select("id");
      if (groupsError) throw new Error(groupsError.message);

      const groupIds = (insertedGroups ?? []).map((g) => g.id as string);

      const groupPlayerRows = body.groups.flatMap((g, gi) =>
        g.playerIndexes.map((pIndex) => ({
          group_id: groupIds[gi],
          player_id: playerIds[pIndex],
          is_player_a: pIndex === g.playerAIndex,
        }))
      );

      if (groupPlayerRows.length) {
        const { error: gpError } = await admin.from("group_players").insert(groupPlayerRows);
        if (gpError) throw new Error(gpError.message);
      }
    }
  } catch (err) {
    // best-effort rollback: cascade delete cleans up holes/players/groups/group_players
    await admin.from("events").delete().eq("id", eventId);
    const message = err instanceof Error ? err.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ eventId, joinCode, hostToken });
}
