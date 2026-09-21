import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { RichTextEditor } from "../components/RichTextEditor";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAuthenticatedAdmin, signInWithAccessCode, uploadMedia, type AdminProfile } from "../lib/admin";
import { getCompetitions, getTeams, getPlayers, getMatches } from "../lib/api";
import type { Competition, Match, Player, Team } from "../types";

type Resource = "competitions" | "teams" | "players" | "matches" | "events" | "lineups" | "mvp" | "player_of_month" | "partners" | "active_collaborations" | "social_contents";
type Row = Record<string, unknown>;
type Lookups = { competitions: Competition[]; teams: Team[]; players: Player[]; matches: Match[] };

const labels: Record<Resource, string> = {
  competitions: "Competizioni", teams: "Squadre", players: "Giocatori", matches: "Partite",
  events: "Eventi", lineups: "Formazioni", mvp: "MVP", player_of_month: "POTM",
  partners: "Sponsor", active_collaborations: "Collab attive", social_contents: "Social / Video",
};
const tables: Record<Resource, string> = {
  competitions: "competitions", teams: "teams", players: "players", matches: "matches",
  events: "match_events", lineups: "match_lineups", mvp: "match_mvp", player_of_month: "player_of_month",
  partners: "partners", active_collaborations: "active_collaborations", social_contents: "social_contents",
};
const keys: Record<Resource, string> = {
  competitions: "id", teams: "id", players: "id", matches: "id", events: "id", lineups: "id", mvp: "match_id",
  player_of_month: "id", partners: "id", active_collaborations: "id", social_contents: "id",
};
const fields: Record<Resource, string[]> = {
  competitions: ["name", "slug", "status", "season_label", "start_date", "end_date", "hero_image_url"],
  teams: ["competition_id", "name", "slug", "accent_hex", "logo_url"],
  players: ["team_id", "first_name", "last_name", "shirt_number", "position", "profile_image_url", "bg_less_image_url"],
  matches: ["competition_id", "home_team_id", "away_team_id", "matchday", "kickoff_at", "status", "home_score", "away_score", "venue"],
  events: ["match_id", "player_id", "related_player_id", "event_type", "minute", "note"],
  lineups: ["match_id", "team_id", "player_id", "starter", "shirt_number"],
  mvp: ["match_id", "player_id"],
  player_of_month: ["player_id", "month_label", "note", "published_at"],
  partners: ["name", "tier", "logo_url", "website_url", "sort_order"],
  active_collaborations: ["title", "description", "flyer_url", "cta_url", "sort_order"],
  social_contents: ["platform", "title", "thumbnail_url", "content_url", "published_at"],
};
const required: Record<Resource, string[]> = {
  competitions: ["name", "slug", "status"], teams: ["competition_id", "name", "slug"], players: ["team_id", "first_name", "last_name"],
  matches: ["competition_id", "home_team_id", "away_team_id", "kickoff_at", "status"], events: ["match_id", "event_type"],
  lineups: ["match_id", "team_id", "player_id"], mvp: ["match_id", "player_id"],
  player_of_month: ["player_id", "month_label", "published_at"], partners: ["name", "tier"],
  active_collaborations: ["title", "description"], social_contents: ["platform", "title", "content_url"],
};
const fieldLabels: Record<string, string> = {
  name: "Nome", slug: "Slug", status: "Stato", season_label: "Stagione", start_date: "Data inizio", end_date: "Data fine",
  hero_image_url: "Immagine hero", competition_id: "Competizione", accent_hex: "Colore accent", logo_url: "Logo",
  team_id: "Squadra", first_name: "Nome", last_name: "Cognome", shirt_number: "Numero", position: "Ruolo", profile_image_url: "Immagine profilo", bg_less_image_url: "Immagine sfondo",
  home_team_id: "Squadra casa", away_team_id: "Squadra ospite", matchday: "Giornata", kickoff_at: "Inizio", home_score: "Gol casa", away_score: "Gol ospite", venue: "Campo",
  match_id: "Partita", player_id: "Giocatore", related_player_id: "Giocatore correlato", event_type: "Tipo evento", minute: "Minuto", note: "Nota", starter: "Titolare",
  tier: "Livello", website_url: "Sito web", sort_order: "Ordine", platform: "Piattaforma", title: "Titolo", description: "Descrizione", thumbnail_url: "Anteprima", content_url: "URL contenuto", published_at: "Pubblicato", flyer_url: "Volantino", cta_url: "URL CTA", month_label: "Mese",
};
const options: Record<string, string[]> = {
  competitionStatus: ["upcoming", "active", "finished"], matchStatus: ["scheduled", "live", "finished", "postponed"], tier: ["gold", "silver", "bronze"], platform: ["youtube", "instagram", "tiktok"], event_type: ["goal", "assist", "yellow_card", "red_card", "substitution", "foul", "other"],
};

