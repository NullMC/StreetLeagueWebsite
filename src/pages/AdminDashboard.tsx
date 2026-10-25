import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { RichTextEditor } from "../components/RichTextEditor";
import { AdminMatchAwards } from "../components/AdminMatchAwards";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ensureFreshAdminSession, getAuthenticatedAdmin, signInWithAccessCode, uploadMedia, type AdminProfile } from "../lib/admin";
import { getCompetitions, getTeams, getPlayers, getMatches } from "../lib/api";
import type { Competition, Match, Player, Team } from "../types";

type Resource = "competitions" | "teams" | "players" | "matches" | "events" | "mvp" | "player_of_month" | "partners" | "active_collaborations" | "social_contents" | "transfer_market_entries";
type Row = Record<string, any>;
type Lookups = { competitions: Competition[]; teams: Team[]; players: Player[]; matches: Match[] };

type AdminSection = Resource | "match_awards";

const nav: { key: AdminSection; label: string }[] = [
  { key: "competitions", label: "Competizioni" },
  { key: "teams", label: "Squadre" },
  { key: "players", label: "Giocatori" },
  { key: "matches", label: "Partite" },
  { key: "events", label: "Eventi" },
  { key: "match_awards", label: "Voti portieri e MVP partita" },
  { key: "player_of_month", label: "POTM & Staff del mese" },
  { key: "partners", label: "Sponsor" },
  { key: "active_collaborations", label: "Collab attive" },
  { key: "social_contents", label: "Social / Video" },
  { key: "transfer_market_entries", label: "Calcio mercato" },
];

