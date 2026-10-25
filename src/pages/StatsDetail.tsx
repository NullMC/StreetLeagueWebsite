import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import {
  getActiveCompetitions,
  getPlayerStatsForCompetitions,
  getStaffRankingForCompetitions,
  getStatisticsGroups,
  getTeams,
} from "../lib/api";
import type { Player, PlayerStats, StaffRankingEntry, StatisticsGroup, Team } from "../types";
import { compareGoalkeeperScores, formatKeeperAverage, getCompetitionAwardScores, isGoalkeeperPosition, type CompetitionAwardScores } from "../lib/awards";

type DetailKey = "goals" | "mvps" | "goalkeepers" | "clean_sheets" | "staff";
type RankedPlayer = Player & { stats: PlayerStats; team_name: string };
type DetailData = {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
  awards: CompetitionAwardScores;
  teamNames: Record<string, string>;
};

const config: Record<DetailKey, { title: string; unit: string }> = {
  goals: { title: "Miglior marcatore", unit: "gol" },
  mvps: { title: "Classifica MVP", unit: "MVP partita" },
  goalkeepers: { title: "Miglior portiere", unit: "media voto / 5" },
  clean_sheets: { title: "Miglior portiere", unit: "media voto / 5" },
  staff: { title: "Classifica staff", unit: "gol" },
};

function isStaff(player: Pick<Player, "position" | "role">) {
  return player.role?.trim().toUpperCase() === "STAFF" ||
    player.position?.trim().toUpperCase() === "STAFF";
}

