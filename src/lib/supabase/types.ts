export type EventStatus = "setup" | "in_progress" | "complete";
export type ScoringFormat = "stableford" | "stroke_play";

export interface EventRow {
  id: string;
  name: string;
  course_name: string;
  event_date: string | null;
  join_code: string;
  host_token_hash: string;
  status: EventStatus;
  scoring_format: ScoringFormat;
  created_at: string;
}

export interface HoleRow {
  event_id: string;
  hole_number: number;
  par: number;
  stroke_index: number;
}

export interface PlayerRow {
  id: string;
  event_id: string;
  name: string;
  playing_handicap: number;
  created_at: string;
}

export interface GroupRow {
  id: string;
  event_id: string;
  name: string;
  tee_time: string | null;
  sort_order: number;
}

export interface GroupPlayerRow {
  group_id: string;
  player_id: string;
  is_player_a: boolean;
}

export interface HoleScoreRow {
  id: string;
  group_id: string;
  player_id: string;
  hole_number: number;
  strokes: number | null;
  updated_at: string;
}

export interface PhotoRow {
  id: string;
  event_id: string;
  url: string;
  storage_path: string;
  uploaded_by_name: string | null;
  created_at: string;
}
