import { useEffect, useMemo, useState } from "react";
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
import { getCompetitionAwardScores, isGoalkeeperPosition, type CompetitionAwardScores } from "../lib/awards";

type StatCategory = "goals" | "mvps" | "goalkeepers" | "staff";
type RankedPlayer = Player & { stats: PlayerStats; team_name: string };
type GroupStats = {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
  awards: CompetitionAwardScores;
  playersByCompetition: Record<string, RankedPlayer[]>;
};

const cards: Array<{ key: StatCategory; title: string; unit: string }> = [
  { key: "goals", title: "Miglior marcatore", unit: "gol" },
  { key: "mvps", title: "Miglior giocatore (MVP)", unit: "MVP partita" },
  { key: "goalkeepers", title: "Miglior portiere", unit: "media voto / 5" },
  { key: "staff", title: "Miglior membro staff", unit: "gol staff" },
];

function isStaff(player: Pick<Player, "position" | "role">) {
  return player.role?.trim().toUpperCase() === "STAFF" ||
    player.position?.trim().toUpperCase() === "STAFF";
}

function BestStatsCard({ group, players, staff, awards, config }: {
  group: StatisticsGroup;
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
  awards: CompetitionAwardScores;
  config: (typeof cards)[number];
}) {
  const staffLeader =
    staff[0] && staff[0].presidential_penalties > 0 ? staff[0] : undefined;
  const sortValue = (player: RankedPlayer): number =>
    config.key === "goals" ? player.stats.goals :
    config.key === "mvps" ? awards.mvpCounts[player.id] ?? 0 :
    config.key === "goalkeepers" ? awards.goalkeepers[player.id]?.average ?? 0 : 0;
  const ranked = config.key === "staff" ? [] : [...players]
    .filter((player) => config.key !== "goalkeepers" || isGoalkeeperPosition(player.position))
    .filter((player) => sortValue(player) > 0)
    .sort((a, b) =>
      sortValue(b) - sortValue(a) ||
      (config.key === "goalkeepers"
        ? (awards.goalkeepers[b.id]?.count ?? 0) - (awards.goalkeepers[a.id]?.count ?? 0)
        : 0) ||
      (a.last_name + " " + a.first_name).localeCompare(b.last_name + " " + b.first_name, "it"),
    );
  const leader = config.key === "staff" ? staffLeader : ranked[0];
  const staffPlayer = config.key === "staff" && leader
    ? (leader as StaffRankingEntry).player
    : null;
  const player = staffPlayer ?? (leader && config.key !== "staff"
    ? leader as RankedPlayer
    : null);
  const name = player ? player.first_name + " " + player.last_name : "Nessun record";
  const value = leader
    ? config.key === "staff"
      ? (leader as StaffRankingEntry).presidential_penalties
      : sortValue(leader as RankedPlayer)
    : 0;
  const displayValue = config.key === "goalkeepers"
    ? value.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : String(value).padStart(2, "0");
  const voteCount = config.key === "goalkeepers" && player
    ? awards.goalkeepers[player.id]?.count ?? 0
    : 0;
  const profilePhoto = player?.profile_image_url?.trim();

  const cardContent = (
    <>
      <span className="eyebrow">{config.title}</span>
      {leader ? (
        <>
          {profilePhoto ? (
            <img
              className="best-stats-card__photo"
              src={profilePhoto}
              alt={"Foto profilo di " + name}
              loading="lazy"
            />
          ) : null}
          <h3>{name}</h3>
          <div className="stat-card__value">{displayValue}</div>
          <span className="best-stats-card__unit">{config.unit}{config.key === "goalkeepers" ? " · " + voteCount + (voteCount === 1 ? " partita valutata" : " partite valutate") : ""}</span>
          <span className="best-stats-card__hint">Classifica completa <span aria-hidden="true">↗</span></span>
        </>
      ) : (
        <div className="best-stats-card__empty-copy">
          <h3>Nessun record</h3>
          <p>{config.key === "staff"
            ? "La classifica si attiverà quando sarà registrato almeno un gol dello staff."
            : "Non sono ancora presenti statistiche registrate per questo riconoscimento."}</p>
        </div>
      )}
    </>
  );

  return leader ? (
    <a
      className="stat-card best-stats-card"
      href={"/statistiche/" + encodeURIComponent(group.id) + "/" + config.key}
      aria-label={"Apri " + config.title + " per " + group.name}
    >
      {cardContent}
    </a>
  ) : (
    <div className="stat-card best-stats-card best-stats-card--empty" aria-label={config.title + ": nessun record"}>
      {cardContent}
    </div>
  );
}

