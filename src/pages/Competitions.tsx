import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions } from "../lib/api";
import type { Competition } from "../types";
export default function Competitions() {
  const [items, setItems] = useState<Competition[]>([]);
  useEffect(() => {
    getCompetitions()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="" title="Competizioni" />
        {items.length ? (
          <div className="cards-grid">
            {items.map((c) => (
              <a
                className="stat-card"
                key={c.id}
                href={`/competizioni/${c.id}`}
              >
                <span className="eyebrow">{c.status}</span>
                <h3>{c.name}</h3>
                <p>{c.season_label || "—"}</p>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Competizione non ancora iniziata"
            text="Non ci sono competizioni disponibili nel database."
          />
        )}
      </div>
    </PageShell>
  );
}
