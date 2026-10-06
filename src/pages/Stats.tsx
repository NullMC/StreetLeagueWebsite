import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  getActiveCompetitions,
  getPlayerStatsForCompetitions,
  getStaffRankingForCompetitions,
  getStatisticsGroups,
} from "../lib/api";
import type { PlayerStats, StaffRankingEntry, StatisticsGroup } from "../types";

type StatKey = keyof PlayerStats;

const categories: Array<{ key: StatKey; label: string }> = [
  { key: "goals", label: "Reti" },
  { key: "appearances", label: "Presenze" },
  { key: "assists", label: "Assist" },
  { key: "yellow_cards", label: "Gialli" },
  { key: "red_cards", label: "Rossi" },
  { key: "clean_sheets", label: "Clean sheets" },
  { key: "mvps", label: "MVP" },
];

export default function Stats() {
  const [groups, setGroups] = useState<StatisticsGroup[]>([]);
  const [playersByGroup, setPlayersByGroup] = useState<Record<string, Array<any>>>({});
  const [staffByGroup, setStaffByGroup] = useState<Record<string, StaffRankingEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const competitions = await getActiveCompetitions();
        const nextGroups = await getStatisticsGroups(competitions);
        const entries = await Promise.all(
          nextGroups.map(async (group) => {
            const [players, staff] = await Promise.all([
              getPlayerStatsForCompetitions(group.competition_ids),
              getStaffRankingForCompetitions(group.competition_ids),
            ]);
            return [group.id, { players, staff }] as const;
          }),
        );
        if (mounted) {
          setGroups(nextGroups);
          setPlayersByGroup(
            Object.fromEntries(entries.map(([id, data]) => [id, data.players])),
          );
          setStaffByGroup(
            Object.fromEntries(entries.map(([id, data]) => [id, data.staff])),
          );
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Impossibile caricare le statistiche.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const leadersFor = (players: Array<any>) =>
    categories.map((category) => ({
      ...category,
      rows: [...players].filter((player) => player.stats[category.key] > 0).sort((a, b) => b.stats[category.key] - a.stats[category.key] || `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "it")).slice(0, 3),
    }));


  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="Live" title="Statistiche" />

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p className="admin-message">Caricamento statistiche…</p>
        ) : !groups.length ? (
          <EmptyState title="Nessuna statistica" text="Non ci sono competizioni attive da analizzare." />
        ) : (
          groups.map((group) => {
            const players = playersByGroup[group.id] ?? [];
            const staff = staffByGroup[group.id] ?? [];
            const leaders = leadersFor(players);
            return (
              <section className="stats-competition-group" key={group.id}>
                <SectionTitle eyebrow="Statistiche attive" title={group.name} />
                {group.competitions.length > 1 && <p className="admin-help-text">Dati aggregati da: {group.competitions.map((competition) => competition.name).join(" · ")}</p>}

                <section className="section">
                  <SectionTitle eyebrow="Staff" title="Classifica staff" />
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
                        <span>Rigori pres.</span>
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
                          <span>{row.presidential_penalties}</span>
                          <strong>{row.presidential_penalties}</strong>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {!players.length ? <EmptyState title="Nessun dato" text="Le statistiche compariranno con i dati registrati." /> : (
                  <>
                    <div className="leaders">
                      {leaders.map((leader) => {
                        const top = leader.rows[0];
                        return <div className="stat-card" key={leader.key}><span className="eyebrow">{leader.label}</span><h3>{top ? <a href={`/giocatori/${top.id}`}>{top.first_name} {top.last_name}</a> : "Nessun dato"}</h3><div className="stat-card__value">{top ? top.stats[leader.key] : "—"}</div><div className="rank-list">{leader.rows.map((player, index) => <a className="rank-row" href={`/giocatori/${player.id}`} key={player.id}><span>{String(index + 1).padStart(2, "0")}</span><span>{player.first_name} {player.last_name}</span><strong>{player.stats[leader.key]}</strong></a>)}</div></div>;
                      })}
                    </div>
                    <div className="section"><SectionTitle eyebrow="Player data" title="Statistiche complete" /><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Giocatore</th><th>Reti</th><th>Presenze</th><th>Assist</th><th>Gialli</th><th>Rossi</th><th>CS</th><th>MVP</th></tr></thead><tbody>{[...players].sort((a,b)=>b.stats.goals-a.stats.goals||b.stats.assists-a.stats.assists||b.stats.appearances-a.stats.appearances).map((player)=><tr key={player.id}><td><a href={`/giocatori/${player.id}`}>{player.first_name} {player.last_name}</a></td><td>{player.stats.goals}</td><td>{player.stats.appearances}</td><td>{player.stats.assists}</td><td>{player.stats.yellow_cards}</td><td>{player.stats.red_cards}</td><td>{player.stats.clean_sheets}</td><td>{player.stats.mvps}</td></tr>)}</tbody></table></div></div>
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
