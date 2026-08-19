# The Golf Hub

A hub for a golf society or group of friends to run a golf day together: set up players and groups, enter scores from the course on a phone, watch a live Stableford leaderboard, and see final results once the round is done.

No accounts, no passwords. Access is via a short **Join Code** (view + score entry) and a per-event **Host Token** (setup/admin), as described below.

## Tech stack

- **Next.js 16** (App Router, TypeScript) — frontend + API routes (Route Handlers)
- **Tailwind CSS v4** — styling (utility-first, CSS-based theme tokens, no separate `tailwind.config.js`)
- **Supabase** — Postgres (data), Row Level Security, Realtime (live leaderboard/gallery updates), Storage (photo gallery)
- **Vitest** — unit tests for the Stableford scoring engine
- **Vercel** — deployment target

I stuck with the recommended stack as-is (Supabase + Vercel) rather than the SQLite/polling-only fallback, since a hosted Postgres + Realtime + Storage backend is the better fit for a multi-device, concurrent-write app like this and Supabase's free tier is enough for a golf day. The live leaderboard and gallery use a **Supabase Realtime subscription as the primary update mechanism, with a 5–10s poll as a fallback/belt-and-braces** for the leaderboard — so it keeps working even if a realtime connection drops on a patchy course network.

## How access control works (no accounts)

There's no Supabase Auth / user login anywhere in this app. Instead:

- **Join Code** — 6 characters, uppercase, digits `2-9` and letters with `0/O/1/I` removed to avoid ambiguity. Looked up client-side against the public `events` table to find the event ID; from there, every event page (groupings, scorecards, leaderboard, results, gallery) is reachable and readable by anyone with the link.
- **Host Token** — a 32-byte random secret generated server-side when the event is created, shown once, and stored in the creating device's `localStorage` (keyed by event ID). A **Host Link** (`/event/{id}?host={token}`) is also shown as a backup — opening it stores the token again, so it can be bookmarked or sent to yourself. Every write that changes event/course/player/groupings data goes through an API route that hashes the supplied token (SHA-256 + a server-side pepper) and compares it to the hash stored on the event — the raw token is never stored server-side.
- **Player A confirmation** — honour-system, no password. The score-entry page for a group just asks "Are you entering scores as {Player A's name}?" before unlocking the grid, and remembers the answer in that browser's `localStorage` (with a "Not you?" reset link). This is intentionally lightweight per the spec; a natural v2 upgrade is a per-group 4-digit PIN if honour-system access turns out not to be enough.

**Database-level enforcement.** Row Level Security is on for every table. The anon (public) key can only `SELECT` — that's what powers the public leaderboard/gallery pages and Realtime subscriptions. All `INSERT`/`UPDATE`/`DELETE` for events/holes/players/groups/groupings goes through Next.js Route Handlers using the Supabase **service role** key, which checks the host token before writing — so even if a page had a bug, the database itself won't accept a write from a browser that only holds the anon key for those tables. The two exceptions, both deliberate and matching the product spec: `hole_scores` (INSERT/UPDATE) and `photos` (INSERT) are open to the anon key, because score entry is honour-system by design and photo upload has no restriction at all. See `supabase/migrations/0001_init.sql` for the exact policies and the reasoning inline.

## Scoring

The host picks a scoring format per event, stored on `events.scoring_format`: **Stableford** (default) or **Stroke Play**. Both live in one place — [`src/lib/scoring.ts`](src/lib/scoring.ts) — and the live leaderboard and final results page both call the same functions, so they can't disagree.

**Stableford** implements exactly the spec:

```
baseStrokes = floor(playing_handicap / 18)
extraStrokes = playing_handicap % 18
strokesReceived(hole) = baseStrokes + (hole.stroke_index <= extraStrokes ? 1 : 0)
netPar = hole.par + strokesReceived
points = max(0, 2 - (grossStrokes - netPar))
```

**Stroke Play** ranks by **net** total strokes (gross minus playing handicap; lowest wins) rather than gross — see the assumptions below for why. Net is computed per hole the same way Stableford allocates handicap strokes (`gross - strokesReceived`) and summed only over holes played so far, rather than deducting the player's *full* handicap from a partial gross total — that keeps an in-progress leaderboard fair instead of making net scores look artificially low before the round is finished. Once all holes are in, this necessarily equals the simpler `grossTotal - playingHandicap`, which `scoring.test.ts` checks directly.

Holes with no score entered yet are excluded from the running total/thru count rather than treated as zero, for both formats. Unit tests with hand-calculated examples (including a >18 handicap case) are in [`src/lib/scoring.test.ts`](src/lib/scoring.test.ts) — run with `npm test`.

Ranking (used by both the leaderboard and results podium) is standard competition ranking — `1, 1, 3, 4…` — via [`src/lib/ranking.ts`](src/lib/ranking.ts), so ties show as e.g. "T-2". It sorts descending for Stableford (more points is better) and ascending for Stroke Play (fewer strokes is better). Per the spec, tied podium places are shown as a shared placing rather than an invented tiebreak; individual hole-by-hole scores stay in the database and are viewable by expanding a player's row on the Results page, in case a tie ever needs manual resolution.

## Local development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).

3. **Run the migrations.** In the Supabase dashboard's SQL Editor, run each file in `supabase/migrations/` in order (`0001_init.sql`, `0002_storage.sql`, `0003_scoring_format.sql`, `0004_gallery_limits.sql`). (If you use the Supabase CLI instead: `supabase link` then `supabase db push`.)

