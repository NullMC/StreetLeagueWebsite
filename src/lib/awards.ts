import { supabase } from "./supabase";
import { getAllMatchLineups, getMatches, getPlayers } from "./api";
import type { GoalkeeperMatchRating, MatchMvp } from "../types";

export type GoalkeeperMatchVote = {
  matchId: string;
  matchday: string | null;
  kickoffAt: string;
  opponentTeamId: string | null;
  rating: number;
  goalsConceded: number | null;
};

export type GoalkeeperVoteSummary = {
  total: number;
  count: number;
  average: number;
  /** Goals conceded only in finished matches for which this player has a rating. */
  goalsConceded: number;
  scoredMatches: number;
  goalsConcededPerMatch: number | null;
  votes: GoalkeeperMatchVote[];
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

/**
 * Rank by average *per-match* vote, never by the sum of votes.
 * Equal averages are resolved by fewer goals conceded per rated match.
 * Use only rated matches with a recorded final score (unknown scores are not zeros).
 */
export function compareGoalkeeperScores(
  first: GoalkeeperVoteSummary | undefined,
  second: GoalkeeperVoteSummary | undefined,
): number {
  if (!first && !second) return 0;
  if (!first) return 1;
  if (!second) return -1;
  if (first.average !== second.average) return second.average - first.average;

  const a = first.goalsConcededPerMatch;
  const b = second.goalsConcededPerMatch;
  if (a === null || b === null) {
    if (a === null && b !== null) return 1;
    if (b === null && a !== null) return -1;
  } else if (a !== b) {
    return a - b;
  }

  // If the rate is tied, reward fewer total goals conceded, then more ratings.
  return first.goalsConceded - second.goalsConceded ||
    second.count - first.count;
}

export function formatKeeperAverage(value: number): string {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Scores for one competition or a user-selected group of active competitions. */
export async function getCompetitionAwardScores(
  competitionIds: string[],
): Promise<CompetitionAwardScores> {
  const ids = [...new Set(competitionIds.filter(Boolean))];
  const empty: CompetitionAwardScores = { goalkeepers: {}, mvpCounts: {} };
  if (!supabase || !ids.length) return empty;

  const [matches, players, lineups, ratingsResponse, mvpResponse] = await Promise.all([
    getMatches(),
    getPlayers(),
    getAllMatchLineups(),
    supabase.from("goalkeeper_match_ratings").select("match_id,player_id,rating"),
    supabase.from("match_mvp").select("match_id,player_id"),
  ]);
  if (ratingsResponse.error) throw ratingsResponse.error;
  if (mvpResponse.error) throw mvpResponse.error;

  const finishedMatches = new Map(
    matches
      .filter((match) => ids.includes(match.competition_id) && match.status === "finished")
      .map((match) => [match.id, match]),
  );
  const playerTeams = new Map(players.map((player) => [player.id, player.team_id]));
  // Prefer the historic lineup when a goalkeeper has subsequently changed teams.
  const lineupTeams = new Map(
    lineups.map((lineup) => [lineup.match_id + ":" + lineup.player_id, lineup.team_id]),
  );

  const sums = new Map<string, {
    total: number; count: number; goalsConceded: number;
    scoredMatches: number; votes: GoalkeeperMatchVote[];
  }>();
  ((ratingsResponse.data ?? []) as GoalkeeperMatchRating[]).forEach((entry) => {
    const match = finishedMatches.get(entry.match_id);
    if (!match) return;
    const teamId = lineupTeams.get(match.id + ":" + entry.player_id) ?? playerTeams.get(entry.player_id);
    const home = teamId === match.home_team_id;
    const away = teamId === match.away_team_id;
    const rawConceded = home ? match.away_score : away ? match.home_score : null;
    const goalsConceded = typeof rawConceded === "number" &&
      Number.isFinite(rawConceded) ? rawConceded : null;
    const current = sums.get(entry.player_id) ?? {
      total: 0, count: 0, goalsConceded: 0, scoredMatches: 0, votes: [],
    };
    sums.set(entry.player_id, {
      total: current.total + Number(entry.rating),
      count: current.count + 1,
      goalsConceded: current.goalsConceded + (goalsConceded ?? 0),
      scoredMatches: current.scoredMatches + (goalsConceded === null ? 0 : 1),
      votes: [...current.votes, {
        matchId: match.id,
        matchday: match.matchday,
        kickoffAt: match.kickoff_at,
        opponentTeamId: home ? match.away_team_id : away ? match.home_team_id : null,
        rating: Number(entry.rating),
        goalsConceded,
      }],
    });
  });

  const goalkeepers: Record<string, GoalkeeperVoteSummary> = {};
  sums.forEach((value, playerId) => {
    goalkeepers[playerId] = {
      ...value,
      average: value.total / value.count,
      goalsConcededPerMatch: value.scoredMatches
        ? value.goalsConceded / value.scoredMatches
        : null,
      votes: value.votes.sort((a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime()),
    };
  });

  const mvpCounts: Record<string, number> = {};
  ((mvpResponse.data ?? []) as MatchMvp[]).forEach((entry) => {
    if (!finishedMatches.has(entry.match_id)) return;
    mvpCounts[entry.player_id] = (mvpCounts[entry.player_id] ?? 0) + 1;
  });

  return { goalkeepers, mvpCounts };
}
