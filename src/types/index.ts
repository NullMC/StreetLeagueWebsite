export type CompetitionStatus = "upcoming" | "active" | "finished";
export type PartnerTier = "gold" | "silver" | "bronze";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";
export type EventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "foul"
  | "presidential_penalty"
  | "other";

export interface Competition {
  id: string;
  name: string;
  slug: string;
  status: CompetitionStatus;
  season_label: string | null;
  start_date: string | null;
  end_date: string | null;
  statistics_group: string | null;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  accent_hex: string | null;
  competition_ids?: string[];
}

export interface Player {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  position: string | null;
  role?: string | null;
  profile_image_url: string | null;
  bg_less_image_url: string | null;
}

export interface Match {
  id: string;
  competition_id: string;
  home_team_id: string;
  away_team_id: string;
  matchday: string | null;
  kickoff_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  photo_drive_url?: string | null;
}

export const WILDCARD_POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"] as const;
export type WildcardPosition = (typeof WILDCARD_POSITIONS)[number];

/** External player allowed for one match only: one per team, with a role. */
export interface MatchWildcard {
  id: string;
  match_id: string;
  team_id: string;
  full_name: string;
  position: WildcardPosition;
  /** End-of-match rating (1-5), only when the Wildcard plays as goalkeeper. */
  goalkeeper_rating: number | null;
}

export interface MatchLineup {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  starter: boolean;
  shirt_number: number | null;
}

export interface MatchMvp {
  match_id: string;
  /** Registered player, or null when the MVP is the match Wildcard. */
  player_id: string | null;
  wildcard_id?: string | null;
}

export interface Partner {
  id: string;
  name: string;
  description?: string | null;
  activity_image_url?: string | null;
  tier: PartnerTier;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
}

export interface ActiveCollaboration {
  id: string;
  title: string;
  description: string;
  flyer_url: string | null;
  cta_url?: string | null;
  sort_order: number;
  created_at: string;
}

export interface SocialContent {
  id: string;
  platform: "youtube" | "instagram" | "tiktok";
  title: string;
  thumbnail_url: string | null;
  image_url?: string | null;
  description?: string | null;
  article_body?: string | null;
  sort_order?: number;
  content_url: string;
  published_at: string | null;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  /** Set instead of player_id when the event belongs to the match Wildcard. */
  wildcard_id?: string | null;
  related_player_id: string | null;
  event_type: EventType;
  minute: number | null;
  note: string | null;
}

export interface PlayerStats {
  goals: number;
  appearances: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  fouls: number;
  clean_sheets: number;
  mvps: number;
}

export interface StatisticsGroup {
  id: string;
  name: string;
  competition_ids: string[];
  competitions: Competition[];
}

export interface StaffRankingEntry {
  player: Player;
  presidential_penalties: number;
}

/** Rating given to one goalkeeper for one completed match (1–5). */
export interface GoalkeeperMatchRating {
  match_id: string;
  player_id: string;
  rating: number;
  created_at?: string;
  updated_at?: string;
}

/** One MVP nomination per competition and matchday. */
export interface MatchdayMvpVote {
  competition_id: string;
  matchday: string;
  player_id: string;
  created_at?: string;
  updated_at?: string;
}
