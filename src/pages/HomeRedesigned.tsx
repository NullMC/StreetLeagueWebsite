import { useEffect, useState } from "react";
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
import {
  getActiveCompetitions,
  getMatches,
  getSocialContent,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import { getPlayerOfMonth, getStaffOfMonth, subscribeToPlayerOfMonth } from "../lib/playerOfMonth";
import type { Competition, Match, SocialContent, Team } from "../types";

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
            <Link className="home-feature-card" key={item.id} to={"/articoli/" + item.id} aria-label={"Leggi articolo: " + item.title}>
              <div className="home-feature-card__media-link">
                <div className="home-feature-card__media">
                  {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <div className="home-feature-card__fallback" aria-hidden="true" />}
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
    competitionMatchdays[0];

  return (
    <div className="home-redesign home-redesign--ordered">
      <section className="home-about home-hero section--edge" id="home-about" aria-labelledby="home-about-title">
        <div className="home-hero__backdrop" aria-hidden="true" />
        <div className="home-hero__inner">
          <div className="home-about__logo">
            <img src="/assets/logo.png" alt="Logo Street League" />
          </div>
          <div className="home-about__copy">

            <h1 id="home-about-title">La Street League raccontata da vicino</h1>
            <p>
              Questa è la piattaforma dedicata alla community della Street League, dove puoi seguire le competizioni e restare aggiornato sulle ultime novità,
              squadre, partite, classifiche e statistiche aggiornate.
            </p>
          </div>
        </div>
        <a className="home-hero__scroll" href="#home-matches" aria-label="Scorri alla sezione Partite">
          <span className="home-hero__scroll-label">Scorri</span>
          <span className="home-hero__scroll-icon" aria-hidden="true">↓</span>
        </a>
      </section>

      {error ? <p className="admin-help-text home-load-error">{error}</p> : null}

      <section className="home-matches section--edge" id="home-matches">
        <div className="home-section-head">
          <SectionTitle eyebrow="Calendario" title="Partite" />
          <a className="home-section-head__link" href="/competizioni">Tutte le competizioni ↗</a>
        </div>
        {loading ? (
          <p className="admin-message">Caricamento partite…</p>
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
                <div className="home-matchdays__tabs" aria-label="Seleziona giornata">
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
                <div className="home-match-carousel" aria-label={"Partite " + selectedCompetition?.name + " " + selectedMatchday.label}>
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
          <a className="home-section-head__link" href="/competizioni">Esplora le competizioni ↗</a>
        </div>
        {loading ? (
          <p className="admin-message">Caricamento squadre…</p>
        ) : data.teams.length ? (
          <TeamCarousel teams={data.teams} label="Tutte le squadre della piattaforma" />
        ) : (
          <EmptyState title="Nessuna squadra" text="Le squadre appariranno qui quando saranno registrate nel database." />
        )}
      </section>

      <section className="home-featured section--edge" id="home-featured">
        <div className="home-section-head">
          <SectionTitle eyebrow="Dalla community" title="Contenuti in evidenza" />
        </div>
        {loading ? <p className="admin-message">Caricamento contenuti…</p> : <FeaturedContentCarousel items={data.social} />}
      </section>

      <div className="home-top-seven" id="home-top-seven"><TopSevenOfMonth /></div>

      <section className="section--edge potm-section" id="home-potm">
        <div className="home-section-head">
          <SectionTitle eyebrow="I protagonisti del mese" title="POTM & Staff" />
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
