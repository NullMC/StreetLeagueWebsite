import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getPlayers, getTeams } from "../lib/api";
import type { Player, Team } from "../types";
export default function PlayerDetail() {
  const { playerId = "" } = useParams();
  const [p, setP] = useState<Player | null>(null),
    [team, setTeam] = useState<Team | null>(null);
  useEffect(() => {
    (async () => {
      const ps = await getPlayers();
      const pp = ps.find((x) => x.id === playerId) || null;
      setP(pp);
      if (pp) {
        const ts = await getTeams();
        setTeam(ts.find((t) => t.id === pp.team_id) || null);
      }
    })();
  }, [playerId]);
  return (
    <PageShell>
      {p ? (
        <>
          <section className="detail-hero" style={{ minHeight: 420 }}>
            <div className="detail-hero__inner">
              {p.bg_less_image_url && (
                <img
                  src={p.bg_less_image_url}
                  alt=""
                  style={{
                    position: "absolute",
                    right: "8%",
                    bottom: 0,
                    height: "92%",
                    maxWidth: "45%",
                    objectFit: "contain",
                  }}
                />
              )}
              <span className="eyebrow">
                Player profile / {team?.name || "—"}
              </span>
              <h1>
                #{p.shirt_number ?? "—"}
                <br />
                {p.first_name}
                <br />
                {p.last_name}
              </h1>
              <div className="detail-meta">
                <span>{p.position || "—"}</span>
                <span>{team?.name || "—"}</span>
              </div>
            </div>
          </section>
          <div className="page">
            <SectionTitle eyebrow="Performance" title="Statistiche" />
            <div className="leaders">
              {["Reti", "Presenze", "Assist", "Gialli", "Rossi", "Falli"].map(
                (x) => (
                  <div className="stat-card" key={x}>
                    <span className="eyebrow">{x}</span>
                    <div className="stat-card__value">—</div>
                  </div>
                ),
              )}
            </div>
            <div className="section">
              <EmptyState
                title="Dati partita"
                text="Le statistiche di ogni partita saranno disponibili qui quando saranno registrate nel database."
              />
            </div>
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState title="Giocatore non trovato" />
        </div>
      )}
    </PageShell>
  );
}
