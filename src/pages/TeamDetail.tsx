import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getTeams, getPlayers, getMatches } from "../lib/api";
import type { Team, Player, Match } from "../types";

function RosterCards({ members, staff = false }: { members: Player[]; staff?: boolean }) {
  return (
    <div className="cards-grid">
      {members.map((player) => {
        const image = player.profile_image_url || player.bg_less_image_url;
        return (
          <a
            className={`stat-card team-roster-card${staff ? " team-roster-card--staff" : ""}`}
            href={`/giocatori/${player.id}`}
            key={player.id}
          >
            {image && (
              <span className="player-card__photo" aria-hidden="true">
                <img
                  src={image}
                  alt=""
                  className={player.profile_image_url
                    ? "player-card__photo-image"
                    : "player-card__photo-image player-card__photo-image--cutout"}
                />
              </span>
            )}
            <div className="player-card__content">
              <span className="eyebrow">
                {staff ? "Membro staff" : `#${player.shirt_number ?? "—"} / ${player.position || "Giocatore"}`}
              </span>
              <h3>
                {player.first_name}
                <br />
                {player.last_name}
              </h3>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default function TeamDetail() {
  const { teamId = "" } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const teams = await getTeams();
        const selectedTeam = teams.find((item) => item.id === teamId) || null;
        if (!mounted) return;
        setTeam(selectedTeam);
        if (selectedTeam) {
          const [teamPlayers, teamMatches] = await Promise.all([
            getPlayers(selectedTeam.id),
            getMatches(),
          ]);
          if (!mounted) return;
          setPlayers(teamPlayers);
          setMatches(
            teamMatches
              .filter((match) => match.home_team_id === selectedTeam.id || match.away_team_id === selectedTeam.id)
              .slice(0, 6),
          );
        }
      } catch (error) {
        console.error("Team detail data error:", error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const staffMembers = players.filter((player) => player.role?.trim().toUpperCase() === "STAFF");
  const rosterPlayers = players.filter((player) => player.role?.trim().toUpperCase() !== "STAFF");

  return (
    <PageShell>
      {team ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">Club profile</span>
              <h1>{team.name}</h1>
            </div>
          </section>
          <div className="page">
            <SectionTitle eyebrow="Roster" title="Giocatori" variant="subsection" />
            {rosterPlayers.length ? (
              <RosterCards members={rosterPlayers} />
            ) : (
              <EmptyState title="Roster giocatori vuoto" text="Nessun giocatore senza ruolo STAFF è associato a questa squadra." />
            )}

            <section className="section team-staff-section">
              <SectionTitle eyebrow="Roster" title="Membri staff" variant="subsection" />
              {staffMembers.length ? (
                <RosterCards members={staffMembers} staff />
              ) : (
                <EmptyState title="Nessun membro staff" text="I membri con ruolo STAFF appariranno qui quando saranno registrati per questa squadra." />
              )}
            </section>

            <section className="section">
              <SectionTitle eyebrow="History" title="Partite" variant="subsection" />
              {matches.length ? (
                <div className="match-grid">
                  {matches.map((match) => (
                    <a key={match.id} className="match-card" href={`/partite/${match.id}`}>
                      <div className="match-card__meta">
                        <span>{new Date(match.kickoff_at).toLocaleDateString("it-IT")}</span>
                        <span>{match.matchday || "—"}</span>
                      </div>
                      <div className="match-card__teams">
                        <div><b>{match.home_team_id === team.id ? team.name : "—"}</b></div>
                        <strong>
                          {match.status === "scheduled"
                            ? "VS"
                            : `${match.home_score ?? "—"} : ${match.away_score ?? "—"}`}
                        </strong>
                        <div className="right"><b>{match.away_team_id === team.id ? team.name : "—"}</b></div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nessuna partita" />
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState title="Squadra non trovata" text="Il riferimento non corrisponde a una squadra presente nel database." />
        </div>
      )}
    </PageShell>
  );
}
