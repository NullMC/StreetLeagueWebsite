import "../styles/collab-carousel.css";
import { useMemo, useRef, useState } from "react";
import { Box, Button, Card, CardContent, IconButton, Typography } from "@mui/material";
import type { ActiveCollaboration } from "../types";
import { sanitizeRichTextHtml } from "../lib/richText";

export function CollabCarousel({
  items,
  variant = "default",
}: {
  items: ActiveCollaboration[];
  variant?: "default" | "home";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const ordered = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items],
  );

  if (!ordered.length) return null;

  const goTo = (index: number) => {
    const next = (index + ordered.length) % ordered.length;
    setActive(next);
    viewportRef.current?.children.item(next)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  const move = (direction: 1 | -1) => goTo(active + direction);

  const updateActive = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    Array.from(viewport.children).forEach((child, index) => {
      const element = child as HTMLElement;
      const childCenter = element.offsetLeft + element.offsetWidth / 2;
      const nextDistance = Math.abs(center - childCenter);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = index;
      }
    });
    setActive((current) => current === closest ? current : closest);
  };

  return (
    <Box
      component="section"
      className={`collab-carousel ${variant === "home" ? "collab-carousel--home" : ""}`}
      aria-label="Collaborazioni attive"
      aria-roledescription="carosello"
    >
      <Box className="collab-carousel__toolbar">
        <Box className="collab-carousel__heading">
          <Typography component="h2" variant="h5">Collaborazioni attive</Typography>
          <Typography component="p" variant="body2">
            Progetti, iniziative e opportunità per la community Street League.
          </Typography>
        </Box>
        {ordered.length > 1 ? (
          <Box className="collab-carousel__controls">
            <IconButton
              type="button"
              className="collab-carousel__control"
              aria-label="Collaborazione precedente"
              onClick={() => move(-1)}
              size="small"
            >
              <span aria-hidden="true">←</span>
            </IconButton>
            <IconButton
              type="button"
              className="collab-carousel__control"
              aria-label="Collaborazione successiva"
              onClick={() => move(1)}
              size="small"
            >
              <span aria-hidden="true">→</span>
            </IconButton>
          </Box>
        ) : null}
      </Box>

      <Box
        className="collab-carousel__viewport"
        ref={viewportRef}
        onScroll={updateActive}
        role="region"
        aria-label="Elenco delle collaborazioni"
        tabIndex={0}
      >
        {ordered.map((item, index) => {
          const hasCta = Boolean(item.cta_url);
          const hasFlyer = Boolean(item.flyer_url);
          const contactHref = `mailto:streetleaguebari@gmail.com?subject=${encodeURIComponent("Informazioni: " + item.title)}`;

          return (
            <Card
              component="article"
              variant="outlined"
              elevation={0}
              className={`collab-carousel__item ${index === active ? "is-active" : ""}`}
              key={item.id}
              aria-label={item.title}
            >
              <Box className={`collab-carousel__ad ${hasFlyer ? "has-poster" : "is-copy-only"}`}>
                <CardContent className="collab-carousel__copy">
                  <Typography component="h3" variant="h4" className="collab-carousel__title">
                    {item.title}
                  </Typography>

                  {item.description ? (
                    <Box
                      className="collab-carousel__description"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(item.description) }}
                    />
                  ) : (
                    <Typography component="p" variant="body2" className="collab-carousel__description-empty">
                      Scopri i dettagli di questa iniziativa Street League.
                    </Typography>
                  )}

                  <Box className="collab-carousel__footer">
                    <Button
                      component="a"
                      className="collab-carousel__cta"
                      href={hasCta ? item.cta_url! : contactHref}
                      target={hasCta ? "_blank" : undefined}
                      rel={hasCta ? "noopener noreferrer" : undefined}
                      variant="outlined"
                      endIcon={<span aria-hidden="true">↗</span>}
                    >
                      {hasCta ? "Scopri la collaborazione" : "Richiedi informazioni"}
                    </Button>
                    <Typography component="span" variant="caption" className="collab-carousel__counter">
                      {String(index + 1).padStart(2, "0")} / {String(ordered.length).padStart(2, "0")}
                    </Typography>
                  </Box>
                </CardContent>

                {hasFlyer ? (
                  <Box component="figure" className="collab-carousel__poster">
                    <img src={item.flyer_url!} alt={`Materiale promozionale: ${item.title}`} loading="lazy" />
                  </Box>
                ) : (
                  <Box className="collab-carousel__visual-accent" aria-hidden="true">
                    <span>SL</span>
                  </Box>
                )}
              </Box>
            </Card>
          );
        })}
      </Box>

      {ordered.length > 1 ? (
        <Box className="collab-carousel__dots" aria-label="Seleziona una collaborazione">
          {ordered.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === active ? "is-active" : ""}
              aria-label={`Mostra collaborazione ${index + 1}: ${item.title}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => goTo(index)}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