4. **Copy the env file and fill it in:**

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key — **server-only secret, never expose to the browser** |
   | `HOST_TOKEN_PEPPER` | Any random string you generate (e.g. `openssl rand -hex 32`) — optional locally (a dev default is used), but set a real value in any deployed environment |
   | `CRON_SECRET` | Any random string you generate — checked against the `Authorization` header on the cleanup cron endpoint so it can't be triggered by anyone else. Optional locally (the check is skipped if unset), but set a real value in any deployed environment |
   | `EVENT_RETENTION_DAYS` | How many days after creation an event (and its photos) is auto-deleted. Optional, defaults to `30` |

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

6. **Run tests / lint**

   ```bash
   npm test
   npm run lint
   ```

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it into Vercel ([vercel.com/new](https://vercel.com/new)).
3. Add the environment variables from `.env.example` in the Vercel project's Settings → Environment Variables (Production + Preview).
4. Deploy. No other config needed — `vercel.json` already schedules the daily cleanup cron (see below), and it's otherwise a standard Next.js App Router project.

## Automatic cleanup

A Vercel Cron Job (`vercel.json` → `GET /api/cron/cleanup`, daily at 03:00 UTC) deletes any event older than `EVENT_RETENTION_DAYS` (default 30, counted from creation), including its photos in Storage — deleting the `events` row cascades to every other table, but not to the actual files sitting in the `gallery` bucket, so those are removed via the Storage API first. Cron only runs once deployed to Vercel; it does nothing in local dev. Vercel's Hobby (free) plan supports one daily cron job, which is exactly what this needs.

## Project structure

```
src/
  app/
    page.tsx                    Home
    join/                       Join by code
    create/                     Host setup wizard + confirmation screen
    event/[id]/
      layout.tsx                Shared header/nav + EventProvider (host/event state)
      page.tsx                  Event Hub (+ host-only controls)
      groupings/                Groupings (read-only + host edit)
      scorecards/               Per-group links into score entry, with progress
      score/[groupId]/          Score entry (Player A gate, hole-by-hole, autosave)
      leaderboard/              Live Stableford leaderboard
      results/                  Podium + full standings (gated on event.status)
      gallery/                  Photo upload + grid
    privacy/                    Plain-English privacy notice
    api/events/                 Route Handlers for all host-authorized writes
    api/cron/cleanup/           Daily retention cleanup (Vercel Cron, see vercel.json)
  lib/
    scoring.ts                  Stableford engine (+ scoring.test.ts)
    ranking.ts                  Shared competition-ranking helper
    codes.ts / joinCode.ts      Join code + host token generation/hashing
    hostAuth.ts                 Server-side host token verification for API routes
    eventContext.tsx            Client context: event data, host status, realtime
    scoreQueue.ts                localStorage retry queue for score autosave
    supabase/                   Public (anon) and admin (service role) clients
supabase/migrations/            SQL schema + RLS policies + storage bucket
```

## Assumptions & simplifications

A few calls I made where the spec left room, plus one design trade-off flagged in the spec itself:

- **Player A is honour-system**, as the spec explicitly allows — no PIN. Noted above as the natural place to tighten later.
- **Setup → In Progress transition**: the spec describes the host's "Mark Event Complete" control but not what starts the round. I made it automatic and unremarkable: the event flips from `setup` to `in_progress` the first time any score is saved for any group (a no-auth, idempotent endpoint), rather than requiring an explicit "Start Round" click from the host.
- **Accent colour**: the spec offered a choice between muted gold and golf green — I went with **gold** (`#C9A54E`), used for primary CTAs, the "live" indicator, and podium highlights.
- **No dark mode.** This app is meant to be used outdoors on a phone in bright sunlight, so it intentionally ignores `prefers-color-scheme` and uses one consistent, high-contrast navy/white/gold theme rather than switching palettes.
- **9 or 18 holes**: the create-event wizard defaults to 18 with a toggle for 9, since golf societies commonly run 9-hole evenings too; the spec's "up to 18 holes" language allows for this.
- **Groupings are entered group-first**, not as one flat player roster with a group-picker dropdown per row: pick the number of groups, then add each player directly into their group (name, handicap, Player A). Moving someone between groups is remove-and-re-add rather than an inline "move" control — deliberately, to keep each row down to just what it needs on a phone-width screen.
- **Deleting a whole group** (not just editing its membership) does cascade-delete any scores already entered for it — editing a group in place (renaming, reassigning players) does not touch scores. This is called out inline in the groupings API route.
- **RLS is coarse, not code-aware** (see "How access control works" above) — since there's no session, Postgres can't verify "this caller knows the join code." Reads are public at the database layer; the join code is what gates *reaching* the page in the first place. This is a deliberate trade-off consistent with the rest of the no-accounts design, not an oversight.
- **Stroke Play ranks by net, not gross.** The spec only asked for Stableford; Stroke Play was added later as a second host-selectable format. Since the app already collects a playing handicap for every player specifically for fair comparison, gross-only ranking would have been inconsistent with that — net (gross minus handicap) keeps both formats fair across mixed-handicap groups. The scoring format is fixed at event creation; there's no host control to change it mid-event.
- **Events auto-delete after 30 days** (configurable via `EVENT_RETENTION_DAYS`), added once real usage made "how do I keep the database tidy" a practical question rather than a hypothetical one. There's no warning before deletion — a golf day's data isn't expected to be needed a month later, and the retention window is generous enough that this shouldn't surprise anyone using the app as intended.
- **Gallery uploads are capped at 10MB and image MIME types only**, enforced at the Storage bucket level (not just client-side, which is trivially bypassed) — added for the same "actually going to be used" reason as the retention cleanup.