const labels: Record<Resource, string> = {
  competitions: "Competizioni", teams: "Squadre", players: "Giocatori", matches: "Partite",
  events: "Eventi", mvp: "MVP", player_of_month: "POTM & Staff del mese",
  partners: "Sponsor", active_collaborations: "Collab attive", social_contents: "Social / Video", transfer_market_entries: "Calcio mercato",
};
const tables: Record<Resource, string> = {
  competitions: "competitions", teams: "teams", players: "players", matches: "matches",
  events: "match_events", mvp: "match_mvp", player_of_month: "player_of_month",
  partners: "partners", active_collaborations: "active_collaborations", social_contents: "social_contents", transfer_market_entries: "transfer_market_entries",
};
const keys: Record<Resource, string> = {
  competitions: "id", teams: "id", players: "id", matches: "id", events: "id", mvp: "match_id",
  player_of_month: "id", partners: "id", active_collaborations: "id", social_contents: "id", transfer_market_entries: "id",
};
const fields: Record<Resource, string[]> = {
  competitions: ["name", "slug", "status", "season_label", "start_date", "end_date", "statistics_group"],
  teams: ["competition_ids", "name", "slug", "accent_hex", "logo_url"],
  players: ["team_id", "first_name", "last_name", "shirt_number", "position", "profile_image_url", "bg_less_image_url"],
  matches: ["competition_id", "home_team_id", "away_team_id", "matchday", "kickoff_at", "status", "home_score", "away_score", "venue"],
  events: ["match_id", "player_id", "related_player_id", "event_type", "minute", "note"],
  mvp: ["match_id", "player_id"],
  player_of_month: ["award_type", "player_id", "card_image_url", "month_label", "note", "published_at"],
  partners: ["name", "logo_url", "activity_image_url", "description", "website_url", "sort_order"],
  active_collaborations: ["title", "description", "flyer_url", "cta_url", "sort_order"],
  social_contents: ["platform", "title", "thumbnail_url", "content_url", "published_at"],
  transfer_market_entries: ["team_id", "slot_number", "player_id", "external_first_name", "external_last_name", "external_position", "external_shirt_number", "external_photo_url", "notes"],
};
const required: Record<Resource, string[]> = {
  competitions: ["name", "slug", "status"], teams: ["competition_ids", "name", "slug"], players: ["team_id", "first_name", "last_name"],
  matches: ["competition_id", "home_team_id", "away_team_id", "kickoff_at", "status"], events: ["match_id", "event_type"],
  mvp: ["match_id", "player_id"],
  player_of_month: ["award_type", "player_id", "month_label", "published_at"], partners: ["name", "logo_url", "description", "website_url"],
  active_collaborations: ["title", "description"], social_contents: ["platform", "title", "content_url"],
  transfer_market_entries: ["team_id", "slot_number"],
};
const fieldLabels: Record<string, string> = {
  name: "Nome", slug: "Slug", status: "Stato", season_label: "Stagione", start_date: "Data inizio", end_date: "Data fine",
  logo_url: "Logo", competition_id: "Competizione", competition_ids: "Competizioni", accent_hex: "Colore accent",
  team_id: "Squadra", first_name: "Nome", last_name: "Cognome", shirt_number: "Numero", position: "Ruolo", profile_image_url: "Immagine profilo", bg_less_image_url: "Immagine sfondo",
  home_team_id: "Squadra casa", away_team_id: "Squadra ospite", matchday: "Giornata", kickoff_at: "Inizio", home_score: "Gol casa", away_score: "Gol ospite", venue: "Campo",
  match_id: "Partita", player_id: "Giocatore", related_player_id: "Giocatore correlato", event_type: "Tipo evento", minute: "Minuto", note: "Nota",
  award_type: "Riconoscimento", card_image_url: "Foto di sfondo della card", activity_image_url: "Immagine attività / copertina sponsor", website_url: "Sito web", sort_order: "Ordine", platform: "Piattaforma", title: "Titolo", description: "Descrizione", thumbnail_url: "Anteprima", content_url: "URL contenuto", published_at: "Pubblicato", flyer_url: "Volantino", cta_url: "URL CTA", month_label: "Mese", statistics_group: "Gruppo competizioni (aggregazione)", slot_number: "Slot (1-6)", external_first_name: "Nome giocatore esterno", external_last_name: "Cognome giocatore esterno", external_position: "Ruolo giocatore esterno", external_shirt_number: "Numero maglia", external_photo_url: "Foto giocatore esterno", notes: "Nota mercato",
};
const options: Record<string, string[]> = {
  competitionStatus: ["upcoming", "active", "finished"], matchStatus: ["scheduled", "live", "finished", "postponed"], platform: ["youtube", "instagram", "tiktok"], award_type: ["player", "staff"], event_type: ["goal", "assist", "yellow_card", "red_card", "substitution", "foul", "presidential_penalty", "other"],
};

