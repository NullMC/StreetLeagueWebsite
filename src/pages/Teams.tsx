import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { TeamCarousel } from "../components/TeamCarousel";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetition, getTeams } from "../lib/api";
import type { Team } from "../types";

export default function Teams() {
  const [items, setItems] = useState<Team[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const competition = await getActiveCompetition();
        setItems(await getTeams(competition?.id));
      } catch (error) {
        console.error("Teams data error:", error);
        setItems([]);
      }
    })();
  }, []);

  return (
    <PageShell>
      <div className="page teams-page">
        <SectionTitle eyebrow="League" title="Squadre" />
        {items.length ? (
          <>
            <TeamCarousel teams={items} label="Tutte le squadre della competizione" />
            <div className="teams-page__hint">
              <span>Scorri per esplorarle tutte</span>
            </div>
          </>
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
