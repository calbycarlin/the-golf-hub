-- The Golf Hub — initial schema
--
-- Access model: there is no Supabase Auth / user accounts. Access is via a
-- shareable join code (public) and a per-event host token (secret, hashed).
--
-- Because there are no sessions, RLS cannot check "does this caller know the
-- join code" — that gate lives at the application layer (you need the code
-- to reach the event's URL / call the API). RLS is instead used as a coarse,
-- defense-in-depth boundary:
--   * anon (public) role: SELECT only, on everything. This is what powers
--     Realtime subscriptions and the public leaderboard/gallery/results
--     views. Nothing sensitive lives in these tables (host_token is stored
--     as a hash, never the raw token).
--   * All INSERT/UPDATE/DELETE for event/course/player/group data goes
--     through Next.js API routes using the service role key, which checks
--     the host token server-side before writing. RLS grants no anon write
--     access to those tables at all, so this is enforced even if an API
--     route had a bug.
--   * hole_scores and photos are the two exceptions: the spec asks for a
--     lightweight, honour-system "Player A" check for scores and no
--     restriction at all for photo uploads, done client-side. Anon is
--     granted INSERT/UPDATE (scores) and INSERT (photos) directly so score
--     entry keeps working from the course even if the network drops
--     mid-request and a retry needs to happen without a server round trip
--     for authorization.

create extension if not exists pgcrypto;

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_name text not null,
  event_date date,
  join_code text not null unique,
  host_token_hash text not null,
  status text not null default 'setup' check (status in ('setup', 'in_progress', 'complete')),
  created_at timestamptz not null default now()
);

create table holes (
  event_id uuid not null references events(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  par int not null default 4 check (par between 3 and 6),
  stroke_index int not null check (stroke_index between 1 and 18),
  primary key (event_id, hole_number)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  playing_handicap int not null default 0,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  tee_time text,
  sort_order int not null default 0
);

create table group_players (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  is_player_a boolean not null default false,
  primary key (group_id, player_id),
  -- a player only ever plays in one group for a given event
  unique (player_id)
);

create table hole_scores (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  hole_number int not null check (hole_number between 1 and 18),
  strokes int check (strokes is null or strokes between 1 and 20),
  updated_at timestamptz not null default now(),
  unique (player_id, hole_number)
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  url text not null,
  storage_path text not null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index players_event_id_idx on players(event_id);
create index groups_event_id_idx on groups(event_id);
create index group_players_group_id_idx on group_players(group_id);
create index hole_scores_group_id_idx on hole_scores(group_id);
create index hole_scores_player_id_idx on hole_scores(player_id);
create index photos_event_id_idx on photos(event_id);
create index events_join_code_idx on events(join_code);

-- keep hole_scores.updated_at current on every upsert
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger hole_scores_set_updated_at
before update on hole_scores
for each row execute function set_updated_at();

-- Row Level Security ---------------------------------------------------

alter table events enable row level security;
alter table holes enable row level security;
alter table players enable row level security;
alter table groups enable row level security;
alter table group_players enable row level security;
alter table hole_scores enable row level security;
alter table photos enable row level security;

-- Public read access everywhere (needed for Realtime + the public pages).
create policy "public read events" on events for select using (true);
create policy "public read holes" on holes for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read groups" on groups for select using (true);
create policy "public read group_players" on group_players for select using (true);
create policy "public read hole_scores" on hole_scores for select using (true);
create policy "public read photos" on photos for select using (true);

-- Honour-system score entry: anyone with the link can write scores for
-- any group (the app gates this with the Player A confirmation prompt,
-- not a server secret — see README for the trade-off).
create policy "public insert hole_scores" on hole_scores for insert with check (true);
create policy "public update hole_scores" on hole_scores for update using (true);

-- Photo upload has no restriction at all per spec.
create policy "public insert photos" on photos for insert with check (true);

-- No anon write policies exist on events / holes / players / groups /
-- group_players — those go through API routes using the service role key,
-- which bypasses RLS after checking the host token.

-- Realtime -------------------------------------------------------------
alter publication supabase_realtime add table hole_scores;
alter publication supabase_realtime add table groups;
alter publication supabase_realtime add table group_players;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table photos;
