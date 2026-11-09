import { useState } from "react";
import { ensureFreshAdminSession, listUnusedMedia, purgeUnusedMedia, type UnusedMedia } from "../lib/admin";

const MEDIA_BASE = (import.meta.env.VITE_SUPABASE_URL ?? "") + "/storage/v1/object/public/street-league-media/";
const formatSize = (bytes: number) =>
  bytes >= 1048576 ? (bytes / 1048576).toLocaleString("it-IT", { maximumFractionDigits: 1 }) + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB";
const folderOf = (name: string) => name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "—";

/**
 * Lists the files of the media bucket that no record uses any more (replaced photos,
 * logos of deleted teams, uploads never saved) and deletes them on request.
 * Each file is checked again on the database right before deletion.
 */
export function AdminMediaCleanup({ canDelete }: { canDelete: boolean }) {
  const [files, setFiles] = useState<UnusedMedia[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function scan() {
    setBusy(true); setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      setFiles(await listUnusedMedia());
    } catch (cause) {
      const text = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "Ricerca non riuscita.";
      setError(/list_unused_media|schema cache/.test(text)
        ? "Esegui prima la migrazione SQL supabase/27_media_cleanup.sql in Supabase."
        : text);
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!files?.length) return;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (!window.confirm(`Eliminare definitivamente ${files.length} file non utilizzati (${formatSize(total)})? L'operazione non si può annullare.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const removed = await purgeUnusedMedia(files.map((file) => file.name));
      setMessage(`${removed} file eliminati.`);
      setFiles(await listUnusedMedia());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Eliminazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  const total = (files ?? []).reduce((sum, file) => sum + file.size, 0);
  const byFolder = new Map<string, { count: number; size: number }>();
  (files ?? []).forEach((file) => {
    const entry = byFolder.get(folderOf(file.name)) ?? { count: 0, size: 0 };
    byFolder.set(folderOf(file.name), { count: entry.count + 1, size: entry.size + file.size });
  });

  return (
    <section className="admin-media">
      <section className="sl-admin__card">
        <h2>Media non utilizzati</h2>
        <p className="admin-help-text">
          Quando sostituisci la foto di un giocatore, il logo di una squadra o l'immagine di uno sponsor, il file precedente
          viene eliminato in automatico se nessun altro record lo usa. Qui trovi i file rimasti senza utilizzo
          (caricamenti mai salvati, record eliminati) caricati da più di un giorno.
        </p>
        <div className="admin-media__actions">
          <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void scan()}>
            {busy && !files ? "Ricerca…" : files ? "Aggiorna ricerca" : "Cerca media inutilizzati"}
          </button>
          {canDelete && files && files.length > 0 && (
            <button className="btn btn--danger" type="button" disabled={busy} onClick={() => void purge()}>
              Elimina {files.length} file ({formatSize(total)})
            </button>
          )}
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {message && <p className="admin-message" role="status">{message}</p>}
        {files && !files.length && <p className="admin-help-text" role="status">Nessun file inutilizzato: lo spazio è già ottimizzato.</p>}
        {files && files.length > 0 && (
          <p className="admin-help-text" role="status">
            {files.length} file inutilizzati · {formatSize(total)} ·{" "}
            {[...byFolder.entries()].map(([folder, entry]) => `${folder} ${entry.count}`).join(" · ")}
          </p>
        )}
      </section>
      {files && files.length > 0 && (
        <section className="sl-admin__card sl-admin__card--table">
          {/* Plain list, no thumbnails: previews would themselves consume storage egress. */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Cartella</th><th>File</th><th>Peso</th><th>Caricato</th></tr></thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name}>
                    <td>{folderOf(file.name)}</td>
                    <td><a href={MEDIA_BASE + file.name} target="_blank" rel="noreferrer">{file.name.slice(file.name.lastIndexOf("/") + 1)}</a></td>
                    <td>{formatSize(file.size)}</td>
                    <td>{new Date(file.created_at).toLocaleDateString("it-IT")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
