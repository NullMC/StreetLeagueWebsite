import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { supabase, supabaseConfigured } from "../lib/supabase";
import {
  callAdminUsers,
  getCurrentAdminProfile,
  getAuthenticatedAdmin,
  signInWithAccessCode,
  uploadMedia,
  type AdminProfile,
  type AdminRole,
} from "../lib/admin";
import {
  getCompetitions,
  getTeams,
  getPlayers,
  getMatches,
  getPartners,
} from "../lib/api";
import type { Competition, Team, Player, Match, Partner } from "../types";

type Resource =
  | "competitions"
  | "teams"
  | "players"
  | "matches"
  | "events"
  | "lineups"
  | "mvp"
  | "partners"
  | "social_contents";
type Row = Record<string, unknown>;

const resourceLabels: Record<Resource, string> = {
  competitions: "Competizioni",
  teams: "Squadre",
  players: "Giocatori",
  matches: "Partite",
  events: "Eventi",
  lineups: "Formazioni",
  mvp: "MVP",
  partners: "Sponsor",
  social_contents: "Social / Video",
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
  teams: ["competition_id", "name", "slug", "accent_hex", "logo_url"],
  players: [
    "team_id",
    "first_name",
    "last_name",
    "shirt_number",
    "position",
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
    "other",
  ],
};

const fieldLabels: Record<string, string> = {
  // competitions
  name: "Nome",
  slug: "Slug",
  status: "Stato",
  season_label: "Stagione",
  start_date: "Data inizio",
  end_date: "Data fine",
  hero_image_url: "Immagine (hero)",
  // teams
  competition_id: "Competizione",
  accent_hex: "Colore accent",
  logo_url: "Logo",
  // players
  team_id: "Squadra",
  first_name: "Nome",
  last_name: "Cognome",
  shirt_number: "Numero",
  position: "Ruolo",
  bg_less_image_url: "Immagine sfondo",
  // matches
  home_team_id: "Squadra casa",
  away_team_id: "Squadra ospite",
  matchday: "Giornata",
  kickoff_at: "Inizio",
  home_score: "Gol casa",
  away_score: "Gol ospite",
  venue: "Stadio",
  // events
  match_id: "Partita",
  player_id: "Giocatore",
  related_player_id: "Giocatore correlato",
  event_type: "Tipo evento",
  minute: "Minuto",
  note: "Nota",
  // partners / social
  tier: "Livello",
  website_url: "Sito web",
  sort_order: "Ordine",
  platform: "Piattaforma",
  title: "Titolo",
  thumbnail_url: "Anteprima",
  content_url: "URL contenuto",
  published_at: "Pubblicato",
};

function labelize(value: string) {
  if (fieldLabels[value]) return fieldLabels[value];
  return value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());
}

function defaultsFor(resource: Resource): Row {
  const row: Row = {};
  for (const field of resourceFields[resource])
    row[field] =
      field === "sort_order"
        ? 0
        : field === "status"
          ? resource === "competitions"
            ? "upcoming"
            : "scheduled"
          : field === "starter"
            ? true
            : "";
  return row;
}

async function fetchResource(resource: Resource): Promise<Row[]> {
  if (!supabase) return [];
  if (resource === "competitions")
    return (await getCompetitions()) as unknown as Row[];
  if (resource === "teams") return (await getTeams()) as unknown as Row[];
  if (resource === "players") return (await getPlayers()) as unknown as Row[];
  if (resource === "matches") return (await getMatches()) as unknown as Row[];
  const { data, error } = await supabase
    .from(resource === "events" ? "match_events" : resource)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Row[];
}

