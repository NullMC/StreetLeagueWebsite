import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { EmptyState } from "../components/EmptyState";
import {
  getMatch, getTeams, getMatchEvents, getMatchMvp, getPlayers, getMatchLineups,
} from "../lib/api";
import type { Match, Team, MatchEvent, MatchMvp, MatchLineup, Player } from "../types";
import { MATCH_DURATION_MINUTES, isValidMatchMinute } from "../lib/matchDuration";

type DetailTab = "summary" | "lineups";
const eventTitles: Record<string, string> = {
  goal: "Gol", presidential_penalty: "Rigore presidenziale",
  yellow_card: "Cartellino giallo", red_card: "Cartellino rosso",
  assist: "Assist", substitution: "Sostituzione",
};
const eventSymbols: Record<string, string> = {
  goal: "⚽", presidential_penalty: "⚽",
  yellow_card: "▰", red_card: "▰", assist: "↗",
};
export default function MatchDetail() {
  const { matchId = "" } = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [mvp, setMvp] = useState<MatchMvp | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tab, setTab] = useState<DetailTab>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setTab("summary"); setError("");
    const load = async () => {
      try {
        const currentMatch = await getMatch(matchId);
        if (!active) return;
        setMatch(currentMatch);
        if (!currentMatch) return;
        const [teams, matchEvents, matchMvp, allPlayers, matchLineups] = await Promise.all([
          getTeams(), getMatchEvents(matchId), getMatchMvp(matchId),
          getPlayers(), getMatchLineups(matchId),
        ]);
        if (!active) return;
        setHome(teams.find((team) => team.id === currentMatch.home_team_id) ?? null);
        setAway(teams.find((team) => team.id === currentMatch.away_team_id) ?? null);
        setEvents(matchEvents);
        setMvp(matchMvp);
        setPlayers(allPlayers);
        setLineups(matchLineups);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Impossibile caricare la partita.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [matchId]);

  const findPlayer = (id: string | null) => players.find((player) => player.id === id);
  const playerName = (id: string | null) => {
    const player = findPlayer(id);
    return player ? player.first_name + " " + player.last_name : "Giocatore";
  };
  const hasReport = match?.status === "finished";
  const timelineEvents = events.filter((event) =>
    ["goal", "presidential_penalty", "yellow_card", "red_card"].includes(event.event_type) &&
    isValidMatchMinute(event.minute),
  ).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  return (
    <PageShell>
      {loading ? <div className="page"><p className="admin-message">Caricamento partita…</p></div> : !match ? (
        <div className="page"><EmptyState title="Partita non trovata"
          text={error || "La partita richiesta non è disponibile."} /></div>
      ) : (
        <div className="match-experience">
          <div className="match-experience__hero">
            <div className="match-experience__breadcrumb">
              <a href="/competizioni">← Competizioni</a>
              <span>{match.matchday ? "Giornata " + match.matchday.replace(/^giornata\s*/i, "") : "Partita"}</span>
            </div>
            <span className={"match-experience__status match-experience__status--" + match.status}>
              {match.status === "finished" ? "Terminata" : match.status === "live" ? "LIVE" :
                match.status === "postponed" ? "Rinviata" : "Programmata"}
            </span>
            <div className="match-experience__scoreboard">
              {[home, away].map((team, index) => (
                <div key={index} className={"match-experience__team match-experience__team--" + (index === 0 ? "home" : "away")}>
                  {team?.logo_url
                    ? <img src={team.logo_url} alt="" className="match-experience__logo" />
                    : <span className="match-experience__logo match-experience__logo--fallback">{team?.name.slice(0, 1) ?? "?"}</span>}
                  <strong>{team?.name ?? (index === 0 ? "Casa" : "Ospiti")}</strong>
                </div>
              )).reduce<React.ReactNode[]>((acc, item, index) => {
                if (index === 1) acc.push(
                  <div className="match-experience__score" key="score" aria-label="Risultato">
                    {match.status === "scheduled" || match.home_score === null || match.away_score === null
                      ? "VS" : <><span>{match.home_score}</span><small>:</small><span>{match.away_score}</span></>}
                  </div>,
                );
                acc.push(item);
                return acc;
              }, [])}
            </div>
            <div className="match-experience__details">
              <span>▦ {new Date(match.kickoff_at).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>
              {match.venue && <span>⌖ {match.venue}</span>}
            </div>
          </div>

          <div className="match-experience__body">
            <nav className="match-experience__tabs" aria-label="Dettagli partita">
              <button type="button" className={tab === "summary" ? "active" : ""}
                aria-current={tab === "summary" ? "page" : undefined} onClick={() => setTab("summary")}>
                <span aria-hidden="true">☷</span> Riepilogo
              </button>
              <button type="button" className={tab === "lineups" ? "active" : ""}
                aria-current={tab === "lineups" ? "page" : undefined} onClick={() => setTab("lineups")}>
                <span aria-hidden="true">♟</span> Formazioni
              </button>
            </nav>

            {tab === "summary" && (
              <section className="match-experience__panel">
                <div className="match-experience__panel-title">
                  <h2>Riepilogo partita</h2>
                  <p>Gol, rigori presidenziali e provvedimenti disciplinari · 1′–{MATCH_DURATION_MINUTES}′</p>
                </div>
                {hasReport && timelineEvents.length ? (
                  <div className="match-experience__timeline" aria-label={`Cronologia degli eventi dal 1° al ${MATCH_DURATION_MINUTES}° minuto`}>
                    <span className="match-experience__timeline-boundary">1′ · Inizio partita</span>
                    {timelineEvents.map((event) => {
                      const player = findPlayer(event.player_id);
                      const side = player?.team_id === match.away_team_id ? "away" : "home";
                      const title = eventTitles[event.event_type] ?? event.event_type;
                      return (
                        <div className={"match-experience__timeline-row match-experience__timeline-row--" + side} key={event.id}>
                          <div className="match-experience__timeline-entry">
                            {player?.profile_image_url && <img src={player.profile_image_url} alt="" />}
                            <div className="match-experience__event-text">
                              <strong>{playerName(event.player_id)}</strong>
                              <span className={"match-experience__event-kind match-experience__event-kind--" + event.event_type}>
                                <b aria-hidden="true">{eventSymbols[event.event_type] ?? "•"}</b> {title}
                              </span>
                              {event.note && <small>{event.note}</small>}
                            </div>
                          </div>
                          <span className="match-experience__minute">{event.minute ?? "—"}'</span>
                        </div>
                      );
                    })}
                    <span className="match-experience__timeline-boundary">Fine partita · {MATCH_DURATION_MINUTES}′</span>
                  </div>
                ) : (
                  <div className="match-experience__empty">
                    <strong>Nessun evento disponibile</strong>
                    <p>{hasReport
                      ? "Il riepilogo sarà pubblicato quando sarà inserito il referto arbitrale."
                      : "Gli eventi verranno pubblicati al termine della partita."}</p>
                  </div>
                )}
                {mvp && <div className="match-experience__mvp">★ MVP della partita <strong>{playerName(mvp.player_id)}</strong></div>}
              </section>
            )}

            {tab === "lineups" && (
              <section className="match-experience__panel">
                <div className="match-experience__panel-title">
                  <h2>Formazioni</h2>
                  <p>Titolari e giocatori a disposizione delle due squadre</p>
                </div>
                <div className="match-experience__formations">
                  {[home, away].map((team, index) => {
                    const teamId = index === 0 ? match.home_team_id : match.away_team_id;
                    const teamLineup = lineups.filter((entry) => entry.team_id === teamId)
                      .sort((a, b) => Number(b.starter) - Number(a.starter) ||
                        (a.shirt_number ?? 999) - (b.shirt_number ?? 999));
                    return (
                      <section className="match-experience__formation" key={teamId}>
                        <div className="match-experience__formation-head">
                          {team?.logo_url && <img src={team.logo_url} alt="" />}
                          <h3>{team?.name ?? "Squadra"}</h3>
                        </div>
                        {teamLineup.length ? (
                          <>
                            {([true, false] as const).map((starter) => {
                              const members = teamLineup.filter((entry) => entry.starter === starter);
                              return members.length ? <div className="match-experience__formation-group" key={String(starter)}>
                                <h4>{starter ? "Titolari" : "Panchina"}</h4>
                                {members.map((entry) => {
                                  const player = findPlayer(entry.player_id);
                                  return <div className="match-experience__formation-player" key={entry.id}>
                                    {player?.profile_image_url
                                      ? <img src={player.profile_image_url} alt="" />
                                      : <span className="match-experience__avatar">#{entry.shirt_number ?? "—"}</span>}
                                    <span>{playerName(entry.player_id)}</span>
                                    <strong>#{entry.shirt_number ?? player?.shirt_number ?? "—"}</strong>
                                  </div>;
                                })}
                              </div> : null;
                            })}
                          </>
                        ) : <p className="match-experience__formation-empty">Formazione non ancora disponibile.</p>}
                      </section>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
