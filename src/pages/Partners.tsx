import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getPartners } from "../lib/api";
import type { Partner } from "../types";
export default function Partners() {
  const [items, setItems] = useState<Partner[]>([]);
  useEffect(() => {
    getPartners()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  const tiers = ["gold", "silver", "bronze"] as const;
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="" title="I nostri partner" />
          <a className="btn btn--primary" href="/collabora">
            Collabora con noi
          </a>
        
        {items.length ? (
          tiers.map((tier) => (
            <section className="section" key={tier}>
              <SectionTitle
                title={tier.toUpperCase()}
              />
              <div className="partners-grid">
                {items
                  .filter((p) => p.tier === tier)
                  .map((p) => (
                    <a
                      className="partner-card"
                      href={p.website_url || "#"}
                      key={p.id}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.logo_url && <img src={p.logo_url} alt="" />}
                      <span>{p.name}</span>
                    </a>
                  ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title="Nessun partner"
            text="La gerarchia Gold / Silver / Bronze è pronta per il collegamento al database."
          />
        )}
      </div>
    </PageShell>
  );
}
