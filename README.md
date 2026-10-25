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
