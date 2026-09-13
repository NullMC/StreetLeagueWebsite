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

Abilita Email/Password in Supabase Authentication. Crea gli utenti necessari dalla dashboard Supabase Auth. Dopo la creazione di un utente, assegna il ruolo nella tabella `profiles`:

```sql
insert into public.profiles (id, full_name, role)
values ('UUID_UTENTE_AUTH', 'Nome Operatore', 'admin');
```

Ruoli disponibili: `viewer`, `operator`, `admin`.

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