function labelize(v: string) { return fieldLabels[v] ?? v.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase()); }
function defaults(resource: Resource): Row {
  return Object.fromEntries(
    fields[resource].map((f) => [
      f,
      f === "competition_ids"
        ? []
        : f === "slot_number"
          ? 1
          : f === "award_type"
          ? "player"
          : f === "sort_order"
            ? 0
            : f === "status"
              ? resource === "competitions"
                ? "upcoming"
                : "scheduled"
              : "",
    ]),
  );
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
async function readRows(resource: Resource): Promise<Row[]> {
  if (!supabase) return [];
  await ensureFreshAdminSession();
  if (resource === "teams") {
    const { data, error } = await supabase
      .from("teams")
      .select("*, competition_teams(competition_id)")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((team) => ({
      ...team,
      competition_ids: Array.isArray(team.competition_teams)
        ? team.competition_teams.map((membership) => membership.competition_id)
        : [],
    }));
  }
  const { data, error } = await supabase
    .from(tables[resource])
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Row[];
}
function relationOptions(field: string, resource: Resource, form: Row, l: Lookups) {
  if (field === "competition_id") return l.competitions.map((x) => ({ id: x.id, label: x.name }));
  if (field === "team_id") return l.teams.map((x) => ({ id: x.id, label: x.name }));
  if (field === "home_team_id" || field === "away_team_id") return l.teams.filter((x) => !form.competition_id || x.competition_ids?.includes(String(form.competition_id))).map((x) => ({ id: x.id, label: x.name }));
  if (field === "match_id") return l.matches.map((x) => ({ id: x.id, label: `${l.teams.find((t) => t.id === x.home_team_id)?.name ?? "Casa"} - ${l.teams.find((t) => t.id === x.away_team_id)?.name ?? "Ospite"} / ${x.matchday ?? "—"}` }));
  if (field === "player_id" || field === "related_player_id") { let ps = l.players; if (resource === "transfer_market_entries") ps = ps.filter((p) => p.role?.trim().toUpperCase() !== "STAFF" && p.position?.trim().toUpperCase() !== "STAFF"); if (["events", "mvp"].includes(resource) && form.match_id) { const m = l.matches.find((x) => x.id === form.match_id); const ids = m ? [m.home_team_id, m.away_team_id] : []; ps = ps.filter((p) => ids.includes(p.team_id)); } if (resource === "events" && field === "player_id" && form.event_type === "presidential_penalty") ps = ps.filter((p) => p.role?.trim().toUpperCase() === "STAFF" || p.position?.trim().toUpperCase() === "STAFF"); if (resource === "player_of_month" && field === "player_id") { const isStaff = (p: Player) => p.role?.trim().toUpperCase() === "STAFF" || p.position?.trim().toUpperCase() === "STAFF"; ps = ps.filter((p) => form.award_type === "staff" ? isStaff(p) : !isStaff(p)); } return ps.map((p) => ({ id: p.id, label: `#${p.shirt_number ?? "—"} ${p.first_name} ${p.last_name}` })); }
  return [];
}
function sanitize(resource: Resource, source: Row) {
  const out: Row = {};
  for (const f of fields[resource]) {
    if (f === "competition_ids") continue;
    let v = source[f];
    if (f === "kickoff_at" || f === "published_at") {
      v = v === "" || v == null ? null : toIso(String(v));
    } else if (v === "") {
      v = null;
    }
    if (
      ["shirt_number", "home_score", "away_score", "minute", "sort_order", "slot_number", "external_shirt_number"].includes(f) &&
      v != null
    ) {
      v = Number(v);
    }
    out[f] = v;
  }
  return out;
}
function validate(resource: Resource, payload: Row, l: Lookups) {
  for (const f of required[resource]) if (payload[f] == null || payload[f] === "") throw new Error(`${labelize(f)} è obbligatorio.`);
  if (["shirt_number", "home_score", "away_score", "minute", "sort_order", "external_shirt_number"].some((f) => payload[f] != null && Number(payload[f]) < 0)) throw new Error("I valori numerici non possono essere negativi.");
  if (resource === "teams") {
    const competitionIds = payload.competition_ids;
    if (!Array.isArray(competitionIds) || competitionIds.length === 0) {
      throw new Error("Seleziona almeno una competizione per la squadra.");
    }
    if (competitionIds.some((id) => !l.competitions.some((competition) => competition.id === id))) {
      throw new Error("Una o più competizioni selezionate non sono valide.");
    }
  }
  if (resource === "transfer_market_entries") {
    const team = l.teams.find((x) => x.id === payload.team_id);
    if (!team) throw new Error("Seleziona una squadra valida.");
    const slot = Number(payload.slot_number);
    if (!Number.isInteger(slot) || slot < 1 || slot > 6) throw new Error("Seleziona uno slot compreso tra 1 e 6.");
    if (payload.player_id) {
      const player = l.players.find((x) => x.id === payload.player_id);
      if (!player || player.role?.trim().toUpperCase() === "STAFF" || player.position?.trim().toUpperCase() === "STAFF") throw new Error("Seleziona un giocatore valido, non un membro dello staff.");
    } else if (!String(payload.external_first_name ?? "").trim() || !String(payload.external_last_name ?? "").trim()) {
      throw new Error("Seleziona un giocatore registrato oppure inserisci nome e cognome del giocatore esterno.");
    }
  }
  if (resource === "matches") {
    const c = l.competitions.find((x) => x.id === payload.competition_id);
    const h = l.teams.find((x) => x.id === payload.home_team_id);
    const a = l.teams.find((x) => x.id === payload.away_team_id);
    if (!c || !h || !a) throw new Error("Competizione o squadre non valide.");
    if (!h.competition_ids?.includes(c.id) || !a.competition_ids?.includes(c.id)) {
      throw new Error("Casa e ospite devono partecipare alla competizione selezionata.");
    }
    if (h.id === a.id) throw new Error("Le squadre devono essere diverse.");
  }
  if (resource === "events" && payload.event_type === "presidential_penalty") { const player = l.players.find((x) => x.id === payload.player_id); if (!player || (player.role?.trim().toUpperCase() !== "STAFF" && player.position?.trim().toUpperCase() !== "STAFF")) throw new Error("Per un rigore presidenziale devi selezionare un giocatore con ruolo STAFF."); }
  if (resource === "player_of_month") {
    const selected = l.players.find((x) => x.id === payload.player_id);
    if (!selected) throw new Error("Il giocatore selezionato non esiste.");
    const isStaff = selected.role?.trim().toUpperCase() === "STAFF" || selected.position?.trim().toUpperCase() === "STAFF";
    if (payload.award_type === "staff" && !isStaff) throw new Error("Per il riconoscimento Staff del mese seleziona una persona con ruolo STAFF.");
    if (payload.award_type === "player" && isStaff) throw new Error("Per il POTM seleziona un giocatore, non un membro STAFF.");
  }
  if (resource === "active_collaborations" && payload.cta_url) { try { const parsed = new URL(String(payload.cta_url)); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { throw new Error("URL CTA non valido: usa un link http:// o https://."); } }
  for (const field of ["website_url", "content_url", "logo_url", "profile_image_url", "bg_less_image_url", "thumbnail_url", "flyer_url", "cta_url", "card_image_url", "activity_image_url", "external_photo_url"]) { const value = payload[field]; if (value) { try { const parsed = new URL(String(value)); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { throw new Error(`${labelize(field)} non valido: usa un link http:// o https://.`); } } }
  if (resource === "teams" && payload.accent_hex) { if (!/^#[0-9a-f]{6}$/i.test(String(payload.accent_hex))) throw new Error("Colore accent non valido: usa il formato #RRGGBB."); }
}
function displayCellValue(resource: Resource, field: string, row: Row, l: Lookups) {
  if (field === "competition_ids") {
    const ids = Array.isArray(row[field]) ? row[field] as string[] : [];
    const names = ids
      .map((id) => l.competitions.find((competition) => competition.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length ? names.join(", ") : "—";
  }
  if (field === "player_id") {
    const p = l.players.find((x) => x.id === row[field]);
    if (p) return `#${p.shirt_number ?? "—"} ${p.first_name} ${p.last_name}`;
    if (resource === "transfer_market_entries") return `${row.external_first_name ?? ""} ${row.external_last_name ?? ""}`.trim() || "Giocatore esterno";
    return "—";
  }
  if (resource === "player_of_month" && field === "award_type") return row.award_type === "staff" ? "Staff del mese" : "POTM";
  if (field === "team_id") return l.teams.find((x) => x.id === row[field])?.name ?? "—";
  if (field === "competition_id") return l.competitions.find((x) => x.id === row[field])?.name ?? "—";
  return String(row[field] ?? "—");
}

function rowLabel(resource: Resource, row: Row, l: Lookups) { if (["competitions", "teams"].includes(resource)) return String(row.name ?? resource); if (resource === "players") return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(); if (resource === "player_of_month") { const p = l.players.find((x) => x.id === row.player_id); const kind = row.award_type === "staff" ? "Staff del mese" : "POTM"; return `${kind} · ${row.month_label ?? ""} / ${p ? `${p.first_name} ${p.last_name}` : "Profilo non disponibile"}`; } if (resource === "matches") return `${l.teams.find((x) => x.id === row.home_team_id)?.name ?? "Casa"} - ${l.teams.find((x) => x.id === row.away_team_id)?.name ?? "Ospite"}`; if (resource === "transfer_market_entries") { const team = l.teams.find((x) => x.id === row.team_id); const player = l.players.find((x) => x.id === row.player_id); return `${team?.name ?? "Squadra"} · Slot ${row.slot_number} / ${player ? `${player.first_name} ${player.last_name}` : `${row.external_first_name ?? ""} ${row.external_last_name ?? ""}`.trim()}`; } if (resource === "active_collaborations") return String(row.title ?? "Collaborazione"); return String(row.title ?? row.name ?? resource); }

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
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
  if (resource === "teams" && Array.isArray(row.competition_ids)) {
    row.competition_ids.forEach((id) => {
      const selected = l.competitions.find((x) => x.id === id);
      if (selected) extras.push(selected.name, selected.slug);
    });
  }
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
  const canWrite = profile.role === "super_admin" || profile.role === "admin" || (profile.role === "operator" && ["matches", "events", "mvp"].includes(resource));
  const refresh = async () => { setLoading(true); try { setRows(await readRows(resource)); } catch (e) { setMessage(errorMessage(e, "Errore di caricamento.")); } finally { setLoading(false); } };
  useEffect(() => { setForm(defaults(resource)); setEditing(null); setMessage(""); setSearchTerm(""); void refresh(); }, [resource]);
  useEffect(() => { Promise.all([getCompetitions(), getTeams(), getPlayers(), getMatches()]).then(([competitions, teams, players, matches]) => setLookups({ competitions, teams, players, matches })).catch(() => undefined); }, [resource]);
  const setField = (f: string, v: unknown) => setForm((p) => ({ ...p, [f]: v, ...(f === "award_type" && resource === "player_of_month" ? { player_id: "" } : {}), ...(f === "competition_id" ? { home_team_id: "", away_team_id: "", ...(resource === "transfer_market_entries" ? { team_id: "" } : {}) } : {}), ...(resource === "transfer_market_entries" && f === "player_id" && v ? { external_first_name: "", external_last_name: "", external_position: "", external_shirt_number: "", external_photo_url: "" } : {}), ...(f === "match_id" ? { team_id: "", player_id: "", related_player_id: "" } : {}) }));
  const edit = (r: Row) => { const n = { ...r }; setEditing(String(r[keys[resource]])); if (n.kickoff_at) n.kickoff_at = localDate(n.kickoff_at); if (n.published_at) n.published_at = localDate(n.published_at); setForm(n); setMessage(""); window.scrollTo({ top: 120, behavior: "smooth" }); };
  const cancelEdit = () => { setEditing(null); setForm(defaults(resource)); setMessage(""); };
  const uploadFor = async (field: string, file: File) => { if (!canWrite || !file) return; setUploadingField(field); setMessage(""); try { const folder = field === "activity_image_url" ? "partners/activity" : field === "card_image_url" ? "awards" : field === "external_photo_url" ? "players/market" : field === "flyer_url" ? "collaborations" : field.includes("logo") ? "logos" : field.includes("bg_less") ? "players/bg-less" : field.includes("profile") ? "players/profile" : field.includes("thumbnail") ? "social" : "media"; const url = await uploadMedia(file, folder); setForm((p) => ({ ...p, [field]: url })); setMessage("File caricato. Salva il record per applicare l'URL."); } catch (e) { setMessage(errorMessage(e, "Upload non riuscito.")); } finally { setUploadingField(null); } };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !canWrite) return;
    setMessage("");
    try {
      await ensureFreshAdminSession();
      const p = sanitize(resource, form);
      if (resource === "transfer_market_entries") {
        if (p.player_id) {
          ["external_first_name", "external_last_name", "external_position", "external_shirt_number", "external_photo_url"].forEach((field) => { p[field] = null; });
        } else {
          p.player_id = null;
        }
      }
      if (resource === "partners" && !editing) p.tier = "gold";
      validate(resource, { ...p, ...(resource === "teams" ? { competition_ids: form.competition_ids } : {}) }, lookups);

      if (resource === "players" && !editing) {
        if (p.profile_image_url == null) delete p.profile_image_url;
        if (p.bg_less_image_url == null) delete p.bg_less_image_url;
      }

      if (resource === "teams") {
        const competitionIds = Array.isArray(form.competition_ids)
          ? form.competition_ids.map(String)
          : [];

        let teamId = editing;
        if (editing) {
          const { error } = await supabase
            .from("teams")
            .update(p)
            .eq("id", editing);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("teams")
            .insert(p)
            .select("id")
            .single();
          if (error) throw error;
          teamId = data.id;
        }

        const { error: membershipError } = await supabase.rpc(
          "set_team_competitions",
          {
            p_team_id: teamId,
            p_competition_ids: competitionIds,
          },
        );
        if (membershipError) throw membershipError;
      } else {
        const q = supabase.from(tables[resource]);
        const result = editing
          ? await q.update(p).eq(keys[resource], editing)
          : resource === "mvp"
            ? await q.upsert(p, { onConflict: "match_id" })
            : resource === "player_of_month"
              ? await q.upsert(p, { onConflict: "month_label,award_type" })
              : await q.insert(p);
        if (result.error) throw result.error;
      }

      setMessage(editing ? "Record aggiornato." : "Record creato.");
      setEditing(null);
      setForm(defaults(resource));
      await refresh();
    } catch (e) {
      setMessage(errorMessage(e, "Operazione non riuscita."));
    }
  };
  const remove = async (r: Row) => { if (!supabase || !canWrite) return; const k = r[keys[resource]]; if (!k || !confirm(`Eliminare ${rowLabel(resource, r, lookups)}?`)) return; try { await ensureFreshAdminSession(); const { error } = await supabase.from(tables[resource]).delete().eq(keys[resource], k); if (error) throw error; setMessage("Record eliminato."); await refresh(); } catch (e) { setMessage(errorMessage(e, "Eliminazione non riuscita.")); } }; const normalizedSearch = normalizeSearch(searchTerm.trim()); const filteredRows = normalizedSearch ? rows.filter((r) => searchableRowText(resource, r, lookups).includes(normalizedSearch)) : rows;
  const render = (f: string) => {
    const v = form[f];
    if (f === "competition_ids") {
      const selected = Array.isArray(v) ? v.map(String) : [];
      const size = Math.min(6, Math.max(3, lookups.competitions.length));
      return (
        <select
          multiple
          size={size}
          value={selected}
          onChange={(e) =>
            setField(
              f,
              Array.from(e.currentTarget.selectedOptions, (option) => option.value),
            )
          }
          required
          aria-label="Seleziona una o più competizioni"
        >
          {lookups.competitions.map((competition) => (
            <option key={competition.id} value={competition.id}>
              {competition.name}
            </option>
          ))}
        </select>
      );
    }
    if (f === "player_id" && resource === "transfer_market_entries") { const opts = relationOptions(f, resource, form, lookups); return <><select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)}><option value="">Non registrato: compila i dati esterni sotto</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select><small className="admin-help-text">Puoi scegliere un giocatore già presente in piattaforma, anche da un’altra competizione. Per un nuovo giocatore lascia vuoto e inserisci nome e cognome nei campi successivi.</small></>; }    const rel = ["competition_id", "team_id", "home_team_id", "away_team_id", "match_id", "player_id", "related_player_id"]; if (rel.includes(f)) { const opts = relationOptions(f, resource, form, lookups); return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)}><option value="">Seleziona</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>; } if (f === "status") { const opts = resource === "competitions" ? options.competitionStatus : options.matchStatus; return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required><option value="">Seleziona</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>; } if (options[f]) return <select value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)}><option value="">Seleziona</option>{options[f].map((o) => <option key={o} value={o}>{f === "event_type" && o === "presidential_penalty" ? "Rigore presidenziale" : f === "award_type" && o === "player" ? "POTM" : f === "award_type" && o === "staff" ? "Staff del mese" : o}</option>)}</select>; if (f === "slot_number") return <select value={String(v ?? 1)} onChange={(e) => setField(f, e.target.value)} required><option value="1">Slot 1</option><option value="2">Slot 2</option><option value="3">Slot 3</option><option value="4">Slot 4</option><option value="5">Slot 5</option><option value="6">Slot 6</option></select>; if (f === "statistics_group") return <><input type="text" value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} placeholder="es. Street Cup" /><small className="admin-help-text">Inserisci lo stesso nome in tutte le competizioni da riunire. Saranno mostrate sotto un’unica voce pubblica e aggregate nelle statistiche. Lascia vuoto per mantenerla separata.</small></> ; if (f === "description") return <RichTextEditor value={String(v ?? "")} onChange={(x) => setField(f, x)} />; if (f === "note") return <textarea rows={5} value={String(v ?? "")} onChange={(e) => setField(f, e.target.value)} />; const dt = f === "kickoff_at" || f === "published_at"; const date = f === "start_date" || f === "end_date"; const num = ["shirt_number", "home_score", "away_score", "minute", "sort_order", "external_shirt_number"].includes(f); const uploadable = isUploadableImage(f); const url = ["cta_url", "website_url", "content_url", "logo_url", "profile_image_url", "bg_less_image_url", "thumbnail_url", "flyer_url", "card_image_url", "activity_image_url", "external_photo_url"].includes(f); const input = <input type={dt ? "datetime-local" : date ? "date" : num ? "number" : url ? "url" : "text"} value={dt ? localDate(v) : v == null ? "" : String(v)} onChange={(e) => setField(f, e.target.value)} required={required[resource].includes(f)} min={num ? 0 : undefined} placeholder={f === "month_label" ? "Settembre 2026" : undefined} />; if (!uploadable) return input; return <div className="admin-input-row">{input}<input className="file-input" type="file" accept="image/*" disabled={!canWrite || uploadingField === f} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFor(f, file); e.currentTarget.value = ""; }} />{uploadingField === f && <small className="admin-help-text">Caricamento…</small>}</div>; };
  return <div className="admin-resource"><div className="admin-resource__head"><div><span className="eyebrow">CRUD / {labels[resource]}</span><h2>{editing ? "Modifica record" : "Nuovo record"}</h2></div>{editing && <button className="btn btn--ghost" type="button" onClick={cancelEdit}>Annulla</button>}</div>{canWrite ? <form className="admin-form" onSubmit={save}><div className="admin-form__grid">{fields[resource].map((f) => f === "competition_ids" ? <fieldset className="admin-fieldset" key={f}><legend>{labelize(f)}</legend><p className="admin-fieldset__help">Seleziona tutte le competizioni a cui partecipa la squadra.</p><div className="admin-checkbox-group">{lookups.competitions.map((competition) => { const selected = Array.isArray(form.competition_ids) && form.competition_ids.map(String).includes(competition.id); return <label className="admin-checkbox" key={competition.id}><input type="checkbox" checked={selected} onChange={() => { const current = Array.isArray(form.competition_ids) ? form.competition_ids.map(String) : []; setField("competition_ids", selected ? current.filter((id) => id !== competition.id) : [...current, competition.id]); }} /><span>{competition.name}</span></label>; })}</div></fieldset> : <label key={f}>{labelize(f)}{render(f)}</label>)}</div>{message && <p className="admin-message">{message}</p>}<button className="btn btn--primary" type="submit">{editing ? "Salva modifiche" : "Crea record"}</button></form> : <div className="empty-state"><div className="empty-state__mark">R</div><div><h3>Accesso in sola lettura</h3><p>Questo ruolo non può modificare questa sezione.</p></div></div>}<div className="admin-records">
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
    {loading ? (
      <p className="admin-message">Caricamento…</p>
    ) : !rows.length ? (
      <p className="admin-message">Nessun record presente.</p>
    ) : !filteredRows.length ? (
      <p className="admin-message">Nessun risultato per “{searchTerm}”.</p>
    ) : (
      <table className="admin-table">
        <thead>
          <tr>
            {fields[resource].slice(0, 6).map((f) => <th key={f}>{labelize(f)}</th>)}
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r) => (
            <tr key={String(r[keys[resource]])}>
              {fields[resource].slice(0, 6).map((f) => (
                <td key={f}>{displayCellValue(resource, f, r, lookups)}</td>
              ))}
              <td className="admin-actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => edit(r)}>Modifica</button>{" "}
                <button className="btn btn--danger btn--small" type="button" onClick={() => void remove(r)}>Elimina</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
</div></div>;
}

function isUploadableImage(field: string) { return field.includes("logo") || field.includes("image") || field.includes("photo") || field.includes("thumbnail") || field === "flyer_url" || field === "card_image_url"; }

function Login({ onLogin }: { onLogin: (p: AdminProfile) => void }) { const [u, setU] = useState(""); const [c, setC] = useState(""); const [m, setM] = useState(""); const [busy, setBusy] = useState(false); const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setM(""); try { const r = await signInWithAccessCode(u, c); if (r.error) throw r.error; const p = await getAuthenticatedAdmin(); if (!p) throw new Error("Profilo amministratore non valido."); onLogin(p); } catch (e) { setM(errorMessage(e, "Accesso non riuscito.")); } finally { setBusy(false); } }; return <div className="admin-login"><span className="eyebrow">Street League / Admin</span><h1>Back office</h1><p>Accedi con username e codice permanente per gestire la piattaforma.</p>{m && <p className="admin-error">{m}</p>}<form onSubmit={submit}><input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" /><input type="password" value={c} onChange={(e) => setC(e.target.value)} placeholder="Codice di accesso" /><button className="btn btn--primary" disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button></form></div>; }



export default function AdminDashboard() {
  const [profile, setProfile] = useState<AdminProfile | null>(null); const [resource, setResource] = useState<AdminSection>("competitions"); const [booting, setBooting] = useState(true);
  useEffect(() => { void getAuthenticatedAdmin().then(setProfile).catch(() => setProfile(null)).finally(() => setBooting(false)); }, []);
  const logout = async () => { await supabase?.auth.signOut(); setProfile(null); setResource("competitions"); };
  if (!supabaseConfigured || booting) return <PageShell title="Admin" eyebrow="Street League"><div className="admin-help"><h3>Configurazione</h3><p>Verifica le variabili Supabase prima di accedere al back office.</p></div></PageShell>;
  if (!profile) return <PageShell title="Admin" eyebrow="Street League"><Login onLogin={setProfile} /></PageShell>;
  return <PageShell title="Back office" eyebrow={profile.role}><div className="admin-layout"><aside className="admin-sidebar"><span className="eyebrow">Street League</span><h2>Back office</h2><p className="admin-user">{profile.full_name ?? profile.username ?? profile.email}</p><nav>{nav.map((item) => <button key={item.key} type="button" className={resource === item.key ? "active" : ""} onClick={() => setResource(item.key)}>{item.label}</button>)}</nav><button className="btn btn--ghost" type="button" onClick={() => void logout()}>Esci</button></aside><main className="admin-main">{resource === "match_awards" ? <AdminMatchAwards /> : <Crud resource={resource} profile={profile} />}</main></div></PageShell>;
}
