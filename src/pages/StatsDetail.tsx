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

type DetailKey = "goals" | "mvps" | "clean_sheets" | "staff";
type RankedPlayer = Player & { stats: PlayerStats; team_name: string };
type DetailData = {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
};

const config: Record<DetailKey, { title: string; unit: string }> = {
  goals: { title: "Miglior marcatore", unit: "gol" },
  mvps: { title: "Storico MVP", unit: "record MVP" },
  clean_sheets: { title: "Miglior portiere", unit: "clean sheet" },
  staff: { title: "Classifica staff", unit: "gol" },
};

function isStaff(player: Pick<Player, "position" | "role">) {
  return player.role?.trim().toUpperCase() === "STAFF" ||
    player.position?.trim().toUpperCase() === "STAFF";
}

function isGoalkeeper(player: RankedPlayer) {
  const position = (player.position || "").trim().toLocaleLowerCase("it");
  return position.includes("portier") || position.includes("goalkeeper") ||
    position.includes("goalie") || position === "gk" || position === "por";
}

export default function StatsDetail() {
  const { groupId = "", statKey = "" } = useParams();
  const key = statKey as DetailKey;
  const validKey = key === "goals" || key === "mvps" || key === "clean_sheets" || key === "staff";
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
        const [playerRows, staff, allTeams] = await Promise.all([
          getPlayerStatsForCompetitions(group.competition_ids),
          getStaffRankingForCompetitions(group.competition_ids),
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
  const playerRanking = validKey && key !== "staff" ? [...players]
    .filter((player) => key === "clean_sheets" ? isGoalkeeper(player) : true)
    .filter((player) => player.stats[key] > 0)
    .sort((a, b) =>
      b.stats[key] - a.stats[key] ||
      (a.last_name + " " + a.first_name).localeCompare(b.last_name + " " + b.first_name, "it"),
    ) : [];
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
              ? "Storico dei giocatori con il maggior numero di riconoscimenti MVP nelle competizioni attive selezionate."
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
            <div className="leaderboard stats-detail-leaderboard" role="table" aria-label={config.staff.title}>
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
                <a className="table-row" href={"/giocatori/" + player.id} key={player.id}>
                  <span className="position">{String(index + 1).padStart(2, "0")}</span>
                  <span className="stats-detail-player">
                    {photo ? <img src={photo} alt="" /> : <span className="stats-detail-player__placeholder">{player.first_name.slice(0, 1)}{player.last_name.slice(0, 1)}</span>}
                    <span><strong>{player.first_name} {player.last_name}</strong><small>{player.position || "Giocatore"}</small></span>
                  </span>
                  <span className="stats-detail-team">{player.team_name}</span>
                  <strong>{player.stats[key]}</strong>
                </a>
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
