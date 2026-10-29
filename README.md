# Street League — React + Supabase

Sito web per torneo di calcio a 7, progettato sulla base della scheda tecnica fornita e con una direzione visuale street/sportiva. La struttura prende come riferimento informativo la gerarchia del sito Kings League Italia, senza replicarne il design.

## Requisiti

- Node.js 20+
- npm 10+
- Account Supabase

## 1. Installazione locale

```bash
npm install
npm run dev
```

Apri `http://localhost:5173`.

## 2. Collegamento Supabase

1. Crea un nuovo progetto su Supabase.
2. Apri `SQL Editor` e incolla `supabase/schema.sql`.
3. Esegui lo script.
4. Lascia `supabase/seed.sql` vuoto: il progetto non usa dati demo.
5. Copia `.env.example` in `.env.local`:

```bash
cp .env.example .env.local
```

6. Inserisci:

```env
VITE_SUPABASE_URL=https://TUO-PROGETTO.supabase.co
VITE_SUPABASE_ANON_KEY=LA_TUA_ANON_KEY
```

7. Riavvia `npm run dev`.

## 3. Storage immagini

Crea bucket pubblici in Supabase Storage, ad esempio:

- `branding`
- `teams`
- `players`
- `content`

Salva gli URL pubblici nelle colonne `_url` delle tabelle.

## 4. Autenticazione Admin

Il back office usa **username + codice di accesso permanente**. Il codice viene salvato esclusivamente come hash nella tabella `admin_access_codes`: non viene mai salvato in chiaro.

Dopo `schema.sql`, esegui anche:

```text
supabase/admin_access_code_migration.sql
supabase/admin_access_code_hardening.sql
```

Il primo Super Admin deve essere inizializzato tramite `supabase/bootstrap_super_admin.sql`.

L'accesso al back office è riservato esclusivamente al Super Admin inizializzato tramite `bootstrap_super_admin.sql`. Non è presente una procedura di creazione di ulteriori account dal back office.

Il ruolo operativo utilizzato per il back office è `super_admin`.

## 5. Realtime

Nel progetto Supabase abilita Realtime per almeno:

- `matches`
- `match_events`
- `match_lineups`
- `match_mvp`

Il frontend è già predisposto alla sottoscrizione dei cambiamenti.

## 6. Deployment Cloudflare Pages

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Aggiungi nelle Environment Variables di Cloudflare Pages:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## 7. Deploy automatico delle Edge Functions

Le funzioni Supabase in `supabase/functions/` non vengono pubblicate da Cloudflare Pages insieme al frontend. Il repository include quindi il workflow:

`.github/workflows/deploy-supabase-functions.yml`

che deploya automaticamente le Edge Functions a ogni push su `main`.

Nel repository GitHub aggiungi questi **Actions secrets**:

- `SUPABASE_ACCESS_TOKEN`: Personal Access Token Supabase
- `SUPABASE_PROJECT_ID`: project reference del progetto Supabase

Dopo aver configurato i secrets, ogni push su `main` che modifica `supabase/functions/**` pubblica automaticamente le funzioni sul progetto indicato.

## 7. Routing su Cloudflare

Il progetto usa React Router in modalità BrowserRouter. Su Cloudflare Pages è necessario mantenere il fallback SPA verso `index.html`. Aggiungi un file `public/_redirects` con:

```text
/* /index.html 200
```

## Struttura

```text
src/
  components/      componenti condivisi
  lib/             client e query Supabase
  pages/           pagine route-driven
  styles/          stile globale
  types/           tipi dati
supabase/
  schema.sql       schema PostgreSQL + RLS
  seed.sql         volutamente vuoto
public/assets/     asset forniti
```

## Dati

La Home e le pagine pubbliche non inventano dati. Quando Supabase è vuoto vengono mostrati stati vuoti. La classifica è derivata dalle partite concluse; le statistiche giocatore sono predisposte per essere derivate dagli eventi in `match_events`.

## Note

L'Admin UI presente in questa prima codebase è lo scheletro operativo e l'area di controllo. Il modello dati, i ruoli e le policy RLS sono già predisposti per una successiva estensione CRUD completa senza cambiare la struttura delle route.


## Voti portieri e MVP per partita

Nell'area **Admin → Voti portieri e MVP partita** è possibile selezionare la
competizione attiva, filtrare per numero di giornata e scegliere la singola partita.
Le due sezioni hanno selettori e ricerche indipendenti.

- **Portieri:** la tabella `goalkeeper_match_ratings` registra un voto intero da
  1 a 5 per portiere e partita terminata. La classifica usa la media dei voti,
  con precedenza al maggior numero di partite valutate in caso di parità.
