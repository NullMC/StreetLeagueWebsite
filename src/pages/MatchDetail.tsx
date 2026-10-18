import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import {
  getMatch,
  getTeams,
  getMatchEvents,
  getMatchMvp,
  getPlayers,
} from "../lib/api";
import type {
  Match,
  Team,
  MatchEvent,
  MatchMvp,
  Player,
} from "../types";

export default function MatchDetail() {
  const { matchId = "" } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
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
        setMvp(currentMvp);
        setPlayers(allPlayers);
      } catch {
        if (mounted) {
          setMatch(null);
          setEvents([]);
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
            <div className="scoreboard match-detail-scoreboard">
              <div className="score-team">
                <div className="score-team__identity">
                  {home?.logo_url ? (
                    <img className="score-team__logo" src={home.logo_url} alt="" aria-hidden="true" />
                  ) : (
                    <span className="score-team__logo score-team__logo--placeholder" aria-hidden="true">
                      {home?.name?.slice(0, 1).toUpperCase() ?? "?"}
                    </span>
                  )}
                  <h2>{home?.name || "—"}</h2>
                </div>
              </div>

              <div className="score">
                {match.status === "scheduled"
                  ? "— : —"
                  : `${match.home_score ?? 0} : ${match.away_score ?? 0}`}
              </div>

              <div className="score-team right">
                <div className="score-team__identity">
                  {away?.logo_url ? (
                    <img className="score-team__logo" src={away.logo_url} alt="" aria-hidden="true" />
                  ) : (
                    <span className="score-team__logo score-team__logo--placeholder" aria-hidden="true">
                      {away?.name?.slice(0, 1).toUpperCase() ?? "?"}
                    </span>
                  )}
                  <h2>{away?.name || "—"}</h2>
                </div>
              </div>
            </div>
          </div>

          <div className="page">
            <SectionTitle eyebrow="" title="Eventi"  variant="subsection" />

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

            {mvp && (
              <div className="section">
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
