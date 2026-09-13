import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getMatch, getTeams, getMatchEvents } from "../lib/api";
import type { Match, Team, MatchEvent } from "../types";
export default function MatchDetail() {
  const { matchId = "" } = useParams();
  const [m, setM] = useState<Match | null>(null),
    [home, setHome] = useState<Team | null>(null),
    [away, setAway] = useState<Team | null>(null),
    [events, setEvents] = useState<MatchEvent[]>([]);
  useEffect(() => {
    (async () => {
      const mm = await getMatch(matchId);
      setM(mm);
      if (mm) {
        const ts = await getTeams();
        setHome(ts.find((t) => t.id === mm.home_team_id) || null);
        setAway(ts.find((t) => t.id === mm.away_team_id) || null);
        setEvents(await getMatchEvents(mm.id));
      }
    })();
  }, [matchId]);
  return (
    <PageShell>
      {m ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">
                {m.matchday || "Match"} / {m.status}
              </span>
              <h1>
                {home?.name || "Home"}{" "}
                <span style={{ color: "var(--pink)" }}>VS</span>{" "}
                {away?.name || "Away"}
              </h1>
              <div className="detail-meta">
                <span>{new Date(m.kickoff_at).toLocaleString("it-IT")}</span>
                <span>{m.venue || "Venue —"}</span>
              </div>
            </div>
          </section>
          <div className="match-detail-score">
            <div className="scoreboard">
              <div className="score-team">
                <span className="eyebrow">HOME</span>
                <h2>{home?.name || "—"}</h2>
              </div>
              <div className="score">
                {m.status === "scheduled"
                  ? "— : —"
                  : `${m.home_score ?? 0} : ${m.away_score ?? 0}`}
              </div>
              <div className="score-team right">
                <span className="eyebrow">AWAY</span>
                <h2>{away?.name || "—"}</h2>
              </div>
            </div>
          </div>
          <div className="page">
            <SectionTitle eyebrow="Match timeline" title="Eventi" />
            {events.length ? (
              <div className="timeline">
                {events.map((e) => (
                  <div className="timeline-row" key={e.id}>
                    <span>{e.minute ? `${e.minute}'` : "—"}</span>
                    <b>{e.event_type.replace("_", " ")}</b>
                    <span>{e.note || "Evento registrato"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nessun evento"
                text="Gol, cartellini, cambi e assist appariranno quando l'operatore li registrerà."
              />
            )}
            <div className="section">
              <SectionTitle eyebrow="Lineups" title="Formazioni" />
              <EmptyState
                title="Formazioni non disponibili"
                text="Le formazioni verranno lette dalla tabella match_lineups."
              />
            </div>
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState
            title="Partita non trovata"
            text="Il match ID non corrisponde a un record presente in Supabase."
          />
        </div>
      )}
    </PageShell>
  );
}
