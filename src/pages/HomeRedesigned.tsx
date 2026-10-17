import { useEffect, useState } from "react";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { TeamCarousel } from "../components/TeamCarousel";
import { PlayerOfMonthCard } from "../components/PlayerOfMonth";
import { StaffOfMonthCard } from "../components/StaffOfMonth";
import { TopSevenOfMonth } from "../components/TopSevenOfMonth";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import {
  getActiveCompetitions,
  getSocialContent,
  getStaffRankingForCompetitions,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import { getPlayerOfMonth } from "../lib/playerOfMonth";
import type { SocialContent, StaffRankingEntry, Team } from "../types";

type HomeData = {
  teams: Team[];
  social: SocialContent[];
  potm: Awaited<ReturnType<typeof getPlayerOfMonth>>;
  staffMonthly: StaffRankingEntry[];
};

const initialData: HomeData = {
  teams: [],
  social: [],
  potm: null,
  staffMonthly: [],
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
        {items.map((item) => (
          <a
            className="home-feature-card"
            href={item.content_url}
            target="_blank"
            rel="noopener noreferrer"
            key={item.id}
          >
            <div className="home-feature-card__media">
              {item.thumbnail_url || item.image_url ? (
                <img src={item.thumbnail_url || item.image_url || ""} alt="" loading="lazy" />
              ) : (
                <div className="home-highlight__fallback" />
              )}
            </div>
            <div className="home-feature-card__shade" />
            <div className="home-feature-card__content">
              <h3>{item.title}</h3>
              {item.description ? <p>{item.description}</p> : null}
              <span className="home-feature-card__cta">Apri contenuto <span aria-hidden="true">↗</span></span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function HomeRedesigned() {
  const [data, setData] = useState<HomeData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const now = new Date();
        const activeCompetitions = await getActiveCompetitions();
        const [allTeams, social, potm, staffMonthly] = await Promise.all([
          getTeams(),
          getSocialContent(),
          getPlayerOfMonth(),
          getStaffRankingForCompetitions(activeCompetitions.map((item) => item.id), {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          }),
        ]);

        if (!mounted) return;
        const uniqueTeams = Array.from(new Map(allTeams.map((team) => [team.id, team] as const)).values());
        setData({
          teams: uniqueTeams,
          social,
          potm,
          staffMonthly: staffMonthly.filter((entry) => entry.presidential_penalties > 0),
        });
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
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="home-redesign home-redesign--ordered">
      <section className="home-about home-hero section--edge" id="home-about" aria-labelledby="home-about-title">
        <div className="home-hero__backdrop" aria-hidden="true" />
        <div className="home-hero__inner">
          <div className="home-about__logo">
            <img src="/assets/favicon.png" alt="Logo Street League" />
          </div>
          <div className="home-about__copy">
            <span className="eyebrow">Street League Bari</span>
            <h1 id="home-about-title">Il calcio di strada, raccontato da vicino.</h1>
            <p>
              Street League è la piattaforma dedicata alle competizioni di calcio della community barese:
              qui trovi squadre, partite, classifiche e statistiche aggiornate, insieme ai protagonisti
              in campo e allo staff che rende possibile ogni giornata.
            </p>
          </div>
        </div>
      </section>

      {error ? <p className="admin-help-text home-load-error">{error}</p> : null}

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

      <section className="section--edge potm-section" id="home-potm">
        <div className="home-section-head">
          <SectionTitle eyebrow="I protagonisti del mese" title="POTM & Staff" />
        </div>
        <div className="monthly-awards-grid">
          <div className="monthly-award-column">
            <PlayerOfMonthCard item={data.potm} teams={data.teams} />
          </div>
          <div className="monthly-award-column">
            <div className="monthly-award-column__head">
              <h3>Miglior membro staff del mese</h3>
            </div>
            <StaffOfMonthCard
              items={data.staffMonthly}
              monthLabel={new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date())}
            />
          </div>
        </div>
      </section>

      <div className="home-top-seven" id="home-top-seven"><TopSevenOfMonth /></div>

      <SponsorWatermarkStrip />
    </div>
  );
}
