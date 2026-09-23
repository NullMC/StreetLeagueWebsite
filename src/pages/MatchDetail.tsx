import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  getMatch,
  getTeams,
  getMatchEvents,
  getMatchLineups,
  getMatchMvp,
  getPlayers,
} from "../lib/api";
import type {
  Match,
  Team,
  MatchEvent,
  MatchLineup,
  MatchMvp,
  Player,
} from "../types";

export default function MatchDetail() {
  const { matchId = "" } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [mvp, setMvp] = useState<MatchMvp | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const currentMatch = await getMatch(matchId);
        if (!mounted) return;
        setMatch(currentMatch);

        if (!currentMatch) return;

        const [teams, currentEvents, currentLineups, currentMvp, allPlayers] =
          await Promise.all([
            getTeams(),
            getMatchEvents(currentMatch.id),
            getMatchLineups(currentMatch.id),
            getMatchMvp(currentMatch.id),
            getPlayers(),
          ]);

        if (!mounted) return;

        setHome(
          teams.find((team) => team.id === currentMatch.home_team_id) ?? null,
        );
        setAway(
          teams.find((team) => team.id === currentMatch.away_team_id) ?? null,
        );
        setEvents(currentEvents);
        setLineups(currentLineups);
        setMvp(currentMvp);
        setPlayers(allPlayers);
      } catch {
        if (mounted) {
          setMatch(null);
          setEvents([]);
          setLineups([]);
          setMvp(null);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [matchId]);

  function playerName(id: string) {
    const player = players.find((item) => item.id === id);
    return player ? `${player.first_name} ${player.last_name}` : "Giocatore";
  }

  const homeLineups = lineups.filter((item) => item.team_id === home?.id);
  const awayLineups = lineups.filter((item) => item.team_id === away?.id);

  return (
    <PageShell>
      {match ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">
                {match.matchday || "Match"} / {match.status}
              </span>

              <h1>
                {home?.name || "Home"}{" "}
                <span style={{ color: "var(--pink)" }}>VS</span>{" "}
                {away?.name || "Away"}
              </h1>

              <div className="detail-meta">
                <span>
                  {new Date(match.kickoff_at).toLocaleString("it-IT")}
                </span>
                <span>{match.venue || "Venue —"}</span>
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
                {match.status === "scheduled"
                  ? "— : —"
                  : `${match.home_score ?? 0} : ${match.away_score ?? 0}`}
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
                {events.map((event) => (
                  <div className="timeline-row" key={event.id}>
                    <span>
                      {event.minute !== null && event.minute !== undefined
                        ? `${event.minute}'`
                        : "—"}
                    </span>
                    <b>
                      {event.event_type === "presidential_penalty"
                        ? "Rigore presidenziale"
                        : event.event_type.replaceAll("_", " ")}
                    </b>
                    <span>
                      {event.player_id ? playerName(event.player_id) : ""}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nessun evento"
                text="Gol, cartellini, cambi, assist e falli appariranno quando saranno registrati."
              />
            )}

            <div className="section">
              <SectionTitle eyebrow="Lineups" title="Formazioni" />

              {!lineups.length ? (
                <EmptyState
                  title="Formazioni non disponibili"
                  text="Non sono ancora state registrate formazioni per questa partita."
                />
              ) : (
                <div className="cards-grid">
                  <div className="stat-card">
                    <span className="eyebrow">{home?.name ?? "Casa"}</span>
                    <h3>Formazione</h3>
                    <div className="rank-list">
                      {homeLineups.map((item) => (
                        <div className="rank-row" key={item.id}>
                          <span>{item.starter ? "T" : "R"}</span>
                          <span>{playerName(item.player_id)}</span>
                          <strong>#{item.shirt_number ?? "—"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="stat-card">
                    <span className="eyebrow">{away?.name ?? "Ospite"}</span>
                    <h3>Formazione</h3>
                    <div className="rank-list">
                      {awayLineups.map((item) => (
                        <div className="rank-row" key={item.id}>
                          <span>{item.starter ? "T" : "R"}</span>
                          <span>{playerName(item.player_id)}</span>
                          <strong>#{item.shirt_number ?? "—"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mvp && (
                <div className="section">
                  <div className="stat-card">
                    <span className="eyebrow">Player of the match</span>
                    <h3>{playerName(mvp.player_id)}</h3>
                    <div className="stat-card__value">MVP</div>
                  </div>
                </div>
              )}
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
