import { supabase } from "./supabase";
import { getMatches } from "./api";
import type { GoalkeeperMatchRating, MatchMvp } from "../types";

export type GoalkeeperVoteSummary = {
  total: number;
  count: number;
  average: number;
};

export type CompetitionAwardScores = {
  goalkeepers: Record<string, GoalkeeperVoteSummary>;
  mvpCounts: Record<string, number>;
};

export function isGoalkeeperPosition(position: string | null | undefined): boolean {
  const value = (position ?? "").trim().toLocaleLowerCase("it");
  return value.includes("portier") || value.includes("goalkeeper") ||
    value.includes("goalie") || value === "gk" || value === "por";
}

export function isStaffPosition(position: string | null | undefined, role?: string | null): boolean {
  return position?.trim().toUpperCase() === "STAFF" ||
    role?.trim().toUpperCase() === "STAFF";
}

/** Goalkeepers use match ratings; MVPs use one winner per finished match. */
export async function getCompetitionAwardScores(
  competitionIds: string[],
): Promise<CompetitionAwardScores> {
  const ids = [...new Set(competitionIds.filter(Boolean))];
  const empty: CompetitionAwardScores = { goalkeepers: {}, mvpCounts: {} };
  if (!supabase || !ids.length) return empty;

  const [matches, ratingsResponse, mvpResponse] = await Promise.all([
    getMatches(),
    supabase.from("goalkeeper_match_ratings").select("match_id,player_id,rating"),
    supabase.from("match_mvp").select("match_id,player_id"),
  ]);
  if (ratingsResponse.error) throw ratingsResponse.error;
  if (mvpResponse.error) throw mvpResponse.error;

  const eligibleMatches = new Set(
    matches.filter((match) => ids.includes(match.competition_id) && match.status === "finished").map((match) => match.id),
  );
  const sums = new Map<string, { total: number; count: number }>();
  (ratingsResponse.data as GoalkeeperMatchRating[] | null ?? []).forEach((entry) => {
    if (!eligibleMatches.has(entry.match_id)) return;
    const current = sums.get(entry.player_id) ?? { total: 0, count: 0 };
    sums.set(entry.player_id, {
      total: current.total + Number(entry.rating),
      count: current.count + 1,
    });
  });
  const goalkeepers: Record<string, GoalkeeperVoteSummary> = {};
  sums.forEach((value, playerId) => {
    goalkeepers[playerId] = {
      ...value,
      average: value.total / value.count,
    };
  });

  const mvpCounts: Record<string, number> = {};
  (mvpResponse.data as MatchMvp[] | null ?? []).forEach((entry) => {
    if (!eligibleMatches.has(entry.match_id)) return;
    mvpCounts[entry.player_id] = (mvpCounts[entry.player_id] ?? 0) + 1;
  });

  return { goalkeepers, mvpCounts };
}
