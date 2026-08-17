"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button, LinkButton } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { apiClient, ApiError } from "@/lib/apiClient";
import { storeHostToken, hostLink as buildHostLink } from "@/lib/hostToken";
import { CopyButton } from "@/components/CopyButton";
import { GroupBuilder } from "@/components/GroupBuilder";
import type { GroupBuilderState } from "@/lib/draftTypes";

interface HoleDraft {
  holeNumber: number;
  par: number;
  strokeIndex: number;
}

function defaultHoles(count: number): HoleDraft[] {
  return Array.from({ length: count }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    strokeIndex: i + 1,
  }));
}

export default function CreateEventPage() {
  const [name, setName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [holes, setHoles] = useState<HoleDraft[]>(() => defaultHoles(18));

  const [groupBuilderState, setGroupBuilderState] = useState<GroupBuilderState>({
    groups: [{ name: "Group 1", teeTime: "" }],
    players: [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; joinCode: string; hostToken: string } | null>(null);

  function changeHoleCount(count: 9 | 18) {
    setHoleCount(count);
    setHoles(defaultHoles(count));
  }

  function updateHole(index: number, patch: Partial<HoleDraft>) {
    setHoles((hs) => hs.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  async function handleSubmit() {
    setError(null);

    const trimmedName = name.trim();
    const trimmedCourse = courseName.trim();
    const { groups, players } = groupBuilderState;
    const validPlayers = players.filter((p) => p.name.trim());

    if (!trimmedName || !trimmedCourse) {
      setError("Event name and course name are required.");
      return;
    }
    if (validPlayers.length === 0) {
      setError("Add at least one player.");
      return;
    }
    for (let gi = 0; gi < groups.length; gi++) {
      const inGroup = validPlayers.filter((p) => p.groupIndex === gi);
      if (inGroup.length > 0 && !inGroup.some((p) => p.isPlayerA)) {
        setError(`Group "${groups[gi].name}" needs a Player A selected.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        courseName: trimmedCourse,
        eventDate: eventDate || null,
        holes: holes.map((h) => ({ holeNumber: h.holeNumber, par: h.par, strokeIndex: h.strokeIndex })),
        players: validPlayers.map((p) => ({ name: p.name.trim(), playingHandicap: p.handicap })),
        groups: groups.map((g, gi) => {
          const playerIndexes = validPlayers.flatMap((p, pi) => (p.groupIndex === gi ? [pi] : []));
          const playerAIndex = validPlayers.findIndex((p, pi) => playerIndexes.includes(pi) && p.isPlayerA);
          return {
            name: g.name.trim() || `Group ${gi + 1}`,
            teeTime: g.teeTime || null,
            playerIndexes,
            playerAIndex,
          };
        }),
      };

      const data = await apiClient.post("/api/events", payload);
      storeHostToken(data.eventId, data.hostToken);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong creating the event.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <ConfirmationScreen eventId={result.eventId} joinCode={result.joinCode} hostToken={result.hostToken} />;
  }

  return (
    <main className="flex-1 bg-offwhite">
      <Container>
        <Link href="/" className="mb-6 inline-block text-sm font-semibold text-navy/60">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-navy">Create an Event</h1>
        <p className="mt-1 text-sm text-navy/60">Set up your course, players and groups — you can tweak all of this later as host.</p>

        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <h2 className="text-lg font-bold text-navy">Event Details</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <Label htmlFor="name">Event Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Autumn Cup 2026" />
              </div>
              <div>
                <Label htmlFor="course">Course Name</Label>
                <Input id="course" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Royal Sands GC" />
              </div>
              <div className="min-w-0">
                <Label htmlFor="date">Date (optional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="min-w-0 max-w-full appearance-none"
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy">Course Setup</h2>
              <div className="flex gap-1 rounded-lg bg-offwhite p-1">
                {([9, 18] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changeHoleCount(n)}
                    className={`rounded-md px-3 py-1 text-sm font-semibold ${
                      holeCount === n ? "bg-navy text-white" : "text-navy/60"
                    }`}
                  >
                    {n} holes
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-navy/50">
              Defaults to Par 4 with stroke index = hole number. Edit any hole — stroke index is used to fairly allocate handicap strokes.
            </p>

            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
              <div className="font-semibold text-navy/50">Hole</div>
              <div className="font-semibold text-navy/50">Par</div>
              <div className="font-semibold text-navy/50">Stroke Index</div>
              {holes.map((h, i) => (
                <HoleRow key={h.holeNumber} hole={h} onChange={(patch) => updateHole(i, patch)} />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-navy">Groups &amp; Players</h2>
            <p className="mt-1 text-xs text-navy/50">
              Set the number of groups, then add each player straight into their group with a name, handicap, and Player A.
            </p>
            <div className="mt-4">
              <GroupBuilder state={groupBuilderState} onChange={setGroupBuilderState} />
            </div>
          </Card>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
          )}

          <Button variant="accent" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create Event"}
          </Button>
        </div>
      </Container>
    </main>
  );
}

function HoleRow({ hole, onChange }: { hole: HoleDraft; onChange: (patch: Partial<HoleDraft>) => void }) {
  return (
    <>
      <div className="flex h-10 items-center font-semibold text-navy">{hole.holeNumber}</div>
      <NumberField
        min={3}
        max={6}
        value={hole.par}
        onChange={(par) => onChange({ par })}
        className="w-full min-w-0"
        ariaLabel={`Par for hole ${hole.holeNumber}`}
      />
      <NumberField
        min={1}
        max={18}
        value={hole.strokeIndex}
        onChange={(strokeIndex) => onChange({ strokeIndex })}
        className="w-full min-w-0"
        ariaLabel={`Stroke index for hole ${hole.holeNumber}`}
      />
    </>
  );
}

function ConfirmationScreen({ eventId, joinCode, hostToken }: { eventId: string; joinCode: string; hostToken: string }) {
  const link = buildHostLink(eventId, hostToken);
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-navy px-4 py-12 text-white">
      <Container className="max-w-md">
        <Card className="!bg-white text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-hover">Event Created</p>
          <h1 className="mt-1 text-2xl font-bold text-navy">You&apos;re all set</h1>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Join Code</p>
            <p className="mt-1 text-4xl font-extrabold tracking-[0.2em] text-navy">{joinCode}</p>
            <CopyButton text={joinCode} label="Copy code" className="mt-2" />
            <p className="mt-2 text-xs text-navy/50">Share this with your players so they can join, view groupings and enter scores.</p>
          </div>

          <div className="mt-6 rounded-xl bg-offwhite p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">This device is now the host</p>
            <p className="mt-1 text-xs text-navy/60">
              Your host access is saved to this browser. As a backup (in case it gets cleared), bookmark or send yourself this host link:
            </p>
            <p className="mt-2 break-all rounded-lg bg-white p-2 text-xs text-navy/70">{link}</p>
            <CopyButton text={link} label="Copy host link" className="mt-2" />
          </div>

          <LinkButton href={`/event/${eventId}`} variant="accent" size="lg" className="mt-6 w-full">
            Go to Event Hub
          </LinkButton>
        </Card>
      </Container>
    </main>
  );
}
