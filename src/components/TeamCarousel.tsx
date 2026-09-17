import { useRef } from "react";
import type { Team } from "../types";

export function TeamCarousel({
  teams,
  label = "Squadre",
}: {
  teams: Team[];
  label?: string;
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
        {teams.map((team) => (
          <a className="team-carousel__item" href={`/squadre/${team.id}`} key={team.id}>
            <span className="team-carousel__logo" style={{ padding: 0 }}>
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%", display: "block" }}
                />
              ) : (
                <span aria-hidden="true">{team.name.slice(0, 3).toUpperCase()}</span>
              )}
            </span>
            <span className="team-carousel__name">{team.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
