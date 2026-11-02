import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { sanitizeRichTextHtml } from "../lib/richText";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { TeamCarousel } from "../components/TeamCarousel";
import { MatchCard } from "../components/MatchCard";
import { PlayerOfMonthCard } from "../components/PlayerOfMonth";
import { StaffOfMonthCard } from "../components/StaffOfMonth";
import { TopSevenOfMonth } from "../components/TopSevenOfMonth";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import { HeroBackdrop } from "../components/fx/HeroBackdrop";
import { HeroLogo3D } from "../components/fx/HeroLogo3D";
import { SkeletonCards } from "../components/ui/Skeleton";
import {
  getActiveCompetitions,
  getMatches,
  getSocialContent,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import { getPlayerOfMonth, getStaffOfMonth, subscribeToPlayerOfMonth } from "../lib/playerOfMonth";
import type { Competition, Match, SocialContent, Team } from "../types";

const HERO_TITLE_WORDS = "La Street League raccontata da vicino".split(" ");
/** Da "raccontata" in poi il titolo passa al serif corsivo d'accento. */
const HERO_ACCENT_FROM = 3;

type HomeMatchday = {
  key: string;
  label: string;
  competitionId: string;
  competitionName: string;
  matches: Match[];
  firstKickoff: number;
};

function groupMatchesByMatchday(
  competitionMatches: Array<{ competition: Competition; matches: Match[] }>,
): HomeMatchday[] {
  const buckets = new Map<string, HomeMatchday>();

  competitionMatches.forEach(({ competition, matches }) => {
    matches.forEach((match) => {
      const date = new Date(match.kickoff_at);
      const hasValidDate = !Number.isNaN(date.getTime());
      const dateKey = hasValidDate
        ? date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0")
        : "da-definire";
      const suppliedDay = match.matchday?.trim() || "";
      const normalizedDay = suppliedDay.replace(/^giornata\s*/i, "").trim();
      const key = competition.id + ":" + (
        suppliedDay ? "round:" + normalizedDay.toLocaleLowerCase() : "date:" + dateKey
      );
      const label = suppliedDay
        ? (/giornata/i.test(suppliedDay)
            ? suppliedDay.replace(/giornata/ig, "Giornata")
            : "Giornata " + suppliedDay)
        : (hasValidDate
            ? "Data " + date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
            : "Data da definire");
      const kickoff = hasValidDate ? date.getTime() : Number.MAX_SAFE_INTEGER;
      const current = buckets.get(key);

      if (current) {
        current.matches.push(match);
        current.firstKickoff = Math.min(current.firstKickoff, kickoff);
      } else {
        buckets.set(key, {
          key,
          label,
          competitionId: competition.id,
          competitionName: competition.name,
          matches: [match],
          firstKickoff: kickoff,
        });
      }
    });
  });

  return Array.from(buckets.values())
    .map((day) => ({
      ...day,
      matches: [...day.matches].sort(
        (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
      ),
    }))
    .sort((a, b) => a.firstKickoff - b.firstKickoff);
}

/** Giornata da mostrare di default: quella con una partita LIVE, poi la prossima in programma, altrimenti l'ultima. */
function pickCurrentMatchday(matchdays: HomeMatchday[]): HomeMatchday | undefined {
  if (!matchdays.length) return undefined;
  const live = matchdays.find((matchday) => matchday.matches.some((match) => match.status === "live"));
  if (live) return live;
  const now = Date.now();
  const upcoming = matchdays.find((matchday) =>
    matchday.matches.some(
      (match) => match.status === "scheduled" && new Date(match.kickoff_at).getTime() >= now - 3 * 60 * 60 * 1000,
    ),
  );
  return upcoming ?? matchdays[matchdays.length - 1];
}

type HomeData = {
  competitions: Competition[];
  teams: Team[];
  social: SocialContent[];
  potm: Awaited<ReturnType<typeof getPlayerOfMonth>>;
  staffOfMonth: Awaited<ReturnType<typeof getStaffOfMonth>>;
  matchdays: HomeMatchday[];
};

const initialData: HomeData = {
  competitions: [],
  teams: [],
  social: [],
  potm: null,
  staffOfMonth: null,
  matchdays: [],
};

function FeaturedContentCarousel({ items }: { items: SocialContent[] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Nessun contenuto in evidenza"
        text="I contenuti pubblicati appariranno qui."
      />
    );
  }

  return (
    <div className="home-feature-carousel" aria-label="Contenuti in evidenza">
      <div className="home-feature-carousel__track">
        {items.map((item) => {
          const imageUrl = item.thumbnail_url || item.image_url;
          return (
            <Link className="home-feature-card" key={item.id} to={"/articoli/" + item.id} aria-label={"Leggi articolo: " + item.title} data-spotlight>
              <div className="home-feature-card__media-link">
                <div className="home-feature-card__media">
                  {imageUrl ? <img src={imageUrl} alt="" loading="lazy" decoding="async" /> : <div className="home-feature-card__fallback" aria-hidden="true" />}
                </div>
              </div>
              <div className="home-feature-card__content">
                <h3>{item.title}</h3>
                {item.description ? (
                  <div
                    className="home-feature-card__description"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(item.description, { allowLinks: false }),
                    }}
                  />
                ) : null}
                <span className="home-feature-card__cta">
                  <span>Leggi articolo</span><span aria-hidden="true">↗</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function HomeRedesigned() {
  const [data, setData] = useState<HomeData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedMatchdayKey, setSelectedMatchdayKey] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const activeCompetitions = await getActiveCompetitions();
        const [allTeams, social, potm, staffOfMonth, matchesByCompetition] = await Promise.all([
          getTeams(),
          getSocialContent(),
          getPlayerOfMonth(),
          getStaffOfMonth(),
          Promise.all(activeCompetitions.map(async (competition) => ({
            competition,
            matches: await getMatches(competition.id),
          }))),
        ]);

        if (!mounted) return;
        const uniqueTeams = Array.from(new Map(allTeams.map((team) => [team.id, team] as const)).values());
        const matchdays = groupMatchesByMatchday(matchesByCompetition);
        setData({
          competitions: activeCompetitions,
          teams: uniqueTeams,
          social,
          potm,
          staffOfMonth,
          matchdays,
        });
        setSelectedCompetitionId((current) =>
          activeCompetitions.some((competition) => competition.id === current)
            ? current
            : (activeCompetitions[0]?.id ?? ""),
        );
        setError("");
      } catch (loadError) {
        console.error("Home data error:", loadError);
        if (mounted) setError("Alcuni contenuti non sono al momento disponibili.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    const unsubscribe = subscribeToCompetition(() => void load());
    const unsubscribeAwards = subscribeToPlayerOfMonth(() => void load());
    return () => {
      mounted = false;
      unsubscribe();
      unsubscribeAwards();
    };
  }, []);

  const selectedCompetition =
    data.competitions.find((competition) => competition.id === selectedCompetitionId) ??
    data.competitions[0];
  const competitionMatchdays = selectedCompetition
    ? data.matchdays.filter((matchday) => matchday.competitionId === selectedCompetition.id)
    : [];
  const selectedMatchday =
    competitionMatchdays.find((matchday) => matchday.key === selectedMatchdayKey) ??
    pickCurrentMatchday(competitionMatchdays);

  // Mantiene visibile la giornata selezionata nella barra delle giornate.
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const rail = tabsRef.current;
    if (!active || !rail) return;
    rail.scrollTo({ left: active.offsetLeft - rail.clientWidth / 2 + active.clientWidth / 2, behavior: "smooth" });
  }, [selectedMatchday?.key]);

  // Leggera inclinazione 3D del logo nell'hero che segue il puntatore (solo dispositivi con mouse).
  const onHeroPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--tilt-x", ((event.clientX - box.left) / box.width - 0.5).toFixed(3));
    event.currentTarget.style.setProperty("--tilt-y", ((event.clientY - box.top) / box.height - 0.5).toFixed(3));
  };

  return (
    <div className="home-redesign home-redesign--ordered">
      <section
        className="sl-hero"
        id="home-about"
        aria-labelledby="home-about-title"
        onPointerMove={onHeroPointerMove}
      >
        <div className="sl-hero__bg" aria-hidden="true" />
        <HeroBackdrop />
        <div className="sl-hero__inner">
          <div className="sl-hero__copy">
            <h1 id="home-about-title" className="sl-hero__title">
              {HERO_TITLE_WORDS.map((word, index) => (
                <Fragment key={word + index}>
                  <span className={`sl-word${index >= HERO_ACCENT_FROM ? " sl-word--accent" : ""}`} style={{ "--i": index } as CSSProperties}>
                    <span className="sl-word__inner">{word}</span>
                  </span>
                  {index < HERO_TITLE_WORDS.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h1>
            <p className="sl-hero__lead">
              Questa è la piattaforma dedicata alla community della Street League, dove puoi seguire le competizioni e restare aggiornato sulle ultime novità,
              squadre, partite, classifiche e statistiche aggiornate.
            </p>
            <div className="sl-hero__actions">
              <a className="sl-btn sl-btn--primary" href="#home-matches">Partite</a>
              <Link className="sl-btn sl-btn--ghost" to="/classifica">Classifica</Link>
            </div>
          </div>

          <div className="sl-hero__side">
            <div className="sl-hero__logo">
              <HeroLogo3D />
            </div>
          </div>
        </div>
        <a className="sl-hero__scroll" href="#home-matches" aria-label="Scorri alla sezione Partite">
          <span>Scorri</span>
          <span className="sl-hero__scroll-icon" aria-hidden="true">↓</span>
        </a>
      </section>

      {error ? <p className="admin-help-text home-load-error">{error}</p> : null}

      <section className="home-matches section--edge" id="home-matches">
        <div className="home-section-head">
          <SectionTitle eyebrow="Calendario" title="Partite" />
          <Link className="home-section-head__link" to="/competizioni">Tutte le competizioni ↗</Link>
        </div>
        {loading ? (
          <SkeletonCards label="Caricamento partite…" count={3} />
        ) : data.competitions.length ? (
          <div className="home-matchdays">
            <div className="home-matchdays__competition">
              <label htmlFor="home-match-competition">Seleziona competizione</label>
              <select
                id="home-match-competition"
                value={selectedCompetition?.id ?? ""}
                onChange={(event) => {
                  setSelectedCompetitionId(event.target.value);
                  setSelectedMatchdayKey("");
                }}
              >
                {data.competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedMatchday ? (
              <>
                <div className="home-matchdays__tabs" aria-label="Seleziona giornata" ref={tabsRef}>
                  {competitionMatchdays.map((matchday) => (
                    <button
                      type="button"
                      className="home-matchday-tab"
                      key={matchday.key}
                      aria-pressed={selectedMatchday.key === matchday.key}
                      onClick={() => setSelectedMatchdayKey(matchday.key)}
                    >
                      <strong>{matchday.label}</strong>
                    </button>
                  ))}
                </div>
                <div className="home-matchdays__summary">
                  <h3>{selectedCompetition?.name} · {selectedMatchday.label}</h3>
                  <span>{selectedMatchday.matches.length} {selectedMatchday.matches.length === 1 ? "partita" : "partite"}</span>
                </div>
                <div className="sl-match-rail" aria-label={"Partite " + selectedCompetition?.name + " " + selectedMatchday.label}>
                  {selectedMatchday.matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      home={data.teams.find((team) => team.id === match.home_team_id)}
                      away={data.teams.find((team) => team.id === match.away_team_id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="Nessuna partita in calendario"
                text={`Non ci sono ancora partite inserite per ${selectedCompetition?.name ?? "questa competizione"}.`}
              />
            )}
          </div>
        ) : (
          <EmptyState
            title="Nessuna competizione attiva"
            text="Le partite appariranno qui quando sarà attivata una competizione e saranno inseriti gli incontri."
          />
        )}
      </section>

      <section className="section--edge home-teams" id="home-teams">
        <div className="home-section-head">
          <SectionTitle eyebrow="Le protagoniste" title="Squadre" />
          <Link className="home-section-head__link" to="/competizioni">Esplora le competizioni ↗</Link>
        </div>
        {loading ? (
          <SkeletonCards label="Caricamento squadre…" count={6} variant="tile" />
        ) : data.teams.length ? (
          <TeamCarousel teams={data.teams} label="Tutte le squadre della piattaforma" />
        ) : (
          <EmptyState title="Nessuna squadra" text="Le squadre appariranno qui quando saranno registrate nel database." />
        )}
      </section>

      <section className="home-featured section--edge" id="home-featured">
        <div className="home-section-head">
          <SectionTitle eyebrow="Dalla community" title="Contenuti in evidenza" accent="in evidenza" />
        </div>
        {loading ? <SkeletonCards label="Caricamento contenuti…" count={4} /> : <FeaturedContentCarousel items={data.social} />}
      </section>

      <div className="home-top-seven" id="home-top-seven"><TopSevenOfMonth /></div>

      <section className="section--edge potm-section" id="home-potm">
        <div className="home-section-head">
          <SectionTitle eyebrow="I protagonisti del mese" title="POTM & Staff" accent="& Staff" />
        </div>
        <div className="monthly-awards-grid">
          <div className="monthly-award-column">
            <PlayerOfMonthCard item={data.potm} teams={data.teams} />
          </div>
          <div className="monthly-award-column">
            <StaffOfMonthCard
              item={data.staffOfMonth}
              monthLabel={new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date())}
            />
          </div>
        </div>
      </section>

      <SponsorWatermarkStrip />
    </div>
  );
}
