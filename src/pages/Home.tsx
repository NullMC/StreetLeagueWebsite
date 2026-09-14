import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { DataGate } from "../components/DataGate";
import { MatchCard } from "../components/MatchCard";
import { TeamCard } from "../components/TeamCard";
import { EmptyState } from "../components/EmptyState";
import {
  calculateStandings,
  getActiveCompetition,
  getMatches,
  getTeams,
  getPartners,
  getSocialContent,
  subscribeToCompetition,
} from "../lib/api";
import type {
  Competition,
  Match,
  Team,
  Partner,
  SocialContent,
} from "../types";

export default function Home() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [social, setSocial] = useState<SocialContent[]>([]);

  const load = async () => {
    try {
      const active = await getActiveCompetition();
      setCompetition(active);
      setMatches(await getMatches(active?.id));
      setTeams(await getTeams(active?.id));
      setPartners(await getPartners());
      setSocial(await getSocialContent());
    } catch (error) {
      console.error("Home data error:", error);
      setCompetition(null);
      setMatches([]);
      setTeams([]);
      setPartners([]);
      setSocial([]);
    }
  };

  useEffect(() => {
    void load();
    return subscribeToCompetition(() => void load());
  }, []);

  const upcoming = useMemo(() => matches.slice(0, 6), [matches]);
  const standings = useMemo(
    () => calculateStandings(teams, matches),
    [teams, matches],
  );

  const heroBackground =
    competition?.hero_image_url || "/assets/nebula-landscape.jpg";

  const topScorers = useMemo(() => {
    const counts = new Map<string, number>();
    return counts;
  }, []);

  return (
    <PageShell>
      <section
        className="hero hero--brand"
        style={{ "--hero-image": `url("${heroBackground}")` } as CSSProperties}
        aria-labelledby="home-hero-title"
      >
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-brand-lockup">
              <img
                className="hero-brand-lockup__mark"
                src="/assets/favicon.png"
                alt=""
                aria-hidden="true"
              />
              <img
                className="hero-brand-lockup__wordmark"
                src="/assets/street-league-logo.png"
                alt="Street League"
                id="home-hero-title"
              />
              <span className="hero-brand-lockup__subline">
                Football tournament / live platform
              </span>
            </div>

            <div className="hero-actions">
              <a className="btn btn--primary" href="/partite">
                Calendario
              </a>
              <a className="btn btn--ghost" href="/classifica">
                Classifica
              </a>
            </div>
          </div>

          <div className="hero-data-panels" aria-label="Dati della competizione">
            <section className="hero-calendar" id="home-matches" aria-labelledby="home-matches-title">
              <div className="hero-calendar__header">
                <div>
                  <span className="eyebrow">Next matches</span>
                  <h2 id="home-matches-title">Calendario</h2>
                </div>
                <a className="hero-calendar__all" href="/partite">
                  Vedi tutte
                </a>
              </div>

              {upcoming.length ? (
                <div className="hero-calendar__list">
                  {upcoming.slice(0, 3).map((match) => {
                    const home = teams.find((team) => team.id === match.home_team_id);
                    const away = teams.find((team) => team.id === match.away_team_id);

                    return (
                      <a
                        key={match.id}
                        href={`/partite/${match.id}`}
                        className="hero-match"
                      >
                        <div className="hero-match__meta">
                          <span>
                            {new Date(match.kickoff_at).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                          <span>
                            {new Date(match.kickoff_at).toLocaleTimeString("it-IT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div className="hero-match__teams">
                          <div className="hero-match__team">
                            {home?.logo_url ? (
                              <img src={home.logo_url} alt="" />
                            ) : (
                              <span className="hero-match__logo-placeholder" />
                            )}
                            <span>{home?.short_name || home?.name || "—"}</span>
                          </div>

                          <span className="hero-match__vs">VS</span>

                          <div className="hero-match__team hero-match__team--away">
                            <span>{away?.short_name || away?.name || "—"}</span>
                            {away?.logo_url ? (
                              <img src={away.logo_url} alt="" />
                            ) : (
                              <span className="hero-match__logo-placeholder" />
                            )}
                          </div>
                        </div>

                        <div className="hero-match__footer">
                          <span>
                            {match.matchday ? `Giornata ${match.matchday}` : "Match"}
                          </span>
                          <span className="hero-match__arrow">→</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="hero-calendar__empty">
                  <span className="eyebrow">Upcoming</span>
                  <h3>Nessuna partita programmata</h3>
                  <p>
                    {competition
                      ? "Le prossime partite verranno mostrate qui."
                      : "Competizione non ancora iniziata."}
                  </p>
                </div>
              )}
            </section>

            <section className="hero-standings" id="home-standings" aria-labelledby="home-standings-title">
              <div className="hero-standings__header">
                <div>
                  <span className="eyebrow">Live ranking</span>
                  <h2 id="home-standings-title">Classifica</h2>
                </div>
                <a className="hero-calendar__all" href="/classifica">
                  Completa
                </a>
              </div>

              {standings.length ? (
                <div className="hero-standings__list">
                  {standings.slice(0, 5).map((entry, index) => (
                    <div
                      className={`hero-standing ${index === 0 ? "hero-standing--first" : ""}`}
                      key={entry.team.id}
                    >
                      <span className="hero-standing__position">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="hero-standing__team">
                        {entry.team.logo_url ? (
                          <img src={entry.team.logo_url} alt="" />
                        ) : (
                          <span className="hero-standing__logo-placeholder" />
                        )}
                        <span>{entry.team.short_name || entry.team.name}</span>
                      </div>
                      <div className="hero-standing__stats">
                        <span>{entry.played}</span>
                        <strong>{entry.points}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hero-standings__empty">
                  <span className="eyebrow">Ranking</span>
                  <h3>Classifica non disponibile</h3>
                  <p>
                    La classifica verrà popolata automaticamente dai risultati
                    delle partite.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>

      <section className="section--edge leaders-section" id="home-stats">
        <SectionTitle eyebrow="Live" title="Top performers" />
        <DataGate when={false} fallback={null}>
          <div />
        </DataGate>
        <div className="leaders">
          {[
            ["Miglior marcatore", topScorers.size ? "—" : "—"],
            ["Top uomo-assist", "—"],
            ["Clean sheets", "—"],
          ].map(([title, value]) => (
            <div className="stat-card" key={title}>
              <span className="eyebrow">{title}</span>
              <h3>Dati live</h3>
              <div className="stat-card__value">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section--edge" id="home-teams">
        <SectionTitle
          eyebrow=""
          title="Squadre"
          action={
            <a className="btn btn--ghost" href="/squadre">
              Esplora
            </a>
          }
        />
        {teams.length ? (
          <div className="cards-grid">
            {teams.slice(0, 3).map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna squadra"
            text="Le squadre compariranno qui quando saranno registrate nel database."
          />
        )}
      </section>

      <section className="sponsor-band" id="home-partners">
        <div className="section--edge">
          <SectionTitle eyebrow="Sponsors" title="Chi sostiene il gioco" />
          <div className="partners-grid">
            {partners
              .filter((partner) => partner.tier === "gold")
              .slice(0, 4)
              .map((partner) => (
                <div className="partner-card" key={partner.id}>
                  {partner.website_url ? (
                    <a
                      href={partner.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {partner.logo_url ? (
                        <img src={partner.logo_url} alt={partner.name} />
                      ) : (
                        partner.name
                      )}
                    </a>
                  ) : partner.logo_url ? (
                    <img src={partner.logo_url} alt={partner.name} />
                  ) : (
                    <span>{partner.name}</span>
                  )}
                  <span>Gold / {partner.name}</span>
                </div>
              ))}
          </div>
          <a className="btn btn--primary" href="/collabora">
            Collabora con noi
          </a>
          {!partners.length && (
            <EmptyState
              title="Partner in attesa"
              text="La sezione è pronta per i partner Gold, Silver e Bronze da Supabase."
            />
          )}
        </div>
      </section>

      <section className="section--edge" id="home-content">
        <SectionTitle eyebrow="" title="Ultimi contenuti" />
        {social.length ? (
          <div className="video-grid">
            {social.slice(0, 6).map((item) => (
              <a
                className="video-card"
                key={item.id}
                href={item.content_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="video-thumb">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" />
                  ) : (
                    <div className="video-play">↗</div>
                  )}
                </div>
                <div className="video-card__body">
                  <span className="eyebrow">{item.platform}</span>
                  <h3>{item.title}</h3>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessun contenuto"
            text="YouTube, Instagram e TikTok verranno alimentati dal pannello amministrativo."
          />
        )}
      </section>
    </PageShell>
  );
}
