import { useEffect, useState } from "react";
import { Button, Typography } from "@mui/material";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { SponsorGrid } from "../components/SponsorGrid";
import { getPartners } from "../lib/api";
import type { Partner } from "../types";

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPartners()
      .then((items) => {
        if (mounted) setPartners(items);
      })
      .catch((error) => {
        console.error("Impossibile caricare gli sponsor:", error);
        if (mounted) setPartners([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PageShell>
      <section className="sponsor-band sponsor-band--redesign partners-sponsors-band" id="home-partners">
        <div className="section--edge sponsor-band__inner">
          <section className="home-collab-proposal" id="collabora">
            <div className="home-collab-proposal__copy">
              <SectionTitle title="Collabora con Street League" />
              <p>
                Raccontaci della tua attività, costruiamo insieme una proposta adatta al tuo brand e cresci insieme a noi.
              </p>
              <Button
                component="a"
                href="mailto:streetleaguebari@gmail.com?subject=Collaborazione%20Street%20League"
                variant="outlined"
                className="home-collab-proposal__button"
              >
                Contattaci per saperne di più <span aria-hidden="true">↗</span>
              </Button>
            </div>
          </section>
          <section className="home-sponsors" aria-label="Sponsor Street League" id="sponsor">
            <div className="home-section-head home-section-head--on-pink">
              <SectionTitle title="I nostri sponsor" />
            </div>
            <div className="sponsor-cta-row">
              <Typography component="span" className="sponsor-cta-row__title">
                Il prossimo nome può essere il tuo.
              </Typography>
              <Button
                component="a"
                href="mailto:streetleaguebari@gmail.com?subject=Collaborazione%20Street%20League"
                variant="outlined"
                className="partners-sponsors-band__button"
              >
                Diventa sponsor <span aria-hidden="true">↗</span>
              </Button>
            </div>
            <Typography component="p" className="home-sponsors__intro">
              Le attività che contribuiscono alla crescita della Street League.
            </Typography>
            {loading ? (
              <Typography component="p" className="home-sponsors__loading">
                Caricamento sponsor…
              </Typography>
            ) : partners.length ? (
              <SponsorGrid partners={partners} />
            ) : (
              <EmptyState
                title="Sponsor in aggiornamento"
                text="I partner compariranno qui non appena saranno pubblicati dal back office."
              />
            )}
            
          </section>
        </div>
      </section>
    </PageShell>
  );
}
