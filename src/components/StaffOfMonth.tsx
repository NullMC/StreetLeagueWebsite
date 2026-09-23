import type { StaffRankingEntry } from "../types";

export function StaffOfMonthCard({
  items,
  monthLabel,
}: {
  items: StaffRankingEntry[];
  monthLabel: string;
}) {
  const top = items[0];

  if (!top) {
    return (
      <div className="staff-month-empty">
        <span className="eyebrow">Staff of the Month · {monthLabel}</span>
        <h3>Nessun rigore presidenziale registrato</h3>
        <p>Il riconoscimento verrà valorizzato automaticamente quando saranno registrati i rigori presidenziali del mese.</p>
      </div>
    );
  }

  const initials =
    (top.player.first_name[0] ?? "") +
    (top.player.last_name[0] ?? "");

  return (
    <article className="staff-month-card">
      <div className="staff-month-card__visual">
        <span className="staff-month-card__badge">STAFF OF THE MONTH</span>
        <div className="staff-month-card__avatar" aria-hidden="true">
          {initials.toUpperCase()}
        </div>
      </div>
      <div className="staff-month-card__content">
        <span className="eyebrow">Miglior membro staff · {monthLabel}</span>
        <h3>{top.player.first_name} {top.player.last_name}</h3>
        <div className="staff-month-card__stat">{top.presidential_penalties}</div>
        <span className="staff-month-card__label">rigori presidenziali</span>
        <div className="rank-list">
          {[0, 1, 2].map((index) => {
            const entry = items[index];
            return (
              <div className="rank-row" key={entry?.player.id ?? ("staff-" + index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  {entry
                    ? entry.player.first_name + " " + entry.player.last_name
                    : "—"}
                </span>
                <strong>{entry?.presidential_penalties ?? "—"}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
