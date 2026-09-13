import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions, getMatches, getTeams } from "../lib/api";
import type { Competition, Match, Team } from "../types";
import { MatchCard } from "../components/MatchCard";
export default function CompetitionDetail() {
  const { competitionId = "" } = useParams();
  const [c, setC] = useState<Competition | null>(null),
    [m, setM] = useState<Match[]>([]),
    [t, setT] = useState<Team[]>([]);
  useEffect(() => {
    (async () => {
      const cs = await getCompetitions();
      const cc = cs.find((x) => x.id === competitionId) || null;
      setC(cc);
      if (cc) {
        setM(await getMatches(cc.id));
        setT(await getTeams(cc.id));
      }
    })();
  }, [competitionId]);
  return (
    <PageShell>
      {c ? (
        <>
          <section className="detail-hero">
            <div className="detail-hero__inner">
              <span className="eyebrow">Competition / {c.status}</span>
              <h1>{c.name}</h1>
              <div className="detail-meta">
                <span>{c.season_label || "—"}</span>
                <span>{c.start_date || "—"}</span>
                <span>{c.end_date || "—"}</span>
              </div>
            </div>
          </section>
          <div className="page">
            <SectionTitle eyebrow="Calendar" title="Partite" />
            {m.length ? (
              <div className="match-grid">
                {m.map((x) => (
                  <MatchCard
                    key={x.id}
                    match={x}
                    home={t.find((q) => q.id === x.home_team_id)}
                    away={t.find((q) => q.id === x.away_team_id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Competizione non ancora iniziata"
                text="Non sono ancora presenti partite per questa competizione."
              />
            )}
          </div>
        </>
      ) : (
        <div className="page">
          <EmptyState title="Competizione non trovata" />
        </div>
      )}
    </PageShell>
  );
}