export default function Stats() {
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
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
          const [playerRows, staff, awards, individualSets] = await Promise.all([
            getPlayerStatsForCompetitions(group.competition_ids),
            getStaffRankingForCompetitions(group.competition_ids),
            getCompetitionAwardScores(group.competition_ids),
            Promise.all(group.competitions.map(async (competition) => {
              const [players, teams] = await Promise.all([
                getPlayerStatsForCompetitions([competition.id]),
                getTeams(competition.id),
              ]);
              return { competitionId: competition.id, players, teams };
            })),
          ]);
          const teamById = new Map<string, Team>();
          individualSets.flatMap((entry) => entry.teams).forEach((team) => teamById.set(team.id, team));
          const withTeams = (rows: Array<Player & { stats: PlayerStats }>): RankedPlayer[] =>
            rows.filter((player) => !isStaff(player)).map((player) => ({
              ...player,
              team_name: teamById.get(player.team_id)?.name ?? "—",
            }));

          return {
            group,
            players: withTeams(playerRows),
            staff,
            awards,
            playersByCompetition: Object.fromEntries(
              individualSets.map((entry) => [entry.competitionId, withTeams(entry.players)]),
            ),
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

  const normalizedSearch = playerSearch.trim().toLocaleLowerCase("it");
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return groupStats.flatMap(({ group, playersByCompetition }) =>
      group.competitions.flatMap((competition) =>
        (playersByCompetition[competition.id] ?? [])
          .filter((player) => {
            const byName = (player.first_name + " " + player.last_name).toLocaleLowerCase("it");
            const byReverseName = (player.last_name + " " + player.first_name).toLocaleLowerCase("it");
            return byName.includes(normalizedSearch) || byReverseName.includes(normalizedSearch);
          })
          .map((player) => ({ group, competition, player })),
      ),
    );
  }, [groupStats, normalizedSearch]);

  return (
    <PageShell>
      <div className="page platform-stats-page">
        <header className="platform-page-heading">
          <SectionTitle title="Statistiche" />
          <p>Record individuali e riconoscimenti, sempre riferiti alle competizioni attive.</p>
        </header>



        <div className="stats-tools">
          <label className="stats-player-search">
            <span>Cerca un giocatore</span>
            <input
              type="search"
              value={playerSearch}
              onChange={(event) => setPlayerSearch(event.target.value)}
              placeholder="Scrivi nome o cognome…"
              aria-label="Cerca giocatore per nome o cognome"
            />
          </label>
        </div>

        {!loading && groupStats.length > 0 ? (
          <nav className="stats-competition-nav" aria-label="Navigazione rapida alle competizioni attive">
            <span className="stats-competition-nav__label">Vai alla competizione</span>
            <div className="stats-competition-nav__links">
              {groupStats.map(({ group }) => (
                <a
                  className="stats-competition-nav__link"
                  href={"#stats-group-" + encodeURIComponent(group.id)}
                  key={group.id}
                >
                  {group.name}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {normalizedSearch && !loading ? (
          <section className="stats-search-results" aria-live="polite">
            <SectionTitle eyebrow="Ricerca giocatore" title={"Risultati per “" + playerSearch.trim() + "”"} variant="subsection" />
            {searchResults.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table stats-search-table">
                  <thead>
                    <tr>
                      <th>Competizione</th><th>N° maglia</th><th>Giocatore</th><th>Squadra</th>
                      <th>Gol</th><th>Assist</th><th>Gialli</th><th>Rossi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(({ group, competition, player }) => (
                      <tr key={competition.id + "-" + player.id}>
                        <td>{group.name !== competition.name ? group.name + " · " + competition.name : competition.name}</td>
                        <td>{player.shirt_number ?? "—"}</td>
                        <td><a href={"/giocatori/" + player.id}>{player.first_name} {player.last_name}</a></td>
                        <td>{player.team_name}</td>
                        <td>{player.stats.goals}</td>
                        <td>{player.stats.assists}</td>
                        <td>{player.stats.yellow_cards}</td>
                        <td>{player.stats.red_cards}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Nessun giocatore trovato" text="Prova con un nome o un cognome diverso." />
            )}
          </section>
        ) : null}

        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? (
          <p className="admin-message">Caricamento statistiche…</p>
        ) : !groupStats.length ? (
          <EmptyState title="Nessuna statistica attiva" text="Le classifiche verranno mostrate quando ci saranno competizioni attive." />
        ) : (
          <div className="stats-groups-list">
            {groupStats.map(({ group, players, staff, awards }) => (
              <section className="stats-competition-group" id={"stats-group-" + encodeURIComponent(group.id)} key={group.id}>
                <SectionTitle eyebrow="Competizioni attive" title={group.name} variant="group" />
                {group.competitions.length > 1 ? (
                  <p className="admin-help-text">
                    Dati aggregati da: {group.competitions.map((competition) => competition.name).join(", ")}
                  </p>
                ) : null}
                <div className="leaders stats-best-cards-grid">
                  {cards.map((config) => (
                    <BestStatsCard key={config.key} group={group} players={players} staff={staff} awards={awards} config={config} />
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
