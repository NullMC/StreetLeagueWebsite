import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getPlayers, getTeams, getPlayerStats } from "../lib/api";
import type { Player, Team, PlayerStats } from "../types";

export default function PlayerDetail() {
  const { playerId = "" } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const players = await getPlayers();
        const current = players.find((item) => item.id === playerId) ?? null;

        if (!mounted) return;
        setPlayer(current);

        if (!current) return;

        const [teams, currentStats] = await Promise.all([
          getTeams(),
          getPlayerStats(current.id),
        ]);

        if (!mounted) return;

        setTeam(teams.find((item) => item.id === current.team_id) ?? null);
        setStats(currentStats);
      } catch {
        if (mounted) {
          setPlayer(null);
          setStats(null);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [playerId]);

  return (
    <PageShell>
      {player ? (
        <>
          <section className="detail-hero" style={{ minHeight: 420 }}>
            <div className="detail-hero__inner">
              {player.bg_less_image_url && (
                <img
                  src={player.bg_less_image_url}
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
                #{player.shirt_number ?? "—"}
                <br />
                {player.first_name}
                <br />
                {player.last_name}
              </h1>

              <div className="detail-meta">
                <span>{player.position || "—"}</span>
                <span>{team?.name || "—"}</span>
              </div>
            </div>
          </section>

          <div className="page">
            <SectionTitle eyebrow="Performance" title="Statistiche" />

            {!stats ? (
              <EmptyState
                title="Statistiche non disponibili"
                text="Non è stato possibile calcolare i dati del giocatore."
              />
            ) : (
              <div className="leaders">
                {[
                  ["Reti", stats.goals],
                  ["Presenze", stats.appearances],
                  ["Assist", stats.assists],
                  ["Gialli", stats.yellow_cards],
                  ["Rossi", stats.red_cards],
                  ["Falli", stats.fouls],
                  ["Clean sheets", stats.clean_sheets],
                  ["MVP", stats.mvps],
                ].map(([label, value]) => (
                  <div className="stat-card" key={String(label)}>
                    <span className="eyebrow">{label}</span>
                    <div className="stat-card__value">{value}</div>
                  </div>
                ))}
              </div>
            )}
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
