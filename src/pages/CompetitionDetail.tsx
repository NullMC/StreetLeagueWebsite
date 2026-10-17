import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions, getMatches, getTeams } from "../lib/api";
import type { Competition, Match, Team } from "../types";
import { MatchCard } from "../components/MatchCard";
import { TeamCarousel } from "../components/TeamCarousel";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";

type CompetitionSectionData = {
  competition: Competition;
  matches: Match[];
  teams: Team[];
};

type MatchdayBucket = {
  key: string;
  label: string;
  matches: Match[];
  firstKickoff: number;
};

function matchdayBuckets(matches: Match[]): MatchdayBucket[] {
  const buckets = new Map<string, MatchdayBucket>();
  matches.forEach((match) => {
    const date = new Date(match.kickoff_at);
    const dateKey = Number.isNaN(date.getTime())
      ? "da-definire"
      : date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    const rawSuppliedDay = match.matchday?.trim() || "";
    const key = rawSuppliedDay || "date:" + dateKey;
    const suppliedDay = rawSuppliedDay
      ? (/giornata/i.test(rawSuppliedDay)
          ? rawSuppliedDay.replace(/giornata/ig, "Giornata")
          : "Giornata " + rawSuppliedDay)
      : "";
    const label = suppliedDay || (Number.isNaN(date.getTime())
      ? "Data da definire"
      : "Data " + date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }));
    const current = buckets.get(key);
    if (current) {
      current.matches.push(match);
      current.firstKickoff = Math.min(current.firstKickoff, date.getTime() || Number.MAX_SAFE_INTEGER);
    } else {
      buckets.set(key, {
        key,
        label,
        matches: [match],
        firstKickoff: date.getTime() || Number.MAX_SAFE_INTEGER,
      });
    }
  });

  const ordered = Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    matches: [...bucket.matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
  })).sort((a, b) => {
    const numberA = a.label.match(/\d+/)?.[0];
    const numberB = b.label.match(/\d+/)?.[0];
    if (numberA && numberB && !a.key.startsWith("date:") && !b.key.startsWith("date:")) {
      const difference = Number(numberA) - Number(numberB);
      if (difference) return difference;
    }
    return a.firstKickoff - b.firstKickoff;
  });

  return ordered.map((bucket, index) => bucket.key.startsWith("date:")
    ? { ...bucket, label: "Giornata " + (index + 1) + " · " + bucket.label.replace(/^Data\s*/, "") }
    : bucket);
}

function MatchdayHeading({ competitionName }: { competitionName: string }) {
  return (
    <div className="competition-matchday-heading">
      <SectionTitle title={`Partite · ${competitionName}`} variant="subsection" />
    </div>
  );
}

function MatchdayMatchList({ section }: { section: CompetitionSectionData }) {
  const days = useMemo(() => matchdayBuckets(section.matches), [section.matches]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    if (days.length && !days.some((day) => day.key === selectedKey)) {
      setSelectedKey(days[0].key);
    }
  }, [days, selectedKey]);

  const selectedDay = days.find((day) => day.key === selectedKey) || days[0];
  if (!days.length) {
    return <EmptyState title="Nessuna partita" text="Non sono ancora presenti partite per questa competizione." />;
  }

  return (
    <section className="competition-matchday-section">
      <nav className="matchday-nav" aria-label={"Giornate " + section.competition.name}>
        {days.map((day) => (
          <button
            type="button"
            key={day.key}
            aria-pressed={selectedDay?.key === day.key}
            onClick={() => setSelectedKey(day.key)}
          >
            <span>{day.label}</span>
          </button>
        ))}
      </nav>
      {selectedDay ? (
        <>
          <p className="competition-matchday-section__label">
            {selectedDay.label} · {selectedDay.matches.length} {selectedDay.matches.length === 1 ? "partita" : "partite"}
          </p>
          <div className="match-grid">
            {selectedDay.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                home={section.teams.find((team) => team.id === match.home_team_id)}
                away={section.teams.find((team) => team.id === match.away_team_id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function CompetitionDetail() {
  const { competitionId = "", groupName } = useParams();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [sections, setSections] = useState<CompetitionSectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const allCompetitions = await getCompetitions();
        let selected: Competition[];

        if (groupName !== undefined) {
          let decodedName = groupName;
          try { decodedName = decodeURIComponent(groupName); } catch { /* Router has already decoded the parameter. */ }
          selected = allCompetitions.filter(
            (item) => item.status === "active" && item.statistics_group?.trim() === decodedName,
          );
        } else {
          const found = allCompetitions.find((item) => item.id === competitionId && item.status === "active");
          selected = found ? [found] : [];
        }

        if (!mounted) return;
        setCompetition(selected[0] ?? null);

        const nextSections = await Promise.all(selected.map(async (item) => {
          const [matches, teams] = await Promise.all([getMatches(item.id), getTeams(item.id)]);
          return { competition: item, matches, teams };
        }));
        if (mounted) setSections(nextSections);
      } catch (error) {
        console.error("Competition detail data error:", error);
        if (mounted) {
          setCompetition(null);
          setSections([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [competitionId, groupName]);

  const aggregated = sections.length > 1;

  const renderTeams = (section: CompetitionSectionData) => section.teams.length ? (
    <TeamCarousel teams={section.teams} label={"Squadre registrate a " + section.competition.name} />
  ) : (
    <EmptyState title="Nessuna squadra registrata" text="Non sono ancora presenti squadre registrate." />
  );

  return (
    <PageShell>
      {loading ? (
        <div className="page"><p className="admin-message">Caricamento competizione…</p></div>
      ) : competition ? (
        <>
          <div className="page competition-detail-page">
            {aggregated ? (
              sections.map((section) => (
                <section className="competition-detail-stage" key={section.competition.id}>
                  <MatchdayHeading competitionName={section.competition.name} />
                  <MatchdayMatchList section={section} />
                  <section className="competition-detail-section competition-detail-section--stage">
                    <SectionTitle eyebrow="Iscrizioni" title="Squadre registrate" variant="subsection" />
                    {renderTeams(section)}
                  </section>
                </section>
              ))
            ) : (
              <>
                <MatchdayHeading competitionName={sections[0].competition.name} />
                <MatchdayMatchList section={sections[0]} />
                <section className="competition-detail-section">
                  <SectionTitle eyebrow="Iscrizioni" title="Squadre registrate" variant="subsection" />
                  {renderTeams(sections[0])}
                </section>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState title="Competizione non trovata" text="Controlla il gruppo di aggregazione o la competizione selezionata." />
        </div>
      )}
      <SponsorWatermarkStrip />
    </PageShell>
  );
}
