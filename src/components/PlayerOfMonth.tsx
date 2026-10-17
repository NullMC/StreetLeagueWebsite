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
      <div className="monthly-award-card monthly-award-card--empty">
        <span className="monthly-award-card__badge">POTM</span>
        <div className="monthly-award-card__content">
          <span className="eyebrow">Player of the Month</span>
          <h3>Player of the Month non ancora assegnato</h3>
          <p>Il riconoscimento verrà mostrato qui quando sarà pubblicato.</p>
        </div>
      </div>
    );
  }

  const player = item.player;
  const team = teams.find((entry) => entry.id === player.team_id);
  const initials = `${player.first_name[0] ?? ""}${player.last_name[0] ?? ""}`.toUpperCase();

  return (
    <a className="monthly-award-card" href={`/giocatori/${player.id}`} aria-label={`Apri il profilo di ${player.first_name} ${player.last_name}`}>
      {item.card_image_url ? (
        <img className="monthly-award-card__background" src={item.card_image_url} alt="" aria-hidden="true" loading="lazy" />
      ) : (
        <div className="monthly-award-card__background monthly-award-card__background--fallback" aria-hidden="true">
          <span>{initials}</span>
        </div>
      )}
      <div className="monthly-award-card__shade" aria-hidden="true" />
      <span className="monthly-award-card__badge">POTM</span>
      <div className="monthly-award-card__content">
        <span className="eyebrow">Player of the Month · {item.month_label}</span>
        <h3>{player.first_name} {player.last_name}</h3>
        <div className="monthly-award-card__meta">
          {player.shirt_number != null ? <span>#{player.shirt_number}</span> : null}
          {player.position ? <span>{player.position}</span> : null}
          {team ? <span>{team.name}</span> : null}
        </div>
        {item.note ? <p>{item.note}</p> : null}
        <span className="monthly-award-card__cta">Profilo giocatore <span aria-hidden="true">↗</span></span>
      </div>
    </a>
  );
}
