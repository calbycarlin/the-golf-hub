"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { LinkButton, Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useEvent } from "@/lib/eventContext";
import { apiClient, ApiError } from "@/lib/apiClient";
import { formatDeletionDate } from "@/lib/retention";
import { FlagIcon, TrophyIcon, CameraIcon, GolfBallIcon } from "@/components/ui/icons";

const HUB_LINKS = [
  { href: "/groupings", label: "Groupings", desc: "See who's playing with who", icon: FlagIcon },
  { href: "/scorecards", label: "Scorecards", desc: "Enter scores on the course", icon: GolfBallIcon },
  { href: "/leaderboard", label: "Leaderboard", desc: "Live Stableford standings", icon: TrophyIcon },
  { href: "/results", label: "Results", desc: "Final podium once complete", icon: TrophyIcon },
  { href: "/gallery", label: "Gallery", desc: "Photos from the day", icon: CameraIcon },
];

export default function EventHubPage() {
  const { event, eventId, isHost, hostToken, notFound, loading, refresh } = useEvent();

  if (notFound) return null;
  if (loading || !event) {
    return (
      <Container>
        <p className="text-navy/50">Loading event…</p>
      </Container>
    );
  }

  return (
    <Container>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HUB_LINKS.map((link) => (
          <LinkButton
            key={link.href}
            href={`/event/${eventId}${link.href}`}
            variant="outline"
            className="!h-auto !justify-start !border-navy/10 !bg-white !py-4 shadow-sm"
          >
            <link.icon className="h-6 w-6 shrink-0 text-accent-hover" />
            <span className="text-left">
              <span className="block font-bold text-navy">{link.label}</span>
              <span className="block text-xs font-normal text-navy/50">{link.desc}</span>
            </span>
          </LinkButton>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-navy/40">
        This event, including scores and photos, is automatically deleted on {formatDeletionDate(event.created_at)}.
      </p>

      {isHost && hostToken && (
        <HostControls eventId={eventId} hostToken={hostToken} event={event} onSaved={refresh} />
      )}
    </Container>
  );
}

function HostControls({
  eventId,
  hostToken,
  event,
  onSaved,
}: {
  eventId: string;
  hostToken: string;
  event: { name: string; course_name: string; event_date: string | null; status: string };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(event.name);
  const [courseName, setCourseName] = useState(event.course_name);
  const [eventDate, setEventDate] = useState(event.event_date ?? "");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDetails() {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(
        `/api/events/${eventId}`,
        { name, courseName, eventDate: eventDate || null },
        hostToken
      );
      onSaved();
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    if (!confirm("Mark this event complete? Results will be finalised for everyone.")) return;
    setCompleting(true);
    setError(null);
    try {
      await apiClient.post(`/api/events/${eventId}/complete`, undefined, hostToken);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark complete");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-bold text-navy">Host Controls</h2>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="hname">Event Name</Label>
            <Input id="hname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="hcourse">Course Name</Label>
            <Input id="hcourse" value={courseName} onChange={(e) => setCourseName(e.target.value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor="hdate">Date</Label>
            <Input
              id="hdate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="min-w-0 max-w-full appearance-none"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveDetails} disabled={saving} variant="accent">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button onClick={() => setEditing(false)} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit Event Details
          </Button>
          <LinkButton href={`/event/${eventId}/groupings`} variant="outline">
            Edit Groupings &amp; Players
          </LinkButton>
          {event.status !== "complete" && (
            <Button variant="accent" onClick={markComplete} disabled={completing}>
              {completing ? "Marking…" : "Mark Event Complete"}
            </Button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </Card>
  );
}