function labelize(v: string) { return fieldLabels[v] ?? v.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase()); }
function defaults(resource: Resource): Row {
  return Object.fromEntries(fields[resource].map((f) => [f, f === "sort_order" ? 0 : f === "starter" ? true : f === "status" ? (resource === "competitions" ? "upcoming" : "scheduled") : ""]));
}
function localDate(value: unknown) { if (!value) return ""; const d = new Date(String(value)); if (Number.isNaN(d.getTime())) return ""; const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); }
function toIso(value: string) { if (!value) return null; const d = new Date(value); if (Number.isNaN(d.getTime())) throw new Error("Data/ora non valida."); return d.toISOString(); }
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
async function readRows(resource: Resource) { if (!supabase) return []; const { data, error } = await supabase.from(tables[resource]).select("*").order("created_at", { ascending: false }); if (error) throw error; return (data ?? []) as Row[]; }
function relationOptions(field: string, resource: Resource, form: Row, l: Lookups) {
  if (field === "competition_id") return l.competitions.map((x) => ({ id: x.id, label: x.name }));
  if (field === "team_id") return l.teams.map((x) => ({ id: x.id, label: x.name }));
  if (field === "home_team_id" || field === "away_team_id") return l.teams.filter((x) => !form.competition_id || x.competition_id === form.competition_id).map((x) => ({ id: x.id, label: x.name }));
  if (field === "match_id") return l.matches.map((x) => ({ id: x.id, label: `${l.teams.find((t) => t.id === x.home_team_id)?.name ?? "Casa"} - ${l.teams.find((t) => t.id === x.away_team_id)?.name ?? "Ospite"} / ${x.matchday ?? "—"}` }));
  if (field === "player_id" || field === "related_player_id") { let ps = l.players; if (resource === "lineups" && form.team_id) ps = ps.filter((p) => p.team_id === form.team_id); if (["events", "mvp"].includes(resource) && form.match_id) { const m = l.matches.find((x) => x.id === form.match_id); const ids = m ? [m.home_team_id, m.away_team_id] : []; ps = ps.filter((p) => ids.includes(p.team_id)); } return ps.map((p) => ({ id: p.id, label: `#${p.shirt_number ?? "—"} ${p.first_name} ${p.last_name}` })); }
  return [];
}
function sanitize(resource: Resource, source: Row) { const out: Row = {}; for (const f of fields[resource]) { let v = source[f]; if (f === "kickoff_at" || f === "published_at") v = v === "" || v == null ? null : toIso(String(v)); else if (v === "") v = null; if (["shirt_number", "home_score", "away_score", "minute", "sort_order"].includes(f) && v != null) v = Number(v); out[f] = f === "starter" ? Boolean(v) : v; } return out; }
function validate(resource: Resource, payload: Row, l: Lookups) {
  for (const f of required[resource]) if (payload[f] == null || payload[f] === "") throw new Error(`${labelize(f)} è obbligatorio.`);
  if (["shirt_number", "home_score", "away_score", "minute", "sort_order"].some((f) => payload[f] != null && Number(payload[f]) < 0)) throw new Error("I valori numerici non possono essere negativi.");
  if (resource === "matches") { const c = l.competitions.find((x) => x.id === payload.competition_id); const h = l.teams.find((x) => x.id === payload.home_team_id); const a = l.teams.find((x) => x.id === payload.away_team_id); if (!c || !h || !a) throw new Error("Competizione o squadre non valide."); if (h.competition_id !== c.id || a.competition_id !== c.id) throw new Error("Casa e ospite devono appartenere alla competizione selezionata."); if (h.id === a.id) throw new Error("Le squadre devono essere diverse."); }
  if (resource === "player_of_month" && !l.players.some((x) => x.id === payload.player_id)) throw new Error("Il giocatore selezionato non esiste.");
  if (resource === "active_collaborations" && payload.cta_url) { try { const parsed = new URL(String(payload.cta_url)); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { throw new Error("URL CTA non valido: usa un link http:// o https://."); } }
}
function rowLabel(resource: Resource, row: Row, l: Lookups) { if (["competitions", "teams"].includes(resource)) return String(row.name ?? resource); if (resource === "players") return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(); if (resource === "player_of_month") { const p = l.players.find((x) => x.id === row.player_id); return `${row.month_label ?? "POTM"} / ${p ? `${p.first_name} ${p.last_name}` : "Giocatore"}`; } if (resource === "matches") return `${l.teams.find((x) => x.id === row.home_team_id)?.name ?? "Casa"} - ${l.teams.find((x) => x.id === row.away_team_id)?.name ?? "Ospite"}`; if (resource === "active_collaborations") return String(row.title ?? "Collaborazione"); return String(row.title ?? row.name ?? resource); }

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT");
}
function searchableRowText(resource: Resource, row: Row, l: Lookups) {
  const values = fields[resource].map((f) => String(row[f] ?? ""));
  const extras: string[] = [];
  const team = row.team_id ? l.teams.find((x) => x.id === row.team_id) : undefined;
  const competition = row.competition_id ? l.competitions.find((x) => x.id === row.competition_id) : undefined;
  const player = row.player_id ? l.players.find((x) => x.id === row.player_id) : undefined;
  const relatedPlayer = row.related_player_id ? l.players.find((x) => x.id === row.related_player_id) : undefined;
  const match = row.match_id ? l.matches.find((x) => x.id === row.match_id) : undefined;

  if (team) extras.push(team.name, team.slug);
  if (competition) extras.push(competition.name, competition.slug);
  if (player) extras.push(player.first_name, player.last_name, String(player.shirt_number ?? ""));
  if (relatedPlayer) extras.push(relatedPlayer.first_name, relatedPlayer.last_name, String(relatedPlayer.shirt_number ?? ""));
  if (match) {
    const home = l.teams.find((x) => x.id === match.home_team_id);
    const away = l.teams.find((x) => x.id === match.away_team_id);
    extras.push(
      home?.name ?? "",
      away?.name ?? "",
      String(match.matchday ?? ""),
      String(match.venue ?? ""),
    );
  }
  if (row.home_team_id) {
    const home = l.teams.find((x) => x.id === row.home_team_id);
    if (home) extras.push(home.name, home.slug);
  }
  if (row.away_team_id) {
    const away = l.teams.find((x) => x.id === row.away_team_id);
    if (away) extras.push(away.name, away.slug);
  }

  return normalizeSearch([...values, ...extras].join(" "));
}

