# Redesign Street League — note tecniche

Restyling del sito pubblico ispirato ai pattern di 21st.dev, adattati al contesto Street League e reimplementati in React/CSS nativo (il progetto non usa Tailwind: nessuna nuova dipendenza di UI).

## Pattern 21st.dev applicati

| Pattern 21st.dev | Dove | File |
| --- | --- | --- |
| Limelight Nav | Navigazione desktop nell'header | `src/components/ui/DesktopNav.tsx` |
| Floating Dock | Navigazione rapida mobile (nascosta in `/admin`) | `src/components/ui/MobileDock.tsx` |
| Spotlight Card | Alone che segue il mouse su card partita e articoli | `AppLayout.tsx` (`useSpotlight`), `[data-spotlight]` |
| Border Beam | Bordo animato solo sulle partite LIVE | `MatchCard.tsx`, `.slm__beam` |
| Marquee | Striscia sponsor con bordi sfumati | `sl-system.css` |
| Theme toggle animato | Rivelazione circolare (View Transitions API) | `src/components/ui/ThemeToggle.tsx` |
| Skeleton loader | Caricamenti di home e pagine | `src/components/ui/Skeleton.tsx` |

## Tipografia (`src/styles/sl-type.css`)

I font "display" valgono **solo per titoli e intestazioni**. Paragrafi, etichette, dati, pulsanti, navigazione, tabelle e moduli usano Archivo.

| Ruolo | Font | Uso |
| --- | --- | --- |
| Titoli di pagina e di sezione | Unbounded | Hero, titoli di pagina e di sezione, login admin, dettaglio squadra/giocatore/partita, articoli |
| Accento nel titolo | Instrument Serif corsivo | Una parola dentro il titolo: "raccontata da vicino", "in evidenza", "& Staff", "del mese", "collaborazioni", "Street League" (`SectionTitle` prop `accent`, classe `.sl-accent`) |
| Titoli di card e sottotitoli | Barlow Condensed corsivo | Nomi squadra nelle card, titoli di card, h3/h4, titoli MUI |
| Testo | Archivo | Tutto il resto |

La regola è imposta da un cascade layer (`@layer sl-typography`): le sue dichiarazioni `!important` prevalgono su quelle dei fogli legacy, quindi nessun testo corrente può ricevere un font da titolo. Il corsivo resta solo dove lo vuole il contenuto (`em`, `i`, citazioni, editor).

Tutti i font sono ospitati nel progetto (`@fontsource`), senza richieste esterne. JetBrains Mono è stato rimosso.

## Livello effetti (`src/styles/sl-fx.css`, `src/components/fx/`)

| Effetto | Dove | Implementazione |
| --- | --- | --- |
| Shader WebGL animati a livelli: mesh gradient brand + god rays, punti luce, grana | Hero della home | `HeroBackdrop.tsx` + `HeroShaderLayers.tsx` (`@paper-design/shaders-react`, il motore degli shader di 21st.dev; caricato in lazy, immagine statica come fallback) |
| Mesh gradient d'atmosfera (soft) | Testata delle pagine indice: competizioni, classifica, statistiche, calciomercato, partner | `AmbientBackdrop.tsx` + `AmbientShaderLayer.tsx`: stesso motore Paper dell'hero, palette a basso contrasto e movimento lento; assente su home, dettagli e admin. Il footer usa solo un bagliore statico |
| Liquid glass | Header (allo scroll), dock mobile, menu laterale, card LIVE nell'hero, pulsanti ghost, frecce carosello, barra giornate | Vetro con riflesso speculare; rifrazione SVG (`LiquidGlassDefs.tsx`) nei browser Chromium |
| Glowing Effect | Card partita, articoli, squadre, classifiche (bordo luminoso che segue il puntatore); alone sulle card statistiche, partner, giocatori | `useCinematics.ts` + CSS |
| Logo 3D cinematico | Hero della home | `HeroLogo3D.tsx`: faccia + 18 strati estrusi (sagoma via CSS mask), inquadratura laterale, oscillazione, riflesso speculare, alone e ombra; inclinazione col puntatore |
| Primo paint senza immagine | Hero della home | Gradiente CSS con i colori dello shader (niente più immagine marmo visibile al caricamento) |
| Card competizioni bento | Pagina Competizioni | Pannello media incassato con logo 3D, stato con indicatore, titolo leggibile, azione "Apri" a pillola |
| Bordo luminoso su tutte le card | Card squadra, giocatore, statistiche, POTM, partner, competizioni, classifiche | `sl-polish.css` (`::after` con maschera, segue il puntatore) |
| Barra di avanzamento scroll, griglia di punti e aloni di sfondo | Tutte le pagine | `sl-polish.css` (`animation-timeline: scroll()`) |
| | Rivelazioni cinematiche | Titoli, card, righe di classifica, pannelli in tutte le pagine | IntersectionObserver con stagger, blur e maschere |
| Titolo hero parola per parola, parallasse allo scroll | Home | CSS (`animation-timeline: scroll()` dove supportato) |
| Number Ticker | Punti in classifica, valori statistici, punteggi | `useCinematics.ts`, si interrompe se arriva un aggiornamento realtime |
| Pulsanti magnetici e riflesso sul pulsante primario | Pulsanti e link d'azione | proprietà CSS `translate` |
| Transizioni di pagina | Navigazione interna (React Router `viewTransition`) e link completi (`@view-transition`) | View Transitions API |

