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
  getPartners,
  getPlayerStatsForCompetitions,
  getSocialContent,
  getStaffRankingForCompetitions,
  getStatisticsGroups,
  getTeams,
  subscribeToCompetition,
} from "../lib/api";
import { getPlayerOfMonth } from "../lib/playerOfMonth";
import type {
  Partner,
  Player,
  PlayerStats,
  SocialContent,
  StaffRankingEntry,
  StatisticsGroup,
  Team,
} from "../types";

type RankedPlayer = Player & { stats: PlayerStats; team_name: string };
type HomeData = {
  teams: Team[];
  social: SocialContent[];
  partners: Partner[];
  groups: StatisticsGroup[];
  playersByGroup: Record<string, RankedPlayer[]>;
  staffByGroup: Record<string, StaffRankingEntry[]>;
  potm: Awaited<ReturnType<typeof getPlayerOfMonth>>;
  staffMonthly: StaffRankingEntry[];
};

const initialData: HomeData = {
  teams: [],
  social: [],
  partners: [],
  groups: [],
  playersByGroup: {},
  staffByGroup: {},
  potm: null,
  staffMonthly: [],
};

function isStaff(player: Pick<Player, "role" | "position">) {
  return player.role?.trim().toUpperCase() === "STAFF" ||
    player.position?.trim().toUpperCase() === "STAFF";
}

function isGoalkeeper(player: RankedPlayer) {
  const position = (player.position || "").trim().toLocaleLowerCase("it");
  return position.includes("portier") || position.includes("goalkeeper") ||
    position.includes("goalie") || position === "gk" || position === "por";
}

const homeStats = [
  { key: "goals", title: "Miglior marcatore", unit: "gol" },
  { key: "mvps", title: "Record MVP", unit: "MVP" },
  { key: "clean_sheets", title: "Miglior portiere", unit: "clean sheet" },
] as const;

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
        {items.map((item, index) => (
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
            <span className="home-feature-card__index">{String(index + 1).padStart(2, "0")}</span>
            <span className="home-feature-card__platform">{item.platform}</span>
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

function BestStatsCard({
  group,
  title,
  category,
  players,
  staff,
}: {
  group: StatisticsGroup;
  title: string;
  category: "goals" | "mvps" | "clean_sheets" | "staff";
  players: RankedPlayer[];
  staff: StaffRankingEntry[];
}) {
  const staffLeader = staff.filter((entry) => entry.presidential_penalties > 0)[0];
  const ranked = category === "staff"
    ? []
    : [...players]
        .filter((player) => player.stats[category] > 0)
        .filter((player) => category !== "clean_sheets" || isGoalkeeper(player))
        .sort((a, b) =>
          b.stats[category] - a.stats[category] ||
          (a.last_name + " " + a.first_name).localeCompare(b.last_name + " " + b.first_name, "it"),
        );
  const top = ranked[0];
  const value = category === "staff"
    ? staffLeader?.presidential_penalties ?? 0
    : top?.stats[category] ?? 0;
  const name = category === "staff"
    ? staffLeader ? staffLeader.player.first_name + " " + staffLeader.player.last_name : "Nessun record"
    : top ? top.first_name + " " + top.last_name : "Nessun record";

  return (
    <a
      className="stat-card home-best-stat-card"
      href={"/statistiche/" + encodeURIComponent(group.id) + "/" + category}
      aria-label={"Apri la classifica: " + title + ", " + group.name}
    >
      <span className="eyebrow">{title}</span>
      <h3>{name}</h3>
      <div className="stat-card__value">{String(value).padStart(2, "0")}</div>
      <span className="home-best-stat-card__scope">{group.name}</span>
      <span className="home-best-stat-card__hint">Apri classifica <span aria-hidden="true">↗</span></span>
    </a>
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
        const groups = await getStatisticsGroups(activeCompetitions);

        const [allTeams, partners, social, potm, staffMonthly, groupData] = await Promise.all([
          getTeams(),
          getPartners(),
          getSocialContent(),
          getPlayerOfMonth(),
          getStaffRankingForCompetitions(activeCompetitions.map((item) => item.id), {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          }),
          Promise.all(groups.map(async (group) => {
            const [players, staff] = await Promise.all([
              getPlayerStatsForCompetitions(group.competition_ids),
              getStaffRankingForCompetitions(group.competition_ids),
            ]);
            const teamsInGroup = await Promise.all(group.competition_ids.map((id) => getTeams(id)));
            const teamById = new Map<string, Team>();
            teamsInGroup.flat().forEach((team) => teamById.set(team.id, team));
            const rankedPlayers: RankedPlayer[] = players
              .filter((player) => !isStaff(player))
              .map((player) => ({
                ...player,
                team_name: teamById.get(player.team_id)?.name ?? "—",
              }));
            return { id: group.id, players: rankedPlayers, staff };
          })),
        ]);

        if (!mounted) return;
        const uniqueTeams = Array.from(new Map(allTeams.map((team) => [team.id, team] as const)).values());
        setData({
          teams: uniqueTeams,
          partners,
          social,
          potm,
          staffMonthly: staffMonthly.filter((entry) => entry.presidential_penalties > 0),
          groups,
          playersByGroup: Object.fromEntries(groupData.map((entry) => [entry.id, entry.players])),
          staffByGroup: Object.fromEntries(groupData.map((entry) => [entry.id, entry.staff])),
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
      <section className="home-about section--edge" id="home-about" aria-labelledby="home-about-title">
        <div className="home-about__copy">
          <span className="eyebrow">Street League Bari</span>
          <h1 id="home-about-title">Il calcio di strada, raccontato da vicino.</h1>
          <p>
            Street League è la piattaforma dedicata alle competizioni di calcio della community barese:
            qui trovi squadre, partite, classifiche e statistiche aggiornate, insieme ai protagonisti
            in campo e allo staff che rende possibile ogni giornata.
          </p>
        </div>
        <div className="home-about__aside" aria-hidden="true">
          <span>Una lega.</span>
          <span>La nostra città.</span>
          <strong>Il nostro gioco.</strong>
        </div>
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

      <section className="section--edge home-top-seven" id="home-top-seven">
        <TopSevenOfMonth />
      </section>

      <section className="home-best-stats section--edge" id="home-best-stats">
        <div className="home-section-head">
          <SectionTitle eyebrow="Competenze e riconoscimenti" title="Best stats" />
          <a className="home-section-head__link" href="/statistiche">Tutte le statistiche ↗</a>
        </div>
        {error ? <p className="admin-help-text">{error}</p> : null}
        {loading ? (
          <p className="admin-message">Caricamento statistiche…</p>
        ) : data.groups.length ? (
          data.groups.map((group) => (
            <section className="home-best-stats__group" key={group.id}>
              <h3>{group.name}</h3>
              <div className="leaders home-best-stats__grid">
                {homeStats.map((stat) => (
                  <BestStatsCard
                    key={stat.key}
                    group={group}
                    title={stat.title}
                    category={stat.key}
                    players={data.playersByGroup[group.id] ?? []}
                    staff={data.staffByGroup[group.id] ?? []}
                  />
                ))}
                <BestStatsCard
                  group={group}
                  title="Miglior membro staff"
                  category="staff"
                  players={data.playersByGroup[group.id] ?? []}
                  staff={data.staffByGroup[group.id] ?? []}
                />
              </div>
            </section>
          ))
        ) : (
          <EmptyState title="Nessuna statistica attiva" text="Le best stats verranno mostrate qui quando ci saranno competizioni attive." />
        )}
      </section>

      <SponsorWatermarkStrip />
    </div>
  );
}
