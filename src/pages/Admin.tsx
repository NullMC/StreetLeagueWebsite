import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { supabase, supabaseConfigured } from "../lib/supabase";
import {
  callAdminUsers,
  getAuthenticatedAdmin,
  signInWithAccessCode,
  uploadMedia,
  type AdminProfile,
  type AdminRole,
} from "../lib/admin";
import { getCompetitions, getTeams, getPlayers, getMatches } from "../lib/api";
import type { Competition, Team, Player, Match } from "../types";

type Resource =
  | "competitions"
  | "teams"
  | "players"
  | "matches"
  | "events"
  | "lineups"
  | "mvp"
  | "partners"
  | "active_collaborations"
  | "social_contents";
type Row = Record<string, unknown>;
type LookupState = {
  competitions: Competition[];
  teams: Team[];
  players: Player[];
  matches: Match[];
};

const resourceLabels: Record<Resource, string> = {
  competitions: "Competizioni",
  teams: "Squadre",
  players: "Giocatori",
  matches: "Partite",
  events: "Eventi",
  lineups: "Formazioni",
  mvp: "MVP",
  partners: "Sponsor",
  active_collaborations: "Collab attive",
  social_contents: "Social / Video",
};
const resourceTables: Record<Resource, string> = {
  competitions: "competitions",
  teams: "teams",
  players: "players",
  matches: "matches",
  events: "match_events",
  lineups: "match_lineups",
  mvp: "match_mvp",
  partners: "partners",
  active_collaborations: "active_collaborations",
  social_contents: "social_contents",
};
const resourcePrimaryKeys: Record<Resource, string> = {
  competitions: "id",
  teams: "id",
  players: "id",
  matches: "id",
  events: "id",
  lineups: "id",
  mvp: "match_id",
  partners: "id",
  active_collaborations: "id",
  social_contents: "id",
};
const resourceFields: Record<Resource, string[]> = {
  competitions: [
    "name",
    "slug",
    "status",
    "season_label",
    "start_date",
    "end_date",
    "hero_image_url",
  ],
  teams: [
    "competition_id",
    "name",
    "slug",
    "short_name",
    "city",
    "accent_hex",
    "logo_url",
  ],
  players: [
    "team_id",
    "first_name",
    "last_name",
    "shirt_number",
    "position",
    "profile_image_url",
    "bg_less_image_url",
  ],
  matches: [
    "competition_id",
    "home_team_id",
    "away_team_id",
    "matchday",
    "kickoff_at",
    "status",
    "home_score",
    "away_score",
    "venue",
  ],
  events: [
    "match_id",
    "player_id",
    "related_player_id",
    "event_type",
    "minute",
    "note",
  ],
  lineups: ["match_id", "team_id", "player_id", "starter", "shirt_number"],
  mvp: ["match_id", "player_id"],
  partners: ["name", "tier", "logo_url", "website_url", "sort_order"],
  active_collaborations: ["title", "description", "flyer_url", "sort_order"],
  social_contents: [
    "platform",
    "title",
    "thumbnail_url",
    "content_url",
    "published_at",
  ],
};
const selectOptions: Record<string, string[]> = {
  competitionStatus: ["upcoming", "active", "finished"],
  matchStatus: ["scheduled", "live", "finished", "postponed"],
  tier: ["gold", "silver", "bronze"],
  platform: ["youtube", "instagram", "tiktok"],
  event_type: [
    "goal",
    "assist",
    "yellow_card",
    "red_card",
    "substitution",
    "foul",
    "other",
  ],
};
const fieldLabels: Record<string, string> = {
  name: "Nome",
  slug: "Slug",
  status: "Stato",
  season_label: "Stagione",
  start_date: "Data inizio",
  end_date: "Data fine",
  hero_image_url: "Immagine hero",
  competition_id: "Competizione",
  short_name: "Nome breve",
  city: "Città",
  accent_hex: "Colore accent",
  logo_url: "Logo",
  team_id: "Squadra",
  first_name: "Nome",
  last_name: "Cognome",
  shirt_number: "Numero",
  position: "Ruolo",
  profile_image_url: "Immagine profilo",
  bg_less_image_url: "Immagine sfondo",
  home_team_id: "Squadra casa",
  away_team_id: "Squadra ospite",
  matchday: "Giornata",
  kickoff_at: "Inizio",
  home_score: "Gol casa",
  away_score: "Gol ospite",
  venue: "Stadio",
  match_id: "Partita",
  player_id: "Giocatore",
  related_player_id: "Giocatore correlato",
  event_type: "Tipo evento",
  minute: "Minuto",
  note: "Nota",
  tier: "Livello",
  website_url: "Sito web",
  sort_order: "Ordine",
  platform: "Piattaforma",
  title: "Titolo",
  description: "Descrizione",
  thumbnail_url: "Anteprima",
  content_url: "URL contenuto",
  published_at: "Pubblicato",
  flyer_url: "Volantino",
  starter: "Titolare",
};
const requiredFields: Record<Resource, string[]> = {
  competitions: ["name", "slug", "status"],
  teams: ["competition_id", "name", "slug"],
  players: ["team_id", "first_name", "last_name"],
  matches: [
    "competition_id",
    "home_team_id",
    "away_team_id",
    "kickoff_at",
    "status",
  ],
  events: ["match_id", "event_type"],
  lineups: ["match_id", "team_id", "player_id"],
  mvp: ["match_id", "player_id"],
  partners: ["name", "tier"],
  active_collaborations: ["title", "description"],
  social_contents: ["platform", "title", "content_url"],
};

