import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  calculateStandings,
  getActiveCompetition,
  getMatches,
  getStaffRanking,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import type { Team } from "../types";

export default function Standings() {
  const [rows, setRows] = useState<ReturnType<typeof calculateStandings>>([]);
  const [staffRows, setStaffRows] = useState<Awaited<ReturnType<typeof getStaffRanking>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const competition = await getActiveCompetition();
        if (!competition) {
          if (mounted) {
            setRows([]);
            setStaffRows([]);
          }
          return;
        }

        const [teams, matches, staff] = await Promise.all([
          getTeams(competition.id),
          getMatches(competition.id),
          getStaffRanking(competition.id),
        ]);

        if (mounted) {
          setRows(calculateStandings(teams, matches));
          setStaffRows(staff);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Errore classifica.",
          );
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
        <SectionTitle eyebrow="Competizione attuale" title="Classifica" />

        {error && <p className="admin-error">{error}</p>}

        {loading ? (
          <p className="admin-message">Caricamento…</p>
        ) : !rows.length ? (
          <EmptyState
            title="Nessuna classifica"
            text="La classifica viene derivata dalle partite concluse presenti nel database."
          />
        ) : (
          <div className="leaderboard">
            <div className="table-row head">
              <span>#</span>
              <span>Squadra</span>
              <span>P</span>
              <span>W</span>
              <span>D</span>
              <span>L</span>
              <span>DG</span>
              <span>PTS</span>
            </div>

            {rows.map((row, index) => (
              <div className="table-row" key={row.team.id}>
                <span className="position">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{row.team.name}</strong>
                <span>{row.played}</span>
                <span>{row.wins}</span>
                <span>{row.draws}</span>
                <span>{row.losses}</span>
                <span>{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
                <strong>{row.points}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="section standings-staff-section">
          <SectionTitle eyebrow="Competizione attuale" title="Classifica staff" />
          {!staffRows.length ? (
            <EmptyState
              title="Nessun membro STAFF"
              text="I giocatori con ruolo STAFF e i relativi rigori presidenziali verranno mostrati qui."
            />
          ) : (
            <div className="leaderboard staff-leaderboard">
              <div className="table-row head">
                <span>#</span>
                <span>Membro staff</span>
                <span>Rigori pres.</span>
                <span>Gol</span>
              </div>
              {staffRows.map((row, index) => (
                <div className="table-row" key={row.player.id}>
                  <span className="position">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{row.player.first_name} {row.player.last_name}</strong>
                  <span>{row.presidential_penalties}</span>
                  <strong>{row.presidential_penalties}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
