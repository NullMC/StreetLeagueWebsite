import { supabase } from "./supabase";
import {
  getActiveCompetitions,
  getAllGoalkeeperRatings,
  getAllMatchEvents,
  getAllMatchLineups,
  getAllMatchMvps,
  getMatches,
  getPlayers,
  getTeams,
} from "./api";
import type {
  GoalkeeperMatchRating,
  Match,
  MatchEvent,
  MatchLineup,
  MatchMvp,
  MonthlyTopSeven,
  Player,
  Team,
  TopSevenEntry,
  TopSevenSlot,
} from "../types";

/** How many players each role gets on the pitch (7 in total). */
export const TOP_SEVEN_SLOTS: Record<TopSevenSlot, number> = {
  goalkeeper: 1,
  defender: 2,
  midfielder: 2,
  attacker: 2,
};

export const TOP_SEVEN_LABELS: Record<TopSevenSlot, string> = {
  goalkeeper: "Portiere",
  defender: "Difensore",
  midfielder: "Centrocampista",
  attacker: "Attaccante",
};

export function roleFromPosition(value: string | null | undefined): TopSevenSlot | null {
  const p = (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[._-]/g, " ");
  if (p.includes("staff")) return null;

  if (
    p.includes("portier") || p.includes("goalkeeper") || p.includes("goalie") ||
    p === "keeper" || ["gk", "por", "pt", "goal"].includes(p)
  ) return "goalkeeper";

  if (
    p.includes("difensor") || p.includes("defender") || p.includes("terzin") ||
    p.includes("braccetto") || p.includes("difesa") ||
    ["dif", "def", "df", "dc", "d", "cb", "lb", "rb", "lwb", "rwb"].includes(p)
  ) return "defender";

  if (
    p.includes("centrocamp") || p.includes("midfield") || p.includes("mediano") ||
    p.includes("mezzala") || p.includes("trequartista") || p.includes("regista") ||
    ["cen", "mid", "cm", "mf", "cc", "mc", "med", "cam", "cdm", "mco"].includes(p)
  ) return "midfielder";

  if (
    p.includes("attacc") || p.includes("forward") || p.includes("punta") ||
    p.includes("centravanti") || p.includes("striker") ||
    ["fw", "att", "st", "cf", "a"].includes(p)
  ) return "attacker";

  return null;
}

function isStaff(player: Player) {
  return player.role?.trim().toUpperCase() === "STAFF" || player.position?.trim().toUpperCase() === "STAFF";
}

type Candidate = {
  player: Player;
  team: Team;
  role: TopSevenSlot | null;
  appearances: number;
  goals: number;
  assists: number;
  mvps: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  keeperRatings: number;
  points: number;
};

function compareCandidates(a: Candidate, b: Candidate) {
  return b.points - a.points || b.goals - a.goals || b.assists - a.assists || b.mvps - a.mvps ||
    b.appearances - a.appearances ||
    (a.player.last_name + " " + a.player.first_name).localeCompare(b.player.last_name + " " + b.player.first_name, "it");
}

/** First day of the month as YYYY-MM-DD, in local time. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatTopSevenMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, (month || 1) - 1, 1));
}

/**
 * Best players of the month, one per team. Slots are filled from the best score down
 * across every role, so a team's goalkeeper is not excluded just because a teammate
 * has more points.
 */
