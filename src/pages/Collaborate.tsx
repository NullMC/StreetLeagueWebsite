import type { ReactNode } from "react";
import { PageShell } from "../components/PageShell";

type SponsorshipPackage = {
  name: string;
  price: string;
  description: string;
  accent: "bronze" | "silver" | "gold";
  benefits: ReactNode[];
};

const sponsorshipPackages: SponsorshipPackage[] = [
  {
    name: "Bronze",
    price: "300€",
    accent: "bronze",
    description: "",
    benefits: [
      "Menzione collettiva degli sponsor Bronze sulla pagina ufficiale del torneo.",
      "Presenza del logo nei banner pubblicitari presenti in diverse aree del centro sportivo.",
      "1 storia Instagram dedicata agli sponsor Bronze sulla pagina ufficiale del torneo.",
      "Presenza del logo nei principali materiali grafici e promozionali della Street League.",
    ],
  },
  {
    name: "Silver",
    price: "500€",
    accent: "silver",
    description: "",
    benefits: [
      "Menzione dedicata dell’attività sulla pagina ufficiale del torneo.",
      "Presenza del logo nei banner pubblicitari in più aree del centro sportivo.",
      "Pubblicazione di 2 storie Instagram dedicate all’attività sulla pagina ufficiale del torneo.",
      "1 post dedicato all’attività sulla pagina ufficiale del torneo.",
      "Inserimento del logo nei principali contenuti grafici e promozionali del torneo.",
      "Presenza del brand nelle comunicazioni digitali relative agli eventi del torneo.",
    ],
  },
  {
    name: "Gold",
    price: "800€",
    accent: "gold",
    description: "",
    benefits: [
      "Sponsor ufficiale Gold con menzione privilegiata in tutte le principali comunicazioni.",
      "Logo in posizione premium su banner singolo o dedicato.",
      "1 contenuto video dedicato pubblicato sui canali social ufficiali.",
      "3 storie Instagram dedicate all’attività.",
      "2 post dedicati sulla pagina ufficiale (date da concordare).",
      "Filigrana degli Sponsor Gold costantemente presente nelle registrazioni YouTube.",
      "Possibilità di inserire materiale pubblicitario fisico al centro sportivo.",
      "Possibilità di distribuire flyer o gadget ai partecipanti.",
      "Menzione in qualità di Gold Sponsor durante le premiazioni e momenti ufficiali.",
      <>
        20% di sconto sullo sviluppo di{" "}
        <a href="https://franksitez.com/" target="_blank" rel="noopener noreferrer">
          <strong style={{ color: "#F1CF18" }}>soluzioni digitali</strong>
        </a>{" "}
        personalizzate per la propria attività
      </>,
      <>
        scontistiche su lavori di{" "}
        <a href="https://www.instagram.com/_acvisual_/" target="_blank" rel="noopener noreferrer">
          <strong style={{ color: "#F1CF18" }}>grafiche, montaggio video e branding</strong>
        </a>{" "}
      </>,
    ],
  },
];

export default function Collaborate() {
  return (
    <PageShell>
      <div className="collaborate-page collaborate-page--redesign">
        <section className="collaborate-hero" aria-labelledby="collaborate-title">
          <div className="collaborate-abstract" aria-hidden="true">
            <span className="collaborate-abstract__orb collaborate-abstract__orb--one" />
            <span className="collaborate-abstract__orb collaborate-abstract__orb--two" />
            <span className="collaborate-abstract__band collaborate-abstract__band--one" />
            <span className="collaborate-abstract__band collaborate-abstract__band--two" />
            <span className="collaborate-abstract__line collaborate-abstract__line--one" />
            <span className="collaborate-abstract__line collaborate-abstract__line--two" />
          </div>
          <div className="collaborate-hero__content">
            <span className="eyebrow">Street League / Partnership</span>
            <h1 id="collaborate-title" className="collaborate-hero__title">
              PORTA IL TUO
              <br />
              BRAND IN CAMPO
            </h1>
            <p className="collaborate-hero__intro">PROPOSTA UFFICIALE DI SPONSORIZZAZIONE</p>
            <a className="btn btn--primary" href="mailto:streetleaguebari@gmail.com">Contatta il team</a>
          </div>
        </section>

        <section className="collaborate-section collaborate-section--intro">
          <div className="collaborate-container">
            <div className="collaborate-intro-layout">
              <div>
                <span className="eyebrow">01 / Il progetto</span>
                <h2>Una presenza che resta dentro e fuori dal campo.</h2>
              </div>
              <div className="collaborate-intro-copy">
                <p>
                  <strong>Street League</strong> nasce con l’obiettivo di organizzare tornei di calcio amatoriali a Bari, ospitati presso il centro sportivo{" "}
                  <a href="https://www.dicagno.it/" target="_blank" rel="noopener noreferrer"><strong>Di Cagno Abrescia</strong></a>.
                </p>
                <p>
                  Con l’obiettivo di migliorare costantemente l’esperienza offerta e garantire servizi sempre più efficaci e professionali ai partecipanti, Street League sviluppa collaborazioni con attività e aziende del territorio interessate a sostenere il progetto attraverso partnership e sponsorizzazioni.
                </p>
                <p>
                  La collaborazione offre alle aziende un’ampia visibilità, sia online che offline, grazie a una presenza costante sui nostri canali social, alla visibilità diretta all’interno del centro sportivo e al contatto con centinaia di partecipanti e spettatori durante gli eventi.
                </p>
                <p>
                  Le attività di sponsorizzazione sono strutturate per garantire ai partner un ritorno in termini di visibilità, riconoscibilità del brand e presenza sul territorio, creando una collaborazione vantaggiosa per entrambe le parti.
                </p>
                <div className="collaborate-invoice-note">
                  <strong>PER OGNI QUOTA DI SPONSORIZZAZIONE VIENE EMESSA REGOLARE FATTURA</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="collaborate-section collaborate-section--packages">
          <div className="collaborate-container">
            <div className="collaborate-packages-heading">
              <div>
                <span className="eyebrow">02 / Partnership</span>
                <h2>PACCHETTI DI<br />SPONSORIZZAZIONE</h2>
              </div>
              <p>Validi per l’intera durata del singolo torneo e comprese tutte le attività di comunicazione.</p>
            </div>

            <div className="sponsorship-grid">
              {sponsorshipPackages.map((pkg) => (
                <article key={pkg.name} className={`sponsorship-card sponsorship-card--${pkg.accent}`}>
                  <div className="sponsorship-card__top">
                    <span className="sponsorship-card__label">{pkg.name}</span>
                    <strong className="sponsorship-card__price">{pkg.price}</strong>
                  </div>
                  <div className="sponsorship-card__divider" />
                  <p className="sponsorship-card__description">{pkg.description}</p>
                  <ul className="sponsorship-card__benefits">
                    {pkg.benefits.map((benefit, idx) => (
                      <li key={`${pkg.name}-${idx}`}>
                        <span className="sponsorship-card__bullet">+</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="sponsorship-card__footer">STREET LEAGUE PARTNERSHIP</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="collaborate-section collaborate-section--cta">
          <div className="collaborate-container">
            <div className="collaborate-cta">
              <div>
                <span className="eyebrow">03 / Next move</span>
                <h2>COSTRUIAMO INSIEME<br />LA PROSSIMA STAGIONE</h2>
                <p>Scegli il livello di partnership più adatto alla tua attività e porta il tuo brand all’interno della Street League.</p>
              </div>
              <a className="btn btn--primary collaborate-cta__button" href="mailto:streetleaguebari@gmail.com">Contatta il team</a>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
