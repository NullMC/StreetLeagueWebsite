import "../styles/collab-carousel.css";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { ContentCarousel } from "../components/ContentCarousel";
import { CollabCarousel } from "../components/CollabCarousel";
import { LogoScroller } from "../components/LogoScroller";
import { TeamCarousel } from "../components/TeamCarousel";
import { PlayerOfMonthCard } from "../components/PlayerOfMonth";
import { calculateStandings, getActiveCollaborations, getActiveCompetition, getAllPlayerStats, getMatches, getPartners, getSocialContent, getTeams, subscribeToCompetition } from "../lib/api";
import { getPlayerOfMonth } from "../lib/playerOfMonth";
import type { ActiveCollaboration, Competition, Match, Partner, Player, PlayerStats, SocialContent, Team } from "../types";

type PlayerWithStats = Player & { stats: PlayerStats };
type LeaderConfig = { key: "goals" | "assists" | "clean_sheets"; title: string };

const leaderConfigs: LeaderConfig[] = [
  { key: "goals", title: "Miglior marcatore" },
  { key: "assists", title: "Top uomo-assist" },
  { key: "clean_sheets", title: "Clean sheets" },
];

function LeaderPanel({ config, players }: { config: LeaderConfig; players: PlayerWithStats[] }) {
  const ranked = useMemo(() => [...players].filter((p) => p.stats[config.key] > 0).sort((a, b) => b.stats[config.key] - a.stats[config.key] || a.last_name.localeCompare(b.last_name, "it") || a.first_name.localeCompare(b.first_name, "it")).slice(0, 3), [config.key, players]);
  const statLabel = config.key === "goals" ? "gol" : config.key === "assists" ? "assist" : "clean sheet";
  return (
    <article className="stat-card leader-stat-card">
      <span className="eyebrow">{config.title}</span>
      <h3>{ranked[0] ? `${ranked[0].first_name} ${ranked[0].last_name}` : "—"}</h3>
      <div className="stat-card__value">{ranked[0] ? String(ranked[0].stats[config.key]).padStart(2, "0") : "0"}</div>
      <div className="rank-list">
        {[0, 1, 2].map((index) => {
          const player = ranked[index];
          return (
            <div className="rank-row" key={player?.id || `${config.key}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{player ? `${player.first_name} ${player.last_name}` : "—"}{player ? <small> · {player.stats[config.key]}{index === 0 ? ` ${statLabel}` : ""}</small> : null}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SponsorCard({ partner }: { partner: Partner }) {
  const hasLink = Boolean(partner.website_url);
  return (
    <article className={`partner-card partner-card--${partner.tier}`}>
      <div className="partner-card__logo">{partner.logo_url ? <img src={partner.logo_url} alt={partner.name} /> : <strong>{partner.name}</strong>}</div>
      <div className="partner-card__meta">
        <span className="partner-card__name">{partner.name}</span>
        {(partner.tier === "gold" || partner.tier === "silver") && (
          <a className={`sponsor-link-btn ${hasLink ? "" : "sponsor-link-btn--disabled"}`} href={hasLink ? partner.website_url! : "#"} target={hasLink ? "_blank" : undefined} rel={hasLink ? "noopener noreferrer" : undefined} aria-disabled={!hasLink} onClick={(event) => !hasLink && event.preventDefault()}>
            <span>Info</span><span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  );
}

function MatchList({ matches, teams }: { matches: Match[]; teams: Team[] }) {
  if (!matches.length) return <EmptyState title="Nessuna partita programmata" text="Le prossime partite verranno mostrate qui." />;
  return (
    <div className="home-schedule__matches">
      {matches.slice(0, 6).map((match) => {
        const home = teams.find((t) => t.id === match.home_team_id);
        const away = teams.find((t) => t.id === match.away_team_id);
        return (
          <a key={match.id} className="home-match-row" href={`/partite/${match.id}`}>
            <div className="home-match-row__date"><strong>{new Date(match.kickoff_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</strong><span>{new Date(match.kickoff_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="home-match-row__teams"><span>{home?.name ?? "—"}</span><b>vs</b><span>{away?.name ?? "—"}</span></div>
            <div className="home-match-row__meta"><span>{match.matchday ?? "Match"}</span><span>→</span></div>
          </a>
        );
      })}
    </div>
  );
}

function StandingsList({ standings }: { standings: ReturnType<typeof calculateStandings> }) {
  if (!standings.length) return <EmptyState title="Classifica non disponibile" text="I risultati delle partite alimenteranno automaticamente la classifica." />;
  return (
    <div className="home-ranking">
      {standings.slice(0, 8).map((entry, index) => (
        <div className={`home-ranking__row ${index === 0 ? "is-first" : ""}`} key={entry.team.id}>
          <span className="home-ranking__pos">{String(index + 1).padStart(2, "0")}</span>
          <span className="home-ranking__team">{entry.team.logo_url ? <img src={entry.team.logo_url} alt="" /> : <i aria-hidden="true" />}{entry.team.name}</span>
          <span className="home-ranking__record">{entry.played} G</span>
          <strong>{entry.points}</strong>
        </div>
      ))}
    </div>
  );
}

export default function HomeRedesigned() {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>([]);
  const [social, setSocial] = useState<SocialContent[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerWithStats[]>([]);
  const [potm, setPotm] = useState<Awaited<ReturnType<typeof getPlayerOfMonth>>>(null);

  const load = async () => {
    try {
      const active = await getActiveCompetition();
      const [nextMatches, nextTeams, nextPartners, nextCollabs, nextSocial, nextStats, nextPotm] = await Promise.all([
        getMatches(active?.id), getTeams(active?.id), getPartners(), getActiveCollaborations(), getSocialContent(), getAllPlayerStats(), getPlayerOfMonth(),
      ]);
      setCompetition(active); setMatches(nextMatches); setTeams(nextTeams); setPartners(nextPartners); setCollaborations(nextCollabs); setSocial(nextSocial); setPlayerStats(nextStats); setPotm(nextPotm);
    } catch (error) {
      console.error("Home data error:", error);
      setCompetition(null); setMatches([]); setTeams([]); setPartners([]); setCollaborations([]); setSocial([]); setPlayerStats([]); setPotm(null);
    }
  };

  useEffect(() => { void load(); return subscribeToCompetition(() => void load()); }, []);

  const standings = useMemo(() => calculateStandings(teams, matches), [teams, matches]);
  const heroBackground = "/assets/nebula-vertical.webp";
  const heroBackdropStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: [
      "linear-gradient(to top, #fff 0%, rgba(255,255,255,0.72) 24%, rgba(255,255,255,0.12) 58%, rgba(255,255,255,0) 100%)",
      "linear-gradient(135deg, rgba(255,255,255,0.76) 0%, rgba(245,211,221,0.30) 54%, rgba(237,123,171,0.18) 100%)",
      `url("${heroBackground}")`,
    ].join(","),
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  };
  const goldPartners = useMemo(() => partners.filter((p) => p.tier === "gold"), [partners]);
  const silverPartners = useMemo(() => partners.filter((p) => p.tier === "silver"), [partners]);
  const bronzePartners = useMemo(() => partners.filter((p) => p.tier === "bronze"), [partners]);

  return (
    <div className="home-redesign">
      <section className="home-hero" style={{ background: "#fff", color: "#010a08" }} aria-labelledby="home-hero-title">
        <div aria-hidden="true" style={heroBackdropStyle} />
        <div className="home-hero__inner" style={{ position: "relative", zIndex: 1 }}>
          <div className="home-hero__mast" style={{ color: "#010a08", borderBottomColor: "rgba(1,10,8,.16)" }}>
            <div><span className="home-hero__kicker" style={{ color: "#e42278", opacity: 1 }}>Highlights</span><h1 id="home-hero-title" style={{ color: "#010a08" }}>Street League</h1></div>
            <span className="home-hero__competition" style={{ color: "rgba(1,10,8,.62)", opacity: 1 }}>{competition?.name ?? "Street League"}</span>
          </div>
          {social.length ? (
            <div className="home-hero__highlights">
              <a className="home-highlight home-highlight--feature" href={social[0].content_url} target="_blank" rel="noopener noreferrer">
                <div className="home-highlight__media">{social[0].thumbnail_url ? <img src={social[0].thumbnail_url} alt="" /> : <div className="home-highlight__fallback" />}</div>
                <div className="home-highlight__shade" />
                <div className="home-highlight__content"><span className="home-highlight__index">01</span><span className="home-highlight__platform">{social[0].platform}</span><h2>{social[0].title}</h2><span className="home-highlight__cta">Apri contenuto ↗</span></div>
              </a>
              <div className="home-hero__rail">
                {social.slice(1, 5).map((item, index) => (
                  <a className="home-highlight home-highlight--rail" href={item.content_url} target="_blank" rel="noopener noreferrer" key={item.id}>
                    <div className="home-highlight__media">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <div className="home-highlight__fallback" />}</div>
                    <div className="home-highlight__shade" />
                    <div className="home-highlight__content"><span className="home-highlight__index">{String(index + 2).padStart(2, "0")}</span><span className="home-highlight__platform">{item.platform}</span><h3>{item.title}</h3><span className="home-highlight__arrow">↗</span></div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="home-hero__empty"><span className="home-hero__kicker" style={{ color: "#e42278", opacity: 1 }}>Highlights</span><h2 style={{ color: "#010a08" }}>Nessun highlight ancora.</h2><p style={{ color: "rgba(1,10,8,.62)" }}>I contenuti pubblicati appariranno qui.</p></div>
          )}
          <div className="home-hero__foot" style={{ color: "rgba(1,10,8,.52)", borderTopColor: "rgba(1,10,8,.14)" }}><span>Live feed / Street League</span><span>Scorri per continuare ↓</span></div>
        </div>
      </section>

      <section className="section--edge home-schedule" id="home-matches">
        <div className="home-section-head"><SectionTitle eyebrow="Competition" title="Calendario" /><a className="home-section-head__link" href="/partite">Tutte le partite ↗</a></div>
        <div className="home-schedule__grid">
          <div><MatchList matches={matches} teams={teams} /></div>
          <div className="home-schedule__ranking"><div className="home-mini-head"><span>Classifica</span><a href="/classifica">Completa ↗</a></div><StandingsList standings={standings} /></div>
        </div>
      </section>

      <section className="section--edge home-performers" id="home-stats">
        <div className="home-section-head"><SectionTitle eyebrow="Live data" title="Top performers" /></div>
        <div className="leaders">{leaderConfigs.map((config) => <LeaderPanel key={config.key} config={config} players={playerStats} />)}</div>
      </section>

      <section className="section--edge potm-section" id="home-potm">
        <div className="home-section-head"><SectionTitle eyebrow="Monthly award" title="POTM" /></div>
        <PlayerOfMonthCard item={potm} teams={teams} />
      </section>

      <section className="section--edge home-teams" id="home-teams">
        <div className="home-section-head"><SectionTitle title="Squadre" /><a className="home-section-head__link" href="/squadre">Tutte le squadre ↗</a></div>
        {teams.length ? <TeamCarousel teams={teams} /> : <EmptyState title="Nessuna squadra" text="Le squadre compariranno qui quando saranno registrate nel database." />}
      </section>

      <section className="sponsor-band sponsor-band--redesign" id="home-partners">
        <div className="section--edge sponsor-band__inner">
          <div className="home-section-head home-section-head--on-pink"><SectionTitle eyebrow="Partners" title="Chi sostiene la Street League" /></div>
          <div className="sponsor-tier sponsor-tier--gold"><div className="sponsor-tier__heading"><div><h3>Sponsor Gold</h3></div></div>{goldPartners.length ? <div className="partners-grid partners-grid--gold">{goldPartners.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}</div> : <EmptyState title="Gold sponsor in attesa" />}</div>
          {collaborations.length ? <div className="sponsor-tier sponsor-tier--collab"><CollabCarousel items={collaborations} variant="home" /></div> : null}
          <div className="sponsor-tier sponsor-tier--silver"><div className="sponsor-tier__heading"><div><h3>Sponsor Silver</h3></div></div>{silverPartners.length ? <ContentCarousel>{silverPartners.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}</ContentCarousel> : <EmptyState title="Silver sponsor in attesa" text="I partner Silver verranno mostrati qui dal database." />}</div>
          <div className="sponsor-tier sponsor-tier--network"><div className="sponsor-tier__heading sponsor-tier__heading--row"><div><h3>Sponsor Bronze</h3></div><a className="btn btn--ghost" href="/partner">Tutti i partner</a></div>{bronzePartners.length ? <LogoScroller partners={bronzePartners} label="Bronze sponsors" /> : <LogoScroller partners={partners.filter((p) => p.tier !== "gold")} label="Street League partners" />}</div>
          <div className="sponsor-cta-row"><h2>Porta il tuo brand in campo con noi</h2><a className="btn btn--primary" href="/collabora">Collabora con noi</a></div>
        </div>
      </section>
    </div>
  );
}
