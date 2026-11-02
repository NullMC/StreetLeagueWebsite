import type { CSSProperties } from "react";
import type { Match, Team } from "../types";
import { day } from "../lib/format";

function TeamSide({
  team,
  side,
  outcome,
}: {
  team?: Team;
  side: "home" | "away";
  outcome: "win" | "loss" | "draw" | null;
}) {
  return (
    <div
      className={`slm__team slm__team--${side}${outcome ? ` is-${outcome}` : ""}`}
    >
      {team?.logo_url ? (
        <img
          className="slm__logo"
          src={team.logo_url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="slm__logo slm__logo--placeholder" aria-hidden="true">
          {team?.name?.slice(0, 1).toUpperCase() ?? "?"}
        </span>
      )}
      <b className="slm__name">{team?.name || "—"}</b>
    </div>
  );
}

export function MatchCard({
  match,
  home,
  away,
  compact = false,
}: {
  match: Match;
  home?: Team;
  away?: Team;
  compact?: boolean;
}) {
  const kickoffTime =
    match.kickoff_at &&
    /T\d{2}:\d{2}/.test(match.kickoff_at) &&
    !Number.isNaN(new Date(match.kickoff_at).getTime())
      ? new Intl.DateTimeFormat("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(match.kickoff_at))
      : null;

  const hasScore = match.status !== "scheduled";
  const homeScore = match.home_score;
  const awayScore = match.away_score;
  const decided =
    match.status === "finished" && homeScore != null && awayScore != null;
  const homeOutcome = decided
    ? homeScore! > awayScore!
      ? "win"
      : homeScore! < awayScore!
        ? "loss"
        : "draw"
    : null;
  const awayOutcome = decided
    ? awayScore! > homeScore!
      ? "win"
      : awayScore! < homeScore!
        ? "loss"
        : "draw"
    : null;

  const style = {
    "--home-accent": home?.accent_hex || "var(--sl-accent)",
    "--away-accent": away?.accent_hex || "var(--sl-accent-2)",
  } as CSSProperties;

  return (
    <article
      className={`slm slm--${match.status}${compact ? " slm--compact" : ""}`}
      data-spotlight
      style={style}
    >
      <a
        className="slm__link"
        href={`/partite/${match.id}`}
        aria-label={`Apri la partita ${home?.name ?? "Casa"} - ${away?.name ?? "Ospiti"}`}
      />
      {match.status === "live" ? (
        <span className="slm__beam" aria-hidden="true" />
      ) : null}
      <div className="slm__meta">
        <span className="slm__when">
          <span>{day(match.kickoff_at)}</span>
          {kickoffTime && (
            <time
              className="slm__time"
              dateTime={match.kickoff_at ?? undefined}
            >
              {kickoffTime}
            </time>
          )}
        </span>
        <span className="slm__round">{match.matchday || "CALENDARIO"}</span>
      </div>

      <div className="slm__teams">
        <TeamSide team={home} side="home" outcome={homeOutcome} />
        <strong className={`slm__score${hasScore ? "" : " slm__score--vs"}`}>
          {hasScore ? (
            <>
              <span>{homeScore ?? "—"}</span>
              <span className="slm__sep"> : </span>
              <span>{awayScore ?? "—"}</span>
            </>
          ) : (
            <span className="slm__vs">VS</span>
          )}
        </strong>
        <TeamSide team={away} side="away" outcome={awayOutcome} />
      </div>

      <div className="slm__foot">
        <span className={`slm__status slm__status--${match.status}`}>
          {match.status === "live" ? (
            <span className="slm__pulse" aria-hidden="true" />
          ) : null}
          {match.status === "live"
            ? "LIVE"
            : match.status === "finished"
              ? "TERMINATA"
              : match.status === "postponed"
                ? "RINVIATA"
                : "PROGRAMMATA"}
        </span>
        <span className="slm__venue" aria-label="Stadio Di Cagno Abbrescia">
          <svg
            className="slm__venue-icon"
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
        {match.photo_drive_url && !compact ? (
          <a
            className="slm__gallery"
            href={match.photo_drive_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Photo Gallery: ${home?.name ?? "Casa"} - ${away?.name ?? "Ospiti"}`}
          >
            <span aria-hidden="true">▧</span> Photo Gallery{" "}
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
