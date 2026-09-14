import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { ContentCarousel } from "../components/ContentCarousel";
import { CollabCarousel } from "../components/CollabCarousel";
import { LogoScroller } from "../components/LogoScroller";
import { getActiveCollaborations, getPartners } from "../lib/api";
import type { ActiveCollaboration, Partner } from "../types";

function SponsorCard({ partner }: { partner: Partner }) {
  const body = partner.logo_url ? <img src={partner.logo_url} alt={partner.name} /> : <strong>{partner.name}</strong>;
  const hasLink = Boolean(partner.website_url);
  const isPrimary = partner.tier === "gold" || partner.tier === "silver";
  return (
    <article className={`partner-card partner-card--${partner.tier}`}>
      <div className="partner-card__logo">{body}</div>
      <span>{partner.name}</span>
      {isPrimary ? (
        <a className={`btn btn--small btn--primary sponsor-link-btn ${hasLink ? "" : "sponsor-link-btn--disabled"}`} href={hasLink ? partner.website_url! : "#"} target={hasLink ? "_blank" : undefined} rel={hasLink ? "noopener noreferrer" : undefined} aria-disabled={!hasLink} onClick={(event) => { if (!hasLink) event.preventDefault(); }}>
          {hasLink ? "Visita piattaforma ↗" : "Piattaforma non disponibile"}
        </a>
      ) : null}
    </article>
  );
}

export default function Partners() {
  const [items, setItems] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>([]);
  useEffect(() => {
    Promise.all([getPartners(), getActiveCollaborations()]).then(([partners, collabs]) => { setItems(partners); setCollaborations(collabs); }).catch(() => { setItems([]); setCollaborations([]); });
  }, []);
  const gold = useMemo(() => items.filter((partner) => partner.tier === "gold"), [items]);
  const silver = useMemo(() => items.filter((partner) => partner.tier === "silver"), [items]);
  const bronze = useMemo(() => items.filter((partner) => partner.tier === "bronze"), [items]);
  return (
    <div className="partners-page partners-page--redesign">
      <section className="partners-page__hero">
        <div className="partners-page__hero-bg" aria-hidden="true" />
        <div className="partners-page__hero-content partners-page__hero-content--with-collabs">
          <div className="partners-page__hero-copy"><span className="eyebrow">Street League network</span><h1>I nostri partner</h1><p>Il network di brand e attività che sostiene il progetto dentro e fuori dal campo.</p><a className="btn btn--primary" href="/collabora">Collabora con noi</a></div>
          {collaborations.length ? <div className="partners-page__hero-collabs"><CollabCarousel items={collaborations} /></div> : null}
        </div>
      </section>
      <section className="section--edge partners-tier-section partners-tier-section--gold"><div className="partners-tier-heading"><div><span className="eyebrow">Main partners</span><h2>Partner Gold</h2><p>La fascia di partnership con maggiore visibilità.</p></div></div>{gold.length ? <div className="partners-grid partners-grid--gold">{gold.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}</div> : <EmptyState title="Gold sponsor in attesa" text="I partner Gold verranno mostrati qui dal database." />}</section>
      <section className="section--edge partners-tier-section partners-tier-section--silver"><div className="partners-tier-heading"><div><h2>Partner Silver</h2><p>Presenza editoriale e digitale dedicata.</p></div></div>{silver.length ? <ContentCarousel>{silver.map((partner) => <SponsorCard key={partner.id} partner={partner} />)}</ContentCarousel> : <EmptyState title="Silver sponsor in attesa" text="I partner Silver verranno mostrati qui dal database." />}</section>
      <section className="section--edge partners-tier-section partners-tier-section--bronze"><div className="partners-tier-heading"><div><h2>Partner Bronze</h2></div></div>{bronze.length ? <LogoScroller partners={bronze} label="Bronze sponsors" /> : <LogoScroller partners={items.filter((partner) => partner.tier !== "gold")} label="League partners" />}</section>
    </div>
  );
}
