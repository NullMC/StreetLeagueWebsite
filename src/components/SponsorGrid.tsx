import { Button, Card, CardContent, Typography } from "@mui/material";
import type { Partner } from "../types";
import { sanitizeRichTextHtml } from "../lib/richText";

export function SponsorGrid({ partners }: { partners: Partner[] }) {
  return <div className="partner-editorial-grid">
    {partners.map((partner,index) => <Card className={"partner-editorial-card partner-editorial-card--"+(index%5)} variant="outlined" key={partner.id}>
      <CardContent className="partner-editorial-card__content">
        <div className="partner-editorial-card__identity">
          {partner.logo_url
            ? <img className="partner-editorial-card__logo" src={partner.logo_url} alt="" />
            : <span className="partner-editorial-card__logo partner-editorial-card__logo--placeholder" aria-hidden="true">{partner.name.slice(0,1).toUpperCase()}</span>}
          <Typography component="h3" variant="h5" className="partner-editorial-card__name">{partner.name}</Typography>
        </div>
        {partner.description
          ? <div className="partner-editorial-card__description" dangerouslySetInnerHTML={{__html:sanitizeRichTextHtml(partner.description)}} />
          : <Typography component="p" className="partner-editorial-card__description partner-editorial-card__description--empty">Informazioni sul partner in aggiornamento.</Typography>}
        {partner.website_url
          ? <Button component="a" href={partner.website_url} target="_blank" rel="noopener noreferrer" variant="contained" className="partner-editorial-card__button">Visita la pagina ↗</Button>
          : <Button variant="outlined" disabled className="partner-editorial-card__button">Link non disponibile</Button>}
      </CardContent>
    </Card>)}
  </div>;
}
