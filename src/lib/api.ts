import { supabase } from "./supabase";
import type {
  Competition,
  Match,
  Team,
  Player,
  Partner,
  ActiveCollaboration,
  SocialContent,
  MatchEvent,
  MatchLineup,
  MatchMvp,
  PlayerStats,
  StaffRankingEntry,
} from "../types";

async function getRows<T>(query: any): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function getCompetitions(): Promise<Competition[]> {
  if (!supabase) return [];
  return getRows<Competition>(
    supabase
      .from("competitions")
      .select("*")
      .order("start_date", { ascending: false }),
  );
}

export async function getActiveCompetition(): Promise<Competition | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("competitions")
    .select("*")
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Competition | null;
}

export async function getTeams(competitionId?: string): Promise<Team[]> {
  if (!supabase) return [];
  let query = supabase.from("teams").select("*").order("name");
  if (competitionId) query = query.eq("competition_id", competitionId);
  return getRows<Team>(query);
}

export async function getPlayers(teamId?: string): Promise<Player[]> {
  if (!supabase) return [];
  let query = supabase
    .from("players")
    .select("*")
    .order("last_name")
    .order("first_name");
  if (teamId) query = query.eq("team_id", teamId);
  return getRows<Player>(query);
}

export async function getMatches(competitionId?: string): Promise<Match[]> {
  if (!supabase) return [];
  let query = supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });
  if (competitionId) query = query.eq("competition_id", competitionId);
  return getRows<Match>(query);
}

export async function getPartners(): Promise<Partner[]> {
  if (!supabase) return [];
  return getRows<Partner>(
    supabase
      .from("partners")
      .select("*")
      .order("tier")
      .order("sort_order")
      .order("name"),
  );
}

export async function getActiveCollaborations(): Promise<
  ActiveCollaboration[]
> {
  if (!supabase) return [];
  return getRows<ActiveCollaboration>(
    supabase
      .from("active_collaborations")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  );
}

export async function getSocialContent(): Promise<SocialContent[]> {
  if (!supabase) return [];
  return getRows<SocialContent>(
    supabase
      .from("social_contents")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(18),
  );
}

export async function getMatch(id: string): Promise<Match | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Match | null;
}

export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  if (!supabase) return [];
  return getRows<MatchEvent>(
    supabase
      .from("match_events")
      .select("*")
      .eq("match_id", matchId)
      .order("minute", { ascending: true }),
  );
}

export async function getMatchLineups(matchId: string): Promise<MatchLineup[]> {
  if (!supabase) return [];
  return getRows<MatchLineup>(
    supabase
      .from("match_lineups")
      .select("*")
      .eq("match_id", matchId)
      .order("team_id")
      .order("starter", { ascending: false }),
  );
}

export async function getMatchMvp(matchId: string): Promise<MatchMvp | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("match_mvp")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data as MatchMvp | null;
}

export async function getAllMatchLineups(): Promise<MatchLineup[]> {
  if (!supabase) return [];
  return getRows<MatchLineup>(supabase.from("match_lineups").select("*"));
}

export async function getAllMatchMvps(): Promise<MatchMvp[]> {
  if (!supabase) return [];
  return getRows<MatchMvp>(supabase.from("match_mvp").select("*"));
}

export async function getAllMatchEvents(): Promise<MatchEvent[]> {
  if (!supabase) return [];
  return getRows<MatchEvent>(supabase.from("match_events").select("*"));
}

