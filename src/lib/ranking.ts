export interface RankedItem<T> {
  item: T;
  rank: number;
  tied: boolean;
}

/**
 * Standard competition ranking (1, 1, 3, 4…) — shared by the leaderboard
 * and results pages so they can't disagree. `direction` controls which way
 * "better" sorts: "desc" for Stableford (higher points win), "asc" for
 * Stroke Play (lower net strokes win).
 */
export function rankByValue<T>(
  items: T[],
  value: (item: T) => number,
  direction: "desc" | "asc" = "desc"
): RankedItem<T>[] {
  const sorted = [...items].sort((a, b) => (direction === "desc" ? value(b) - value(a) : value(a) - value(b)));

  let rank = 0;
  let prevValue: number | null = null;
  const ranked = sorted.map((item, i) => {
    const v = value(item);
    if (v !== prevValue) rank = i + 1;
    prevValue = v;
    return { item, rank, tied: false };
  });

  const countByRank = new Map<number, number>();
  for (const r of ranked) countByRank.set(r.rank, (countByRank.get(r.rank) ?? 0) + 1);
  for (const r of ranked) r.tied = (countByRank.get(r.rank) ?? 0) > 1;

  return ranked;
}
