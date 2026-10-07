import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  getActiveCompetitions,
  getPlayerStatsForCompetitions,
  getStaffRankingForCompetitions,
  getStatisticsGroups,
  getTeams,
} from "../lib/api";
import type {
  PlayerStats,
  StaffRankingEntry,
  StatisticsGroup,
  Team,
} from "../types";

type StatKey = keyof PlayerStats;
type PlayerWithStats = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  shirt_number: number | null;
  position: string | null;
  stats: PlayerStats;
  team_name: string;
};

const categories: Array<{ key: StatKey; label: string }> = [
  { key: "goals", label: "Miglior marcatore" },
  { key: "mvps", label: "Miglior giocatore (MVP)" },
  { key: "clean_sheets", label: "Miglior portiere (Clean sheets)" },
  { key: "yellow_cards", label: "Cartellini gialli" },
  { key: "red_cards", label: "Cartellini rossi" },
];

export default function Stats() {
  const [groups, setGroups] = useState<StatisticsGroup[]>([]);
  const [playersByGroup, setPlayersByGroup] = useState<
    Record<string, PlayerWithStats[]>
  >({});
  const [playersByCompetition, setPlayersByCompetition] = useState<
    Record<string, PlayerWithStats[]>
  >({});
  const [staffByGroup, setStaffByGroup] = useState<
    Record<string, StaffRankingEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const competitions = await getActiveCompetitions();
        const nextGroups = await getStatisticsGroups(competitions);

        const groupedEntries = await Promise.all(
          nextGroups.map(async (group) => {
            const [players, staff] = await Promise.all([
              getPlayerStatsForCompetitions(group.competition_ids),
              getStaffRankingForCompetitions(group.competition_ids),
            ]);
            return [group.id, { players, staff }] as const;
          }),
        );

        const competitionEntries = await Promise.all(
          competitions.map(async (competition) => {
            const [players, teams] = await Promise.all([
              getPlayerStatsForCompetitions([competition.id]),
              getTeams(competition.id),
            ]);

            const teamMap = new Map<string, Team>(
              teams.map((team) => [team.id, team]),
            );

            const scopedPlayers: PlayerWithStats[] = players.map((player) => ({
              ...player,
              team_name: teamMap.get(player.team_id)?.name ?? "—",
            }));

            return [competition.id, scopedPlayers] as const;
          }),
        );

        if (!mounted) return;

        setGroups(nextGroups);
        setPlayersByGroup(
          Object.fromEntries(
            groupedEntries.map(([id, data]) => [id, data.players]),
          ),
        );
        setPlayersByCompetition(Object.fromEntries(competitionEntries));
        setStaffByGroup(
          Object.fromEntries(
            groupedEntries.map(([id, data]) => [id, data.staff]),
          ),
        );
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossibile caricare le statistiche.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const leadersFor = (players: PlayerWithStats[]) =>
    categories.map((category) => ({
      ...category,
      rows: [...players]
        .filter((player) => player.stats[category.key] > 0)
        .sort(
          (a, b) =>
            b.stats[category.key] - a.stats[category.key] ||
            `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`,
              "it",
            ),
        )
        .slice(0, 3),
    }));

  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="Live" title="Statistiche" />

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p className="admin-message">Caricamento statistiche…</p>
        ) : !groups.length ? (
          <EmptyState
            title="Nessuna statistica"
            text="Non ci sono competizioni attive da analizzare."
          />
        ) : (
          groups.map((group) => {
            const players = playersByGroup[group.id] ?? [];
            const staff = staffByGroup[group.id] ?? [];
            const leaders = leadersFor(players);

            return (
              <section className="stats-competition-group" key={group.id}>
                <SectionTitle
                  eyebrow="Statistiche attive"
                  title={group.name}
                  variant="group"
                />

                {group.competitions.length > 1 && (
                  <p className="admin-help-text">
                    Dati aggregati da:{" "}
                    {group.competitions
                      .map((competition) => competition.name)
                      .join(" · ")}
                  </p>
                )}

                <section className="section stats-staff-section">
                  <SectionTitle
                    eyebrow="Staff"
                    title="Classifica staff"
                    variant="subsection"
                  />

                  {!staff.length ? (
                    <EmptyState
                      title="Nessun membro STAFF"
                      text="I membri STAFF delle squadre appartenenti a questa sezione verranno mostrati qui."
                    />
                  ) : (
                    <div className="leaderboard staff-leaderboard">
                      <div className="table-row head">
                        <span>#</span>
                        <span>Membro staff</span>
                        <span>Gol</span>
                      </div>

                      {staff.map((row, index) => (
                        <a
                          className="table-row"
                          href={`/giocatori/${row.player.id}`}
                          key={row.player.id}
                        >
                          <span className="position">
                            {String(index + 1).padStart(2, "0")}
                          </span>

                          <div className="standings-player">
                            {row.player.profile_image_url ||
                            row.player.bg_less_image_url ? (
                              <img
                                src={
                                  row.player.profile_image_url ||
                                  row.player.bg_less_image_url ||
                                  ""
                                }
                                alt=""
                                className="standings-player__avatar"
                              />
                            ) : (
                              <span
                                className="standings-player__avatar standings-player__avatar--placeholder"
                                aria-hidden="true"
                              >
                                {(row.player.first_name[0] ?? "") +
                                  (row.player.last_name[0] ?? "")}
                              </span>
                            )}
                            <strong>
                              {row.player.first_name} {row.player.last_name}
                            </strong>
                          </div>

                          <strong>{row.presidential_penalties}</strong>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {!players.length ? (
                  <EmptyState
                    title="Nessun dato"
                    text="Le statistiche compariranno con i dati registrati."
                  />
                ) : (
                  <>
                    <div className="leaders stats-leaders">
                      {leaders.map((leader) => {
                        const top = leader.rows[0];

                        return (
                          <div className="stat-card" key={leader.key}>
                            <span className="eyebrow">{leader.label}</span>
                            <h3>
                              {top ? (
                                <a href={`/giocatori/${top.id}`}>
                                  {top.first_name} {top.last_name}
                                </a>
                              ) : (
                                "Nessun dato"
                              )}
                            </h3>
                            <div className="stat-card__value">
                              {top ? top.stats[leader.key] : "—"}
                            </div>
                            <div className="rank-list">
                              {leader.rows.map((player, index) => (
                                <a
                                  className="rank-row"
                                  href={`/giocatori/${player.id}`}
                                  key={player.id}
                                >
                                  <span>
                                    {String(index + 1).padStart(2, "0")}
                                  </span>
                                  <span>
                                    {player.first_name} {player.last_name}
                                  </span>
                                  <strong>
                                    {player.stats[leader.key]}
                                  </strong>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="stats-player-lists">
                      {group.competitions.map((competition) => {
                        const competitionPlayers =
                          playersByCompetition[competition.id] ?? [];

                        return (
                          <section
                            className="stats-player-list"
                            key={competition.id}
                          >
                            <SectionTitle
                              eyebrow="Giocatori"
                              title={competition.name}
                              variant="subsection"
                            />

                            {!competitionPlayers.length ? (
                              <EmptyState
                                title="Nessun giocatore"
                                text="I giocatori registrati per questa competizione verranno mostrati qui."
                              />
                            ) : (
                              <div className="admin-table-wrap">
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Giocatore</th>
                                      <th>Squadra</th>
                                      <th>Reti</th>
                                      <th>MVP</th>
                                      <th>Clean sheets</th>
                                      <th>Gialli</th>
                                      <th>Rossi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...competitionPlayers]
                                      .sort(
                                        (a, b) =>
                                          `${a.last_name} ${a.first_name}`.localeCompare(
                                            `${b.last_name} ${b.first_name}`,
                                            "it",
                                          ),
                                      )
                                      .map((player, index) => (
                                        <tr key={player.id}>
                                          <td>
                                            {String(index + 1).padStart(2, "0")}
                                          </td>
                                          <td>
                                            <a
                                              href={`/giocatori/${player.id}`}
                                            >
                                              {player.first_name}{" "}
                                              {player.last_name}
                                            </a>
                                          </td>
                                          <td>{player.team_name}</td>
                                          <td>{player.stats.goals}</td>
                                          <td>{player.stats.mvps}</td>
                                          <td>{player.stats.clean_sheets}</td>
                                          <td>
                                            {player.stats.yellow_cards}
                                          </td>
                                          <td>{player.stats.red_cards}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
