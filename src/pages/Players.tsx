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
                {p.bg_less_image_url && (
                  <img
                    src={p.bg_less_image_url}
                    alt=""
                    style={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      maxHeight: "92%",
                      maxWidth: "52%",
                      objectFit: "contain",
                    }}
                  />
                )}
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
