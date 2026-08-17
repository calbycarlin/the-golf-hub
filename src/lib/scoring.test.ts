import { describe, expect, it } from "vitest";
import { calculateStableford, calculateStrokePlay, holeStablefordPoints, strokesReceived } from "./scoring";

describe("strokesReceived", () => {
  it("gives a single stroke on holes at/under the extra-strokes count", () => {
    // handicap 9 -> base 0, extra 9: strokes on SI 1-9, none on SI 10-18
    expect(strokesReceived(9, 5)).toBe(1);
    expect(strokesReceived(9, 9)).toBe(1);
    expect(strokesReceived(9, 10)).toBe(0);
  });

  it("gives a base stroke on every hole once handicap passes 18", () => {
    // handicap 20 -> base 1, extra 2: two strokes on SI 1-2, one elsewhere
    expect(strokesReceived(20, 1)).toBe(2);
    expect(strokesReceived(20, 2)).toBe(2);
    expect(strokesReceived(20, 3)).toBe(1);
    expect(strokesReceived(20, 18)).toBe(1);
  });

  it("gives zero strokes for a scratch (0) handicap", () => {
    expect(strokesReceived(0, 1)).toBe(0);
    expect(strokesReceived(0, 18)).toBe(0);
  });
});

describe("holeStablefordPoints", () => {
  // hand-calculated table for a net par of 5 (e.g. par 4 + 1 stroke received)
  it("matches the standard Stableford table", () => {
    expect(holeStablefordPoints(3, 5)).toBe(4); // net eagle
    expect(holeStablefordPoints(4, 5)).toBe(3); // net birdie
    expect(holeStablefordPoints(5, 5)).toBe(2); // net par
    expect(holeStablefordPoints(6, 5)).toBe(1); // net bogey
    expect(holeStablefordPoints(7, 5)).toBe(0); // net double bogey
    expect(holeStablefordPoints(9, 5)).toBe(0); // net triple+ still floors at 0
  });

  it("keeps rewarding better-than-eagle nets", () => {
    expect(holeStablefordPoints(2, 5)).toBe(5); // net albatross
  });
});

describe("calculateStableford", () => {
  const holes = [
    { holeNumber: 1, par: 4, strokeIndex: 5 },
    { holeNumber: 2, par: 4, strokeIndex: 15 },
    { holeNumber: 3, par: 3, strokeIndex: 1 },
  ];

  it("only counts holes that have been played so far", () => {
    const summary = calculateStableford(9, holes, [
      { holeNumber: 1, strokes: 5 }, // SI5 <= extra(9) -> 1 stroke, net par 5, gross 5 -> 2 pts
      { holeNumber: 2, strokes: null }, // not played yet
    ]);

    expect(summary.thru).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.holes.find((h) => h.holeNumber === 2)?.points).toBeNull();
  });

  it("sums points correctly across a full set of holes", () => {
    const summary = calculateStableford(9, holes, [
      { holeNumber: 1, strokes: 5 }, // net par 5, gross 5 -> 2 pts
      { holeNumber: 2, strokes: 4 }, // SI15 > extra(9) -> 0 strokes, net par 4, gross 4 -> 2 pts
      { holeNumber: 3, strokes: 3 }, // SI1 <= extra(9) -> 1 stroke, net par 4, gross 3 -> 3 pts
    ]);

    expect(summary.thru).toBe(3);
    expect(summary.total).toBe(7);
  });

  it("handles a high handicap player correctly (>18)", () => {
    const summary = calculateStableford(20, holes, [
      { holeNumber: 1, strokes: 6 }, // base1+extra2, SI5>2 -> 1 stroke, net par 5, gross 6 -> 1 pt
      { holeNumber: 3, strokes: 5 }, // SI1<=2 -> 2 strokes, net par 5, gross 5 -> 2 pts
    ]);

    expect(summary.total).toBe(3);
    expect(summary.thru).toBe(2);
  });
});

describe("calculateStrokePlay", () => {
  const holes = [
    { holeNumber: 1, par: 4, strokeIndex: 5 },
    { holeNumber: 2, par: 4, strokeIndex: 15 },
    { holeNumber: 3, par: 3, strokeIndex: 1 },
  ];

  it("only counts holes played so far, net computed per hole", () => {
    const summary = calculateStrokePlay(9, holes, [
      { holeNumber: 1, strokes: 5 }, // SI5 <= extra(9) -> 1 stroke received, net 4
      { holeNumber: 2, strokes: null },
    ]);

    expect(summary.thru).toBe(1);
    expect(summary.grossTotal).toBe(5);
    expect(summary.netTotal).toBe(4);
  });

  it("sums gross and net correctly across a full set of holes", () => {
    const summary = calculateStrokePlay(9, holes, [
      { holeNumber: 1, strokes: 5 }, // SI5<=9 -> 1 stroke, net 4
      { holeNumber: 2, strokes: 4 }, // SI15>9 -> 0 strokes, net 4
      { holeNumber: 3, strokes: 3 }, // SI1<=9 -> 1 stroke, net 2
    ]);

    expect(summary.thru).toBe(3);
    expect(summary.grossTotal).toBe(12);
    expect(summary.netTotal).toBe(10);
  });

  it("handles a high handicap player correctly (>18)", () => {
    const summary = calculateStrokePlay(20, holes, [
      { holeNumber: 1, strokes: 6 }, // base1+extra2, SI5>2 -> 1 stroke, net 5
      { holeNumber: 3, strokes: 5 }, // SI1<=2 -> 2 strokes, net 3
    ]);

    expect(summary.grossTotal).toBe(11);
    expect(summary.netTotal).toBe(8);
    expect(summary.thru).toBe(2);
  });

  it("matches the flat gross-minus-handicap total once all 18 holes are in", () => {
    // A player's per-hole strokesReceived always sums to their handicap
    // across a genuine 18-hole set (SI 1-18 each represented once) — this
    // is what makes the per-hole net calculation safe to use mid-round.
    const eighteenHoles = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4,
      strokeIndex: i + 1,
    }));
    const playingHandicap = 9;
    const scores = eighteenHoles.map((h) => ({ holeNumber: h.holeNumber, strokes: 4 }));

    const summary = calculateStrokePlay(playingHandicap, eighteenHoles, scores);

    expect(summary.thru).toBe(18);
    expect(summary.grossTotal).toBe(72);
    expect(summary.netTotal).toBe(summary.grossTotal - playingHandicap);
    expect(summary.netTotal).toBe(63);
  });
});
