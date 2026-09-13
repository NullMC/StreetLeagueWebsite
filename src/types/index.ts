export type CompetitionStatus = "upcoming" | "active" | "finished";
export type PartnerTier = "gold" | "silver" | "bronze";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";
export type EventType =
  "goal" | "assist" | "yellow_card" | "red_card" | "substitution" | "other";
export interface Competition {
  id: string;
  name: string;
  slug: string;
  status: CompetitionStatus;
  season_label: string | null;
  start_date: string | null;
  end_date: string | null;
  hero_image_url: string | null;
}
export interface Team {
  id: string;
  competition_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  accent_hex: string | null;
}
export interface Player {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  position: string | null;
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
}
export interface Partner {
  id: string;
  name: string;
  tier: PartnerTier;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
}
export interface SocialContent {
  id: string;
  platform: "youtube" | "instagram" | "tiktok";
  title: string;
  thumbnail_url: string | null;
  content_url: string;
  published_at: string | null;
}
export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  related_player_id: string | null;
  event_type: EventType;
  minute: number | null;
  note: string | null;
}