function Crud({ resource, profile }: { resource: Resource; profile: AdminProfile }) {
  const [rows, setRows] = useState<Row[]>([]); const [form, setForm] = useState<Row>(() => defaults(resource)); const [editing, setEditing] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [message, setMessage] = useState(""); const [searchTerm, setSearchTerm] = useState(""); const [uploadingField, setUploadingField] = useState<string | null>(null); const [lookups, setLookups] = useState<Lookups>({ competitions: [], teams: [], players: [], matches: [] });
  const canWrite = profile.role === "super_admin" || profile.role === "admin" || (profile.role === "operator" && ["matches", "events", "lineups", "mvp"].includes(resource));
  const refresh = async () => { setLoading(true); try { setRows(await readRows(resource)); } catch (e) { setMessage(errorMessage(e, "Errore di caricamento.")); } finally { setLoading(false); } };
  useEffect(() => { setForm(defaults(resource)); setEditing(null); setMessage(""); setSearchTerm(""); void refresh(); }, [resource]);
  useEffect(() => { Promise.all([getCompetitions(), getTeams(), getPlayers(), getMatches()]).then(([competitions, teams, players, matches]) => setLookups({ competitions, teams, players, matches })).catch(() => undefined); }, [resource]);
  const setField = (f: string, v: unknown) => setForm((p) => ({ ...p, [f]: v, ...(f === "competition_id" ? { home_team_id: "", away_team_id: "" } : {}), ...(f === "match_id" ? { team_id: "", player_id: "", related_player_id: "" } : {}) }));
  const edit = (r: Row) => { const n = { ...r }; setEditing(String(r[keys[resource]])); if (n.kickoff_at) n.kickoff_at = localDate(n.kickoff_at); if (n.published_at) n.published_at = localDate(n.published_at); setForm(n); setMessage(""); window.scrollTo({ top: 120, behavior: "smooth" }); };
  const cancelEdit = () => { setEditing(null); setForm(defaults(resource)); setMessage(""); };
  const uploadFor = async (field: string, file: File) => { if (!canWrite || !file) return; setUploadingField(field); setMessage(""); try { const folder = field === "flyer_url" ? "collaborations" : field.includes("logo") ? "logos" : field.includes("bg_less") ? "players/bg-less" : field.includes("profile") ? "players/profile" : field.includes("thumbnail") ? "social" : "media"; const url = await uploadMedia(file, folder); setForm((p) => ({ ...p, [field]: url })); setMessage("File caricato. Salva il record per applicare l'URL."); } catch (e) { setMessage(errorMessage(e, "Upload non riuscito.")); } finally { setUploadingField(null); } };
  const save = async (e: FormEvent) => { e.preventDefault(); if (!supabase || !canWrite) return; setMessage(""); try { const p = sanitize(resource, form); validate(resource, p, lookups); if (resource === "players" && !editing) { if (p.profile_image_url == null) delete p.profile_image_url; if (p.bg_less_image_url == null) delete p.bg_less_image_url; } const q = supabase.from(tables[resource]); const result = editing ? await q.update(p).eq(keys[resource], editing) : resource === "mvp" ? await q.upsert(p, { onConflict: "match_id" }) : await q.insert(p); if (result.error) throw result.error; setMessage(editing ? "Record aggiornato." : "Record creato."); setEditing(null); setForm(defaults(resource)); await refresh(); } catch (e) { setMessage(errorMessage(e, "Operazione non riuscita.")); } };
  const remove = async (r: Row) => { if (!supabase || !canWrite) return; const k = r[keys[resource]]; if (!k || !confirm(`Eliminare ${rowLabel(resource, r, lookups)}?`)) return; try { const { error } = await supabase.from(tables[resource]).delete().eq(keys[resource], k); if (error) throw error; setMessage("Record eliminato."); await refresh(); } catch (e) { setMessage(errorMessage(e, "Eliminazione non riuscita.")); } }; const normalizedSearch = normalizeSearch(searchTerm.trim()); const filteredRows = normalizedSearch ? rows.filter((r) => searchableRowText(resource, r, lookups).includes(normalizedSearch)) : rows;
  const render = (f: string) => { const v = form[f]; if (f === "starter") return <label className="check-field"><input type="checkbox" checked={Boolean(v)} onChange={(e) => setField(f, e.target.checked)} /> Titolare</label>; const rel = ["competition_id", "team_id", "home_team_id", "away_team_id", "match_id", "player_id", "related_player_id"]; if (rel.includes(f)) { const opts = relationOptions(f, resource, form, lookups); return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)}><option value="">Seleziona</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>; } if (f === "status") { const opts = resource === "competitions" ? options.competitionStatus : options.matchStatus; return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required><option value="">Seleziona</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>; } if (options[f]) return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)}><option value="">Seleziona</option>{options[f].map((o) => <option key={o} value={o}>{o}</option>)}</select>; if (f === "description") return <RichTextEditor value={String(v ?? "")} onChange={(x) => setField(f, x)} />; if (f === "note") return <textarea rows={5} value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} />; const dt = f === "kickoff_at" || f === "published_at"; const date = f === "start_date" || f === "end_date"; const num = ["shirt_number", "home_score", "away_score", "minute", "sort_order"].includes(f); const uploadable = isUploadableImage(f); const url = ["cta_url", "website_url", "content_url", "hero_image_url", "logo_url", "profile_image_url", "bg_less_image_url", "thumbnail_url", "flyer_url"].includes(f); const input = <input type={dt ? "datetime-local" : date ? "date" : num ? "number" : url ? "url" : "text"} value={dt ? localDate(v) : v == null ? "" : String(v)} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)} min={num ? 0 : undefined} placeholder={f === "month_label" ? "Settembre 2026" : undefined} />; if (!uploadable) return input; return <div className="admin-input-row">{input}<input className="file-input" type="file" accept="image/*" disabled={!canWrite || uploadingField === f} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFor(f, file); e.currentTarget.value = ""; }} />{uploadingField === f && <small className="admin-help-text">Caricamento…</small>}</div>; };
  return <div className="admin-resource"><div className="admin-resource__head"><div><span className="eyebrow">CRUD / {labels[resource]}</span><h2>{editing ? "Modifica record" : "Nuovo record"}</h2></div>{editing && <button className="btn btn--ghost" type="button" onClick={cancelEdit}>Annulla</button>}</div>{canWrite ? <form className="admin-form" onSubmit={save}><div className="admin-form__grid">{fields[resource].map((f) => <label key={f}>{labelize(f)}{render(f)}</label>)}</div>{message && <p className="admin-message">{message}</p>}<button className="btn btn--primary" type="submit">{editing ? "Salva modifiche" : "Crea record"}</button></form> : <div className="empty-state"><div className="empty-state__mark">R</div><div><h3>Accesso in sola lettura</h3><p>Questo ruolo non può modificare questa sezione.</p></div></div>}<div className="admin-records">
  <div className="admin-search">
    <div className="admin-search__field">
      <span className="admin-search__icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={`Cerca in ${labels[resource].toLowerCase()}…`}
        aria-label={`Cerca in ${labels[resource].toLowerCase()}`}
      />
      {searchTerm && <button className="admin-search__clear" type="button" onClick={() => setSearchTerm("")} aria-label="Cancella ricerca">×</button>}
    </div>
    <span className="admin-search__count">{normalizedSearch ? `${filteredRows.length} di ${rows.length}` : `${rows.length} record`}</span>
  </div>
  <div className="admin-table-wrap">
    {loading ? <p className="admin-message">Caricamento…</p> : !rows.length ? <p className="admin-message">Nessun record presente.</p> : !filteredRows.length ? <p className="admin-message">Nessun risultato per “{searchTerm}”.</p> : <table className="admin-table"><thead><tr>{fields[resource].slice(0, 6).map((f) => <th key={f}>{labelize(f)}</th>)}<th>Azioni</th></tr></thead><tbody>{filteredRows.map((r) => <tr key={String(r[keys[resource]])}>{fields[resource].slice(0, 6).map((f) => <td key={f}>{f === "player_id" ? (() => { const p = lookups.players.find((x) => x.id === r[f]); return p ? `#${p.shirt_number ?? "—"} ${p.first_name} ${p.last_name}` : "—"; })() : f === "team_id" ? (lookups.teams.find((x) => x.id === r[f])?.name ?? "—") : f === "competition_id" ? (lookups.competitions.find((x) => x.id === r[f])?.name ?? "—") : String(r[f] ?? "—")}</td>)}<td className="admin-actions"><button className="btn btn--ghost btn--small" type="button" onClick={() => edit(r)}>Modifica</button>{" "}<button className="btn btn--danger btn--small" type="button" onClick={() => void remove(r)}>Elimina</button></td></tr>)}</tbody></table>}
  </div>
