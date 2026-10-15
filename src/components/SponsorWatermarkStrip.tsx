import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import { getPartners } from "../lib/api";
import type { Partner } from "../types";

export function SponsorWatermarkStrip() {
  const [partners,setPartners] = useState<Partner[]>([]);
  useEffect(() => {
    let mounted = true;
    getPartners().then(items => { if(mounted) setPartners(items); }).catch(() => { if(mounted) setPartners([]); });
    return () => { mounted=false; };
  }, []);
  if (!partners.length) return null;
  return <aside className="sponsor-watermark-strip" aria-label="Supported by: sponsor Street League">
    <Typography component="span" className="sponsor-watermark-strip__label">Supported by</Typography>
    <div className="sponsor-watermark-strip__logos">
      {partners.map(partner => {
        const image = partner.logo_url ? <img src={partner.logo_url} alt={partner.name} title={partner.name} /> : <span title={partner.name}>{partner.name}</span>;
        return partner.website_url
          ? <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer" aria-label={partner.name}>{image}</a>
          : <span className="sponsor-watermark-strip__logo" key={partner.id}>{image}</span>;
      })}
    </div>
  </aside>;
}
