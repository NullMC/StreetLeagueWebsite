import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getTeams, getPlayers, getMatches } from "../lib/api";
import type { Team, Player, Match } from "../types";
export default function TeamDetail() {
  const { teamId = "" } = useParams();
  const [team, setTeam] = useState<Team | null>(null),
    [players, setPlayers] = useState<Player[]>([]),
    [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => {
    (async () => {
      const ts = await getTeams();
      const t = ts.find((x) => x.id === teamId) || null;
      setTeam(t);
      if (t) {
        setPlayers(await getPlayers(t.id));
        setMatches(
          (await getMatches(t.competition_id))
            .filter((m) => m.home_team_id === t.id || m.away_team_id === t.id)
            .slice(0, 6),
        );
      }
    })();
  }, [teamId]);
  return (
    <PageShell>
      {team ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">Club profile</span>
              <h1>{team.name}</h1>
              <div className="detail-meta">
                <span>{team.slug || "—"}</span>
              </div>
            </div>
          </section>
          <div className="page">
            <SectionTitle eyebrow="Roster" title="Giocatori" />
            {players.length ? (
              <div className="cards-grid">
                {players.map((p) => (
                  <a
                    className="stat-card"
                    href={`/giocatori/${p.id}`}
                    key={p.id}
                  >
                    <span className="eyebrow">
                      #{p.shirt_number ?? "—"} / {p.position || "Player"}
                    </span>
                    <h3>
                      {p.first_name}
                      <br />
                      {p.last_name}
                    </h3>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Roster vuoto"
                text="Nessun giocatore associato a questa squadra."
              />
            )}
            <div className="section">
              <SectionTitle eyebrow="History" title="Partite" />
              {matches.length ? (
                <div className="match-grid">
                  {matches.map((m) => (
                    <a
                      key={m.id}
                      className="match-card"
                      href={`/partite/${m.id}`}
                    >
                      <div className="match-card__meta">
                        <span>
                          {new Date(m.kickoff_at).toLocaleDateString("it-IT")}
                        </span>
                        <span>{m.matchday || "—"}</span>
                      </div>
                      <div className="match-card__teams">
                        <div>
                          <b>{m.home_team_id === team.id ? team.name : "—"}</b>
                        </div>
                        <strong>
                          {m.status === "scheduled"
                            ? "VS"
                            : `${m.home_score ?? "—"} : ${m.away_score ?? "—"}`}
                        </strong>
                        <div className="right">
                          <b>{m.away_team_id === team.id ? team.name : "—"}</b>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nessuna partita" />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState
            title="Squadra non trovata"
            text="Il riferimento non corrisponde a una squadra presente nel database."
          />
        </div>
      )}
    </PageShell>
  );
}
