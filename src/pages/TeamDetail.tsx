import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetitions, getTeams, getPlayers, getMatches } from "../lib/api";
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
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const teams = await getTeams();
        const selectedTeam = teams.find((item) => item.id === teamId) || null;
        if (!mounted) return;
        setAllTeams(teams);
        setTeam(selectedTeam);
        if (selectedTeam) {
          const activeCompetitions = await getActiveCompetitions();
          const [teamPlayers, matchesByCompetition] = await Promise.all([
            getPlayers(selectedTeam.id),
            Promise.all(activeCompetitions.map((competition) => getMatches(competition.id))),
          ]);
          if (!mounted) return;
          setPlayers(teamPlayers);
          setMatches(
            matchesByCompetition
              .flat()
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

  // Nel back office il ruolo viene salvato nel campo "position"; "role"
  // resta supportato per compatibilità con record o versioni precedenti.
  const isStaffMember = (player: Player) =>
    player.position?.trim().toUpperCase() === "STAFF" ||
    player.role?.trim().toUpperCase() === "STAFF";
  const staffMembers = players.filter(isStaffMember);
  const rosterPlayers = players.filter((player) => !isStaffMember(player));

  return (
    <PageShell>
      {team ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">Profilo squadra</span>
              <h1>{team.name}</h1>
            </div>
          </section>
          <div className="page">
            <SectionTitle eyebrow="" title="Giocatori" variant="subsection" />
            {rosterPlayers.length ? (
              <RosterCards members={rosterPlayers} />
            ) : (
              <EmptyState title="Roster giocatori vuoto" text="Nessun giocatore senza ruolo STAFF è associato a questa squadra." />
            )}

            <section className="section team-staff-section">
              <SectionTitle eyebrow="" title="Membri staff" variant="subsection" />
              {staffMembers.length ? (
                <RosterCards members={staffMembers} staff />
              ) : (
                <EmptyState title="Nessun membro staff" text="I membri con ruolo STAFF appariranno qui quando saranno registrati per questa squadra." />
              )}
            </section>

            <section className="section">
              <SectionTitle eyebrow="" title="Partite" variant="subsection" />
              {matches.length ? (
                <div className="match-grid">
                  {matches.map((match) => (
                    <a key={match.id} className="match-card" href={`/partite/${match.id}`}>
                      <div className="match-card__meta">
                        <span>{new Date(match.kickoff_at).toLocaleDateString("it-IT")}</span>
                        <span>{match.matchday || "—"}</span>
                      </div>
                      <div className="match-card__teams">
                        {[
                          allTeams.find((item) => item.id === match.home_team_id),
                          allTeams.find((item) => item.id === match.away_team_id),
                        ].map((matchTeam, index) => (
                          <div
                            className={`match-card__team${index === 1 ? " match-card__team--away" : ""}`}
                            key={matchTeam?.id ?? `${match.id}-team-${index}`}
                          >
                            {matchTeam?.logo_url ? (
                              <img
                                className="match-card__team-logo"
                                src={matchTeam.logo_url}
                                alt={`Logo ${matchTeam.name}`}
                              />
                            ) : (
                              <span className="match-card__team-logo match-card__team-logo--placeholder" aria-hidden="true">
                                {(matchTeam?.name ?? "?").slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <div className="match-card__team-copy">
                              <b>{matchTeam?.name ?? "Squadra non disponibile"}</b>
                              <small>{index === 0 ? "Casa" : "Trasferta"}</small>
                            </div>
                          </div>
                        ))}
                        <strong>
                          {match.status === "scheduled"
                            ? "VS"
                            : `${match.home_score ?? "—"} : ${match.away_score ?? "—"}`}
                        </strong>
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
