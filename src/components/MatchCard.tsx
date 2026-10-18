import type { Match, Team } from "../types";
import { day } from "../lib/format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStadium } from "@fortawesome/free-solid-svg-icons";

export function MatchCard({
  match,
  home,
  away,
}: {
  match: Match;
  home?: Team;
  away?: Team;
}) {
  const kickoffTime =
    match.kickoff_at && /T\d{2}:\d{2}/.test(match.kickoff_at) && !Number.isNaN(new Date(match.kickoff_at).getTime())
      ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(match.kickoff_at))
      : null;

  return (
    <a href={`/partite/${match.id}`} className="match-card">
      <div className="match-card__meta">
        <span className="match-card__date-time">
          <span>{day(match.kickoff_at)}</span>
          {kickoffTime && (
            <time className="match-card__time" dateTime={match.kickoff_at ?? undefined}>
              {kickoffTime}
            </time>
          )}
        </span>
        <span>{match.matchday || "CALENDARIO"}</span>
      </div>
      <div className="match-card__teams">
        <div className="match-card__team match-card__team--home">
          {home?.logo_url ? (
            <img
              className="match-card__team-logo"
              src={home.logo_url}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span className="match-card__team-logo match-card__team-logo--placeholder" aria-hidden="true">
              {home?.name?.slice(0, 1).toUpperCase() ?? "?"}
            </span>
          )}
          <div className="match-card__team-copy">
            <b>{home?.name || "—"}</b>
          </div>
        </div>

        <strong className="match-card__score">
          {match.status === "scheduled" ? (
            <span className="match-card__score-vs">VS</span>
          ) : (
            `${match.home_score ?? "—"} : ${match.away_score ?? "—"}`
          )}
        </strong>

        <div className="match-card__team match-card__team--away right">
          {away?.logo_url ? (
            <img
              className="match-card__team-logo"
              src={away.logo_url}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span className="match-card__team-logo match-card__team-logo--placeholder" aria-hidden="true">
              {away?.name?.slice(0, 1).toUpperCase() ?? "?"}
            </span>
          )}
          <div className="match-card__team-copy">
            <b>{away?.name || "—"}</b>
          </div>
        </div>
      </div>
      <div className="match-card__footer">
        <div className={`match-card__status status-${match.status}`}>
          {match.status === "live"
            ? "LIVE"
            : match.status === "finished"
              ? "TERMINATA"
              : match.status === "postponed"
                ? "RINVIATA"
                : "PROGRAMMATA"}
        </div>
        <span className="match-card__venue" aria-label="Stadio Di Cagno Abbrescia">
          <FontAwesomeIcon icon={faStadium} aria-hidden="true" />
          <span>Di Cagno Abbrescia</span>
        </span>
      </div>
    </a>
  );
}
