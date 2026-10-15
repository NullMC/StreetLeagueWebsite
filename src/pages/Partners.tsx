import { useEffect, useState } from "react";
import { Button, Paper, Typography } from "@mui/material";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { CollabCarousel } from "../components/CollabCarousel";
import { SponsorGrid } from "../components/SponsorGrid";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import { getActiveCollaborations, getPartners } from "../lib/api";
import type { ActiveCollaboration, Partner } from "../types";

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [collaborations, setCollaborations] = useState<ActiveCollaboration[]>([]);
  useEffect(() => {
    let mounted = true;
    Promise.all([getPartners(), getActiveCollaborations()])
      .then(([items, collabs]) => {
        if (!mounted) return;
        setPartners(items);
        setCollaborations(collabs);
      })
      .catch(() => {
        if (!mounted) return;
        setPartners([]);
        setCollaborations([]);
      });
    return () => { mounted = false; };
  }, []);

  return <PageShell>
    <div className="page partners-unified-page">
      <Paper component="section" variant="outlined" className="unified-collab-section" id="collabora" elevation={0}>
        <div className="unified-collab-section__copy">
          <Typography component="h1" variant="h1">Collabora con Street League</Typography>
          <Typography component="p">
            Sostieni il progetto, dai visibilità alla tua attività e costruisci una collaborazione su misura.
            Non esistono pacchetti predefiniti: contattaci e valutiamo insieme le opportunità più adatte.
          </Typography>
          <Button component="a" href="mailto:streetleaguebari@gmail.com?subject=Collaborazione%20Street%20League" variant="contained">
            Richiedi informazioni
          </Button>
        </div>
        {collaborations.length
          ? <div className="unified-collab-section__media"><CollabCarousel items={collaborations} /></div>
          : <div className="unified-collab-section__note">
              <Typography component="h2" variant="h4">Una presenza dentro e fuori dal campo.</Typography>
              <Typography component="p">Raccontaci la tua attività: definiremo insieme una proposta di collaborazione personalizzata.</Typography>
            </div>}
      </Paper>
      <section className="unified-sponsors-section" id="sponsor">
        <SectionTitle title="I nostri sponsor" />
        <Typography component="p" className="unified-sponsors-section__intro">
          Le attività e i brand che contribuiscono alla crescita della Street League.
        </Typography>
        <SponsorWatermarkStrip />
        {partners.length ? <SponsorGrid partners={partners} /> : <EmptyState title="Sponsor in aggiornamento" text="I partner compariranno qui non appena saranno pubblicati dal back office." />}
      </section>
    </div>
  </PageShell>;
}
