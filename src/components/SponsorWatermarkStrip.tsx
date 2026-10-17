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

  const renderLogos = (clone: boolean) => {
    // Repeat short lists to avoid showing a blank tail as the marquee loops.
    const repetitions = Math.max(1, Math.ceil(4 / partners.length));
    return Array.from({ length: repetitions }, (_, repetition) =>
      partners.map((partner) => {
        const key = partner.id + "-" + repetition;
        const image = partner.logo_url ? (
          <img
            className="sponsor-watermark-strip__image"
            src={partner.logo_url}
            alt={clone ? "" : partner.name}
            title={partner.name}
            loading="lazy"
          />
        ) : (
          <span className="sponsor-watermark-strip__fallback">{partner.name}</span>
        );

        return partner.website_url ? (
          <a
            className="sponsor-watermark-strip__logo"
            key={key}
            href={partner.website_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={clone ? undefined : partner.name}
            tabIndex={clone ? -1 : undefined}
            title={partner.name}
          >
            {image}
          </a>
        ) : (
          <span className="sponsor-watermark-strip__logo" key={key}>{image}</span>
        );
      }),
    );
  };

  return (
    <aside className="sponsor-watermark-strip" aria-label="Sponsor Street League">
      <div className="sponsor-watermark-strip__heading">
        <Typography component="span" className="sponsor-watermark-strip__label">Supported by</Typography>
      </div>
      <div className="sponsor-watermark-strip__viewport">
        <div className="sponsor-watermark-strip__track">
          <div className="sponsor-watermark-strip__group">{renderLogos(false)}</div>
          <div className="sponsor-watermark-strip__group" aria-hidden="true">{renderLogos(true)}</div>
        </div>
      </div>
    </aside>
  );
}