export default function StatsDetail() {
  const { groupId = "", statKey = "" } = useParams();
  const key = statKey as DetailKey;
  const validKey = key === "goals" || key === "mvps" || key === "goalkeepers" || key === "clean_sheets" || key === "staff";
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setData(null);
      if (!validKey) {
        setError("La classifica richiesta non è disponibile.");
        setLoading(false);
        return;
      }
      try {
        const activeCompetitions = await getActiveCompetitions();
        const groups = await getStatisticsGroups(activeCompetitions);
        const group = groups.find((item) => item.id === groupId);
        if (!group) {
          if (mounted) setError("La competizione selezionata non è attiva o non esiste.");
          return;
        }
        const [playerRows, staff, awards, allTeams] = await Promise.all([
          getPlayerStatsForCompetitions(group.competition_ids),
          getStaffRankingForCompetitions(group.competition_ids),
          getCompetitionAwardScores(group.competition_ids),
          getTeams(),
        ]);
        const teamById = new Map<string, Team>(allTeams.map((team) => [team.id, team]));
        const players: RankedPlayer[] = playerRows
          .filter((player) => !isStaff(player))
          .map((player) => ({ ...player, team_name: teamById.get(player.team_id)?.name ?? "—" }));
        if (mounted) {
          setData({
            group,
            players: players,
            staff: staff,
            awards,
            teamNames: Object.fromEntries(allTeams.map((team) => [team.id, team.name])),
          });
          setError("");
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Impossibile caricare la classifica.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [groupId, validKey]);

  const players = data?.players ?? [];
  const awards = data?.awards;
  const isKeeperRanking = key === "goalkeepers" || key === "clean_sheets";
  const score = (player: RankedPlayer): number =>
    key === "goals" ? player.stats.goals :
    key === "mvps" ? awards?.mvpCounts[player.id] ?? 0 :
    isKeeperRanking ? awards?.goalkeepers[player.id]?.average ?? 0 : 0;
  const playerRanking = validKey && key !== "staff" ? [...players]
    .filter((player) => !isKeeperRanking || isGoalkeeperPosition(player.position))
    .filter((player) => score(player) > 0)
    .sort((a, b) =>
      score(b) - score(a) ||
      (isKeeperRanking
        ? compareGoalkeeperScores(awards?.goalkeepers[a.id], awards?.goalkeepers[b.id])
        : 0) ||
      (a.last_name + " " + a.first_name).localeCompare(b.last_name + " " + b.first_name, "it"),
    ) : [];
  const displayScore = (player: RankedPlayer): string =>
    isKeeperRanking
      ? formatKeeperAverage(score(player))
      : String(score(player));
  const staffRanking = [...(data?.staff ?? [])].sort((a, b) =>
    b.presidential_penalties - a.presidential_penalties ||
    (a.player.last_name + " " + a.player.first_name).localeCompare(b.player.last_name + " " + b.player.first_name, "it"),
  );

  return (
    <PageShell>
      <div className="page platform-stats-detail">
        <header className="platform-page-heading">
          <SectionTitle eyebrow={data?.group.name ?? "Statistiche"} title={validKey ? config[key].title : "Classifica"} />
          <p>
            {key === "mvps"
              ? "Numero di riconoscimenti MVP ottenuti nelle singole partite delle competizioni attive selezionate."
              : isKeeperRanking
                ? "Media dei voti da 1 a 5 ricevuti per partita, non somma. A parità di media voto, prevale chi ha subito meno gol per partita nelle gare valutate; i risultati mancanti non vengono contati come zero."
                : "Classifica completa della statistica, calcolata sui dati registrati per le competizioni attive selezionate."}
          </p>
          <a className="stats-detail-back" href="/statistiche">← Torna alle statistiche</a>
        </header>

        {data?.group.competitions.length ? (
          <div className="stats-detail-scope">
            <span>Competizione</span>
            <strong>{data.group.name}</strong>
            {data.group.competitions.length > 1 ? (
              <small>Dati aggregati: {data.group.competitions.map((competition) => competition.name).join(", ")}</small>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? (
          <p className="admin-message">Caricamento classifica…</p>
        ) : !data ? (
          <EmptyState title="Classifica non disponibile" text={error || "Non è stato possibile trovare la competizione."} />
        ) : key === "staff" ? (
          staffRanking.length ? (
            <div className="leaderboard stats-detail-leaderboard stats-detail-leaderboard--staff" role="table" aria-label={config.staff.title}>
              <div className="table-row head">
                <span>#</span><span>Membro staff</span><span>Gol</span>
              </div>
              {staffRanking.map((entry, index) => {
                const player = entry.player;
                const photo = player.profile_image_url || player.bg_less_image_url;
                return (
                  <a className="table-row" href={"/giocatori/" + player.id} key={player.id}>
                    <span className="position">{String(index + 1).padStart(2, "0")}</span>
                    <span className="stats-detail-player">
                      {photo ? <img src={photo} alt="" /> : <span className="stats-detail-player__placeholder">{player.first_name.slice(0, 1)}{player.last_name.slice(0, 1)}</span>}
                      <span><strong>{player.first_name} {player.last_name}</strong><small>{player.position || "Staff"}</small></span>
                    </span>
                    <strong>{entry.presidential_penalties}</strong>
                  </a>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nessun membro staff" text="La classifica si popolerà quando saranno registrati i membri staff." />
          )
        ) : playerRanking.length ? (
          <div className="leaderboard stats-detail-leaderboard" role="table" aria-label={config[key].title}>
            <div className="table-row head">
              <span>#</span><span>Giocatore</span><span>Squadra</span><span>{config[key].unit}</span>
            </div>
            {playerRanking.map((player, index) => {
              const photo = player.profile_image_url || player.bg_less_image_url;
              return (
                <div className="stats-detail-ranking-entry" key={player.id}>
                  <a className="table-row" href={"/giocatori/" + player.id}>
                    <span className="position">{String(index + 1).padStart(2, "0")}</span>
                    <span className="stats-detail-player">
                    {photo ? <img src={photo} alt="" /> : <span className="stats-detail-player__placeholder">{player.first_name.slice(0, 1)}{player.last_name.slice(0, 1)}</span>}
                    <span><strong>{player.first_name} {player.last_name}</strong><small>{player.position || "Giocatore"}</small></span>
                  </span>
                  <span className="stats-detail-team">{player.team_name}</span>
                  <strong className="stats-detail-keeper-score">{displayScore(player)}{isKeeperRanking && (
                    <small className="stats-detail-rating-count">
                      {awards?.goalkeepers[player.id]?.count ?? 0} voti · GS/gara: {awards?.goalkeepers[player.id]?.goalsConcededPerMatch === null
                        ? "n/d"
                        : (awards?.goalkeepers[player.id]?.goalsConcededPerMatch ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 2 })}
                    </small>
                  )}</strong>
                  </a>
                  {isKeeperRanking && (awards?.goalkeepers[player.id]?.votes.length ?? 0) > 0 ? (
                    <details className="stats-keeper-match-history">
                      <summary>Voti per partita · {awards?.goalkeepers[player.id]?.count ?? 0} gare valutate</summary>
                      <div className="stats-keeper-match-history__list">
                        {awards?.goalkeepers[player.id]?.votes.map((vote) => (
                          <div className="stats-keeper-match-history__match" key={vote.matchId}>
                            <span>{vote.matchday ? vote.matchday + " · " : ""}{vote.opponentTeamId ? "vs " + (data?.teamNames[vote.opponentTeamId] ?? "Avversario") : "Partita"} · {new Date(vote.kickoffAt).toLocaleDateString("it-IT")}</span>
                            <strong>{vote.rating}/5</strong>
                            <small>GS: {vote.goalsConceded ?? "n/d"}</small>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nessun record disponibile" text="Non ci sono ancora valori registrati per questa statistica nelle competizioni selezionate." />
        )}
      </div>
      <SponsorWatermarkStrip />
    </PageShell>
  );
}