const isId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
function labelize(value: string) {
  return (
    fieldLabels[value] ??
    value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase())
  );
}
function defaultsFor(resource: Resource): Row {
  const row: Row = {};
  resourceFields[resource].forEach((field) => {
    row[field] =
      field === "sort_order"
        ? 0
        : field === "starter"
          ? true
          : field === "status"
            ? resource === "competitions"
              ? "upcoming"
              : "scheduled"
            : "";
  });
  return row;
}
function normalizeDateTimeLocal(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Data/ora non valida.");
  return date.toISOString();
}
async function fetchResource(resource: Resource): Promise<Row[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(resourceTables[resource])
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Row[];
}
function relationOptions(
  field: string,
  resource: Resource,
  form: Row,
  lookups: LookupState,
) {
  if (field === "competition_id")
    return lookups.competitions.map((x) => ({ id: x.id, label: x.name }));
  if (field === "team_id") {
    if (resource === "players")
      return lookups.teams.map((x) => ({ id: x.id, label: x.name }));
    if (resource === "lineups") {
      const match = lookups.matches.find((x) => x.id === form.match_id);
      if (!match) return [];
      return lookups.teams
        .filter(
          (x) => x.id === match.home_team_id || x.id === match.away_team_id,
        )
        .map((x) => ({ id: x.id, label: x.name }));
    }
  }
  if (field === "home_team_id" || field === "away_team_id")
    return lookups.teams
      .filter(
        (x) => !form.competition_id || x.competition_id === form.competition_id,
      )
      .map((x) => ({ id: x.id, label: x.name }));
  if (field === "match_id")
    return lookups.matches.map((x) => ({
      id: x.id,
      label: `${lookups.teams.find((t) => t.id === x.home_team_id)?.name ?? "Casa"} - ${lookups.teams.find((t) => t.id === x.away_team_id)?.name ?? "Ospite"} / ${x.matchday ?? "—"}`,
    }));
  if (field === "player_id" || field === "related_player_id") {
    let players = lookups.players;
    if (resource === "lineups")
      players = form.team_id
        ? players.filter((x) => x.team_id === form.team_id)
        : [];
    if (resource === "events" || resource === "mvp") {
      const match = lookups.matches.find((x) => x.id === form.match_id);
      const teamIds = match ? [match.home_team_id, match.away_team_id] : [];
      players = players.filter((x) => teamIds.includes(x.team_id));
    }
    return players.map((x) => ({
      id: x.id,
      label: `#${x.shirt_number ?? "—"} ${x.first_name} ${x.last_name}`,
    }));
  }
  return [];
}
function sanitizePayload(resource: Resource, source: Row): Row {
  const payload: Row = {};
  resourceFields[resource].forEach((field) => {
    let value = source[field];
    if (field === "kickoff_at" || field === "published_at")
      value =
        value === "" || value == null
          ? null
          : localDateTimeToIso(String(value));
    else if (value === "") value = null;
    if (
      [
        "shirt_number",
        "home_score",
        "away_score",
        "minute",
        "sort_order",
      ].includes(field) &&
      value != null
    ) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric))
        throw new Error(`${labelize(field)} non è valido.`);
      value = numeric;
    }
    payload[field] = field === "starter" ? Boolean(value) : value;
  });
  return payload;
}
function validateRow(resource: Resource, payload: Row, lookups: LookupState) {
  requiredFields[resource].forEach((field) => {
    if (payload[field] == null || payload[field] === "")
      throw new Error(`${labelize(field)} è obbligatorio.`);
  });
  if (
    ["shirt_number", "home_score", "away_score", "minute", "sort_order"].some(
      (field) => payload[field] != null && Number(payload[field]) < 0,
    )
  )
    throw new Error("I valori numerici non possono essere negativi.");
  if (resource === "matches") {
    const competition = lookups.competitions.find(
      (x) => x.id === payload.competition_id,
    );
    const home = lookups.teams.find((x) => x.id === payload.home_team_id);
    const away = lookups.teams.find((x) => x.id === payload.away_team_id);
    if (!competition || !home || !away)
      throw new Error("Competizione o squadre non valide.");
    if (
      home.competition_id !== competition.id ||
      away.competition_id !== competition.id
    )
      throw new Error(
        "Casa e ospite devono appartenere alla competizione selezionata.",
      );
    if (home.id === away.id)
      throw new Error(
        "La squadra casa e la squadra ospite devono essere diverse.",
      );
  }
  if (
    resource === "players" &&
    !lookups.teams.some((x) => x.id === payload.team_id)
  )
    throw new Error("La squadra selezionata non esiste.");
  if (resource === "lineups" || resource === "events" || resource === "mvp") {
    const match = lookups.matches.find((x) => x.id === payload.match_id);
    if (!match) throw new Error("La partita selezionata non esiste.");
    const allowed = [match.home_team_id, match.away_team_id];
    if (resource === "lineups") {
      const team = lookups.teams.find((x) => x.id === payload.team_id);
      const player = lookups.players.find((x) => x.id === payload.player_id);
      if (
        !team ||
        !allowed.includes(team.id) ||
        !player ||
        player.team_id !== team.id
      )
        throw new Error("Squadra o giocatore della formazione non validi.");
    } else {
      for (const playerId of [
        payload.player_id,
        payload.related_player_id,
      ].filter(isId)) {
        const player = lookups.players.find((x) => x.id === playerId);
        if (!player || !allowed.includes(player.team_id))
          throw new Error(
            "Il giocatore deve appartenere a una delle due squadre della partita.",
          );
      }
    }
  }
}
function tableLabel(resource: Resource, row: Row, lookups: LookupState) {
  if (resource === "competitions" || resource === "teams")
    return String(row.name ?? resource);
  if (resource === "players")
    return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  if (resource === "matches")
    return `${lookups.teams.find((x) => x.id === row.home_team_id)?.name ?? "Casa"} - ${lookups.teams.find((x) => x.id === row.away_team_id)?.name ?? "Ospite"}`;
  if (resource === "active_collaborations")
    return String(row.title ?? "Collaborazione");
  if (resource === "events")
    return `${row.event_type ?? "Evento"} / ${row.minute ?? "—"}'`;
  return String(row.title ?? row.name ?? resource);
}

