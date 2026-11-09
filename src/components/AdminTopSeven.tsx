import { useEffect, useState } from "react";
import { getLatestTopSeven, getPlayers, getTeams } from "../lib/api";
import { ensureFreshAdminSession } from "../lib/admin";
import { formatKeeperAverage } from "../lib/awards";
import { computeTopSeven, formatTopSevenMonth, monthKey, saveTopSeven, TOP_SEVEN_LABELS } from "../lib/topSeven";
import type { MonthlyTopSeven, Player, Team, TopSevenSlot } from "../types";

const SLOT_ORDER: TopSevenSlot[] = ["goalkeeper", "defender", "midfielder", "attacker"];

/**
 * Card in "POTM & Staff del mese": compiles the Top 7 of a month with the data recorded
 * at that moment and publishes it. The site keeps showing it until the next compilation.
 */
export function AdminTopSeven({ canWrite }: { canWrite: boolean }) {
  const [month, setMonth] = useState(() => monthKey(new Date()).slice(0, 7));
  const [published, setPublished] = useState<MonthlyTopSeven | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([getLatestTopSeven(), getPlayers(), getTeams()])
      .then(([latest, allPlayers, allTeams]) => {
        if (!mounted) return;
        setPublished(latest); setPlayers(allPlayers); setTeams(allTeams);
      })
      .catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : "Caricamento non riuscito."); });
    return () => { mounted = false; };
  }, []);

  const playerName = (id: string) => {
    const player = players.find((entry) => entry.id === id);
    return player ? `${player.first_name} ${player.last_name}` : "Giocatore non disponibile";
  };
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? "—";

  async function compile() {
    const [year, monthNumber] = month.split("-").map(Number);
    if (!year || !monthNumber) { setError("Seleziona un mese valido."); return; }
    const periodMonth = monthKey(new Date(year, monthNumber - 1, 1));
    const label = formatTopSevenMonth(periodMonth);
    if (!window.confirm(`Compilare la Top 7 di ${label} con i dati registrati in questo momento? Sostituirà quella pubblicata sul sito.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const selection = await computeTopSeven(new Date(year, monthNumber - 1, 1));
      if (!selection.length) throw new Error(`Nessuna partita giocata a ${label}: la Top 7 non può essere compilata.`);
      setPublished(await saveTopSeven(periodMonth, selection));
      setMessage(`Top 7 di ${label} pubblicata${selection.length < 7 ? ` (${selection.length} posti su 7: mancano giocatori per alcuni ruoli)` : ""}.`);
    } catch (cause) {
      const text = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "Compilazione non riuscita.";
      setError(/monthly_top_seven|schema cache/.test(text)
        ? "Esegui prima la migrazione SQL supabase/28_monthly_top_seven.sql in Supabase."
        : text);
    } finally {
      setBusy(false);
    }
  }

  const entries = [...(published?.players ?? [])].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  return (
    <section className="sl-admin__card admin-top-seven">
      <h2>Top 7 del mese</h2>
      <p className="admin-help-text">
        La Top 7 non si aggiorna da sola: premi il pulsante per selezionare in questo momento i migliori giocatori del mese
        (uno per squadra) e pubblicarli. Resteranno sul sito fino alla prossima compilazione.
      </p>
      {canWrite ? (
        <div className="admin-media__actions admin-top-seven__actions">
          <label className="admin-top-seven__month">
            <span>Mese</span>
            <input type="month" value={month} max={monthKey(new Date()).slice(0, 7)} disabled={busy} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button className="btn btn--primary" type="button" disabled={busy || !month} onClick={() => void compile()}>
            {busy ? "Compilazione…" : "Compila Top 7"}
          </button>
        </div>
      ) : (
        <p className="admin-help-text">Solo gli amministratori possono compilare la Top 7.</p>
      )}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-message" role="status">{message}</p>}
      {published ? (
        <>
          <p className="admin-help-text" role="status">
            Pubblicata: <strong>{formatTopSevenMonth(published.period_month)}</strong> · compilata il{" "}
            {new Date(published.compiled_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Ruolo</th><th>Giocatore</th><th>Squadra</th><th>Dati</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.slot + entry.player_id}>
                    <td>{TOP_SEVEN_LABELS[entry.slot]}</td>
                    <td>{playerName(entry.player_id)}</td>
                    <td>{teamName(entry.team_id)}</td>
                    <td>
                      {entry.slot === "goalkeeper"
                        ? (entry.keeper_average != null ? `Media voto ${formatKeeperAverage(entry.keeper_average)} (${entry.keeper_votes ?? 0})` : "Nessun voto")
                        : `${entry.goals} gol · ${entry.assists} assist`}
                      {` · ${entry.appearances} pres.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        !error && <p className="admin-help-text" role="status">Nessuna Top 7 pubblicata: sul sito i posti risultano "In attesa".</p>
      )}
    </section>
  );
}
