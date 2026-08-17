export interface RankedItem<T> {
  item: T;
  rank: number;
  tied: boolean;
}

/** Standard competition ranking (1, 1, 3, 4…) — shared by the leaderboard and results pages. */
export function rankByPoints<T>(items: T[], points: (item: T) => number): RankedItem<T>[] {
  const sorted = [...items].sort((a, b) => points(b) - points(a));

  let rank = 0;
  let prevPoints: number | null = null;
  const ranked = sorted.map((item, i) => {
    const p = points(item);
    if (p !== prevPoints) rank = i + 1;
    prevPoints = p;
    return { item, rank, tied: false };
  });

  const countByRank = new Map<number, number>();
  for (const r of ranked) countByRank.set(r.rank, (countByRank.get(r.rank) ?? 0) + 1);
  for (const r of ranked) r.tied = (countByRank.get(r.rank) ?? 0) > 1;

  return ranked;
}