function selectTopSeven(
  matches: Match[], teams: Team[], players: Player[], events: MatchEvent[],
  lineups: MatchLineup[], mvps: MatchMvp[], ratings: GoalkeeperMatchRating[], month: Date,
): TopSevenEntry[] {
  const monthlyMatches = matches.filter((match) => {
    const kickoff = new Date(match.kickoff_at);
    return kickoff.getFullYear() === month.getFullYear() && kickoff.getMonth() === month.getMonth() &&
      (match.status === "finished" || match.status === "live");
  });
  const byMatch = new Map(monthlyMatches.map((match) => [match.id, match] as const));
  const teamById = new Map(teams.map((team) => [team.id, team] as const));
  const playerById = new Map(players.filter((player) => !isStaff(player)).map((player) => [player.id, player] as const));
  type Totals = Omit<Candidate, "player" | "team" | "role" | "points">;
  const totals = new Map<string, Totals>();
  playerById.forEach((player, id) => {
    if (teamById.has(player.team_id)) {
      totals.set(id, { appearances: 0, goals: 0, assists: 0, mvps: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, keeperRatings: 0 });
    }
  });

  lineups.forEach((entry) => {
    const match = byMatch.get(entry.match_id);
    const total = totals.get(entry.player_id);
    const player = playerById.get(entry.player_id);
    if (!match || !total || !player) return;
    total.appearances += 1;
    if (roleFromPosition(player.position) === "goalkeeper" && match.status === "finished") {
      const conceded = match.home_team_id === entry.team_id ? match.away_score : match.home_score;
      if (conceded === 0) total.cleanSheets += 1;
    }
  });
  events.forEach((event) => {
    if (!byMatch.has(event.match_id) || !event.player_id) return;
    const total = totals.get(event.player_id);
    if (!total) return;
    if (event.event_type === "goal" || event.event_type === "presidential_penalty") total.goals += 1;
    if (event.event_type === "assist") total.assists += 1;
    if (event.event_type === "yellow_card") total.yellowCards += 1;
    if (event.event_type === "red_card") total.redCards += 1;
  });
  mvps.forEach((entry) => {
    if (!entry.player_id || !byMatch.has(entry.match_id)) return;
    const total = totals.get(entry.player_id);
    if (total) total.mvps += 1;
  });
  // End-of-match goalkeeper ratings (1-5): the main merit of a keeper, who rarely scores.
  ratings.forEach((entry) => {
    if (!byMatch.has(entry.match_id)) return;
    const total = totals.get(entry.player_id);
    if (total) total.keeperRatings += Number(entry.rating) || 0;
  });

  const candidates: Candidate[] = [];
  totals.forEach((total, playerId) => {
    const player = playerById.get(playerId);
    const team = player ? teamById.get(player.team_id) : undefined;
    if (!player || !team || (!total.appearances && !total.goals && !total.assists && !total.mvps && !total.keeperRatings)) return;
    candidates.push({
      player, team, role: roleFromPosition(player.position), ...total,
      points: total.goals * 5 + total.assists * 3 + total.mvps * 4 + total.cleanSheets * 4 + total.keeperRatings +
        total.appearances - total.yellowCards - total.redCards * 3,
    });
  });

  // Average of every rating the goalkeeper has received so far (all matches, not only this month).
  const keeperHistory = new Map<string, { sum: number; count: number }>();
  ratings.forEach((entry) => {
    const current = keeperHistory.get(entry.player_id) ?? { sum: 0, count: 0 };
    keeperHistory.set(entry.player_id, { sum: current.sum + (Number(entry.rating) || 0), count: current.count + 1 });
  });

  const selected: TopSevenEntry[] = [];
  const filled: Record<TopSevenSlot, number> = { goalkeeper: 0, defender: 0, midfielder: 0, attacker: 0 };
  const usedTeams = new Set<string>();
  candidates.sort(compareCandidates).forEach((candidate) => {
    const role = candidate.role;
    if (!role || usedTeams.has(candidate.team.id) || filled[role] >= TOP_SEVEN_SLOTS[role]) return;
    filled[role] += 1;
    usedTeams.add(candidate.team.id);
    const history = keeperHistory.get(candidate.player.id);
    selected.push({
      slot: role,
      player_id: candidate.player.id,
      team_id: candidate.team.id,
      goals: candidate.goals,
      assists: candidate.assists,
      appearances: candidate.appearances,
      ...(role === "goalkeeper" ? {
        keeper_average: history?.count ? Math.round((history.sum / history.count) * 100) / 100 : null,
        keeper_votes: history?.count ?? 0,
      } : {}),
    });
  });
  return selected;
}

/** Computes the Top 7 of the given month with the data recorded right now (active competitions). */
export async function computeTopSeven(month: Date): Promise<TopSevenEntry[]> {
  const competitions = await getActiveCompetitions();
  const [players, teamSets, matchSets, events, lineups, mvps, ratings] = await Promise.all([
    getPlayers(),
    Promise.all(competitions.map((competition) => getTeams(competition.id))),
    Promise.all(competitions.map((competition) => getMatches(competition.id))),
    getAllMatchEvents(),
    getAllMatchLineups(),
    getAllMatchMvps(),
    getAllGoalkeeperRatings(),
  ]);
  const teams = Array.from(new Map(teamSets.flat().map((team) => [team.id, team] as const)).values());
  const matches = Array.from(new Map(matchSets.flat().map((match) => [match.id, match] as const)).values());
  return selectTopSeven(matches, teams, players, events, lineups, mvps, ratings, month);
}

/** Saves a compiled Top 7: from now on the site shows this one until the next compilation. */
export async function saveTopSeven(periodMonth: string, players: TopSevenEntry[]): Promise<MonthlyTopSeven> {
  if (!supabase) throw new Error("Supabase non configurato.");
  const { data, error } = await supabase
    .from("monthly_top_seven")
    .insert({ period_month: periodMonth, players })
    .select("*")
    .single();
  if (error) throw error;
  return data as MonthlyTopSeven;
}
