import type { Partner } from "../types";

type LogoScrollerProps = {
  partners: Partner[];
  label?: string;
  compact?: boolean;
};

function PartnerItem({ partner }: { partner: Partner }) {
  const content = partner.logo_url ? (
    <img src={partner.logo_url} alt={partner.name} />
  ) : (
    <span>{partner.name}</span>
  );

  return partner.website_url ? (
    <a
      className="logo-scroller__item"
      href={partner.website_url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Apri ${partner.name}`}
    >
      {content}
    </a>
  ) : (
    <div className="logo-scroller__item">{content}</div>
  );
}

export function LogoScroller({ partners, label, compact = false }: LogoScrollerProps) {
  if (!partners.length) return null;

  return (
    <div className={`logo-scroller ${compact ? "logo-scroller--compact" : ""}`}>
      {label && <span className="logo-scroller__label">{label}</span>}
      <div className="logo-scroller__viewport">
        <div className="logo-scroller__track">
          {Array.from({ length: 6 }, (_, copy) => (
            <div className="logo-scroller__set" key={copy} aria-hidden={copy > 0}>
              {partners.map((partner) => (
                <PartnerItem key={`${copy}-${partner.id}`} partner={partner} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
