"use client";

import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { useEvent } from "@/lib/eventContext";
import { useLeaderboardData } from "@/lib/useLeaderboardData";

export default function LeaderboardPage() {
  const { eventId, event } = useEvent();
  const scoringFormat = event?.scoring_format ?? "stableford";
  const { rows, holeCount, loading } = useLeaderboardData(eventId, scoringFormat);
  const isStrokePlay = scoringFormat === "stroke_play";

  return (
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Live Leaderboard</h1>
          <p className="text-xs text-navy/50">{isStrokePlay ? "Stroke Play — lowest net strokes wins" : "Stableford — most points wins"}</p>
        </div>
        {event?.status === "in_progress" && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent-hover">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-hover" />
            Live
          </span>
        )}
      </div>
      {event?.status === "setup" && (
        <p className="mt-1 text-sm text-navy/50">The round hasn&apos;t started yet — scores will appear here once entered.</p>
      )}
      {event?.status === "complete" && (
        <p className="mt-1 text-sm text-navy/50">
          This event is complete —{" "}
          <a href={`/event/${eventId}/results`} className="font-semibold text-accent-hover underline">
            view final results
          </a>
          .
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-navy/50">Loading…</p>
      ) : rows.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-navy/50">No players yet.</p>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/10 bg-offwhite text-left text-xs font-semibold uppercase tracking-wide text-navy/50">
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2">Player</th>
                <th className="hidden px-3 py-2 sm:table-cell">Group</th>
                <th className="px-3 py-2 text-center">Thru</th>
                <th className="px-3 py-2 text-right">{isStrokePlay ? "Net" : "Pts"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.player.id} className="border-b border-navy/5 last:border-0">
                  <td className="px-3 py-2.5 font-bold text-navy">
                    {r.tied ? `T-${r.rank}` : r.rank}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-navy">{r.player.name}</td>
                  <td className="hidden px-3 py-2.5 text-navy/50 sm:table-cell">{r.groupName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-center text-navy/60">
                    {r.summary.thru}/{holeCount}
                  </td>
                  <td className="px-3 py-2.5 text-right text-lg font-extrabold text-navy">
                    {r.format === "stroke_play" ? r.summary.netTotal : r.summary.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
