import {
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Typography,
} from "@mui/material";
import type { Partner } from "../types";
import { sanitizeRichTextHtml } from "../lib/richText";

export function SponsorGrid({ partners }: { partners: Partner[] }) {
  return (
    <div className="partner-editorial-grid">
      {partners.map((partner) => (
        <Card
          className="partner-editorial-card"
          variant="outlined"
          key={partner.id}
          component="article"
        >
          <CardMedia component="div" className="partner-editorial-card__media">
            {partner.activity_image_url ? (
              <img
                className="partner-editorial-card__activity-image"
                src={partner.activity_image_url}
                alt={`Immagine dell’attività di ${partner.name}`}
                loading="lazy"
              />
            ) : (
              <div
                className="partner-editorial-card__media-fallback"
                aria-hidden="true"
              />
            )}
            <div className="partner-editorial-card__media-shade" aria-hidden="true" />
            <div className="partner-editorial-card__identity">
              {partner.logo_url ? (
                <img
                  className="partner-editorial-card__logo"
                  src={partner.logo_url}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="partner-editorial-card__logo partner-editorial-card__logo--placeholder" aria-hidden="true">
                  {partner.name.trim().slice(0, 1).toUpperCase() || "S"}
                </span>
              )}
              <Typography component="h3" variant="h5" className="partner-editorial-card__name">
                {partner.name}
              </Typography>
            </div>
          </CardMedia>
          <CardContent className="partner-editorial-card__content">
            {partner.description?.trim() ? (
              <div
                className="partner-editorial-card__description"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichTextHtml(partner.description),
                }}
              />
            ) : (
              <Typography component="p" className="partner-editorial-card__description partner-editorial-card__description--empty">
                Descrizione in aggiornamento.
              </Typography>
            )}
          </CardContent>
          <CardActions className="partner-editorial-card__actions">
            {partner.website_url ? (
              <Button
                component="a"
                href={partner.website_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                className="partner-editorial-card__button"
              >
                Visita la pagina <span aria-hidden="true">↗</span>
              </Button>
            ) : (
              <Button variant="outlined" disabled className="partner-editorial-card__button">
                Link non disponibile
              </Button>
            )}
          </CardActions>
        </Card>
      ))}
    </div>
  );
}
