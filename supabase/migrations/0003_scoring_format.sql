-- Adds a per-event scoring format choice: Stableford (default, unchanged
-- behaviour) or Stroke Play. Stroke Play ranks players by net total strokes
-- (gross minus playing handicap) — lowest wins — computed the same
-- per-hole way Stableford allocates handicap strokes, so it stays fair for
-- an in-progress round rather than deducting the full handicap upfront.

alter table events
  add column scoring_format text not null default 'stableford'
  check (scoring_format in ('stableford', 'stroke_play'));
