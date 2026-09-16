import type { PlayerOfMonth } from "../lib/playerOfMonth";
import type { Team } from "../types";

export function PlayerOfMonthCard({
  item,
  teams,
}: {
  item: PlayerOfMonth | null;
  teams: Team[];
}) {
  if (!item?.player) {
    return (
      <div className="potm-empty">
        <span className="eyebrow">POTM</span>
        <h3>Player of the Month non ancora assegnato</h3>
        <p>Il riconoscimento verrà mostrato qui quando sarà pubblicato.</p>
      </div>
    );
  }

  const player = item.player;
  const team = teams.find((entry) => entry.id === player.team_id);
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();

  return (
    <article className="potm-card">
      <div className="potm-card__visual">
        <span className="potm-card__badge">POTM</span>
        <div className="potm-card__avatar" aria-hidden="true">
          {initials}
        </div>
      </div>
      <div className="potm-card__content">
        <span className="eyebrow">Player of the Month · {item.month_label}</span>
        <h3>{player.first_name} {player.last_name}</h3>
        <div className="potm-card__meta">
          {player.shirt_number != null ? <span>#{player.shirt_number}</span> : null}
          {player.position ? <span>{player.position}</span> : null}
          {team ? <span>{team.name}</span> : null}
        </div>
        {item.note ? <p>{item.note}</p> : null}
        <a className="btn btn--ghost" href={`/giocatori/${player.id}`}>
          Profilo giocatore <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
