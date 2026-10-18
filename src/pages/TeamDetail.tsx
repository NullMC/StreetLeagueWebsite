import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faCalendarDays,
  faUserTie,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { MatchCard } from "../components/MatchCard";
import { getActiveCompetitions, getTeams, getPlayers, getMatches } from "../lib/api";
import type { Team, Player, Match } from "../types";

type PerformanceOutcome = "win" | "loss" | "draw";
type TeamSection = "players" | "staff" | "matches" | "performance";

function getPerformanceOutcome(match: Match, teamId: string): {
  outcome: PerformanceOutcome;
  letter: "V" | "S" | "P";
  score: string;
  label: string;
} {
  const isHome = match.home_team_id === teamId;
  const ownScore = (isHome ? match.home_score : match.away_score) ?? 0;
  const opponentScore = (isHome ? match.away_score : match.home_score) ?? 0;
  const outcome: PerformanceOutcome =
    ownScore > opponentScore ? "win" : ownScore < opponentScore ? "loss" : "draw";
  const letter = outcome === "win" ? "V" : outcome === "loss" ? "S" : "P";
  const label =
    outcome === "win" ? "Vittoria" : outcome === "loss" ? "Sconfitta" : "Pareggio";

  return { outcome, letter, score: ownScore + "–" + opponentScore, label };
}

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
  const [performanceMatches, setPerformanceMatches] = useState<Match[]>([]);
  const [selectedSection, setSelectedSection] = useState<TeamSection | null>(null);

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
          const [teamPlayers, allMatches, activeCompetitions] = await Promise.all([
            getPlayers(selectedTeam.id),
            getMatches(),
            getActiveCompetitions(),
          ]);
          if (!mounted) return;

          setPlayers(teamPlayers);

          const teamMatches = allMatches
            .filter((match) =>
              match.home_team_id === selectedTeam.id ||
              match.away_team_id === selectedTeam.id
            );

          const activeCompetitionIds = new Set(
            activeCompetitions.map((competition) => competition.id),
          );
          setMatches(
            teamMatches
              .filter((match) => activeCompetitionIds.has(match.competition_id))
              .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
              .slice(0, 6),
          );

          setPerformanceMatches(
            teamMatches
              .filter((match) => match.home_score != null && match.away_score != null)
              .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
              .slice(0, 5),
          );
        } else {
          setPlayers([]);
          setMatches([]);
          setPerformanceMatches([]);
        }
      } catch (error) {
        console.error("Team detail data error:", error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const isStaffMember = (player: Player) =>
    player.position?.trim().toUpperCase() === "STAFF" ||
    player.role?.trim().toUpperCase() === "STAFF";
  const staffMembers = players.filter(isStaffMember);
  const rosterPlayers = players.filter((player) => !isStaffMember(player));

  return (
    <PageShell>
      {team ? (
        <>
          <section className="detail-hero team-detail-hero">
            <div className="detail-hero__inner">
              <div className="detail-hero__team-heading">
                {team.logo_url ? (
                  <img className="detail-hero__team-logo" src={team.logo_url} alt={team.name} />
                ) : (
                  <span className="detail-hero__team-logo detail-hero__team-logo--placeholder" aria-hidden="true">
                    {team.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <h1>{team.name}</h1>
              </div>
            </div>
          </section>

          <div className="page team-detail-page">
            <nav className="team-detail-shortcuts" aria-label="Sezioni della pagina squadra">
              <button type="button" aria-pressed={selectedSection === "players"} className={selectedSection === "players" ? "is-active" : ""} onClick={() => setSelectedSection("players")}><FontAwesomeIcon icon={faUsers} aria-hidden="true" /><span>Giocatori</span></button>
              <button type="button" aria-pressed={selectedSection === "staff"} className={selectedSection === "staff" ? "is-active" : ""} onClick={() => setSelectedSection("staff")}><FontAwesomeIcon icon={faUserTie} aria-hidden="true" /><span>Membri staff</span></button>
              <button type="button" aria-pressed={selectedSection === "matches"} className={selectedSection === "matches" ? "is-active" : ""} onClick={() => setSelectedSection("matches")}><FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" /><span>Partite</span></button>
              <button type="button" aria-pressed={selectedSection === "performance"} className={selectedSection === "performance" ? "is-active" : ""} onClick={() => setSelectedSection("performance")}><FontAwesomeIcon icon={faChartLine} aria-hidden="true" /><span>Performance</span></button>
            </nav>

            {selectedSection === "players" && (
              <section className="section team-detail-section" id="team-players">
                <SectionTitle eyebrow="" title="Giocatori" variant="subsection" />
                {rosterPlayers.length ? <RosterCards members={rosterPlayers} /> : (
                  <EmptyState title="Roster giocatori vuoto" text="Nessun giocatore senza ruolo STAFF è associato a questa squadra." />
                )}
              </section>
            )}

            {selectedSection === "staff" && (
              <section className="section team-detail-section team-staff-section" id="team-staff">
                <SectionTitle eyebrow="" title="Membri staff" variant="subsection" />
                {staffMembers.length ? <RosterCards members={staffMembers} staff /> : (
                  <EmptyState title="Nessun membro staff" text="I membri con ruolo STAFF appariranno qui quando saranno registrati per questa squadra." />
                )}
              </section>
            )}

            {selectedSection === "matches" && (
              <section className="section team-detail-section" id="team-matches">
                <SectionTitle eyebrow="" title="Partite" variant="subsection" />
                {matches.length ? (
                  <div className="match-grid">
                    {matches.map((match) => {
                      const home = allTeams.find((item) => item.id === match.home_team_id);
                      const away = allTeams.find((item) => item.id === match.away_team_id);
                      return <MatchCard key={match.id} match={match} home={home} away={away} />;
                    })}
                  </div>
                ) : (
                  <EmptyState title="Nessuna partita" text="Non risultano partite nelle competizioni attive per questa squadra." />
                )}
              </section>
            )}

            {selectedSection === "performance" && (
              <section className="section team-detail-section team-performance" id="team-performance">
                <SectionTitle eyebrow="" title="Performance" variant="subsection" />
                {performanceMatches.length ? (
                  <>
                    <p className="team-performance__description">Ultime {performanceMatches.length} partite disputate.</p>
                    <div className="team-performance__results" aria-label="Risultati ultime partite">
                      {performanceMatches.map((match) => {
                        const result = getPerformanceOutcome(match, team.id);
                        const home = allTeams.find((item) => item.id === match.home_team_id);
                        const away = allTeams.find((item) => item.id === match.away_team_id);
                        const matchDate = new Date(match.kickoff_at);
                        const dateLabel = Number.isNaN(matchDate.getTime())
                          ? ""
                          : matchDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
                        const ariaLabel = result.label + " " + (home?.name ?? "Casa") + " " +
                          (match.home_score ?? 0) + " a " + (match.away_score ?? 0) + " " +
                          (away?.name ?? "Ospite");

                        return (
                          <a
                            className={`team-performance__result team-performance__result--${result.outcome}`}
                            key={match.id}
                            href={`/partite/${match.id}`}
                            aria-label={ariaLabel}
                            title={ariaLabel}
                          >
                            <span className="team-performance__result-letter">{result.letter}</span>
                            <span className="team-performance__result-score">{result.score}</span>
                            {dateLabel ? <span className="team-performance__result-date">{dateLabel}</span> : null}
                          </a>
                        );
                      })}
                    </div>
                    <div className="team-performance__legend" aria-label="Legenda performance">
                      <span><i className="team-performance__legend-mark team-performance__legend-mark--win" />Vittoria</span>
                      <span><i className="team-performance__legend-mark team-performance__legend-mark--loss" />Sconfitta</span>
                      <span><i className="team-performance__legend-mark team-performance__legend-mark--draw" />Pareggio</span>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Nessuna performance disponibile" text="I risultati appariranno qui quando saranno registrati i punteggi delle partite disputate." />
                )}
              </section>
            )}
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
