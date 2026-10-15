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
  const [competitionRows, setCompetitionRows] = useState<Array<{ id: string; name: string; rows: ReturnType<typeof calculateStandings> }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const competitions = await getActiveCompetitions();
        const data = await Promise.all(
          competitions.map(async (competition) => {
            const [teams, matches] = await Promise.all([
              getTeams(competition.id),
              getMatches(competition.id),
            ]);
            return {
              id: competition.id,
              name: competition.name,
              rows: calculateStandings(teams, matches),
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
        <section className="page-sponsor-band" aria-label="Classifiche e sponsor">
          <div className="page-sponsor-band__inner">
            <SectionTitle title="Classifiche" />
            <SponsorWatermarkStrip />
          </div>
        </section>

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p className="admin-message">Caricamento…</p>
        ) : !competitionRows.length ? (
          <EmptyState title="Nessuna classifica" text="Non ci sono competizioni da mostrare." />
        ) : (
          <div className="standings-competition-list">
            {competitionRows.map((competition) => (
              <section className="standings-competition" key={competition.id}>
                <SectionTitle eyebrow="Classifica competizione" title={competition.name} variant="group" />
                {!competition.rows.length ? (
                  <EmptyState title="Nessuna classifica" text="La classifica viene derivata dalle partite concluse con un risultato registrato." />
                ) : (
                  <div className="leaderboard standings-table" role="region" aria-label={`Classifica ${competition.name}`} tabIndex={0}>
                    <div className="table-row head">
                      <span title="Posizione">#</span>
                      <span>Squadra</span>
                      <span title="Partite giocate">PG</span>
                      <span>Vittorie</span>
                      <span>Pareggi</span>
                      <span>Sconfitte</span>
                      <span>Goal fatti</span>
                      <span>Goal subiti</span>
                      <span>Differenza reti</span>
                      <span>Punti</span>
                    </div>
                    {competition.rows.map((row, index) => (
                      <a className="table-row" href={`/squadre/${row.team.id}`} key={row.team.id}>
                        <span className="position">{String(index + 1).padStart(2, "0")}</span>
                        <div className="standings-team">
                          {row.team.logo_url ? (
                            <img src={row.team.logo_url} alt="" className="standings-team__logo" />
                          ) : (
                            <span className="standings-team__logo standings-team__logo--placeholder" aria-hidden="true">{row.team.name.slice(0, 1).toUpperCase()}</span>
                          )}
                          <strong>{row.team.name}</strong>
                        </div>
                        <span>{row.played}</span>
                        <span>{row.wins}</span>
                        <span>{row.draws}</span>
                        <span>{row.losses}</span>
                        <span>{row.gf}</span>
                        <span>{row.ga}</span>
                        <span>{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                        <strong>{row.points}</strong>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
