import { useRef } from "react";
import type { Team } from "../types";

export function TeamCarousel({
  teams,
  label = "Squadre",
  onSelect,
  selectedTeamId,
}: {
  teams: Team[];
  label?: string;
  onSelect?: (team: Team) => void;
  selectedTeamId?: string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "prev" | "next") => {
    trackRef.current?.scrollBy({
      left: direction === "next" ? 280 : -280,
      behavior: "smooth",
    });
  };

  return (
    <div className="team-carousel" aria-label={label}>
      <div className="team-carousel__controls">
        <button type="button" onClick={() => scroll("prev")} aria-label="Squadre precedenti">
          ←
        </button>
        <button type="button" onClick={() => scroll("next")} aria-label="Squadre successive">
          →
        </button>
      </div>
      <div className="team-carousel__viewport" ref={trackRef} tabIndex={0}>
        {teams.map((team) => {
          const content = (
            <>
              <span className="team-carousel__logo">
                {team.logo_url ? (
                  <img src={team.logo_url} alt="" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{team.name.slice(0, 3).toUpperCase()}</span>
                )}
              </span>
              <span className="team-carousel__name">{team.name}</span>
            </>
          );

          return onSelect ? (
            <button
              className={
                "team-carousel__item team-carousel__item--selectable" +
                (selectedTeamId === team.id ? " is-selected" : "")
              }
              type="button"
              key={team.id}
              aria-pressed={selectedTeamId === team.id}
              onClick={() => onSelect(team)}
            >
              {content}
            </button>
          ) : (
            <a className="team-carousel__item" href={"/squadre/" + team.id} key={team.id}>
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
