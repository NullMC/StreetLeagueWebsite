import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions, getMatches, getTeams } from "../lib/api";
import type { Competition, Match, Team } from "../types";
import { MatchCard } from "../components/MatchCard";
import { TeamCarousel } from "../components/TeamCarousel";

type CompetitionSectionData = {
  competition: Competition;
  matches: Match[];
  teams: Team[];
};

export default function CompetitionDetail() {
  const { competitionId = "", groupName } = useParams();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<CompetitionSectionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const allCompetitions = await getCompetitions();
        let selected: Competition[];
        let selectedTitle: string;

        if (groupName !== undefined) {
          let decodedName = groupName;
          try {
            decodedName = decodeURIComponent(groupName);
          } catch {
            // React Router usually provides an already-decoded parameter.
          }
          selected = allCompetitions.filter(
            (item) => item.statistics_group?.trim() === decodedName,
          );
          selectedTitle = decodedName;
        } else {
          const found = allCompetitions.find((item) => item.id === competitionId);
          selected = found ? [found] : [];
          selectedTitle = found?.name ?? "";
        }

        if (!mounted) return;
        setCompetition(selected[0] ?? null);
        setTitle(selectedTitle);

        const nextSections = await Promise.all(
          selected.map(async (item) => {
            const [matches, teams] = await Promise.all([
              getMatches(item.id),
              getTeams(item.id),
            ]);
            return { competition: item, matches, teams };
          }),
        );
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
    return () => {
      mounted = false;
    };
  }, [competitionId, groupName]);

  const aggregated = sections.length > 1;

  const renderMatches = (section: CompetitionSectionData) =>
    section.matches.length ? (
      <div className="match-grid">
        {section.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            home={section.teams.find((team) => team.id === match.home_team_id)}
            away={section.teams.find((team) => team.id === match.away_team_id)}
          />
        ))}
      </div>
    ) : (
      <EmptyState title="Nessuna partita" text="Non sono ancora presenti partite per questa fase." />
    );

  const renderTeams = (section: CompetitionSectionData) =>
    section.teams.length ? (
      <TeamCarousel teams={section.teams} label={`Squadre registrate a ${section.competition.name}`} />
    ) : (
      <EmptyState title="Nessuna squadra registrata" text="Non sono ancora presenti squadre registrate per questa fase." />
    );

  return (
    <PageShell>
      {loading ? (
        <div className="page"><p className="admin-message">Caricamento competizione…</p></div>
      ) : competition ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">{aggregated ? `Competizione aggregata · ${sections.length} fasi` : `Competition / ${competition.status}`}</span>
              <h1>{title || competition.name}</h1>
              <div className="detail-meta">
                {aggregated ? (
                  <span>{`${sections.length} competizioni incluse · ogni fase è mostrata separatamente`}</span>
                ) : (
                  <>
                    <span>{competition.season_label || "—"}</span>
                    <span>{competition.start_date || "—"}</span>
                    <span>{competition.end_date || "—"}</span>
                  </>
                )}
              </div>
            </div>
          </section>

          <div className="page competition-detail-page">
            {aggregated ? (
              sections.map((section) => (
                <section className="competition-detail-stage" key={section.competition.id}>
                  <SectionTitle
                    eyebrow={`Fase · ${section.competition.status}`}
                    title={section.competition.name}
                    variant="group"
                  />
                  <SectionTitle eyebrow="Calendario della fase" title="Partite" variant="subsection" />
                  {renderMatches(section)}
                  <section className="competition-detail-section competition-detail-section--stage">
                    <SectionTitle eyebrow="Iscrizioni della fase" title="Squadre registrate" variant="subsection" />
                    {renderTeams(section)}
                  </section>
                </section>
              ))
            ) : (
              <>
                <SectionTitle eyebrow="Calendar" title="Partite" variant="subsection" />
                {renderMatches(sections[0])}
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
    </PageShell>
  );
}
