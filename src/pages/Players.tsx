import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetition, getTeams, getPlayers } from "../lib/api";
import type { Player, Team } from "../types";
export default function Players() {
  const [items, setItems] = useState<Player[]>([]),
    [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    (async () => {
      const c = await getActiveCompetition();
      const ts = await getTeams(c?.id);
      setTeams(ts);
      const all = (await Promise.all(ts.map((t) => getPlayers(t.id)))).flat();
      setItems(all);
    })();
  }, []);
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="Roster" title="Giocatori" />
        {items.length ? (
          <div className="cards-grid">
            {items.map((p) => (
              <a className="stat-card" href={`/giocatori/${p.id}`} key={p.id}>
                {(p.profile_image_url || p.bg_less_image_url) && (
                  <span className="player-card__photo" aria-hidden="true">
                    <img
                      src={p.profile_image_url || p.bg_less_image_url || ""}
                      alt=""
                      className={
                        p.profile_image_url
                          ? "player-card__photo-image"
                          : "player-card__photo-image player-card__photo-image--cutout"
                      }
                    />
                  </span>
                )}
                <div className="player-card__content">
                  <span className="eyebrow">
                    #{p.shirt_number ?? "—"} / {p.position || "Player"}
                  </span>
                <h3>
                  {p.first_name}
                  <br />
                  {p.last_name}
                </h3>
                  <p style={{ color: "var(--muted)" }}>
                    {teams.find((t) => t.id === p.team_id)?.name || "—"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessun giocatore"
            text="I giocatori registrati nel database compariranno qui."
          />
        )}
      </div>
    </PageShell>
  );
}
