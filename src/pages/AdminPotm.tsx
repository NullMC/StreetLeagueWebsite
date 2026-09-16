import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import {
  getAuthenticatedAdmin,
  signInWithAccessCode,
  type AdminProfile,
} from "../lib/admin";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getPlayers, getTeams } from "../lib/api";
import type { Player, Team } from "../types";

type PotmRow = {
  id: string;
  player_id: string;
  month_label: string;
  note: string | null;
  published_at: string;
};

export default function AdminPotm() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [rows, setRows] = useState<PotmRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [monthLabel, setMonthLabel] = useState("");
  const [note, setNote] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    if (!supabase) return;
    const [potmResult, nextPlayers, nextTeams] = await Promise.all([
      supabase
        .from("player_of_month")
        .select("id,player_id,month_label,note,published_at")
        .order("published_at", { ascending: false }),
      getPlayers(),
      getTeams(),
    ]);
    if (potmResult.error) throw potmResult.error;
    setRows((potmResult.data ?? []) as PotmRow[]);
    setPlayers(nextPlayers);
    setTeams(nextTeams);
  }

  useEffect(() => {
    void getAuthenticatedAdmin().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (profile) void loadData().catch((e) => setError(e instanceof Error ? e.message : "Errore di caricamento."));
  }, [profile]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoginError("");
    const result = await signInWithAccessCode(username, code);
    if (result.error) {
      setLoginError(result.error.message);
      return;
    }
    const next = await getAuthenticatedAdmin();
    setProfile(next);
    setCode("");
  }

  function resetForm() {
    setEditingId(null);
    setPlayerId("");
    setMonthLabel("");
    setNote("");
    setPublishedAt("");
  }

  function edit(row: PotmRow) {
    setEditingId(row.id);
    setPlayerId(row.player_id);
    setMonthLabel(row.month_label);
    setNote(row.note ?? "");
    const date = new Date(row.published_at);
    setPublishedAt(
      Number.isNaN(date.getTime())
        ? ""
        : new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16),
    );
    window.scrollTo({ top: 140, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile || !["admin", "super_admin"].includes(profile.role)) return;
    setError("");
    setMessage("");
    if (!playerId || !monthLabel.trim()) {
      setError("Giocatore e mese sono obbligatori.");
      return;
    }

    const payload = {
      player_id: playerId,
      month_label: monthLabel.trim(),
      note: note.trim() || null,
      published_at: publishedAt
        ? new Date(publishedAt).toISOString()
        : new Date().toISOString(),
    };

    try {
      const query = editingId
        ? supabase.from("player_of_month").update(payload).eq("id", editingId)
        : supabase.from("player_of_month").insert(payload);
      const { error: saveError } = await query;
      if (saveError) throw saveError;
      setMessage(editingId ? "POTM aggiornato." : "POTM pubblicato.");
      resetForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita.");
    }
  }

  async function remove(row: PotmRow) {
    if (!supabase || !profile || !confirm("Eliminare questo POTM?")) return;
    const { error: removeError } = await supabase
      .from("player_of_month")
      .delete()
      .eq("id", row.id);
    if (removeError) setError(removeError.message);
    else {
      setMessage("POTM eliminato.");
      if (editingId === row.id) resetForm();
      await loadData();
    }
  }

  if (!supabaseConfigured) {
    return (
      <PageShell>
        <div className="page"><div className="empty-state"><div className="empty-state__mark">DB</div><div><h3>Supabase non configurato</h3><p>Configura le variabili VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.</p></div></div></div>
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
            <p>Accedi per modificare il Player of the Month.</p>
            <form onSubmit={login}>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Codice di accesso" type="password" required />
              <button className="btn btn--primary" type="submit">Accedi</button>
              {loginError ? <p className="admin-error">{loginError}</p> : null}
            </form>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!["admin", "super_admin"].includes(profile.role)) {
    return (
      <PageShell>
        <div className="page"><div className="empty-state"><div><h3>Accesso non autorizzato</h3><p>Il POTM può essere modificato da Admin e Super Admin.</p></div></div></div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="page admin-potm">
        <div className="admin-hero">
          <div>
            <span className="eyebrow">Admin · {profile.role}</span>
            <h1>Player of the Month</h1>
            <p>Gestisci il riconoscimento mostrato sotto Top Performers.</p>
          </div>
          <a className="btn btn--ghost" href="/admin">Torna alla dashboard</a>
        </div>

        <form className="admin-potm__card" onSubmit={save}>
          <div className="admin-potm__grid">
            <div className="admin-potm__field">
              <label htmlFor="potm-player">Giocatore</label>
              <select id="potm-player" value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
                <option value="">Seleziona giocatore</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    #{player.shirt_number ?? "—"} · {player.first_name} {player.last_name} · {teams.find((team) => team.id === player.team_id)?.name ?? "Squadra"}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-potm__field">
              <label htmlFor="potm-month">Mese</label>
              <input id="potm-month" value={monthLabel} onChange={(e) => setMonthLabel(e.target.value)} placeholder="Settembre 2026" required />
            </div>
            <div className="admin-potm__field">
              <label htmlFor="potm-published">Pubblicato</label>
              <input id="potm-published" type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
            </div>
            <div className="admin-potm__field admin-potm__field--full">
              <label htmlFor="potm-note">Nota</label>
              <textarea id="potm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivazione o breve descrizione del riconoscimento" />
            </div>
          </div>
          <div className="admin-potm__actions">
            <div>
              {message ? <p className="admin-potm__message">{message}</p> : null}
              {error ? <p className="admin-potm__error">{error}</p> : null}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {editingId ? <button type="button" className="btn btn--ghost" onClick={resetForm}>Annulla</button> : null}
              <button className="btn btn--primary" type="submit">{editingId ? "Salva modifiche" : "Pubblica POTM"}</button>
            </div>
          </div>
        </form>

        <div className="admin-potm__card">
          <div className="sponsor-tier__heading sponsor-tier__heading--row">
            <div><span className="eyebrow">Archivio</span><h3>POTM pubblicati</h3></div>
          </div>
          {rows.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Mese</th><th>Giocatore</th><th>Pubblicato</th><th /></tr></thead>
                <tbody>
                  {rows.map((row) => {
                    const player = players.find((entry) => entry.id === row.player_id);
                    return (
                      <tr key={row.id}>
                        <td>{row.month_label}</td>
                        <td>{player ? `${player.first_name} ${player.last_name}` : "—"}</td>
                        <td>{new Date(row.published_at).toLocaleString("it-IT")}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button className="btn btn--ghost" type="button" onClick={() => edit(row)}>Modifica</button>
                            <button className="btn btn--ghost" type="button" onClick={() => void remove(row)}>Elimina</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p style={{ margin: 0, color: "var(--muted)" }}>Nessun POTM pubblicato.</p>}
        </div>
      </div>
    </PageShell>
  );
}
