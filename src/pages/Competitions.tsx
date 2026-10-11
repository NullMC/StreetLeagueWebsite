import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions } from "../lib/api";
import type { Competition } from "../types";

type CompetitionListing = {
  key: string;
  name: string;
  groupName: string | null;
  competitions: Competition[];
  status: Competition["status"];
};

function buildCompetitionListings(competitions: Competition[]): CompetitionListing[] {
  const groups = new Map<string, CompetitionListing>();

  competitions.forEach((competition) => {
    const groupName = competition.statistics_group?.trim() || null;
    const key = groupName ? `group:${groupName}` : `competition:${competition.id}`;
    const existing = groups.get(key);
    if (existing) {
      existing.competitions.push(competition);
      return;
    }

    groups.set(key, {
      key,
      name: groupName || competition.name,
      groupName,
      competitions: [competition],
      status: competition.status,
    });
  });

  return Array.from(groups.values())
    .map((listing) => ({
      ...listing,
      status: listing.competitions.some((competition) => competition.status === "active")
        ? "active"
        : listing.competitions.some((competition) => competition.status === "upcoming")
          ? "upcoming"
          : "finished",
    }))
    .sort((a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      a.name.localeCompare(b.name, "it"),
    );
}

export default function Competitions() {
  const [items, setItems] = useState<CompetitionListing[]>([]);

  useEffect(() => {
    getCompetitions()
      .then((competitions) => setItems(buildCompetitionListings(competitions)))
      .catch(() => setItems([]));
  }, []);

  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="" title="Competizioni" />
        {items.length ? (
          <div className="cards-grid">
            {items.map((listing) => {
              const href = listing.groupName
                ? `/competizioni/gruppo/${encodeURIComponent(listing.groupName)}`
                : `/competizioni/${listing.competitions[0].id}`;
              return (
                <a className="stat-card competition-list-card" key={listing.key} href={href}>
                  <span className="eyebrow">
                    {listing.status}
                    {listing.competitions.length > 1 ? ` · ${listing.competitions.length} fasi` : ""}
                  </span>
                  <h3>{listing.name}</h3>
                  <p>
                    {listing.competitions.length > 1
                      ? listing.competitions.map((competition) => competition.name).join(" · ")
                      : listing.competitions[0].season_label || "—"}
                  </p>
                  {listing.competitions.length > 1 && (
                    <span className="competition-list-card__hint">Apri calendario e squadre per fase <span aria-hidden="true">↗</span></span>
                  )}
                </a>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nessuna competizione disponibile" text="Le competizioni appariranno qui quando saranno registrate nel database." />
        )}
      </div>
    </PageShell>
  );
}
