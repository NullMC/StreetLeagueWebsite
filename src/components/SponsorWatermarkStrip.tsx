import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import { getPartners } from "../lib/api";
import type { Partner } from "../types";

export function SponsorWatermarkStrip() {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    let mounted = true;
    getPartners()
      .then((items) => { if (mounted) setPartners(items); })
      .catch(() => { if (mounted) setPartners([]); });
    return () => { mounted = false; };
  }, []);

  if (!partners.length) return null;

  const logoItems = [...partners, ...partners];
  return (
    <aside className="sponsor-watermark-strip" aria-label="Sponsor Street League">
      <div className="sponsor-watermark-strip__heading">
        <Typography component="span" className="sponsor-watermark-strip__label">Supported by</Typography>
      </div>
      <div className="sponsor-watermark-strip__viewport">
        <div className="sponsor-watermark-strip__track">
          {logoItems.map((partner, index) => {
            const clone = index >= partners.length;
            const image = partner.logo_url ? (
              <img
                className="sponsor-watermark-strip__image"
                src={partner.logo_url}
                alt={clone ? "" : partner.name}
                title={partner.name}
                loading="lazy"
              />
            ) : (
              <span className="sponsor-watermark-strip__fallback" aria-hidden={clone || undefined}>{partner.name}</span>
            );

            return partner.website_url ? (
              <a
                className="sponsor-watermark-strip__logo"
                key={partner.id + (clone ? "-clone" : "")}
                href={partner.website_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={clone ? undefined : partner.name}
                aria-hidden={clone || undefined}
                tabIndex={clone ? -1 : undefined}
                title={partner.name}
              >
                {image}
              </a>
            ) : (
              <span
                className="sponsor-watermark-strip__logo"
                key={partner.id + (clone ? "-clone" : "")}
                aria-hidden={clone || undefined}
              >
                {image}
              </span>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