export async function getStaffRanking(
  competitionId: string,
  month?: { year: number; month: number },
): Promise<StaffRankingEntry[]> {
  const [players, matches, events] = await Promise.all([
    getPlayers(),
    getMatches(competitionId),
    getAllMatchEvents(),
  ]);

  const staffPlayers = players.filter(
    (player) => player.position?.trim().toUpperCase() === "STAFF",
  );
  const staffIds = new Set(staffPlayers.map((player) => player.id));
  const competitionMatches = new Map(matches.map((match) => [match.id, match]));
  const counts = new Map(staffPlayers.map((player) => [player.id, 0]));

  events.forEach((event) => {
    if (event.event_type !== "presidential_penalty" || !event.player_id) return;
    if (!staffIds.has(event.player_id)) return;
    const match = competitionMatches.get(event.match_id);
    if (!match) return;

    if (month) {
      const date = new Date(match.kickoff_at);
      if (
        date.getFullYear() !== month.year ||
        date.getMonth() + 1 !== month.month
      ) return;
    }

    counts.set(event.player_id, (counts.get(event.player_id) ?? 0) + 1);
  });

  return staffPlayers
    .map((player) => ({
      player,
      presidential_penalties: counts.get(player.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.presidential_penalties - a.presidential_penalties ||
        a.player.last_name.localeCompare(b.player.last_name, "it") ||
        a.player.first_name.localeCompare(b.player.first_name, "it"),
    );
}

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const [matches, events, lineups, mvps] = await Promise.all([
    getMatches(),
    getAllMatchEvents(),
    getAllMatchLineups(),
    getAllMatchMvps(),
  ]);

  const playerLineups = lineups.filter((x) => x.player_id === playerId);
  const playerEvents = events.filter(
    (x) => x.player_id === playerId || x.related_player_id === playerId,
  );
  const playerMvpCount = mvps.filter((x) => x.player_id === playerId).length;

  const goals = playerEvents.filter(
    (x) =>
      x.player_id === playerId &&
      (x.event_type === "goal" || x.event_type === "presidential_penalty"),
  ).length;
  const assists = playerEvents.filter(
    (x) => x.player_id === playerId && x.event_type === "assist",
  ).length;
  const yellowCards = playerEvents.filter(
    (x) => x.player_id === playerId && x.event_type === "yellow_card",
  ).length;
  const redCards = playerEvents.filter(
    (x) => x.player_id === playerId && x.event_type === "red_card",
  ).length;
  const fouls = playerEvents.filter(
    (x) => x.player_id === playerId && x.event_type === "foul",
  ).length;

  const finishedMatches = new Map(
    matches.filter((m) => m.status === "finished").map((m) => [m.id, m]),
  );

  let cleanSheets = 0;
  for (const lineup of playerLineups) {
    const match = finishedMatches.get(lineup.match_id);
    if (!match) continue;
    const isHome = match.home_team_id === lineup.team_id;
    const isAway = match.away_team_id === lineup.team_id;
    if (isHome && match.away_score === 0) cleanSheets++;
    if (isAway && match.home_score === 0) cleanSheets++;
  }

  return {
    goals,
    appearances: playerLineups.length,
    assists,
    yellow_cards: yellowCards,
    red_cards: redCards,
    fouls,
    clean_sheets: cleanSheets,
    mvps: playerMvpCount,
  };
}

export async function getAllPlayerStats(): Promise<
  Array<Player & { stats: PlayerStats }>
> {
  const [players, matches, events, lineups, mvps] = await Promise.all([
    getPlayers(),
    getMatches(),
    getAllMatchEvents(),
    getAllMatchLineups(),
    getAllMatchMvps(),
  ]);

  const finishedMatches = new Map(
    matches.filter((m) => m.status === "finished").map((m) => [m.id, m]),
  );

  return players.map((player) => {
    const playerLineups = lineups.filter((x) => x.player_id === player.id);
    const playerEvents = events.filter(
      (x) => x.player_id === player.id || x.related_player_id === player.id,
    );

    let cleanSheets = 0;
    for (const lineup of playerLineups) {
      const match = finishedMatches.get(lineup.match_id);
      if (!match) continue;
      if (match.home_team_id === lineup.team_id && match.away_score === 0)
        cleanSheets++;
      if (match.away_team_id === lineup.team_id && match.home_score === 0)
        cleanSheets++;
    }

    const stats: PlayerStats = {
      goals: playerEvents.filter(
        (x) =>
        x.player_id === player.id &&
        (x.event_type === "goal" || x.event_type === "presidential_penalty"),
      ).length,
      appearances: playerLineups.length,
      assists: playerEvents.filter(
        (x) => x.player_id === player.id && x.event_type === "assist",
      ).length,
      yellow_cards: playerEvents.filter(
        (x) => x.player_id === player.id && x.event_type === "yellow_card",
      ).length,
      red_cards: playerEvents.filter(
        (x) => x.player_id === player.id && x.event_type === "red_card",
      ).length,
      fouls: playerEvents.filter(
        (x) => x.player_id === player.id && x.event_type === "foul",
      ).length,
      clean_sheets: cleanSheets,
      mvps: mvps.filter((x) => x.player_id === player.id).length,
    };

    return { ...player, stats };
  });
}

export function calculateStandings(teams: Team[], matches: Match[]) {
  const table = teams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }));
  const map = new Map(table.map((entry) => [entry.team.id, entry]));

  matches
    .filter(
      (match) =>
        match.status === "finished" &&
        match.home_score !== null &&
        match.away_score !== null,
    )
    .forEach((match) => {
      const home = map.get(match.home_team_id);
      const away = map.get(match.away_team_id);
      if (!home || !away) return;
      const hg = Number(match.home_score);
      const ag = Number(match.away_score);
      home.played++;
      away.played++;
      home.gf += hg;
      home.ga += ag;
      away.gf += ag;
      away.ga += hg;
      if (hg > ag) {
        home.wins++;
        home.points += 3;
        away.losses++;
      } else if (hg < ag) {
        away.wins++;
        away.points += 3;
        home.losses++;
      } else {
        home.draws++;
        away.draws++;
        home.points++;
        away.points++;
      }
    });

  return table
    .map((entry) => ({ ...entry, gd: entry.gf - entry.ga }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.team.name.localeCompare(b.team.name, "it"),
    );
}

export function subscribeToCompetition(onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const existingChannel = client
    .getChannels()
    .find((channel) => channel.topic === "realtime:street-league-live");
  if (existingChannel) void client.removeChannel(existingChannel);

  const channel = client
    .channel("street-league-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "competitions" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_events" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_lineups" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match_mvp" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "partners" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "social_contents" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "active_collaborations" },
      onChange,
    )
    .subscribe();

  return () => void client.removeChannel(channel);
}
