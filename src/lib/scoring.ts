/**
 * Stableford scoring — the single source of truth used by both the live
 * leaderboard and the final results page so the two can never disagree.
 */

export interface HoleInfo {
  holeNumber: number;
  par: number;
  strokeIndex: number;
}

export interface StrokeEntry {
  holeNumber: number;
  strokes: number | null | undefined;
}

export interface HoleResult {
  holeNumber: number;
  par: number;
  strokeIndex: number;
  gross: number | null;
  strokesReceived: number;
  netPar: number;
  points: number | null;
}

export interface StablefordSummary {
  total: number;
  thru: number;
  holes: HoleResult[];
}

/** Whole strokes a player receives on a given hole from their playing handicap. */
export function strokesReceived(playingHandicap: number, strokeIndex: number): number {
  const baseStrokes = Math.floor(playingHandicap / 18);
  const extraStrokes = playingHandicap % 18;
  return baseStrokes + (strokeIndex <= extraStrokes ? 1 : 0);
}

export function netPar(par: number, received: number): number {
  return par + received;
}

/** Stableford points for a single hole given gross strokes and net par. */
export function holeStablefordPoints(gross: number, netParForHole: number): number {
  return Math.max(0, 2 - (gross - netParForHole));
}

/**
 * Full Stableford breakdown for one player across a set of holes.
 * Holes with no strokes entered yet are excluded from `total` and `thru`
 * rather than counted as zero — used as-is for the live (in-progress)
 * leaderboard, and again once all 18 are in for final results.
 */
export function calculateStableford(
  playingHandicap: number,
  holes: HoleInfo[],
  scores: StrokeEntry[]
): StablefordSummary {
  const scoreByHole = new Map<number, number | null | undefined>();
  for (const s of scores) scoreByHole.set(s.holeNumber, s.strokes);

  let total = 0;
  let thru = 0;
  const holeResults: HoleResult[] = [...holes]
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((hole) => {
      const received = strokesReceived(playingHandicap, hole.strokeIndex);
      const np = netPar(hole.par, received);
      const gross = scoreByHole.get(hole.holeNumber);
      const hasGross = typeof gross === "number";
      const points = hasGross ? holeStablefordPoints(gross as number, np) : null;

      if (hasGross) {
        total += points as number;
        thru += 1;
      }

      return {
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: hole.strokeIndex,
        gross: hasGross ? (gross as number) : null,
        strokesReceived: received,
        netPar: np,
        points,
      };
    });

  return { total, thru, holes: holeResults };
}