Prestazioni e accessibilità: shader a risoluzione ridotta e 30 fps, in pausa fuori schermo o con la scheda nascosta, una sola immagine statica con `prefers-reduced-motion`; nessuna animazione di comparsa con movimento ridotto; vetro opaco con `prefers-reduced-transparency`; l'area admin resta senza shader e senza animazioni di comparsa.

## Design system

Tutti gli stili nuovi sono in `src/styles/sl-system.css`, importato per ultimo in `main.tsx`.

- Token semantici `--sl-*` validi per tema chiaro e notte (palette brand invariata).
- Le regole usano il prefisso `#root` per prevalere sui fogli legacy senza toccarli.
- Tipografia: Barlow Condensed (titoli in corsivo, come la scritta del logo) e Archivo Variable (testo). Font ospitati nel progetto tramite `@fontsource`, niente Google Fonts.
- Movimento ridotto rispettato (`prefers-reduced-motion`).

## Funzionalità e correzioni

- Home: apre la giornata con partita LIVE o la prossima in programma; l'hero mostra la partita LIVE o la prossima.
- Header su una riga; social integrati su desktop (restano nel menu e nel footer).
- Navigazione SPA: scroll in cima a ogni cambio pagina e gestione degli anchor `/#sezione`.
- Link "Calendario" (footer) e "Vai alle partite" (404) puntavano a `/partite`, inesistente: ora `/#home-matches`.

## Prestazioni

- Code splitting per pagina (`React.lazy`) e vendor separati (`vite.config.ts`).
- `nebula-vertical.webp`: da 2 MB a 74 KB, stesso nome file.
- Tema applicato in `index.html` prima del primo paint; preload dell'immagine dell'hero.
- Rimosso il pacchetto `tailwind` (non è Tailwind CSS, non usato, 249 dipendenze).
- Corretti 4 errori TypeScript che bloccavano `npm run build`.

## Dopo il pull

```bash
npm install
npm run build
```

## SEO

| Intervento | File |
| --- | --- |
| Pagine articolo indicizzabili (prima: "Pagina non trovata" + `noindex`): titolo, descrizione dal testo, `og:type=article`, `article:published_time`, immagine, `NewsArticle` JSON-LD, prerender e sitemap con `lastmod` | `Seo.tsx`, `scripts/generate-seo-pages.mjs` |
| Classifiche statistiche per gruppo (marcatori, MVP, portieri, staff): titolo univoco per competizione, prerender e sitemap | idem |
| Un solo `h1` per pagina (Competizioni, Classifiche, Statistiche, Calciomercato, Partner, dettaglio competizione e partita); rimosso l'`h2` vuoto del dettaglio competizione | `SectionTitle` prop `as`, pagine |
| Titoli univoci: giocatori con la squadra, partite con la data (0 duplicati su 473 pagine) | `Seo.tsx`, prerender |
| Briciole solo verso pagine indicizzabili (non più `/squadre`, che reindirizza); giocatore → squadra → giocatore | idem |
| Competizioni non attive escluse da sitemap e indicizzazione (la pagina mostrerebbe "non trovata": soft 404) | idem |
| Immagine social JPEG reale 1920×1080 (`og-street-league.jpg`) con `og:image:width/height/type`; logo dell'organizzazione in PNG reale | `index.html`, `public/assets` |
| Contenuto `noscript` (h1, descrizione, link interni) per i crawler senza JavaScript | prerender |
| Sitemap con estensione immagini (loghi squadre, foto giocatori, copertine articoli) | prerender |
| Descrizioni tagliate a ~155 caratteri sul confine di parola; `theme-color` non più forzato scuro | `Seo.tsx`, prerender |
| Favicon con tipo corretto e `apple-touch-icon`; articolo senza `<main>` annidato e copertina con `alt` | `index.html`, `ArticleDetail.tsx` |