function CrudPanel({
  resource,
  profile,
}: {
  resource: Resource;
  profile: AdminProfile;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>(() => defaultsFor(resource));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [lookups, setLookups] = useState<LookupState>({
    competitions: [],
    teams: [],
    players: [],
    matches: [],
  });
  const canWrite =
    profile.role === "super_admin" ||
    profile.role === "admin" ||
    (profile.role === "operator" &&
      ["matches", "events", "lineups", "mvp"].includes(resource));
  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await fetchResource(resource));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Errore di caricamento.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setForm(defaultsFor(resource));
    setEditingKey(null);
    void refresh();
  }, [resource]);
  useEffect(() => {
    Promise.all([getCompetitions(), getTeams(), getPlayers(), getMatches()])
      .then(([competitions, teams, players, matches]) =>
        setLookups({ competitions, teams, players, matches }),
      )
      .catch(() => undefined);
  }, [resource]);
  const setField = (field: string, value: unknown) =>
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "competition_id"
        ? { home_team_id: "", away_team_id: "" }
        : {}),
      ...(field === "match_id"
        ? { team_id: "", player_id: "", related_player_id: "" }
        : {}),
      ...(field === "team_id" && resource === "lineups"
        ? { player_id: "" }
        : {}),
    }));
  const startEdit = (row: Row) => {
    const next = { ...row };
    setEditingKey(String(row[resourcePrimaryKeys[resource]]));
    if (resource === "mvp") setEditingKey(String(row.match_id));
    if (next.kickoff_at)
      next.kickoff_at = normalizeDateTimeLocal(next.kickoff_at);
    if (next.published_at)
      next.published_at = normalizeDateTimeLocal(next.published_at);
    setForm(next);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };
  const cancelEdit = () => {
    setEditingKey(null);
    setForm(defaultsFor(resource));
  };
  const uploadFor = async (field: string, file: File) => {
    try {
      const folder =
        field === "flyer_url"
          ? "collaborations"
          : field.includes("logo")
            ? "logos"
            : field.includes("bg_less")
              ? "players/bg-less"
              : field.includes("profile")
                ? "players/profile"
                : field.includes("thumbnail")
                  ? "social"
                  : "media";
      const url = await uploadMedia(file, folder);
      setField(field, url);
      setMessage("File caricato. Salva il record per applicare l'URL.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload non riuscito.",
      );
    }
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !canWrite) return;
    setMessage("");
    try {
      const payload = sanitizePayload(resource, form);
      validateRow(resource, payload, lookups);
      const table = resourceTables[resource];
      if (editingKey) {
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq(resourcePrimaryKeys[resource], editingKey);
        if (error) throw error;
      } else if (resource === "mvp") {
        const { error } = await supabase
          .from(table)
          .upsert(payload, { onConflict: "match_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
      setMessage(editingKey ? "Record aggiornato." : "Record creato.");
      cancelEdit();
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  };
  const remove = async (row: Row) => {
    if (!supabase || !canWrite) return;
    const key =
      resource === "mvp" ? row.match_id : row[resourcePrimaryKeys[resource]];
    if (!key || !confirm(`Eliminare ${tableLabel(resource, row, lookups)}?`))
      return;
    const { error } = await supabase
      .from(resourceTables[resource])
      .delete()
      .eq(resourcePrimaryKeys[resource], key);
    if (error) setMessage(error.message);
    else {
      setMessage("Record eliminato.");
      await refresh();
    }
  };
  const renderField = (field: string) => {
    const value = form[field];
    if (field === "starter")
      return (
        <label className="check-field">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setField(field, e.target.checked)}
          />{" "}
          Titolare
        </label>
      );
    const relationFields = [
      "competition_id",
      "team_id",
      "home_team_id",
      "away_team_id",
      "match_id",
      "player_id",
      "related_player_id",
    ];
    if (relationFields.includes(field)) {
      const options = relationOptions(field, resource, form, lookups);
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setField(field, e.target.value)}
          required={requiredFields[resource].includes(field)}
        >
          <option value="">Seleziona</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    if (field === "status") {
      const options =
        resource === "competitions"
          ? selectOptions.competitionStatus
          : selectOptions.matchStatus;
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setField(field, e.target.value)}
          required
        >
          <option value="">Seleziona</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    if (selectOptions[field])
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setField(field, e.target.value)}
          required={requiredFields[resource].includes(field)}
        >
          <option value="">Seleziona</option>
          {selectOptions[field].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    const isDateTime = field === "kickoff_at" || field === "published_at";
    const isDate = field === "start_date" || field === "end_date";
    const isNumber = [
      "shirt_number",
      "home_score",
      "away_score",
      "minute",
      "sort_order",
    ].includes(field);
    const inputValue = isDateTime
      ? normalizeDateTimeLocal(value)
      : value == null
        ? ""
        : String(value);
    const acceptsImage =
      field.includes("logo") ||
      field.includes("image") ||
      field.includes("thumbnail") ||
      field === "flyer_url";
    if (field === "description" || field === "note")
      return (
        <textarea
          value={inputValue}
          onChange={(e) => setField(field, e.target.value)}
          required={requiredFields[resource].includes(field)}
          rows={5}
        />
      );
    return (
      <div className="admin-input-row">
        <input
          type={
            isDateTime
              ? "datetime-local"
              : isDate
                ? "date"
                : isNumber
                  ? "number"
                  : "text"
          }
          value={inputValue}
          onChange={(e) => setField(field, e.target.value)}
          required={requiredFields[resource].includes(field)}
          min={isNumber ? 0 : undefined}
        />
        {acceptsImage && (
          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFor(field, file);
            }}
          />
        )}
      </div>
    );
  };
  return (
    <div className="admin-resource">
      <div className="admin-resource__head">
        <div>
          <span className="eyebrow">CRUD / {resourceLabels[resource]}</span>
          <h2>{editingKey ? "Modifica record" : "Nuovo record"}</h2>
        </div>
        {editingKey && (
          <button className="btn btn--ghost" onClick={cancelEdit} type="button">
            Annulla
          </button>
        )}
      </div>
      {canWrite ? (
        <form className="admin-form" onSubmit={save}>
          <div className="admin-form__grid">
            {resourceFields[resource].map((field) => (
              <label key={field}>
                {labelize(field)}
                {renderField(field)}
              </label>
            ))}
          </div>
          {message && <p className="admin-message">{message}</p>}
          <button className="btn btn--primary" type="submit">
            {editingKey ? "Salva modifiche" : "Crea record"}
          </button>
        </form>
      ) : (
        <div className="empty-state">
          <div className="empty-state__mark">R</div>
          <div>
            <h3>Accesso in sola lettura</h3>
            <p>Questo ruolo non può modificare questa sezione.</p>
          </div>
        </div>
      )}
      <div className="admin-table-wrap">
        {loading ? (
          <p className="admin-message">Caricamento…</p>
        ) : !rows.length ? (
          <p className="admin-message">Nessun record presente.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {resourceFields[resource].slice(0, 5).map((field) => (
                  <th key={field}>{labelize(field)}</th>
                ))}
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={String(
                    resource === "mvp"
                      ? row.match_id
                      : row[resourcePrimaryKeys[resource]],
                  )}
                >
                  {resourceFields[resource].slice(0, 5).map((field) => (
                    <td key={field}>
                      {field === "team_id"
                        ? (lookups.teams.find((x) => x.id === row[field])
                            ?.name ?? "—")
                        : field === "player_id"
                          ? (() => {
                              const p = lookups.players.find(
                                (x) => x.id === row[field],
                              );
                              return p ? `${p.first_name} ${p.last_name}` : "—";
                            })()
                          : row[field] == null || row[field] === ""
                            ? "—"
                            : typeof row[field] === "boolean"
                              ? row[field]
                                ? "Sì"
                                : "No"
                              : String(row[field])}
                    </td>
                  ))}
                  <td className="admin-actions">
                    {canWrite && (
                      <>
                        <button
                          className="btn btn--small btn--ghost"
                          onClick={() => startEdit(row)}
                          type="button"
                        >
                          Modifica
                        </button>
                        <button
                          className="btn btn--small btn--danger"
                          onClick={() => void remove(row)}
                          type="button"
                        >
                          Elimina
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [editing, setEditing] = useState<AdminProfile | null>(null);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    code: "",
    role: "admin" as AdminRole,
  });
  const load = async () => {
    try {
      const result = await callAdminUsers({ action: "list" });
      setUsers(result.users ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossibile caricare gli amministratori.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const resetForm = () => {
    setEditing(null);
    setForm({
      username: "",
      email: "",
      full_name: "",
      code: "",
      role: "admin",
    });
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await callAdminUsers(
        editing
          ? {
              action: "update",
              user_id: editing.id,
              username: form.username,
              email: form.email,
              full_name: form.full_name,
              code: form.code || undefined,
              role: form.role,
            }
          : {
              action: "create",
              username: form.username,
              email: form.email,
              full_name: form.full_name,
              code: form.code,
              role: form.role,
            },
      );
      setMessage(
        editing ? "Amministratore aggiornato." : "Amministratore creato.",
      );
      resetForm();
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  };
  const toggle = async (user: AdminProfile) => {
    try {
      await callAdminUsers({
        action: user.is_active ? "deactivate" : "activate",
        user_id: user.id,
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  };
  const remove = async (user: AdminProfile) => {
    if (!confirm(`Eliminare ${user.username ?? user.full_name ?? "utente"}?`))
      return;
    try {
      await callAdminUsers({ action: "delete", user_id: user.id });
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  };
  return (
    <div className="admin-resource">
      <div className="admin-resource__head">
        <div>
          <span className="eyebrow">Super Admin / Utenti</span>
          <h2>
            {editing ? "Modifica amministratore" : "Nuovo amministratore"}
          </h2>
        </div>
        <button className="btn btn--ghost" onClick={resetForm} type="button">
          Nuovo
        </button>
      </div>
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form__grid">
          <label>
            Username
            <input
              required
              minLength={3}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Nome completo
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </label>
          <label>
            Codice di accesso
            <input
              type="text"
              minLength={editing && !form.code ? undefined : 8}
              required={!editing}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            Ruolo
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as AdminRole })
              }
            >
              <option value="admin">Admin</option>
              <option value="operator">Operatore</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
        </div>
        {message && <p className="admin-message">{message}</p>}
        <button className="btn btn--primary" type="submit">
          {editing ? "Salva" : "Crea account"}
        </button>
      </form>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username ?? "—"}</td>
                <td>{user.email ?? "—"}</td>
                <td>{user.full_name ?? "—"}</td>
                <td>{user.role}</td>
                <td>{user.is_active ? "Attivo" : "Disabilitato"}</td>
                <td className="admin-actions">
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => {
                      setEditing(user);
                      setForm({
                        username: user.username ?? "",
                        email: user.email ?? "",
                        full_name: user.full_name ?? "",
                        code: "",
                        role: user.role,
                      });
                    }}
                    type="button"
                  >
                    Modifica
                  </button>
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => void toggle(user)}
                    type="button"
                  >
                    {user.is_active ? "Disattiva" : "Attiva"}
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => void remove(user)}
                    type="button"
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Admin() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<"dashboard" | Resource | "users">(
    "dashboard",
  );
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void getAuthenticatedAdmin()
      .then((admin) => {
        if (mounted) setProfile(admin);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session) {
        setProfile(null);
        setSection("dashboard");
        return;
      }
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        try {
          const admin = await getAuthenticatedAdmin();
          if (mounted) setProfile(admin);
        } catch {
          if (mounted) setProfile(null);
        }
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!supabase) {
        setError("Configura Supabase prima di accedere.");
        return;
      }
      const { error: loginError } = await signInWithAccessCode(username, code);
      if (loginError) {
        setError("Username o codice di accesso non validi.");
        return;
      }
      const admin = await getAuthenticatedAdmin();
      if (!admin) {
        await supabase.auth.signOut();
        setError("Account non autorizzato o disattivato.");
        return;
      }
      setProfile(admin);
      setCode("");
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Errore durante l’accesso.",
      );
    } finally {
      setLoading(false);
    }
  };
  const logout = async () => {
    await supabase?.auth.signOut();
    setProfile(null);
    setSection("dashboard");
  };
  const resources = useMemo(
    () =>
      (profile?.role === "operator"
        ? ["matches", "events", "lineups", "mvp"]
        : [
            "competitions",
            "teams",
            "players",
            "matches",
            "events",
            "lineups",
            "mvp",
            "partners",
            "active_collaborations",
            "social_contents",
          ]) as Resource[],
    [profile],
  );
  if (!supabaseConfigured)
    return (
      <PageShell>
        <div className="page">
          <div className="empty-state">
            <div className="empty-state__mark">DB</div>
            <div>
              <h3>Supabase non configurato</h3>
              <p>
                Configura VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY in
                .env.local.
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    );
  if (!profile)
    return (
      <PageShell>
        <div className="page">
          <div className="admin-login">
            <span className="eyebrow">Restricted area</span>
            <h1>Street League Admin</h1>
            <p>Accedi con lo username e il codice assegnati dal Super Admin.</p>
            <form onSubmit={login}>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                required
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Codice di accesso"
                autoComplete="one-time-code"
                minLength={8}
                required
              />
              <button
                className="btn btn--primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Accesso…" : "Accedi"}
              </button>
              {error && <p className="admin-error">{error}</p>}
            </form>
          </div>
        </div>
      </PageShell>
    );
  return (
    <PageShell>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div>
            <span className="eyebrow">Street League</span>
            <h2>Back Office</h2>
            <p className="admin-user">
              {profile.username ?? profile.full_name}
            </p>
          </div>
          <nav>
            <button
              className={section === "dashboard" ? "active" : ""}
              onClick={() => setSection("dashboard")}
              type="button"
            >
              Dashboard
            </button>
            {resources.map((resource) => (
              <button
                key={resource}
                className={section === resource ? "active" : ""}
                onClick={() => setSection(resource)}
                type="button"
              >
                {resourceLabels[resource]}
              </button>
            ))}
            {profile.role === "super_admin" && (
              <button
                className={section === "users" ? "active" : ""}
                onClick={() => setSection("users")}
                type="button"
              >
                Amministratori
              </button>
            )}
          </nav>
          <button
            className="btn btn--ghost"
            onClick={() => void logout()}
            type="button"
          >
            Esci
          </button>
        </aside>
        <main className="admin-main">
          {section === "dashboard" ? (
            <div className="admin-hero">
              <div>
                <span className="eyebrow">{profile.role}</span>
                <h1>Dashboard</h1>
                <p>
                  Gestisci competizioni, squadre, giocatori, partite e contenuti
                  Street League.
                </p>
              </div>
            </div>
          ) : section === "users" ? (
            <UsersPanel />
          ) : (
            <CrudPanel resource={section} profile={profile} />
          )}
        </main>
      </div>
    </PageShell>
  );
}
