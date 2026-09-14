import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { ContentCarousel } from "../components/ContentCarousel";
import { CollabCarousel } from "../components/CollabCarousel";
import { LogoScroller } from "../components/LogoScroller";
import { getActiveCollaborations, getPartners } from "../lib/api";
import type { ActiveCollaboration, Partner } from "../types";

function SponsorCard({ partner }: { partner: Partner }) {
  const body = partner.logo_url ? <img src={partner.logo_url} alt={partner.name} /> : <strong>{partner.name}</strong>;
  return (
    <a
      className={`partner-card partner-card--${partner.tier}`}
      href={partner.website_url || "#"}
      target={partner.website_url ? "_blank" : undefined}
      rel={partner.website_url ? "noopener noreferrer" : undefined}
      onClick={(event) => {
        if (!partner.website_url) event.preventDefault();
      }}
    >
      {body}
      <span>{partner.name}</span>
    </a>
  );
}

export default function Partners() {
  const [items, setItems] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>([]);

  useEffect(() => {
    Promise.all([getPartners(), getActiveCollaborations()])
      .then(([partners, collabs]) => {
        setItems(partners);
        setCollaborations(collabs);
      })
      .catch(() => {
        setItems([]);
        setCollaborations([]);
      });
  }, []);

  const gold = useMemo(() => items.filter((partner) => partner.tier === "gold"), [items]);
  const silver = useMemo(() => items.filter((partner) => partner.tier === "silver"), [items]);
  const bronze = useMemo(() => items.filter((partner) => partner.tier === "bronze"), [items]);

  return (
    <PageShell>
      <div className="partners-page partners-page--redesign">
        <section className="partners-page__hero">
          <div className="partners-page__hero-bg" aria-hidden="true" />
          <div className="partners-page__hero-content">
            <h1>I nostri partner</h1>
            <p>Il network di brand e attività che sostiene il progetto dentro e fuori dal campo.</p>
            <a className="btn btn--primary" href="/collabora">Collabora con noi</a>
          </div>
        </section>

        <section className="section--edge partners-tier-section partners-tier-section--gold">
          <div className="partners-tier-heading">
            <div><h2>Partner Gold</h2></div>
            <p>La fascia di partnership con maggiore visibilità.</p>
          </div>
          {gold.length ? (
            <div className="partners-grid partners-grid--gold">
              {gold.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}
            </div>
          ) : (
            <EmptyState title="Gold sponsor in attesa" text="I partner Gold verranno mostrati qui dal database." />
          )}

          {collaborations.length ? (
            <div className="partners-active-collabs">
              <CollabCarousel items={collaborations} />
            </div>
          ) : null}
        </section>

        <section className="section--edge partners-tier-section partners-tier-section--silver">
          <div className="partners-tier-heading"><div><h2>Partner Silver</h2></div></div>
          {silver.length ? (
            <ContentCarousel>
              {silver.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}
            </ContentCarousel>
          ) : (
            <EmptyState title="Silver sponsor in attesa" text="I partner Silver verranno mostrati qui dal database." />
          )}
        </section>

        <section className="section--edge partners-tier-section partners-tier-section--bronze">
          <div className="partners-tier-heading"><div><h2>Partner Bronze</h2></div></div>
          {bronze.length ? (
            <LogoScroller partners={bronze} label="Bronze partners" />
          ) : (
            <LogoScroller partners={items.filter((partner) => partner.tier !== "gold")} label="League partners" />
          )}
        </section>
      </div>
    </PageShell>
  );
}
