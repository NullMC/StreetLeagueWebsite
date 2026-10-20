import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import {
  calculateStandings,
  getActiveCompetitions,
  getMatches,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";

export default function Standings() {
  const [competitionRows, setCompetitionRows] = useState<Array<{
    competition: Awaited<ReturnType<typeof getActiveCompetitions>>[number];
    rows: ReturnType<typeof calculateStandings>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const competitions = await getActiveCompetitions();
        const data = await Promise.all(competitions.map(async (competition) => {
          const [teams, matches] = await Promise.all([
            getTeams(competition.id),
            getMatches(competition.id),
          ]);
          return { competition, rows: calculateStandings(teams, matches) };
        }));
        if (mounted) {
          setCompetitionRows(data);
          setError("");
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Errore classifica.");
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
      <div className="page standings-page">
        <header className="platform-page-heading">
          <SectionTitle title="Classifiche" />
          <p>La situazione aggiornata delle competizioni attive.</p>
        </header>

        {error ? <p className="admin-error">{error}</p> : null}
        {loading ? (
          <p className="admin-message">Caricamento classifiche…</p>
        ) : !competitionRows.length ? (
          <EmptyState title="Nessuna classifica" text="Non ci sono competizioni da mostrare." />
        ) : (
          <div className="standings-competition-list">
            {competitionRows.map((competition) => (
              <section className="standings-competition" key={competition.competition.id}>
                <SectionTitle eyebrow="Classifica competizione" title={competition.competition.name} variant="group" />
                {!competition.rows.length ? (
                  <EmptyState title="Nessuna classifica" text="La classifica viene derivata dalle partite concluse con un risultato registrato." />
                ) : (
                  <div className="leaderboard standings-table" role="region" aria-label={"Classifica " + competition.competition.name} tabIndex={0}>
                    <div className="table-row head">
                      <span title="Posizione">#</span>
                      <span>Squadra</span>
                      <span title="Partite giocate">PG</span>
                      <span title="Punti">P</span>
                      <span title="Goal fatti">GF</span>
                      <span title="Goal subiti">GS</span>
                      <span title="Differenza reti">DR</span>
                    </div>
                    {competition.rows.map((row, index) => (
                      <a className={`table-row${index < 4 ? " table-row--qualified" : ""}`} href={"/squadre/" + row.team.id} key={row.team.id}>
                        <span className="position">{String(index + 1).padStart(2, "0")}</span>
                        <span className="standings-team">
                          {row.team.logo_url ? (
                            <img src={row.team.logo_url} alt="" className="standings-team__logo" />
                          ) : (
                            <span className="standings-team__logo standings-team__logo--placeholder" aria-hidden="true">
                              {row.team.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <strong>{row.team.name}</strong>
                        </span>
                        <span>{row.played}</span>
                        <strong>{row.points}</strong>
                        <span>{row.gf}</span>
                        <span>{row.ga}</span>
                        <span>{row.gd > 0 ? "+" + row.gd : row.gd}</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      <SponsorWatermarkStrip />
    </PageShell>
  );
}
