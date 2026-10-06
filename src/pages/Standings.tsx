import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  calculateStandings,
  getActiveCompetitions,
  getMatches,
  getStaffRanking,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import type { Team } from "../types";

export default function Standings() {
  const [competitionRows, setCompetitionRows] = useState<Array<{ id: string; name: string; rows: ReturnType<typeof calculateStandings>; staffRows: Awaited<ReturnType<typeof getStaffRanking>> }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const competitions = await getActiveCompetitions();
        const data = await Promise.all(
          competitions.map(async (competition) => {
            const [teams, matches, staff] = await Promise.all([
              getTeams(competition.id),
              getMatches(competition.id),
              getStaffRanking(competition.id),
            ]);
            return {
              id: competition.id,
              name: competition.name,
              rows: calculateStandings(teams, matches),
              staffRows: staff,
            };
          }),
        );
        if (mounted) setCompetitionRows(data);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Errore classifica.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    const unsubscribe = subscribeToCompetition(() => void load());

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="Competizioni attive" title="Classifiche" />

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p className="admin-message">Caricamento…</p>
        ) : !competitionRows.length ? (
          <EmptyState title="Nessuna classifica" text="Non ci sono competizioni attive da mostrare." />
        ) : (
          <div className="standings-competition-list">
            {competitionRows.map((competition) => (
              <section className="standings-competition" key={competition.id}>
                <SectionTitle eyebrow="Competizione attiva" title={competition.name} />
                {!competition.rows.length ? (
                  <EmptyState title="Nessuna classifica" text="La classifica viene derivata dalle partite concluse." />
                ) : (
                  <div className="leaderboard">
                    <div className="table-row head"><span>#</span><span>Squadra</span><span>P</span><span>W</span><span>D</span><span>L</span><span>DG</span><span>PTS</span></div>
                    {competition.rows.map((row, index) => (
                      <a className="table-row" href={`/squadre/${row.team.id}`} key={row.team.id}>
                        <span className="position">{String(index + 1).padStart(2, "0")}</span>
                        <div className="standings-team">{row.team.logo_url ? <img src={row.team.logo_url} alt="" className="standings-team__logo" /> : <span className="standings-team__logo standings-team__logo--placeholder" aria-hidden="true">{row.team.name.slice(0, 1).toUpperCase()}</span>}<strong>{row.team.name}</strong></div>
                        <span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.gd > 0 ? `+${row.gd}` : row.gd}</span><strong>{row.points}</strong>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <div className="section standings-staff-section">
          <SectionTitle eyebrow="Competizioni attive" title="Classifica staff" />
          {competitionRows.map((competition) => (
            <section className="standings-competition" key={`staff-${competition.id}`}>
              <h3>{competition.name}</h3>
              {!competition.staffRows.length ? (
                <EmptyState title="Nessun membro STAFF" text="I membri STAFF della competizione verranno mostrati qui." />
              ) : (
                <div className="leaderboard staff-leaderboard">
                  <div className="table-row head"><span>#</span><span>Membro staff</span><span>Rigori pres.</span><span>Gol</span></div>
                  {competition.staffRows.map((row, index) => (
                    <a className="table-row" href={`/giocatori/${row.player.id}`} key={row.player.id}>
                      <span className="position">{String(index + 1).padStart(2, "0")}</span>
                      <div className="standings-player">{row.player.profile_image_url || row.player.bg_less_image_url ? <img src={row.player.profile_image_url || row.player.bg_less_image_url || ""} alt="" className="standings-player__avatar" /> : <span className="standings-player__avatar standings-player__avatar--placeholder" aria-hidden="true">{(row.player.first_name[0] ?? "") + (row.player.last_name[0] ?? "")}</span>}<strong>{row.player.first_name} {row.player.last_name}</strong></div>
                      <span>{row.presidential_penalties}</span><strong>{row.presidential_penalties}</strong>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>      </div>
    </PageShell>
  );
}
