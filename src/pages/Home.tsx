import "../styles/home-fixes.css";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { SectionTitle } from "../components/SectionTitle";
import { TeamCard } from "../components/TeamCard";
import { EmptyState } from "../components/EmptyState";
import { ContentCarousel } from "../components/ContentCarousel";
import { CollabCarousel } from "../components/CollabCarousel";
import { LogoScroller } from "../components/LogoScroller";
import {
  calculateStandings,
  getActiveCollaborations,
  getActiveCompetition,
  getAllPlayerStats,
  getMatches,
  getPartners,
  getSocialContent,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import type {
  ActiveCollaboration,
  Competition,
  Match,
  Partner,
  Player,
  PlayerStats,
  SocialContent,
  Team,
} from "../types";

type PlayerWithStats = Player & { stats: PlayerStats };
type LeaderConfig = {
  key: "goals" | "assists" | "clean_sheets";
  title: string;
  eyebrow: string;
};
const leaderConfigs: LeaderConfig[] = [
  { key: "goals", title: "Miglior marcatore", eyebrow: "Gol" },
  { key: "assists", title: "Top uomo-assist", eyebrow: "Assist" },
  { key: "clean_sheets", title: "Clean sheets", eyebrow: "Portieri" },
];
function LeaderPanel({
  config,
  players,
}: {
  config: LeaderConfig;
  players: PlayerWithStats[];
}) {
  const ranked = useMemo(
    () =>
      [...players]
        .filter((player) => player.stats[config.key] > 0)
        .sort(
          (a, b) =>
            b.stats[config.key] - a.stats[config.key] ||
            a.last_name.localeCompare(b.last_name, "it") ||
            a.first_name.localeCompare(b.first_name, "it"),
        )
        .slice(0, 3),
    [config.key, players],
  );
  const featured = ranked[0];
  const statLabel =
    config.key === "goals"
      ? "gol"
      : config.key === "assists"
        ? "assist"
        : "clean sheet";
  return (
    <article className="stat-card leader-stat-card">
      <span className="eyebrow">{config.title}</span>
      <h3>{featured ? `${featured.first_name} ${featured.last_name}` : "—"}</h3>
      <div className="stat-card__value">
        {featured ? String(featured.stats[config.key]).padStart(2, "0") : "0"}
      </div>
      <div className="rank-list">
        {[0, 1, 2].map((index) => {
          const player = ranked[index];
          return (
            <div
              className="rank-row"
              key={player?.id || `${config.key}-${index}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>
                {player ? `${player.first_name} ${player.last_name}` : "—"}
                {player && (
                  <small>
                    {" "}
                    · {player.stats[config.key]}
                    {index === 0 ? ` ${statLabel}` : ""}
                  </small>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
function SponsorCard({ partner }: { partner: Partner }) {
  const body = partner.logo_url ? (
    <img src={partner.logo_url} alt={partner.name} />
  ) : (
    <strong>{partner.name}</strong>
  );
  const hasLink = Boolean(partner.website_url);
  return (
    <article className={`partner-card partner-card--${partner.tier}`}>
      <div className="partner-card__logo">{body}</div>
      <div className="partner-card__meta">
        <span className="partner-card__name">{partner.name}</span>
        {partner.tier === "gold" || partner.tier === "silver" ? (
          <a
            className={`sponsor-link-btn ${hasLink ? "" : "sponsor-link-btn--disabled"}`}
            href={hasLink ? partner.website_url! : "#"}
            target={hasLink ? "_blank" : undefined}
            rel={hasLink ? "noopener noreferrer" : undefined}
            aria-disabled={!hasLink}
            onClick={(event) => {
              if (!hasLink) event.preventDefault();
            }}
          >
            <span>Info</span>
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
export default function Home() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>(
    [],
  );
  const [social, setSocial] = useState<SocialContent[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerWithStats[]>([]);
  const load = async () => {
    try {
      const active = await getActiveCompetition();
      const [
        nextMatches,
        nextTeams,
        nextPartners,
        nextCollabs,
        nextSocial,
        nextStats,
      ] = await Promise.all([
        getMatches(active?.id),
        getTeams(active?.id),
        getPartners(),
        getActiveCollaborations(),
        getSocialContent(),
        getAllPlayerStats(),
      ]);
      setCompetition(active);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setPartners(nextPartners);
      setCollaborations(nextCollabs);
      setSocial(nextSocial);
      setPlayerStats(nextStats);
    } catch (error) {
      console.error("Home data error:", error);
      setCompetition(null);
      setMatches([]);
      setTeams([]);
      setPartners([]);
      setCollaborations([]);
      setSocial([]);
      setPlayerStats([]);
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
    competition?.hero_image_url || "/assets/nebula-vertical.webp";
  const goldPartners = useMemo(
    () => partners.filter((partner) => partner.tier === "gold"),
    [partners],
  );
  const silverPartners = useMemo(
    () => partners.filter((partner) => partner.tier === "silver"),
    [partners],
  );
  const bronzePartners = useMemo(
    () => partners.filter((partner) => partner.tier === "bronze"),
    [partners],
  );
  return (
    <>
      <section
        className="hero hero--data-only"
        style={{ "--hero-image": `url("${heroBackground}")` } as CSSProperties}
        aria-labelledby="home-hero-title"
      >
        <div className="hero-inner">
          <div
            className="hero-data-panels hero-data-panels--full"
            aria-label="Calendario e classifica della competizione"
          >
            <section
              className="hero-calendar"
              id="home-matches"
              aria-labelledby="home-matches-title"
            >
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
                  {upcoming.slice(0, 4).map((match) => {
                    const home = teams.find(
                      (team) => team.id === match.home_team_id,
                    );
                    const away = teams.find(
                      (team) => team.id === match.away_team_id,
                    );
                    return (
                      <a
                        key={match.id}
                        href={`/partite/${match.id}`}
                        className="hero-match"
                      >
                        <div className="hero-match__meta">
                          <span>
                            {new Date(match.kickoff_at).toLocaleDateString(
                              "it-IT",
                              { day: "2-digit", month: "short" },
                            )}
                          </span>
                          <span>
                            {new Date(match.kickoff_at).toLocaleTimeString(
                              "it-IT",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
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
                            {match.matchday
                              ? `Giornata ${match.matchday}`
                              : "Match"}
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
            <section
              className="hero-standings"
              id="home-standings"
              aria-labelledby="home-standings-title"
            >
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
                  {standings.slice(0, 6).map((entry, index) => (
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
                        <span>{entry.played} GP</span>
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
        <div className="leaders">
          {leaderConfigs.map((config) => (
            <LeaderPanel
              key={config.key}
              config={config}
              players={playerStats}
            />
          ))}
        </div>
      </section>
      <section className="section--edge" id="home-teams">
        <SectionTitle
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
      <section
        className="sponsor-band sponsor-band--redesign"
        id="home-partners"
      >
        <div className="section--edge sponsor-band__inner">
          <SectionTitle
            eyebrow="Sponsors"
            title="Chi sostiene la Street League"
          />
          <div className="sponsor-tier sponsor-tier--gold">
            <div className="sponsor-tier__heading">
              <div>
                <h3>Sponsor Gold</h3>
              </div>
            </div>
            {goldPartners.length ? (
              <div className="partners-grid partners-grid--gold">
                {goldPartners.map((partner) => (
                  <SponsorCard key={partner.id} partner={partner} />
                ))}
              </div>
            ) : (
              <EmptyState title="Gold sponsor in attesa" />
            )}
          </div>
          {collaborations.length ? (
            <div className="sponsor-tier sponsor-tier--collab">
              <CollabCarousel items={collaborations} variant="home" />
            </div>
          ) : null}
          <div className="sponsor-tier sponsor-tier--silver">
            <div className="sponsor-tier__heading">
              <div>
                <h3>Sponsor Silver</h3>
              </div>
            </div>
            {silverPartners.length ? (
              <ContentCarousel>
                {silverPartners.map((partner) => (
                  <SponsorCard key={partner.id} partner={partner} />
                ))}
              </ContentCarousel>
            ) : (
              <EmptyState
                title="Silver sponsor in attesa"
                text="I partner Silver verranno mostrati qui dal database."
              />
            )}
          </div>
          <div className="sponsor-tier sponsor-tier--network">
            <div className="sponsor-tier__heading sponsor-tier__heading--row">
              <div>
                <h3>Sponsor Bronze</h3>
              </div>
              <a className="btn btn--ghost" href="/partner">
                Tutti i partner
              </a>
            </div>
            {bronzePartners.length ? (
              <LogoScroller partners={bronzePartners} label="Bronze sponsors" />
            ) : (
              <LogoScroller
                partners={partners.filter((partner) => partner.tier !== "gold")}
                label="Street League partners"
              />
            )}
          </div>
          <div className="sponsor-cta-row">
            <h2>Porta il tuo brand in campo con noi</h2>
            <a className="btn btn--primary" href="/collabora">
              Collabora con noi
            </a>
          </div>
        </div>
      </section>
      <section className="section--edge" id="home-content">
        <SectionTitle title="Ultimi contenuti" />
        {social.length ? (
          <ContentCarousel>
            {social.map((item) => {
              const imageUrl = item.image_url || item.thumbnail_url;
              return (
                <article className="video-card" key={item.id}>
                  <div className="video-thumb">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : (
                      <div className="video-thumb__fallback" aria-hidden="true" />
                    )}
                    <a
                      className="video-card__link"
                      href={item.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Apri ${item.title}`}
                    >
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                  <div className="video-card__body">
                    <span className="eyebrow">{item.platform}</span>
                    <h3>{item.title}</h3>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                </article>
              );
            })}
          </ContentCarousel>
        ) : (
          <EmptyState
            title="Nessun contenuto"
            text="I contenuti verranno mostrati qui quando saranno pubblicati."
          />
        )}
      </section>
    </>
  );
}
