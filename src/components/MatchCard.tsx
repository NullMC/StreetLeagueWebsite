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
  const kickoffTime =
    match.kickoff_at && /T\d{2}:\d{2}/.test(match.kickoff_at) && !Number.isNaN(new Date(match.kickoff_at).getTime())
      ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(match.kickoff_at))
      : null;

  return (
    <article className="match-card">
      <a
        className="match-card__primary-link"
        href={`/partite/${match.id}`}
        aria-label={`Apri la partita ${home?.name ?? "Casa"} - ${away?.name ?? "Ospiti"}`}
      />
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
          <svg
            className="match-card__stadium-icon"
            viewBox="0 0 32 20"
            width="15"
            height="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1" y="1" width="30" height="18" rx="0.7" />
            <path d="M16 1v18" />
            <circle cx="16" cy="10" r="3" />
            <path d="M1 5h4v10H1M31 5h-4v10h4" />
          </svg>
          <span>Di Cagno Abbrescia</span>
        </span>
        {match.photo_drive_url ? (
          <a
            className="match-card__photo-gallery"
            href={match.photo_drive_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Photo Gallery: ${home?.name ?? "Casa"} - ${away?.name ?? "Ospiti"} (Google Drive)`}
          >
            <span aria-hidden="true">▧</span> Photo Gallery <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