- **MVP:** la tabella **già esistente** `match_mvp` registra un singolo vincitore
  per ciascuna partita terminata (`match_id` è la chiave primaria). Modificare
  il vincitore sostituisce il record precedente anziché crearne un secondo.
  Solo i giocatori delle due squadre, escluso lo staff, possono essere selezionati
  dall'interfaccia. La classifica MVP conteggia le **partite vinte come MVP**,
  non le giornate.

Per aggiungere i voti ai portieri, se non è già stata eseguita, applica **una
sola volta** la migrazione `supabase/19_goalkeeper_votes_and_matchday_mvp.sql`
nel SQL Editor Supabase. **Non serve una nuova migrazione per gli MVP partita**:
si usa `match_mvp`, compresi i suoi dati storici.

Le eventuali vecchie nomination inserite in `competition_matchday_mvp`
non vengono eliminate né convertite automaticamente perché una giornata può
includere più partite e non è possibile sapere a quale incontro associare
il riconoscimento. Per recuperarle, attribuiscile manualmente alle rispettive
partite dal pannello aggiornato.

Le classifiche dei marcatori e dello staff non cambiano.

## Criteri per i portieri nelle statistiche

Ogni portiere riceve un voto da 1 a 5 per ciascuna partita conclusa. Il voto
non viene sommato: la graduatoria confronta la **media dei voti per partita**
(calcolata sulle partite votate). A parità di media, precede il portiere
con **meno gol subiti in media per partita valutata**. Il dato dei gol
subiti proviene dal risultato finale della squadra nella relativa partita;
si usa la squadra della formazione storica, se disponibile, altrimenti la
squadra associata al portiere. Le partite senza un risultato numerico completo
non vengono considerate come se fossero terminate 0–0. Se permane la parità,
si confrontano il totale dei gol subiti e poi il numero di valutazioni.

Nella card viene mostrato il primo classificato accanto al record. La
classifica dettagliata presenta i voti per ciascun incontro e i gol subiti;
per gli MVP viene mantenuto il conteggio cumulativo degli MVP partita.

## Formazioni, referti, Drive e articoli (migrazione 20)

**Prima di distribuire il nuovo frontend**, esegui una volta nel **Supabase SQL Editor**:

`supabase/20_match_reports_drive_articles.sql`

La migrazione aggiunge `matches.photo_drive_url`, il corpo dell'articolo
`social_contents.article_body` e i campi editoriali mancanti, se necessari.
Aggiunge controlli per nuovi eventi e formazioni: gli eventi sono limitati a
**gol, rigori presidenziali e cartellini gialli/rossi**, minuto intero da
**1 a 50**, partita **terminata**, entrambe le formazioni presenti,
giocatore appartenente a una delle due squadre e (salvo rigore presidenziale)
registrato nella formazione. Lo storico precedente resta consultabile.

Il backoffice contiene **Formazioni e referti**, con filtri per competizione
attiva, giornata e partita. Si selezionano i titolari e le riserve di ciascuna
squadra e si salvano separatamente; solo dopo la conferma di entrambe e il
termine dell'incontro si possono creare, modificare e cancellare gli eventi.

Nella scheda **Partite** il campo `photo_drive_url` deve contenere un link
pubblico e condivisibile `https://drive.google.com/...`. Nella pagina partita
sono presenti due schede: **Riepilogo** e **Formazioni**. Il pulsante **Photo Gallery** compare invece nelle card delle partite (home e competizioni) e apre Drive in una nuova scheda.
Il collegamento alla galleria è inattivo finché non viene compilato l'URL.

In **Social / Video** si impostano piattaforma, titolo, estratto facoltativo,
**corpo dell'articolo** con editor formattato, banner/thumbnail e URL del post.
La home mantiene lo stesso carosello di card, ma il click apre la pagina
`/articoli/:articleId`, con banner, testo e link esterno al media originale.
I contenuti storici senza `article_body` mostrano la descrizione esistente,
quando disponibile.

## Durata delle partite e Photo Gallery (migrazione 21)

Le partite Street League durano **50 minuti**. Gli eventi del referto
(gol, rigori presidenziali, cartellini) devono avere un minuto intero tra
**1 e 50**. Il backoffice rifiuta i minuti fuori intervallo; le timeline
pubbliche mostrano solo gli eventi con un minutaggio valido e le schede
Formazioni e referti segnalano eventuali record storici da correggere.
I record storici non vengono cancellati o modificati automaticamente.

**Per i database già aggiornati alla migrazione 20**, eseguire ora
`supabase/21_match_event_minutes_50.sql` nel SQL Editor Supabase. La
migrazione 21 aggiorna la funzione di validazione lato database senza
modificare i referti esistenti. Per una nuova installazione eseguire
prima la migrazione 20 e poi la 21.

Il link Drive continua a essere gestito nella sezione Partite, ma il
pulsante **Photo Gallery** ora appare direttamente in ogni **card della
partita**, separato dal collegamento ai dettagli. La pagina dedicata
contiene solo le schede Riepilogo e Formazioni.