</div></div>;
}

function isUploadableImage(field: string) { return field.includes("logo") || field.includes("image") || field.includes("thumbnail") || field === "flyer_url"; }

function Login({ onLogin }: { onLogin: (p: AdminProfile) => void }) { const [u, setU] = useState(""); const [c, setC] = useState(""); const [m, setM] = useState(""); const [busy, setBusy] = useState(false); const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setM(""); try { const r = await signInWithAccessCode(u, c); if (r.error) throw r.error; const p = await getAuthenticatedAdmin(); if (!p) throw new Error("Profilo amministratore non valido."); onLogin(p); } catch (e) { setM(errorMessage(e, "Accesso non riuscito.")); } finally { setBusy(false); } }; return <div className="admin-login"><span className="eyebrow">Street League / Admin</span><h1>Back office</h1><p>Accedi con username e codice permanente per gestire la piattaforma.</p>{m && <p className="admin-error">{m}</p>}<form onSubmit={submit}><input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" /><input type="password" value={c} onChange={(e) => setC(e.target.value)} placeholder="Codice di accesso" /><button className="btn btn--primary" disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button></form></div>; }

const nav: Array<{ key: Resource; label: string }> = [
  { key: "competitions", label: "Competizioni" }, { key: "teams", label: "Squadre" }, { key: "players", label: "Giocatori" }, { key: "matches", label: "Partite" }, { key: "events", label: "Eventi" }, { key: "lineups", label: "Formazioni" }, { key: "mvp", label: "MVP" }, { key: "player_of_month", label: "POTM" }, { key: "partners", label: "Sponsor" }, { key: "active_collaborations", label: "Collab attive" }, { key: "social_contents", label: "Social / Video" },
];