function sanitizePayload(resource: Resource, source: Row) {
  const payload: Row = {};
  for (const field of resourceFields[resource]) {
    let value = source[field];
    if (value === "") value = null;
    if (
      [
        "shirt_number",
        "home_score",
        "away_score",
        "minute",
        "sort_order",
      ].includes(field) &&
      value !== null
    )
      value = Number(value);
    if (field === "starter") value = Boolean(value);
    payload[field] = value;
  }
  return payload;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (typeof value === "string" && value.length > 35)
    return `${value.slice(0, 35)}…`;
  return String(value);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lookups, setLookups] = useState<{
    competitions: Competition[];
    teams: Team[];
    players: Player[];
    matches: Match[];
  }>({ competitions: [], teams: [], players: [], matches: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canWrite =
    profile.role === "super_admin" ||
    profile.role === "admin" ||
    (profile.role === "operator" &&
      ["matches", "events", "lineups", "mvp"].includes(resource));

  async function refresh() {
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
  }

  useEffect(() => {
    setForm(defaultsFor(resource));
    setEditingId(null);
    setMessage("");
    void refresh();
  }, [resource]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [competitions, teams, players, matches] = await Promise.all([
          getCompetitions(),
          getTeams(),
          getPlayers(),
          getMatches(),
        ]);
        setLookups({ competitions, teams, players, matches });
      } catch {
        /* lookups remain empty until DB is populated */
      }
    }
    void loadLookups();
  }, [resource]);

  const fields = resourceFields[resource];
  const visibleColumns = fields.slice(0, 5);

  function startEdit(row: Row) {
    setEditingId(String(row.id));
    setForm({ ...row });
    window.scrollTo({ top: 140, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !canWrite) return;
    setMessage("");
    try {
      const payload = sanitizePayload(resource, form);
      const table = resource === "events" ? "match_events" : resource;
      const query = editingId
        ? supabase.from(table).update(payload).eq("id", editingId)
        : supabase.from(table).insert(payload);
      const { error } = await query;
      if (error) throw error;
      setMessage(editingId ? "Record aggiornato." : "Record creato.");
      setForm(defaultsFor(resource));
      setEditingId(null);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  }

  async function remove(row: Row) {
    if (
      !supabase ||
      !canWrite ||
      !row.id ||
      !confirm("Eliminare questo record?")
    )
      return;
    const table = resource === "events" ? "match_events" : resource;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Record eliminato.");
      await refresh();
    }
  }

  async function uploadFor(field: string, file: File) {
    try {
      const folder = field.includes("logo")
        ? "logos"
        : field.includes("bg_less")
          ? "players/bg-less"
          : field.includes("profile")
            ? "players/profile"
            : field.includes("thumbnail")
              ? "social"
              : "media";
      const url = await uploadMedia(file, folder);
      setForm((prev) => ({ ...prev, [field]: url }));
      setMessage(
        "File caricato. Salva il record per applicare l" + "'" + "URL.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload non riuscito.",
      );
    }
  }

  function setField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toDateTimeLocal(value: unknown) {
    if (!value) return "";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  }

  function renderField(field: string) {
    const value = form[field];
    const relation = [
      "competition_id",
      "team_id",
      "home_team_id",
      "away_team_id",
      "match_id",
      "player_id",
      "related_player_id",
    ].includes(field);
    const relationOptions =
      field === "competition_id"
        ? lookups.competitions.map((x) => ({ id: x.id, label: x.name }))
        : field.includes("team_id")
          ? lookups.teams.map((x) => ({ id: x.id, label: x.name }))
          : field.includes("player_id")
            ? lookups.players.map((x) => ({
                id: x.id,
                label: `${x.first_name} ${x.last_name}`,
              }))
            : field === "match_id"
              ? lookups.matches.map((x) => ({
                  id: x.id,
                  label: `${x.id.slice(0, 8)} — ${x.matchday ?? ""}`,
                }))
              : [];

    if (relation) {
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setField(field, e.target.value)}
          required
        >
          <option value="">Seleziona</option>
          {relationOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    if (field === "starter") {
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
        >
          <option value="">Seleziona</option>
          {options.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      );
    }

    if (selectOptions[field]) {
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => setField(field, e.target.value)}
        >
          <option value="">Seleziona</option>
          {selectOptions[field].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      );
    }

    const isDateTime = field === "kickoff_at" || field === "published_at";
    const isDate = field === "start_date" || field === "end_date";
    const isNumber = [
      "shirt_number",
      "home_score",
      "away_score",
      "minute",
      "sort_order",
    ].includes(field);
    const type = isDateTime
      ? "datetime-local"
      : isDate
        ? "date"
        : isNumber
          ? "number"
          : "text";
    const inputValue = isDateTime
      ? toDateTimeLocal(value)
      : value === null || value === undefined
        ? ""
        : String(value);
    const acceptsImage =
      field.includes("logo") ||
      field.includes("image") ||
      field.includes("thumbnail") ||
      field.includes("hero_image");

    return (
      <div className="admin-input-row">
        <input
          type={type}
          value={inputValue}
          onChange={(e) => setField(field, e.target.value)}
        />
        {acceptsImage && (
          <input
            className="file-input"
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files?.[0] && void uploadFor(field, e.target.files[0])
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="admin-resource">
      <div className="admin-resource__head">
        <div>
          <span className="eyebrow">CRUD / {resourceLabels[resource]}</span>
          <h2>{editingId ? "Modifica record" : "Nuovo record"}</h2>
        </div>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(defaultsFor(resource));
            setEditingId(null);
          }}
        >
          Nuovo
        </button>
      </div>
      {canWrite && (
        <form className="admin-form" onSubmit={save}>
          <div className="admin-form__grid">
            {fields.map((field) => (
              <label key={field}>
                {labelize(field)}
                {renderField(field)}
              </label>
            ))}
          </div>
          {message && <p className="admin-message">{message}</p>}
          <button className="btn btn--primary" type="submit">
            {editingId ? "Salva modifiche" : "Crea record"}
          </button>
        </form>
      )}
      {!canWrite && (
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
        ) : rows.length === 0 ? (
          <p className="admin-message">Nessun record presente.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {visibleColumns.map((x) => (
                  <th key={x}>{labelize(x)}</th>
                ))}
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {visibleColumns.map((x) => (
                    <td key={x}>{formatCell(row[x])}</td>
                  ))}
                  <td className="admin-actions">
                    {canWrite && (
                      <button
                        className="btn btn--small btn--ghost"
                        onClick={() => startEdit(row)}
                      >
                        Modifica
                      </button>
                    )}
                    {canWrite && (
                      <button
                        className="btn btn--small btn--danger"
                        onClick={() => void remove(row)}
                      >
                        Elimina
                      </button>
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
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    code: "",
    role: "admin" as AdminRole,
  });
  const [message, setMessage] = useState("");

  async function load() {
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
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setEditing(null);
    setForm({
      username: "",
      email: "",
      full_name: "",
      code: "",
      role: "admin",
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      await callAdminUsers(
        editing
          ? {
              action: "update",
              user_id: editing.id,
              username: form.username,
              email: form.email,
              full_name: form.full_name,
              code: form.code,
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
  }

  async function toggle(user: AdminProfile) {
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
  }

  async function remove(user: AdminProfile) {
    if (!confirm(`Eliminare ${user.username ?? user.full_name ?? "utente"}?`))
      return;

    try {
      await callAdminUsers({ action: "delete", user_id: user.id });
      if (editing?.id === user.id) resetForm();
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    }
  }

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
              maxLength={32}
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
              minLength={8}
              required={!editing}
              placeholder={
                editing
                  ? "Lascia vuoto per mantenere il codice"
                  : "Minimo 8 caratteri"
              }
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
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username ?? "—"}</td>
                <td>{u.email ?? "—"}</td>
                <td>{u.full_name ?? "—"}</td>
                <td>{u.role}</td>
                <td>{u.is_active ? "Attivo" : "Disabilitato"}</td>
                <td className="admin-actions">
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => {
                      setEditing(u);
                      setForm({
                        username: u.username ?? "",
                        email: u.email ?? "",
                        full_name: u.full_name ?? "",
                        code: "",
                        role: u.role,
                      });
                    }}
                    type="button"
                  >
                    Modifica
                  </button>
                  <button
                    className="btn btn--small btn--ghost"
                    onClick={() => void toggle(u)}
                    type="button"
                  >
                    {u.is_active ? "Disattiva" : "Attiva"}
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => void remove(u)}
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

    const init = async () => {
      try {
        const admin = await getAuthenticatedAdmin();

        if (mounted) {
          setProfile(admin);
        }
      } catch (error) {
        console.error("Session initialization error:", error);

        if (mounted) {
          setProfile(null);
        }
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setProfile(null);
        setSection("dashboard");
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        try {
          const admin = await getAuthenticatedAdmin();

          if (mounted) {
            setProfile(admin);
          }
        } catch (error) {
          console.error("Auth state validation error:", error);

          if (mounted) {
            setProfile(null);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(e: FormEvent) {
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

      const p = await getCurrentAdminProfile();

      if (
        !p ||
        !p.is_active ||
        !["super_admin", "admin", "operator"].includes(p.role)
      ) {
        await supabase.auth.signOut();
        setError("Account non autorizzato o disattivato.");
        return;
      }

      setProfile(p);
      setCode("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Errore durante l’accesso.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase?.auth.signOut();
    setProfile(null);
    setSection("dashboard");
  }

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
            "social_contents",
          ]) as Resource[],
    [profile],
  );

  if (!supabaseConfigured) {
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
  }

  if (!profile) {
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
  }

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
            {resources.map((r) => (
              <button
                key={r}
                className={section === r ? "active" : ""}
                onClick={() => setSection(r)}
                type="button"
              >
                {resourceLabels[r]}
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
            <>
              <div className="admin-hero">
                <div>
                  <span className="eyebrow">{profile.role}</span>
                  <h1>Dashboard</h1>
                  <p>Gestisci tutti i contenuti Street League.</p>
                </div>
              </div>
            </>
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
