import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { TeamCard } from "../components/TeamCard";
import { EmptyState } from "../components/EmptyState";
import { ContentCarousel } from "../components/ContentCarousel";
import { LogoScroller } from "../components/LogoScroller";
import {
  calculateStandings,
  getActiveCompetition,
  getAllPlayerStats,
  getMatches,
  getPartners,
  getSocialContent,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import type {
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
  { key: "assists", title: "Top assist-man", eyebrow: "Assist" },
  { key: "clean_sheets", title: "Clean sheets", eyebrow: "Portieri" },
];

function LeaderPanel({ config, players }: { config: LeaderConfig; players: PlayerWithStats[] }) {
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
  const rest = ranked.slice(1);
  const statLabel = config.key === "goals" ? "gol" : config.key === "assists" ? "assist" : "clean sheet";
  const image = featured?.bg_less_image_url || featured?.profile_image_url;

  return (
    <article className="leader-panel">
      <div className="leader-panel__heading">
        <div>
          <span className="eyebrow">{config.eyebrow}</span>
          <h3>{config.title}</h3>
        </div>
        <span className="leader-panel__index">TOP 03</span>
      </div>

      {featured ? (
        <>
          <div className="leader-featured">
            <span className="leader-featured__rank">01</span>
            <div className="leader-featured__visual">
              {image ? <img src={image} alt="" /> : <span className="leader-featured__placeholder">SL</span>}
            </div>
            <div className="leader-featured__info">
              <span className="eyebrow">1° posto</span>
              <strong>{featured.first_name} {featured.last_name}</strong>
              <div className="leader-featured__stat">
                <span>{String(featured.stats[config.key]).padStart(2, "0")}</span>
                <small>{statLabel}</small>
              </div>
            </div>
          </div>
          <div className="leader-ranking">
            {rest.map((player, index) => (
              <div className="leader-ranking__row" key={player.id}>
                <span>{String(index + 2).padStart(2, "0")}</span>
                <span>{player.first_name} {player.last_name}</span>
                <strong>{player.stats[config.key]}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="leader-panel__empty">
          <span className="eyebrow">Live data</span>
          <strong>Statistiche in aggiornamento</strong>
          <p>Il podio comparirà automaticamente quando saranno registrati i dati delle partite.</p>
        </div>
      )}
    </article>
  );
}

function SponsorCard({ partner }: { partner: Partner }) {
  const body = partner.logo_url ? <img src={partner.logo_url} alt={partner.name} /> : <strong>{partner.name}</strong>;
  return partner.website_url ? (
    <a className={`partner-card partner-card--${partner.tier}`} href={partner.website_url} target="_blank" rel="noopener noreferrer">
      {body}
      <span>{partner.name}</span>
    </a>
  ) : (
    <div className={`partner-card partner-card--${partner.tier}`}>
      {body}
      <span>{partner.name}</span>
    </div>
  );
}

export default function Home() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [social, setSocial] = useState<SocialContent[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerWithStats[]>([]);

  const load = async () => {
    try {
      const active = await getActiveCompetition();
      const [nextMatches, nextTeams, nextPartners, nextSocial, nextStats] = await Promise.all([
        getMatches(active?.id),
        getTeams(active?.id),
        getPartners(),
        getSocialContent(),
        getAllPlayerStats(),
      ]);
      setCompetition(active);
      setMatches(nextMatches);
      setTeams(nextTeams);
      setPartners(nextPartners);
      setSocial(nextSocial);
      setPlayerStats(nextStats);
    } catch (error) {
      console.error("Home data error:", error);
      setCompetition(null);
      setMatches([]);
      setTeams([]);
      setPartners([]);
      setSocial([]);
      setPlayerStats([]);
    }
  };

  useEffect(() => {
    void load();
    return subscribeToCompetition(() => void load());
  }, []);

  const upcoming = useMemo(() => matches.slice(0, 6), [matches]);
  const standings = useMemo(() => calculateStandings(teams, matches), [teams, matches]);
  const heroBackground = competition?.hero_image_url || "/assets/nebula-landscape.jpg";
  const goldPartners = useMemo(() => partners.filter((partner) => partner.tier === "gold"), [partners]);
  const silverPartners = useMemo(() => partners.filter((partner) => partner.tier === "silver"), [partners]);
  const bronzePartners = useMemo(() => partners.filter((partner) => partner.tier === "bronze"), [partners]);

  return (
    <PageShell>
      <section
        className="hero hero--data-only"
        style={{ "--hero-image": `url("${heroBackground}")` } as CSSProperties}
        aria-labelledby="home-hero-title"
      >
        <h1 id="home-hero-title" className="sr-only">Street League</h1>
        <div className="hero-inner">
          <div className="hero-data-panels hero-data-panels--full" aria-label="Calendario e classifica della competizione">
            <section className="hero-calendar" id="home-matches" aria-labelledby="home-matches-title">
              <div className="hero-calendar__header">
                <div>
                  <span className="eyebrow">Next matches</span>
                  <h2 id="home-matches-title">Calendario</h2>
                </div>
                <a className="hero-calendar__all" href="/partite">Vedi tutte</a>
              </div>

              {upcoming.length ? (
                <div className="hero-calendar__list">
                  {upcoming.slice(0, 4).map((match) => {
                    const home = teams.find((team) => team.id === match.home_team_id);
                    const away = teams.find((team) => team.id === match.away_team_id);
                    return (
                      <a key={match.id} href={`/partite/${match.id}`} className="hero-match">
                        <div className="hero-match__meta">
                          <span>{new Date(match.kickoff_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</span>
                          <span>{new Date(match.kickoff_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="hero-match__teams">
                          <div className="hero-match__team">
                            {home?.logo_url ? <img src={home.logo_url} alt="" /> : <span className="hero-match__logo-placeholder" />}
                            <span>{home?.short_name || home?.name || "—"}</span>
                          </div>
                          <span className="hero-match__vs">VS</span>
                          <div className="hero-match__team hero-match__team--away">
                            <span>{away?.short_name || away?.name || "—"}</span>
                            {away?.logo_url ? <img src={away.logo_url} alt="" /> : <span className="hero-match__logo-placeholder" />}
                          </div>
                        </div>
                        <div className="hero-match__footer">
                          <span>{match.matchday ? `Giornata ${match.matchday}` : "Match"}</span>
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
                  <p>{competition ? "Le prossime partite verranno mostrate qui." : "Competizione non ancora iniziata."}</p>
                </div>
              )}
            </section>

            <section className="hero-standings" id="home-standings" aria-labelledby="home-standings-title">
              <div className="hero-standings__header">
                <div>
                  <span className="eyebrow">Live ranking</span>
                  <h2 id="home-standings-title">Classifica</h2>
                </div>
                <a className="hero-calendar__all" href="/classifica">Completa</a>
              </div>

              {standings.length ? (
                <div className="hero-standings__list">
                  {standings.slice(0, 6).map((entry, index) => (
                    <div className={`hero-standing ${index === 0 ? "hero-standing--first" : ""}`} key={entry.team.id}>
                      <span className="hero-standing__position">{String(index + 1).padStart(2, "0")}</span>
                      <div className="hero-standing__team">
                        {entry.team.logo_url ? <img src={entry.team.logo_url} alt="" /> : <span className="hero-standing__logo-placeholder" />}
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
                  <p>La classifica verrà popolata automaticamente dai risultati delle partite.</p>
                </div>
              )}
            </section>
          </div>

          {partners.length ? (
            <div className="hero-sponsor-line">
              <span className="hero-sponsor-line__label">Powered by</span>
              <LogoScroller partners={partners} compact />
            </div>
          ) : null}
        </div>
      </section>

      <section className="section--edge leaders-section" id="home-stats">
        <SectionTitle eyebrow="Live" title="Top performers" />
        <div className="leaders">
          {leaderConfigs.map((config) => (
            <LeaderPanel key={config.key} config={config} players={playerStats} />
          ))}
        </div>
      </section>

      <section className="section--edge" id="home-teams">
        <SectionTitle eyebrow="" title="Squadre" action={<a className="btn btn--ghost" href="/squadre">Esplora</a>} />
        {teams.length ? (
          <div className="cards-grid">{teams.slice(0, 3).map((team) => <TeamCard key={team.id} team={team} />)}</div>
        ) : (
          <EmptyState title="Nessuna squadra" text="Le squadre compariranno qui quando saranno registrate nel database." />
        )}
      </section>

      <section className="sponsor-band sponsor-band--redesign" id="home-partners">
        <div className="section--edge sponsor-band__inner">
          <SectionTitle eyebrow="Sponsors" title="Chi sostiene il gioco" />

          <div className="sponsor-tier sponsor-tier--gold">
            <div className="sponsor-tier__heading">
              <span className="eyebrow">01 / Gold</span>
              <p>Presenza premium e visibilità principale.</p>
            </div>
            {goldPartners.length ? (
              <div className="partners-grid partners-grid--gold">
                {goldPartners.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}
              </div>
            ) : (
              <EmptyState title="Gold sponsor in attesa" text="I partner Gold verranno mostrati qui dal database." />
            )}
          </div>

          <div className="sponsor-tier sponsor-tier--silver">
            <div className="sponsor-tier__heading">
              <span className="eyebrow">02 / Silver</span>
              <p>Brand in evidenza nel network Street League.</p>
            </div>
            {silverPartners.length ? (
              <ContentCarousel>
                {silverPartners.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}
              </ContentCarousel>
            ) : (
              <EmptyState title="Silver sponsor in attesa" text="I partner Silver verranno mostrati qui dal database." />
            )}
          </div>

          <div className="sponsor-tier sponsor-tier--network">
            <div className="sponsor-tier__heading sponsor-tier__heading--row">
              <div>
                <span className="eyebrow">03 / Network</span>
                <p>Un flusso continuo di realtà che fanno parte del progetto.</p>
              </div>
              <a className="btn btn--ghost" href="/partners">Tutti i partner</a>
            </div>
            {bronzePartners.length ? (
              <LogoScroller partners={bronzePartners} label="Bronze partners" />
            ) : (
              <LogoScroller partners={partners.filter((partner) => partner.tier !== "gold")} label="Street League partners" />
            )}
          </div>

          <div className="sponsor-cta-row">
            <p>Porta il tuo brand in campo con Street League.</p>
            <a className="btn btn--primary" href="/collabora">Collabora con noi</a>
          </div>
        </div>
      </section>

      <section className="section--edge" id="home-content">
        <SectionTitle eyebrow="" title="Ultimi contenuti" />
        {social.length ? (
          <ContentCarousel>
            {social.map((item) => (
              <a className="video-card" key={item.id} href={item.content_url} target="_blank" rel="noopener noreferrer">
                <div className="video-thumb">
                  {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <div className="video-play">↗</div>}
                </div>
                <div className="video-card__body">
                  <span className="eyebrow">{item.platform}</span>
                  <h3>{item.title}</h3>
                </div>
              </a>
            ))}
          </ContentCarousel>
        ) : (
          <EmptyState title="Nessun contenuto" text="YouTube, Instagram e TikTok verranno alimentati dal pannello amministrativo." />
        )}
      </section>
    </PageShell>
  );
}
