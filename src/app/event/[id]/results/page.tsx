"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { TrophyIcon } from "@/components/ui/icons";
import { useEvent } from "@/lib/eventContext";
import { useLeaderboardData, type LeaderboardRow } from "@/lib/useLeaderboardData";

const PODIUM_STYLES = [
  { medal: "🥇", label: "1st", className: "bg-accent text-navy order-2 sm:order-2" },
  { medal: "🥈", label: "2nd", className: "bg-navy/10 text-navy order-1 sm:order-1" },
  { medal: "🥉", label: "3rd", className: "bg-navy/10 text-navy order-3 sm:order-3" },
];

function totalLabel(row: LeaderboardRow) {
  return row.format === "stroke_play" ? `${row.summary.netTotal} net` : `${row.summary.total} pts`;
}

export default function ResultsPage() {
  const { eventId, event } = useEvent();
  const scoringFormat = event?.scoring_format ?? "stableford";
  const { rows, holeCount, loading } = useLeaderboardData(eventId, scoringFormat);

  if (loading || !event) {
    return (
      <Container>
        <p className="text-navy/50">Loading…</p>
      </Container>
    );
  }

  if (event.status !== "complete") {
    return (
      <Container>
        <Card className="text-center">
          <TrophyIcon className="mx-auto h-8 w-8 text-navy/30" />
          <h1 className="mt-3 text-lg font-bold text-navy">Results aren&apos;t final yet</h1>
          <p className="mt-1 text-sm text-navy/50">
            This event is still {event.status === "setup" ? "in setup" : "in progress"}. Results unlock once the host marks it complete.
          </p>
          <a href={`/event/${eventId}/leaderboard`} className="mt-4 inline-block text-sm font-semibold text-accent-hover">
            View live leaderboard instead →
          </a>
        </Card>
      </Container>
    );
  }

  const rankGroups: { rank: number; tied: boolean; rows: LeaderboardRow[] }[] = [];
  for (const r of rows) {
    let group = rankGroups.find((g) => g.rank === r.rank);
    if (!group) {
      group = { rank: r.rank, tied: r.tied, rows: [] };
      rankGroups.push(group);
    }
    group.rows.push(r);
  }
  const podium = rankGroups.slice(0, 3);

  return (
    <Container>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-accent-hover">Event Complete</p>
        <h1 className="mt-1 text-2xl font-bold text-navy">Final Results</h1>
        <p className="mt-1 text-xs text-navy/50">
          {scoringFormat === "stroke_play" ? "Stroke Play — lowest net strokes wins" : "Stableford — most points wins"}
        </p>
      </div>

      <div className="mt-6 flex flex-col items-end gap-3 sm:flex-row sm:items-end sm:justify-center">
        {podium.map((group, i) => (
          <div key={group.rank} className={`flex w-full flex-col items-center rounded-2xl p-4 sm:w-40 ${PODIUM_STYLES[i]?.className ?? ""}`}>
            <span className="text-2xl">{PODIUM_STYLES[i]?.medal}</span>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide opacity-70">
              {group.tied ? `T-${PODIUM_STYLES[i]?.label ?? group.rank}` : PODIUM_STYLES[i]?.label ?? group.rank}
            </p>
            {group.rows.map((r) => (
              <p key={r.player.id} className="mt-1 text-center font-bold leading-tight">
                {r.player.name}
              </p>
            ))}
            <p className="mt-1 text-lg font-extrabold">{totalLabel(group.rows[0])}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold text-navy">Full Standings</h2>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <StandingRow key={r.player.id} row={r} holeCount={holeCount} />
        ))}
      </div>
    </Container>
  );
}

function StandingRow({ row, holeCount }: { row: LeaderboardRow; holeCount: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="!p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 font-bold text-navy">{row.tied ? `T-${row.rank}` : row.rank}</span>
          <div>
            <p className="font-semibold text-navy">{row.player.name}</p>
            {row.groupName && <p className="text-xs text-navy/50">{row.groupName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold text-navy">{totalLabel(row)}</span>
          <span className="text-navy/30">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-navy/10 px-3 pb-3">
          <table className="mt-2 w-full min-w-[36rem] text-xs">
            <thead>
              <tr className="text-navy/50">
                <th className="py-1 text-left font-semibold">Hole</th>
                {row.summary.holes.map((h) => (
                  <th key={h.holeNumber} className="py-1 text-center font-semibold">
                    {h.holeNumber}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-navy/50">Par</td>
                {row.summary.holes.map((h) => (
                  <td key={h.holeNumber} className="py-1 text-center text-navy/50">
                    {h.par}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1 font-semibold text-navy">Gross</td>
                {row.summary.holes.map((h) => (
                  <td key={h.holeNumber} className="py-1 text-center font-semibold text-navy">
                    {h.gross ?? "–"}
                  </td>
                ))}
              </tr>
              {row.format === "stroke_play" ? (
                <tr>
                  <td className="py-1 font-semibold text-accent-hover">Net</td>
                  {row.summary.holes.map((h) => (
                    <td key={h.holeNumber} className="py-1 text-center font-semibold text-accent-hover">
                      {h.net ?? "–"}
                    </td>
                  ))}
                </tr>
              ) : (
                <tr>
                  <td className="py-1 font-semibold text-accent-hover">Pts</td>
                  {row.summary.holes.map((h) => (
                    <td key={h.holeNumber} className="py-1 text-center font-semibold text-accent-hover">
                      {h.points ?? "–"}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-navy/40">{holeCount} holes</p>
        </div>
      )}
    </Card>
  );
}
