import type { Team } from "../types";
export function TeamCard({ team }: { team: Team }) {
  return (
    <a href={`/squadre/${team.id}`} className="team-card">
      <div className="team-card__visual">
        {team.logo_url ? (
          <img src={team.logo_url} alt="" />
        ) : (
          <span>{team.name.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="team-card__body">
        <span>{team.slug || ""}</span>
        <h3>{team.name}</h3>
        <div className="team-card__arrow">↗</div>
      </div>
    </a>
  );
}
