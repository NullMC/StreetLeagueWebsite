import type { Match, Team } from "../types";
import { day } from "../lib/format";
export function MatchCard({
  match,
  home,
  away,
}: {
  match: Match;
  home?: Team;
  away?: Team;
}) {
  return (
    <a href={`/partite/${match.id}`} className="match-card">
      <div className="match-card__meta">
        <span>{day(match.kickoff_at)}</span>
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
            <small>Casa</small>
          </div>
        </div>
        <strong className="match-card__score">
          {match.status === "scheduled"
            ? "VS"
            : `${match.home_score ?? "—"} : ${match.away_score ?? "—"}`}
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
            <small>Trasferta</small>
          </div>
        </div>
      </div>
      <div className={`match-card__status status-${match.status}`}>
        {match.status === "live"
          ? "LIVE"
          : match.status === "finished"
            ? "TERMINATA"
            : match.status === "postponed"
              ? "RINVIATA"
              : "PROGRAMMATA"}
      </div>
    </a>
  );
}
