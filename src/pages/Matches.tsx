import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { MatchCard } from "../components/MatchCard";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetition, getMatches, getTeams } from "../lib/api";
import type { Match, Team } from "../types";
export default function Matches() {
  const [m, setM] = useState<Match[]>([]),
    [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    (async () => {
      const c = await getActiveCompetition();
      setM(await getMatches(c?.id));
      setTeams(await getTeams(c?.id));
    })();
  }, []);
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="01 / Match center" title="Partite" />
        <p className="lede">
          Calendario, risultati e dettaglio completo degli eventi di gara.
        </p>
        {m.length ? (
          <div className="match-grid">
            {m.map((x) => (
              <MatchCard
                key={x.id}
                match={x}
                home={teams.find((t) => t.id === x.home_team_id)}
                away={teams.find((t) => t.id === x.away_team_id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna partita"
            text="Il calendario sarà disponibile non appena verranno registrate partite nel database."
          />
        )}
      </div>
    </PageShell>
  );
}
