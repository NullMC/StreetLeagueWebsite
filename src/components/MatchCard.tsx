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
        <div>
          <b>{home?.name || "—"}</b>
          <small>{home?.name || "Squadra"}</small>
        </div>
        <strong>
          {match.status === "scheduled"
            ? "VS"
            : `${match.home_score ?? "—"} : ${match.away_score ?? "—"}`}
        </strong>
        <div className="right">
          <b>{away?.name || "—"}</b>
          <small>{away?.name || "Squadra"}</small>
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
