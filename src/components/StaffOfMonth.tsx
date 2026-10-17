import type { StaffOfMonth } from "../lib/playerOfMonth";

export function StaffOfMonthCard({
  item,
  monthLabel,
}: {
  item: StaffOfMonth | null;
  monthLabel: string;
}) {
  if (!item?.player) {
    return (
      <div className="monthly-award-card monthly-award-card--empty">
        
        <div className="monthly-award-card__content">
          
          <h3>Staff del mese non ancora assegnato</h3>
          <p>Puoi assegnarlo dal back office nella stessa sezione del POTM.</p>
        </div>
      </div>
    );
  }

  const staff = item.player;
  const initials = `${staff.first_name[0] ?? ""}${staff.last_name[0] ?? ""}`.toUpperCase();

  return (
    <a className="monthly-award-card" href={`/giocatori/${staff.id}`} aria-label={`Apri il profilo staff di ${staff.first_name} ${staff.last_name}`}>
      {item.card_image_url ? (
        <img className="monthly-award-card__background" src={item.card_image_url} alt="" aria-hidden="true" loading="lazy" />
      ) : (
        <div className="monthly-award-card__background monthly-award-card__background--fallback" aria-hidden="true">
          <span>{initials}</span>
        </div>
      )}
      <div className="monthly-award-card__shade" aria-hidden="true" />
      <span className="monthly-award-card__badge">STAFF OF THE MONTH</span>
      <div className="monthly-award-card__content">
        <span className="eyebrow">Staff of the Month · {item.month_label}</span>
        <h3>{staff.first_name} {staff.last_name}</h3>
        <div className="monthly-award-card__meta">
          <span>STAFF</span>
          {staff.position && staff.position.toUpperCase() !== "STAFF" ? <span>{staff.position}</span> : null}
        </div>
        {item.note ? <p>{item.note}</p> : null}
        <span className="monthly-award-card__cta">Profilo staff <span aria-hidden="true">↗</span></span>
      </div>
    </a>
  );
}
