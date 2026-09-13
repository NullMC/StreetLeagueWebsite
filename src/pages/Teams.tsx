import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { TeamCard } from "../components/TeamCard";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetition, getTeams } from "../lib/api";
import type { Team } from "../types";
export default function Teams() {
  const [items, setItems] = useState<Team[]>([]);
  useEffect(() => {
    (async () => {
      const c = await getActiveCompetition();
      setItems(await getTeams(c?.id));
    })();
  }, []);
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="" title="Squadre" />
        {items.length ? (
          <div className="cards-grid">
            {items.map((t) => (
              <TeamCard key={t.id} team={t} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna squadra"
            text="Le squadre appariranno qui quando saranno registrate nel database."
          />
        )}
      </div>
    </PageShell>
  );
}
