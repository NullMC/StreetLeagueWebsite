import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import {
  getActiveCompetitions,
  getPlayerStatsForCompetitions,
  getStaffRankingForCompetitions,
  getStatisticsGroups,
} from "../lib/api";
import type { Player, PlayerStats, StaffRankingEntry, StatisticsGroup } from "../types";

type RankedPlayer = Player & { stats: PlayerStats };
type StatCategory = "goals" | "mvps" | "clean_sheets" | "staff";
type GroupStats = {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
};

const cards: Array<{ key: StatCategory; title: string; unit: string }> = [
  { key: "goals", title: "Miglior marcatore", unit: "gol" },
  { key: "mvps", title: "Miglior giocatore (MVP)", unit: "record MVP" },
  { key: "clean_sheets", title: "Miglior portiere", unit: "clean sheet" },
  { key: "staff", title: "Miglior membro staff", unit: "gol staff" },
];

function isStaff(player: Pick<Player, "position" | "role">) {
  return player.role?.trim().toUpperCase() === "STAFF" ||
    player.position?.trim().toUpperCase() === "STAFF";
}

function isGoalkeeper(player: RankedPlayer) {
  const position = (player.position || "").trim().toLocaleLowerCase("it");
  return position.includes("portier") || position.includes("goalkeeper") ||
    position.includes("goalie") || position === "gk" || position === "por";
}

function BestStatsCard({ group, players, staff, config }: {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
  config: (typeof cards)[number];
}) {
  const staffLeader = staff[0];
  const ranked = config.key === "staff" ? [] : [...players]
    .filter((player) => config.key === "clean_sheets" ? isGoalkeeper(player) : true)
    .filter((player) => player.stats[config.key as Exclude<StatCategory, "staff">] > 0)
    .sort((a, b) =>
      b.stats[config.key as Exclude<StatCategory, "staff">] - a.stats[config.key as Exclude<StatCategory, "staff">] ||
      (a.last_name + " " + a.first_name).localeCompare(b.last_name + " " + b.first_name, "it"),
    );
  const leader = config.key === "staff" ? staffLeader : ranked[0];
  const name = leader
    ? config.key === "staff"
      ? (leader as StaffRankingEntry).player.first_name + " " + (leader as StaffRankingEntry).player.last_name
      : (leader as RankedPlayer).first_name + " " + (leader as RankedPlayer).last_name
    : "Nessun record";
  const value = leader
    ? config.key === "staff"
      ? (leader as StaffRankingEntry).presidential_penalties
      : (leader as RankedPlayer).stats[config.key as Exclude<StatCategory, "staff">]
    : 0;

  return (
    <a
      className="stat-card best-stats-card"
      href={"/statistiche/" + encodeURIComponent(group.id) + "/" + config.key}
      aria-label={"Apri " + config.title + " per " + group.name}
    >
      <span className="eyebrow">{config.title}</span>
      <h3>{name}</h3>
      <div className="stat-card__value">{String(value).padStart(2, "0")}</div>
      <span className="best-stats-card__unit">{config.unit}</span>
      <span className="best-stats-card__hint">Classifica completa <span aria-hidden="true">↗</span></span>
    </a>
  );
}

export default function Stats() {
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const activeCompetitions = await getActiveCompetitions();
        const groups = await getStatisticsGroups(activeCompetitions);
        const result = await Promise.all(groups.map(async (group) => {
          const [playerRows, staff] = await Promise.all([
            getPlayerStatsForCompetitions(group.competition_ids),
            getStaffRankingForCompetitions(group.competition_ids),
          ]);
          return {
            group,
            players: playerRows.filter((player) => !isStaff(player)),
            staff,
          };
        }));
        if (mounted) {
          setGroupStats(result);
          setError("");
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Impossibile caricare le statistiche.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, []);

  return (
    <PageShell>
      <div className="page platform-stats-page">
        <header className="platform-page-heading">
          <SectionTitle title="Statistiche" />
          <p>Record individuali e riconoscimenti, sempre riferiti alle competizioni attive.</p>
        </header>

        {!loading && groupStats.length > 0 ? (
          <nav className="stats-competition-nav" aria-label="Vai alla competizione">
            {groupStats.map(({ group }) => (
              <a href={"#stats-group-" + encodeURIComponent(group.id)} key={group.id}>
                <span>{group.name}</span>
              </a>
            ))}
          </nav>
        ) : null}

        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? (
          <p className="admin-message">Caricamento statistiche…</p>
        ) : !groupStats.length ? (
          <EmptyState title="Nessuna statistica attiva" text="Le classifiche verranno mostrate quando ci saranno competizioni attive." />
        ) : (
          <div className="stats-groups-list">
            {groupStats.map(({ group, players, staff }) => (
              <section className="stats-competition-group" id={"stats-group-" + encodeURIComponent(group.id)} key={group.id}>
                <SectionTitle eyebrow="Competizioni attive" title={group.name} variant="group" />
                {group.competitions.length > 1 ? (
                  <p className="admin-help-text">
                    Dati aggregati da: {group.competitions.map((competition) => competition.name).join(", ")}
                  </p>
                ) : null}
                <div className="leaders stats-best-cards-grid">
                  {cards.map((config) => (
                    <BestStatsCard key={config.key} group={group} players={players} staff={staff} config={config} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <SponsorWatermarkStrip />
    </PageShell>
  );
}
