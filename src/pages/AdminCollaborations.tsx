import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getAuthenticatedAdmin, uploadMedia, type AdminProfile } from "../lib/admin";
import { getActiveCollaborations } from "../lib/api";
import type { ActiveCollaboration } from "../types";

export default function AdminCollaborations() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [items, setItems] = useState<ActiveCollaboration[]>([]);
  const [flyerUrl, setFlyerUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setItems(await getActiveCollaborations());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore di caricamento.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!supabase) return;
    getAuthenticatedAdmin().then(setProfile).catch(() => setProfile(null));
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile || !flyerUrl) return;
    setMessage("");
    const { error } = await supabase.from("active_collaborations").insert({
      flyer_url: flyerUrl,
      sort_order: Math.max(0, Number(sortOrder) || 0),
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setFlyerUrl("");
    setSortOrder(items.length);
    setMessage("Collaborazione attiva aggiunta.");
    await load();
  }

  async function remove(item: ActiveCollaboration) {
    if (!supabase || !confirm("Eliminare questa collaborazione attiva?")) return;
    const { error } = await supabase.from("active_collaborations").delete().eq("id", item.id);
    if (error) setMessage(error.message);
    else {
      setMessage("Collaborazione eliminata.");
      await load();
    }
  }

  async function uploadFlyer(file: File) {
    try {
      const url = await uploadMedia(file, "collaborations");
      setFlyerUrl(url);
      setMessage("Volantino caricato. Salva per pubblicarlo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload non riuscito.");
    }
  }

  if (!supabaseConfigured) {
    return <PageShell><div className="page"><div className="empty-state"><h3>Supabase non configurato</h3></div></div></PageShell>;
  }

  if (!profile) {
    return <PageShell><div className="page"><div className="empty-state"><h3>Accesso non autorizzato</h3><p>Accedi dal pannello amministrativo.</p><a className="btn btn--primary" href="/admin">Vai al pannello</a></div></div></PageShell>;
  }

  const canWrite = profile.role === "super_admin" || profile.role === "admin";

  return (
    <PageShell>
      <div className="page admin-collabs-page">
        <div className="admin-resource__head">
          <div>
            <span className="eyebrow">Back Office / Collaborazioni</span>
            <h1>Collab attive</h1>
            <p>Gestisci i volantini mostrati nella home e nella pagina sponsor.</p>
          </div>
          <a className="btn btn--ghost" href="/admin">Torna al dashboard</a>
        </div>

        {canWrite ? (
          <form className="admin-form" onSubmit={save}>
            <div className="admin-form__grid">
              <label>
                Volantino
                <input value={flyerUrl} onChange={(e) => setFlyerUrl(e.target.value)} required placeholder="URL del volantino" />
                <input className="file-input" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadFlyer(file); }} />
              </label>
              <label>
                Ordine
                <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </label>
            </div>
            {message && <p className="admin-message">{message}</p>}
            <button className="btn btn--primary" type="submit">Aggiungi volantino</button>
          </form>
        ) : (
          <div className="empty-state"><h3>Accesso in sola lettura</h3><p>Solo Admin e Super Admin possono modificare le collaborazioni.</p></div>
        )}

        <div className="admin-table-wrap">
          {loading ? <p className="admin-message">Caricamento…</p> : !items.length ? <p className="admin-message">Nessuna collaborazione attiva.</p> : (
            <table className="admin-table">
              <thead><tr><th>Volantino</th><th>Ordine</th><th>Azioni</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><img className="admin-collab-thumb" src={item.flyer_url} alt="Volantino" /></td>
                    <td>{item.sort_order}</td>
                    <td className="admin-actions">{canWrite && <button className="btn btn--small btn--danger" type="button" onClick={() => void remove(item)}>Elimina</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageShell>
  );
}
