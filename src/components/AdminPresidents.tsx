import { useCallback, useEffect, useState } from "react";
import {
  createMissingPresidentAccounts, createPresidentAccount, listPresidentAccounts, resetPresidentPassword,
  setPresidentActive, type PresidentAccount, type PresidentCredential,
} from "../lib/president";

const LOGIN_URL = "https://streetleaguebari.it/presidente";
const describe = (error: unknown) => error instanceof Error ? error.message : "Operazione non riuscita.";
const when = (iso: string | null) => iso
  ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso))
  : "Mai";
const credentialsText = (rows: PresidentCredential[]) =>
  ["Street League · credenziali presidenti", "Accesso: " + LOGIN_URL, "",
    ...rows.map((row) => row.team_name + "\n  Username: " + row.username + "\n  Password: " + row.password + "\n")].join("\n");

/** Super admin only: one president account per team registered to an active competition. */
export function AdminPresidents() {
  const [rows, setRows] = useState<PresidentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<PresidentCredential[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows(await listPresidentAccounts()); }
    catch (cause) { setError(describe(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(key: string, action: () => Promise<{ credentials?: PresidentCredential[]; failures?: { team_name: string; error: string }[] } | unknown>, done: string) {
    setBusy(key); setError(""); setMessage("");
    try {
      const result = await action() as { credentials?: PresidentCredential[]; failures?: { team_name: string; error: string }[] };
      if (result?.credentials?.length) {
        setCredentials((old) => [...result.credentials!, ...old.filter((row) => !result.credentials!.some((next) => next.team_id === row.team_id))]);
      }
      const failed = result?.failures?.length ? " Non create: " + result.failures.map((row) => row.team_name + " (" + row.error + ")").join(", ") + "." : "";
      setMessage(done + failed);
      await load();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(""); }
  }

  const missing = rows.filter((row) => !row.president).length;
  const download = () => {
    const blob = new Blob([credentialsText(credentials)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "credenziali-presidenti.txt"; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="admin-presidents">
      <header className="admin-resource__head">
        <div><span className="eyebrow">Area presidenti</span><h2>Credenziali presidenti</h2></div>
        <button type="button" className="btn btn--primary" disabled={Boolean(busy) || loading || !missing}
          onClick={() => void run("all", createMissingPresidentAccounts, "Credenziali create.")}>
          {busy === "all" ? "Creazione…" : missing ? "Crea credenziali mancanti (" + missing + ")" : "Tutte le squadre hanno le credenziali"}
        </button>
      </header>
      <p className="admin-help-text">Un account per ogni squadra iscritta a una competizione attiva. Il presidente accede da <a href="/presidente" target="_blank" rel="noreferrer">/presidente</a> e può soltanto registrare le formazioni della propria squadra fino a 15 minuti prima del calcio d'inizio. Le password vengono mostrate una sola volta: salvale o consegnale subito.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-message" role="status">{message}</p>}

      {credentials.length > 0 && (
        <div className="admin-presidents__credentials" role="region" aria-label="Credenziali generate">
          <strong>Credenziali appena generate ({credentials.length})</strong>
          <p className="admin-help-text">Non verranno più mostrate dopo aver lasciato questa pagina. In caso di smarrimento genera una nuova password.</p>
          <ul>
            {credentials.map((row) => (
              <li key={row.team_id}><span>{row.team_name}</span><code>{row.username}</code><code>{row.password}</code></li>
            ))}
          </ul>
          <div className="admin-presidents__credential-actions">
            <button type="button" className="btn btn--primary" onClick={download}>Scarica .txt</button>
            <button type="button" className="btn btn--ghost" onClick={() => void navigator.clipboard?.writeText(credentialsText(credentials)).then(() => setMessage("Credenziali copiate."))}>Copia</button>
            <button type="button" className="btn btn--ghost" onClick={() => setCredentials([])}>Nascondi</button>
          </div>
        </div>
      )}

      {loading ? <p className="admin-help">Caricamento account…</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Squadra</th><th>Username</th><th>Stato</th><th>Ultimo accesso</th><th>Azioni</th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={5} className="admin-message">Nessuna squadra iscritta a competizioni attive.</td></tr>}
              {rows.map((row) => (
                <tr key={row.team_id}>
                  <td><strong>{row.team_name}</strong><br /><small>{row.competitions.join(", ")}</small></td>
                  <td>{row.president?.username ?? "—"}</td>
                  <td>{!row.president ? "Da creare" : row.president.is_active ? "Attivo" : "Disattivato"}</td>
                  <td>{row.president ? when(row.president.last_sign_in_at) : "—"}</td>
                  <td>
                    <div className="admin-actions">
                      {!row.president ? (
                        <button type="button" className="btn btn--primary btn--small" disabled={Boolean(busy)}
                          onClick={() => void run(row.team_id, () => createPresidentAccount(row.team_id), "Credenziali di " + row.team_name + " create.")}>Crea</button>
                      ) : (
                        <>
                          <button type="button" className="btn btn--ghost btn--small" disabled={Boolean(busy)}
                            onClick={() => { if (window.confirm("Generare una nuova password per " + row.team_name + "? Quella attuale smetterà di funzionare e le sessioni aperte verranno chiuse.")) void run(row.team_id, () => resetPresidentPassword(row.team_id), "Nuova password per " + row.team_name + " generata."); }}>Nuova password</button>
                          <button type="button" className={"btn btn--small " + (row.president.is_active ? "btn--danger" : "btn--ghost")} disabled={Boolean(busy)}
                            onClick={() => { const active = !row.president!.is_active; if (active || window.confirm("Disattivare l'account presidente di " + row.team_name + "? Non potrà più accedere né inviare formazioni.")) void run(row.team_id, () => setPresidentActive(row.team_id, active), active ? "Account riattivato." : "Account disattivato."); }}>
                            {row.president.is_active ? "Disattiva" : "Riattiva"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
