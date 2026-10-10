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
import { StaffOfMonthCard } from "../components/StaffOfMonth";
import { calculateStandings, getActiveCollaborations, getActiveCompetitions, getCurrentCompetition, getMatches, getPartners, getPlayerStatsForCompetitions, getSocialContent, getStaffRanking, getStatisticsGroups, getTeams, subscribeToCompetition } from "../lib/api";
import { getPlayerOfMonth } from "../lib/playerOfMonth";
import type { ActiveCollaboration, Competition, Match, Partner, Player, PlayerStats, SocialContent, StaffRankingEntry, Team } from "../types";

type PlayerWithStats = Player & { stats: PlayerStats };
type LeaderConfig = {
  key: "goals" | "mvps" | "clean_sheets" | "yellow_cards" | "red_cards";
  title: string;
};

const leaderConfigs: LeaderConfig[] = [
  { key: "goals", title: "Miglior marcatore" },
  { key: "mvps", title: "Miglior giocatore (MVP)" },
  { key: "clean_sheets", title: "Miglior portiere (Clean sheets)" },
  { key: "yellow_cards", title: "Cartellini gialli" },
  { key: "red_cards", title: "Cartellini rossi" },
];

function LeaderPanel({ config, players }: { config: LeaderConfig; players: PlayerWithStats[] }) {
  const ranked = useMemo(() => [...players].filter((p) => p.stats[config.key] > 0).sort((a, b) => b.stats[config.key] - a.stats[config.key] || a.last_name.localeCompare(b.last_name, "it") || a.first_name.localeCompare(b.first_name, "it")).slice(0, 3), [config.key, players]);
  const statLabel =
    config.key === "goals"
      ? "gol"
      : config.key === "mvps"
        ? "MVP"
        : config.key === "clean_sheets"
          ? "clean sheet"
          : config.key === "yellow_cards"
            ? "gialli"
            : "rossi";
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

function StaffRankingPreview({ items }: { items: StaffRankingEntry[] }) {
  return (
    <div className="home-staff-ranking">
      <div className="home-mini-head">
        <span>Migliori membri staff</span>
        <a href="/statistiche">Completa ↗</a>
      </div>
      <div className="home-staff-ranking__list">
        {items.slice(0, 3).map((entry, index) => (
          <a className="home-staff-ranking__row" href={`/giocatori/${entry.player.id}`} key={entry.player.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{entry.player.first_name} {entry.player.last_name}</span>
            <strong>{entry.presidential_penalties}</strong>
          </a>
        ))}
        {!items.length && (
          <div className="home-staff-ranking__empty">
            Nessun membro STAFF registrato.
          </div>
        )}
      </div>
    </div>
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

function localMatchDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * For each active competition, find its next date containing scheduled/live
 * matches, then keep every fixture on that date so a complete matchday remains
 * visible even when earlier kick-offs have already started or finished.
 */
function getNextMatchdayMatches(
  matches: Match[],
  activeCompetitions: Competition[],
  now = new Date(),
): Match[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nextDateByCompetition = new Map<string, string>();

  activeCompetitions.forEach((competition) => {
    const eligible = matches
      .filter((match) => {
        if (
          match.competition_id !== competition.id ||
          (match.status !== "scheduled" && match.status !== "live")
        ) {
          return false;
        }

        const kickoff = new Date(match.kickoff_at);
        return !Number.isNaN(kickoff.getTime()) && kickoff.getTime() >= today;
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff_at).getTime() -
          new Date(b.kickoff_at).getTime(),
      );

    const nextDate = eligible[0]
      ? localMatchDateKey(eligible[0].kickoff_at)
      : null;

    if (nextDate) nextDateByCompetition.set(competition.id, nextDate);
  });

  const competitionOrder = new Map(
    activeCompetitions.map((competition, index) => [competition.id, index]),
  );

  return matches
    .filter((match) => {
      const nextDate = nextDateByCompetition.get(match.competition_id);
      return Boolean(nextDate && localMatchDateKey(match.kickoff_at) === nextDate);
    })
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() -
          new Date(b.kickoff_at).getTime() ||
        (competitionOrder.get(a.competition_id) ?? 0) -
          (competitionOrder.get(b.competition_id) ?? 0),
    );
}

function MatchList({
  matches,
  teams,
  competitions,
}: {
  matches: Match[];
  teams: Team[];
  competitions: Competition[];
}) {
  if (!matches.length) return <EmptyState title="Nessuna partita programmata" text="Le prossime partite verranno mostrate qui." />;
  return (
    <div className="home-schedule__matches">
      {matches.map((match) => {
        const home = teams.find((t) => t.id === match.home_team_id);
        const away = teams.find((t) => t.id === match.away_team_id);
        const competition = competitions.find((item) => item.id === match.competition_id);
        return (
          <a key={match.id} className="home-match-row" href={`/partite/${match.id}`}>
            <div className="home-match-row__date"><strong>{new Date(match.kickoff_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</strong><span>{new Date(match.kickoff_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="home-match-row__teams">
              <div className="home-match-row__team home-match-row__team--home">
                {home?.logo_url ? (
                  <img src={home.logo_url} alt="" aria-hidden="true" />
                ) : (
                  <span className="home-match-row__logo-placeholder" aria-hidden="true">
                    {home?.name?.slice(0, 1).toUpperCase() ?? "?"}
                  </span>
                )}
                <span>{home?.name ?? "—"}</span>
              </div>
              <b>vs</b>
              <div className="home-match-row__team home-match-row__team--away">
                {away?.logo_url ? (
                  <img src={away.logo_url} alt="" aria-hidden="true" />
                ) : (
                  <span className="home-match-row__logo-placeholder" aria-hidden="true">
                    {away?.name?.slice(0, 1).toUpperCase() ?? "?"}
                  </span>
                )}
                <span>{away?.name ?? "—"}</span>
              </div>
            </div>
            <div className="home-match-row__meta">
              <span className="home-match-row__competition">{competition?.name ?? "Competizione"}</span>
              <span className="home-match-row__matchday">{match.matchday ?? "Match"}</span>
              <span aria-hidden="true">→</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
function StandingsList({ standings }: { standings: ReturnType<typeof calculateStandings> }) {
  if (!standings.length) return <EmptyState title="Classifica non disponibile" text="I risultati delle partite alimenteranno automaticamente la classifica." />;
  return <div className="home-ranking">{standings.slice(0, 8).map((entry, index) => <a className={`home-ranking__row ${index === 0 ? "is-first" : ""}`} href={`/squadre/${entry.team.id}`} key={entry.team.id}><span className="home-ranking__pos">{String(index + 1).padStart(2, "0")}</span><span className="home-ranking__team">{entry.team.logo_url ? <img src={entry.team.logo_url} alt="" /> : <i aria-hidden="true" />}{entry.team.name}</span><span className="home-ranking__record">{entry.played} G</span><strong>{entry.points}</strong></a>)}</div>;
}

export default function HomeRedesigned() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeCompetitionList, setActiveCompetitionList] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>([]);
  const [social, setSocial] = useState<SocialContent[]>([]);
  const [playerStatsByGroup, setPlayerStatsByGroup] = useState<Record<string, PlayerWithStats[]>>({});
  const [activeStandings, setActiveStandings] = useState<Array<{ id: string; name: string; standings: ReturnType<typeof calculateStandings>; staff: StaffRankingEntry[] }>>([]);
  const [statsGroups, setStatsGroups] = useState<Awaited<ReturnType<typeof getStatisticsGroups>>>([]);
  const [potm, setPotm] = useState<Awaited<ReturnType<typeof getPlayerOfMonth>>>(null);
  const [staffRanking, setStaffRanking] = useState<StaffRankingEntry[]>([]);
  const [staffMonthlyRanking, setStaffMonthlyRanking] = useState<StaffRankingEntry[]>([]);

  const load = async () => {
    try {
      const active = await getCurrentCompetition();
      const now = new Date();
      const activeCompetitions = await getActiveCompetitions();
      const nextGroups = await getStatisticsGroups(activeCompetitions);
      const [allMatches, nextTeams, nextPartners, nextCollabs, nextSocial, nextPotm, nextStaff, nextStaffMonth, nextStandings, nextGroupStats] = await Promise.all([
        getMatches(), getTeams(), getPartners(), getActiveCollaborations(), getSocialContent(), getPlayerOfMonth(),
        active ? getStaffRanking(active.id) : Promise.resolve([]),
        active ? getStaffRanking(active.id, { year: now.getFullYear(), month: now.getMonth() + 1 }) : Promise.resolve([]),
        Promise.all(activeCompetitions.map(async (competition) => {
          const [competitionTeams, competitionMatches, staff] = await Promise.all([getTeams(competition.id), getMatches(competition.id), getStaffRanking(competition.id)]);
          return { id: competition.id, name: competition.name, standings: calculateStandings(competitionTeams, competitionMatches), staff };
        })),
        Promise.all(nextGroups.map(async (group) => [group.id, await getPlayerStatsForCompetitions(group.competition_ids)] as const)),
      ]);
      const nextMatches = getNextMatchdayMatches(allMatches, activeCompetitions);
      setMatches(nextMatches); setActiveCompetitionList(activeCompetitions); setTeams(nextTeams); setPartners(nextPartners); setCollaborations(nextCollabs); setSocial(nextSocial); setPotm(nextPotm); setStaffRanking(nextStaff); setStaffMonthlyRanking(nextStaffMonth.filter((entry) => entry.presidential_penalties > 0));
      setActiveStandings(nextStandings); setStatsGroups(nextGroups); setPlayerStatsByGroup(Object.fromEntries(nextGroupStats));
    } catch (error) {
      console.error("Home data error:", error);
      setMatches([]); setActiveCompetitionList([]); setTeams([]); setPartners([]); setCollaborations([]); setSocial([]); setPotm(null); setStaffRanking([]); setStaffMonthlyRanking([]); setActiveStandings([]); setStatsGroups([]); setPlayerStatsByGroup({});
    }
  };

  useEffect(() => { void load(); return subscribeToCompetition(() => void load()); }, []);

  const heroBackground = "/assets/nebula-vertical.webp";
  const heroBackdropStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    backgroundImage: [
      "linear-gradient(to top, #fff 0%, rgba(255,255,255,0.72) 24%, rgba(255,255,255,0.12) 58%, rgba(255,255,255,0) 100%),",

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
            <div><span className="home-hero__kicker" style={{ color: "#e42278", opacity: 1 }}>Street League</span><h1 id="home-hero-title" style={{ color: "#010a08" }}>Highlights</h1></div>
          </div>
          {social.length ? (
            <div className="home-hero__highlights">
              <a className="home-highlight home-highlight--feature" href={social[0].content_url} target="_blank" rel="noopener noreferrer">
                <div className="home-highlight__media">{social[0].thumbnail_url ? <img src={social[0].thumbnail_url} alt="" /> : <div className="home-highlight__fallback" />}</div>
                <div className="home-highlight__shade" />
                <div className="home-highlight__content"><h2>{social[0].title}</h2><span className="home-highlight__cta">Apri contenuto ↗</span></div>
              </a>
              <div className="home-hero__rail">
                {social.slice(1, 5).map((item, index) => (
                  <a className="home-highlight home-highlight--rail" href={item.content_url} target="_blank" rel="noopener noreferrer" key={item.id}>
                    <div className="home-highlight__media">{item.thumbnail_url ? <img src={item.thumbnail_url} alt="" /> : <div className="home-highlight__fallback" />}</div>
                    <div className="home-highlight__shade" />
                    <div className="home-highlight__content"><h3>{item.title}</h3><span className="home-highlight__arrow">↗</span></div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="home-hero__empty"><span className="home-hero__kicker" style={{ color: "#e42278", opacity: 1 }}>Highlights</span><h2 style={{ color: "#010a08" }}>Nessun highlight ancora.</h2><p style={{ color: "rgba(1,10,8,.62)" }}>I contenuti pubblicati appariranno qui.</p></div>
          )}
        </div>
      </section>

      <section className="section--edge home-schedule" id="home-matches">
        <span className="home-hero__competition" style={{ color: "rgba(1,10,8,.62)", opacity: 1 }}>Prossime giornate · tutte le competizioni attive</span>
        <div className="home-section-head"><SectionTitle eyebrow="" title="Calendario" /><a className="home-section-head__link" href="/partite">Tutte le partite ↗</a></div>
        <div className="home-schedule__grid">
          <div><MatchList matches={matches} teams={teams} competitions={activeCompetitionList} /></div>
          <div className="home-schedule__ranking"><div className="home-mini-head"><span>Classifiche attive</span><a href="/classifica">Complete ↗</a></div>{activeStandings.map((competition) => <div className="home-active-competition" key={competition.id}><h3>{competition.name}</h3><StandingsList standings={competition.standings} /><StaffRankingPreview items={competition.staff} /></div>)}{!activeStandings.length && <EmptyState title="Nessuna competizione attiva" text="Le classifiche appariranno qui quando ci saranno competizioni attive." />}</div>
        </div>
      </section>

      <section className="section--edge home-performers" id="home-stats">
        <div className="home-section-head"><SectionTitle eyebrow="Live data" title="Top performers" /></div>
        {statsGroups.map((group) => <div className="home-stat-group" key={group.id}><h3>{group.name}</h3>{group.competitions.length > 1 && <p className="admin-help-text">Dati aggregati da: {group.competitions.map((competition) => competition.name).join(" · ")}</p>}<div className="leaders">{leaderConfigs.map((config) => <LeaderPanel key={config.key} config={config} players={playerStatsByGroup[group.id] ?? []} />)}</div></div>)}{!statsGroups.length && <EmptyState title="Nessuna statistica attiva" text="Le statistiche appariranno qui quando ci saranno competizioni attive." />}
      </section>

      <section className="section--edge potm-section" id="home-potm">
        <div className="home-section-head"><SectionTitle eyebrow="Monthly award" title="POTM" /></div>
        <div className="monthly-awards-grid">
          <div className="monthly-award-column">
            <PlayerOfMonthCard item={potm} teams={teams} />
          </div>
          <div className="monthly-award-column">
            <div className="monthly-award-column__head">
              <span className="eyebrow">Monthly award</span>
              <h3>Miglior membro staff del mese</h3>
            </div>
            <StaffOfMonthCard
              items={staffMonthlyRanking}
              monthLabel={new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date())}
            />
          </div>
        </div>
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