export default function AdminDashboard() {
  const [profile, setProfile] = useState<AdminProfile | null>(null); const [resource, setResource] = useState<Resource>("competitions"); const [booting, setBooting] = useState(true);
  useEffect(() => { void getAuthenticatedAdmin().then(setProfile).catch(() => setProfile(null)).finally(() => setBooting(false)); }, []);
  const logout = async () => { await supabase?.auth.signOut(); setProfile(null); setResource("competitions"); };
  if (!supabaseConfigured || booting) return <PageShell title="Admin" eyebrow="Street League"><div className="admin-help"><h3>Configurazione</h3><p>Verifica le variabili Supabase prima di accedere al back office.</p></div></PageShell>;
  if (!profile) return <PageShell title="Admin" eyebrow="Street League"><Login onLogin={setProfile} /></PageShell>;
  return <PageShell title="Back office" eyebrow={profile.role}><div className="admin-layout"><aside className="admin-sidebar"><span className="eyebrow">Street League</span><h2>Back office</h2><p className="admin-user">{profile.full_name ?? profile.username ?? profile.email}</p><nav>{nav.map((item) => <button key={item.key} type="button" className={resource === item.key ? "active" : ""} onClick={() => setResource(item.key)}>{item.label}</button>)}</nav><button className="btn btn--ghost" type="button" onClick={() => void logout()}>Esci</button></aside><main className="admin-main"><Crud resource={resource} profile={profile} /></main></div></PageShell>;
}
