import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { PageShell } from "../components/PageShell";
import { getActiveCompetitions, getMatchLineups, getMatchWildcards, getPlayers, getTeamMatches, getTeams } from "../lib/api";
import { isGoalkeeperPosition, isStaffPosition } from "../lib/awards";
import {
  changePresidentPassword, getMySubmissions, getPresidentTeamId, savePresidentLineup, signInPresident,
} from "../lib/president";
import { supabase, supabaseConfigured } from "../lib/supabase";
import type { Competition, Match, MatchLineupSubmission, Player, Team } from "../types";

type Draft = Record<string, { selected: boolean; starter: boolean }>;
type KeeperMode = "" | "internal" | "external";
type WildcardMode = "" | "yes" | "no";

const ROME = "Europe/Rome";
const nameOf = (player: Player) => player.first_name + " " + player.last_name;
const isStaff = (player: Player) => isStaffPosition(player.position, player.role);
const isKeeper = (player: Player) => !isStaff(player) && isGoalkeeperPosition(player.position);
const byShirt = (a: Player, b: Player) =>
  (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || nameOf(a).localeCompare(nameOf(b), "it");
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const cleanName = (value: string) => value.trim().replace(/\s+/g, " ");
const describe = (error: unknown) =>
  error instanceof Error ? error.message
    : error && typeof error === "object" && "message" in error ? String(error.message) : "Operazione non riuscita.";

const kickoffLabel = (iso: string) => new Intl.DateTimeFormat("it-IT", {
  weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: ROME,
}).format(new Date(iso));
const shortDateTime = (iso: string) => new Intl.DateTimeFormat("it-IT", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: ROME,
}).format(new Date(iso));
function timeLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Chiusa";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return "Chiude tra " + days + (days === 1 ? " giorno" : " giorni") + (hours ? " e " + hours + " h" : "");
  if (hours > 0) return "Chiude tra " + hours + " h " + (minutes % 60) + " min";
  return "Chiude tra " + Math.max(1, minutes) + " min";
}

function PresidentLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await signInPresident(username, password);
      onLogin();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  };
  return (
    <div className="admin-login sl-admin-login">
      <img className="sl-admin-login__logo" src="/assets/pittogrammaBlack.webp" alt="Street League" />
      <span className="eyebrow">Area presidenti</span>
      <h1>Distinte</h1>
      <p>Accedi con le credenziali della tua squadra per registrare le formazioni delle prossime partite.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <form onSubmit={submit}>
        <label className="sl-admin-login__field"><span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        <label className="sl-admin-login__field"><span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required />
        </label>
        <button className="btn btn--primary" disabled={busy}>{busy ? "Accesso…" : "Accedi"}</button>
      </form>
    </div>
  );
}

function PasswordForm({ onDone }: { onDone: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError("Le due password non coincidono."); return; }
    setBusy(true); setError("");
    try {
      await changePresidentPassword(password);
      setPassword(""); setConfirm("");
      onDone("Password aggiornata.");
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  };
  return (
    <form className="president-area__password" onSubmit={submit}>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <label>Nuova password
        <input type="password" value={password} minLength={10} autoComplete="new-password" required onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label>Ripeti la password
        <input type="password" value={confirm} minLength={10} autoComplete="new-password" required onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <button className="btn btn--primary" disabled={busy}>{busy ? "Salvataggio…" : "Aggiorna password"}</button>
    </form>
  );
}

function LineupEditor({ match, team, opponent, roster, competition, submission, now, onSaved }: {
  match: Match; team: Team; opponent?: Team; roster: Player[]; competition?: Competition;
  submission?: MatchLineupSubmission; now: number; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>({});
  const [keeperMode, setKeeperMode] = useState<KeeperMode>("");
  const [keeperId, setKeeperId] = useState("");
  const [wildcardMode, setWildcardMode] = useState<WildcardMode>("");
  const [wildcardFirst, setWildcardFirst] = useState("");
  const [wildcardLast, setWildcardLast] = useState("");
  const [wildcardStarter, setWildcardStarter] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const keepers = useMemo(() => roster.filter(isKeeper).sort(byShirt), [roster]);
  const fieldPlayers = useMemo(() => roster.filter((player) => !isStaff(player) && !isKeeper(player)).sort(byShirt), [roster]);
  const staff = useMemo(() => roster.filter(isStaff).sort(byShirt), [roster]);
  const locked = now >= new Date(match.kickoff_at).getTime() || match.status !== "scheduled";
  const hasSubmission = Boolean(submission);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [lineups, wildcards] = await Promise.all([getMatchLineups(match.id), getMatchWildcards(match.id)]);
      const mine = lineups.filter((row) => row.team_id === team.id);
      const savedKeeper = mine
        .map((row) => ({ row, player: roster.find((player) => player.id === row.player_id) }))
        .filter((entry) => entry.player && isKeeper(entry.player))
        .sort((a, b) => Number(b.row.starter) - Number(a.row.starter))[0];
      setDraft(Object.fromEntries(mine
        .filter((row) => row.player_id !== savedKeeper?.row.player_id)
        .map((row) => [row.player_id, { selected: true, starter: row.starter }])));
      setKeeperId(savedKeeper?.row.player_id ?? keepers[0]?.id ?? "");
      setKeeperMode(savedKeeper ? "internal" : mine.length || hasSubmission ? "external" : "");
      const wildcard = wildcards.find((row) => row.team_id === team.id);
      const [first = "", ...rest] = (wildcard?.full_name ?? "").split(" ");
      setWildcardFirst(first); setWildcardLast(rest.join(" "));
      setWildcardStarter(wildcard?.starter !== false);
      setWildcardMode(wildcard ? "yes" : mine.length || hasSubmission ? "no" : "");
    } catch (cause) { setError(describe(cause)); }
    finally { setLoading(false); }
  }, [match.id, team.id, roster, keepers, hasSubmission]);

  useEffect(() => { void load(); }, [load]);

  const query = normalize(search).replace(/^#/, "");
  const visiblePlayers = fieldPlayers.filter((player) => !query ||
    normalize(nameOf(player)).includes(query) ||
    normalize(player.last_name + " " + player.first_name).includes(query) ||
    String(player.shirt_number ?? "") === query);
  const starters = fieldPlayers.filter((player) => draft[player.id]?.selected && draft[player.id]?.starter).length +
    (keeperMode === "internal" && keeperId ? 1 : 0) + (wildcardMode === "yes" && wildcardStarter ? 1 : 0);
  const bench = fieldPlayers.filter((player) => draft[player.id]?.selected && !draft[player.id]?.starter).length +
    (wildcardMode === "yes" && !wildcardStarter ? 1 : 0);
  const staffPresent = staff.filter((member) => draft[member.id]?.selected).length;

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(""); setError("");
    if (locked) { setError("Il calcio d'inizio è passato: la formazione non è più modificabile."); return; }
    if (!keeperMode) { setError("Indica se il portiere è interno (tesserato) o esterno."); return; }
    if (keeperMode === "internal" && !keepers.some((player) => player.id === keeperId)) {
      setError("Scegli il portiere tra quelli tesserati."); return;
    }
    if (!wildcardMode) { setError("Indica se schieri una Wildcard."); return; }
    const first = cleanName(wildcardFirst);
    const last = cleanName(wildcardLast);
    if (wildcardMode === "yes" && (first.length < 2 || last.length < 2)) {
      setError("Inserisci nome e cognome della Wildcard."); return;
    }
    const players = [...fieldPlayers, ...staff]
      .filter((player) => draft[player.id]?.selected)
      .map((player) => ({ player_id: player.id, starter: isStaff(player) ? false : draft[player.id]?.starter ?? true }));
    if (!players.some((entry) => fieldPlayers.some((player) => player.id === entry.player_id)) &&
      keeperMode !== "internal" && wildcardMode !== "yes") {
      setError("Seleziona almeno un giocatore."); return;
    }
    setBusy(true);
    try {
      await savePresidentLineup({
        matchId: match.id,
        players,
        keeperId: keeperMode === "internal" ? keeperId : null,
        wildcardName: wildcardMode === "yes" ? (first + " " + last).slice(0, 80) : "",
        wildcardStarter,
      });
      setMessage("Formazione inviata. Puoi modificarla fino al calcio d'inizio.");
      onSaved();
    } catch (cause) { setError(describe(cause)); }
    finally { setBusy(false); }
  }

  const toggle = (player: Player, selected: boolean) =>
    setDraft((old) => ({ ...old, [player.id]: { selected, starter: old[player.id]?.starter ?? true } }));

  return (
    <form className="match-report-admin president-area__editor" onSubmit={(e) => void save(e)}>
      <div className="match-report-admin__section-head">
        <h3>{team.name} – {opponent?.name ?? "Avversario"}</h3>
        <p>{competition?.name ?? "Competizione"}{match.matchday ? " · " + (/^\d+$/.test(match.matchday.trim()) ? "Giornata " + match.matchday.trim() : match.matchday) : ""} · {kickoffLabel(match.kickoff_at)}{match.venue ? " · " + match.venue : ""}</p>
      </div>
      {locked
        ? <p className="admin-error" role="status">Il calcio d'inizio è passato: la formazione è chiusa e non è più modificabile.</p>
        : <p className="admin-help-text">Puoi inviare e modificare la formazione fino al calcio d'inizio ({shortDateTime(match.kickoff_at)}). {timeLeft(match.kickoff_at, now)}.</p>}
      {submission && <p className="admin-help-text">Ultimo invio: {shortDateTime(submission.submitted_at)}.</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-message" role="status">{message}</p>}
      {loading ? <p className="admin-help">Caricamento formazione…</p> : (
        <fieldset className="president-area__fields" disabled={locked || busy}>
          <section className="match-report-admin__team">
            <div className="match-report-admin__team-title"><h4>Portiere</h4></div>
            <div className="president-area__choice" role="radiogroup" aria-label="Portiere">
              <label><input type="radio" name="keeper" checked={keeperMode === "internal"} disabled={!keepers.length}
                onChange={() => { setKeeperMode("internal"); if (!keeperId) setKeeperId(keepers[0]?.id ?? ""); }} /> Interno (tesserato)</label>
              <label><input type="radio" name="keeper" checked={keeperMode === "external"}
                onChange={() => setKeeperMode("external")} /> Esterno</label>
            </div>
            {keeperMode === "internal" && (
              <select aria-label="Portiere tesserato" value={keeperId} onChange={(e) => setKeeperId(e.target.value)}>
                {keepers.map((player) => <option key={player.id} value={player.id}>#{player.shirt_number ?? "—"} {nameOf(player)}</option>)}
              </select>
            )}
            <p className="admin-help-text">{keepers.length
              ? "Il portiere interno gioca titolare. Se il portiere non è tesserato scegli “Esterno”: il campo resta vuoto."
              : "Nessun portiere tesserato in rosa: il portiere sarà esterno."}</p>
          </section>

          <section className="match-report-admin__team">
            <div className="match-report-admin__team-title">
              <h4>Giocatori</h4>
              <span>{starters} titolari · {bench} in panchina</span>
            </div>
            {fieldPlayers.length > 6 && (
              <div className="match-report-admin__search">
                <input type="search" value={search} autoComplete="off" aria-label="Cerca nella rosa"
                  placeholder="Cerca per nome, cognome o numero…" onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }} />
                {query && <small>{visiblePlayers.length} di {fieldPlayers.length}</small>}
              </div>
            )}
            <div className="match-report-admin__roster">
              {!fieldPlayers.length && <p className="admin-help-text">Nessun giocatore registrato per la squadra.</p>}
              {fieldPlayers.length > 0 && !visiblePlayers.length && <p className="admin-help-text">Nessun giocatore trovato per “{search.trim()}”.</p>}
              {visiblePlayers.map((player) => (
                <div className="match-report-admin__roster-row" key={player.id}>
                  <label>
                    <input type="checkbox" checked={draft[player.id]?.selected ?? false} onChange={(e) => toggle(player, e.target.checked)} />
                    <span>#{player.shirt_number ?? "—"} {nameOf(player)}</span>
                  </label>
                  <select aria-label={"Ruolo in formazione di " + nameOf(player)} disabled={!draft[player.id]?.selected}
                    value={draft[player.id]?.starter === false ? "bench" : "starter"}
                    onChange={(e) => setDraft((old) => ({ ...old, [player.id]: { selected: true, starter: e.target.value === "starter" } }))}>
                    <option value="starter">Titolare</option>
                    <option value="bench">Panchina</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="match-report-admin__team">
            <div className="match-report-admin__team-title">
              <h4>Staff</h4>
              <span>{staffPresent} presenti</span>
            </div>
            <div className="match-report-admin__roster">
              {!staff.length && <p className="admin-help-text">Nessun membro dello staff registrato.</p>}
              {staff.map((member) => (
                <div className="match-report-admin__roster-row is-staff" key={member.id}>
                  <label>
                    <input type="checkbox" checked={draft[member.id]?.selected ?? false} onChange={(e) => toggle(member, e.target.checked)} />
                    <span>{nameOf(member)}</span>
                  </label>
                  <span className="match-report-admin__staff-tag">{draft[member.id]?.selected ? "Presente" : "Assente"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="match-report-admin__team">
            <div className="match-report-admin__team-title"><h4>Wildcard</h4></div>
            <div className="president-area__choice" role="radiogroup" aria-label="Wildcard">
              <label><input type="radio" name="wildcard" checked={wildcardMode === "yes"} onChange={() => setWildcardMode("yes")} /> Sì, schiero una Wildcard</label>
              <label><input type="radio" name="wildcard" checked={wildcardMode === "no"} onChange={() => setWildcardMode("no")} /> Nessuna Wildcard</label>
            </div>
            {wildcardMode === "yes" && (
              <div className="president-area__wildcard">
                <label>Nome
                  <input value={wildcardFirst} maxLength={40} autoComplete="off" required onChange={(e) => setWildcardFirst(e.target.value)} />
                </label>
                <label>Cognome
                  <input value={wildcardLast} maxLength={40} autoComplete="off" required onChange={(e) => setWildcardLast(e.target.value)} />
                </label>
                <label>In formazione
                  <select value={wildcardStarter ? "starter" : "reserve"} onChange={(e) => setWildcardStarter(e.target.value === "starter")}>
                    <option value="starter">Titolare</option>
                    <option value="reserve">Riserva</option>
                  </select>
                </label>
              </div>
            )}
          </section>

          <div className="president-area__actions">
            <button type="submit" className="btn btn--primary" disabled={locked || busy}>
              {busy ? "Invio in corso…" : submission ? "Aggiorna formazione" : "Invia formazione"}
            </button>
          </div>
        </fieldset>
      )}
    </form>
  );
}

export default function PresidentArea() {
  const [booting, setBooting] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [submissions, setSubmissions] = useState<MatchLineupSubmission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const resolveSession = useCallback(async () => {
    setError("");
    try {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      setSignedIn(Boolean(session));
      setTeamId(session ? await getPresidentTeamId() : null);
    } catch (cause) { setError(describe(cause)); setTeamId(null); }
    finally { setBooting(false); }
  }, []);

  useEffect(() => {
    void resolveSession();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setSignedIn(false); setTeamId(null); }
    });
    return () => subscription.unsubscribe();
  }, [resolveSession]);

  const loadData = useCallback(async (id: string) => {
    setError("");
    try {
      const [allTeams, players, teamMatches, active, mine] = await Promise.all([
        // Submission dates are only informative: the page still works without them.
        getTeams(), getPlayers(id), getTeamMatches(id), getActiveCompetitions(), getMySubmissions(id).catch(() => []),
      ]);
      setTeams(allTeams);
      setTeam(allTeams.find((entry) => entry.id === id) ?? null);
      setRoster(players.filter((player) => player.team_id === id));
      setMatches(teamMatches);
      setCompetitions(active);
      setSubmissions(mine);
    } catch (cause) { setError(describe(cause)); }
  }, []);

  useEffect(() => { if (teamId) void loadData(teamId); }, [teamId, loadData]);

  const upcoming = useMemo(() => {
    const activeIds = new Set(competitions.map((entry) => entry.id));
    return matches
      .filter((match) => activeIds.has(match.competition_id) && match.status === "scheduled" &&
        new Date(match.kickoff_at).getTime() > now - 6 * 3600_000)
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime());
  }, [matches, competitions, now]);
  const selected = upcoming.find((match) => match.id === selectedId) ??
    upcoming.find((match) => new Date(match.kickoff_at).getTime() > now) ?? upcoming[0];

  const logout = async () => {
    await supabase?.auth.signOut();
    setSignedIn(false); setTeamId(null); setTeam(null); setNotice("");
  };

  if (!supabaseConfigured || booting) {
    return <PageShell title="Area presidenti"><div className="admin-help sl-admin-login"><p>Caricamento…</p></div></PageShell>;
  }
  if (!signedIn) {
    return <PageShell title="Area presidenti"><PresidentLogin onLogin={() => void resolveSession()} /></PageShell>;
  }
  if (!teamId) {
    return (
      <PageShell title="Area presidenti">
        <div className="admin-login sl-admin-login">
          <span className="eyebrow">Area presidenti</span>
          <h1>Accesso negato</h1>
          <p>{error || "Questo account non è collegato a nessuna squadra oppure è stato disattivato. Esci e accedi con le credenziali del presidente."}</p>
          <button type="button" className="btn btn--primary" onClick={() => void logout()}>Esci</button>
        </div>
      </PageShell>
    );
  }

  const teamName = (id: string) => teams.find((entry) => entry.id === id)?.name ?? "Squadra";
  return (
    <PageShell title="Area presidenti">
      <div className="sl-admin sl-admin--president">
        <section className="sl-admin__main">
          <header className="sl-admin__topbar president-area__top">
            <div className="president-area__team">
              {team?.logo_url && <img src={team.logo_url} alt="" />}
              <div>
                <p className="sl-admin__crumb">Area presidenti</p>
                <h1>{team?.name ?? "La tua squadra"}</h1>
              </div>
            </div>
            <div className="president-area__account">
              <button type="button" className="btn btn--ghost" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Chiudi" : "Cambia password"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void logout()}>Esci</button>
            </div>
            <p className="sl-admin__lead">Registra le formazioni delle partite in programma. Ogni formazione si può inviare e modificare fino all'orario esatto del calcio d'inizio.</p>
          </header>
          {notice && <p className="admin-message" role="status">{notice}</p>}
          {error && <p className="admin-error" role="alert">{error}</p>}
          {showPassword && <PasswordForm onDone={(text) => { setNotice(text); setShowPassword(false); }} />}

          {!upcoming.length ? (
            <p className="admin-help">Nessuna partita in programma per la tua squadra nelle competizioni attive.</p>
          ) : (
            <>
              <div className="president-area__matches" role="list" aria-label="Partite in programma">
                {upcoming.map((match) => {
                  const opponent = match.home_team_id === teamId ? match.away_team_id : match.home_team_id;
                  const sent = submissions.find((row) => row.match_id === match.id);
                  const closed = new Date(match.kickoff_at).getTime() <= now;
                  return (
                    <button type="button" role="listitem" key={match.id}
                      className={"president-area__match" + (selected?.id === match.id ? " is-active" : "")}
                      aria-pressed={selected?.id === match.id} onClick={() => setSelectedId(match.id)}>
                      <strong>vs {teamName(opponent)}</strong>
                      <span>{shortDateTime(match.kickoff_at)} · {competitions.find((entry) => entry.id === match.competition_id)?.name ?? ""}</span>
                      <em className={sent ? "is-sent" : closed ? "is-closed" : ""}>
                        {sent ? "Inviata" : closed ? "Non inviata" : "Da inviare"} · {timeLeft(match.kickoff_at, now)}
                      </em>
                    </button>
                  );
                })}
              </div>
              {selected && team && (
                <LineupEditor key={selected.id} match={selected} team={team} roster={roster} now={now}
                  opponent={teams.find((entry) => entry.id === (selected.home_team_id === teamId ? selected.away_team_id : selected.home_team_id))}
                  competition={competitions.find((entry) => entry.id === selected.competition_id)}
                  submission={submissions.find((row) => row.match_id === selected.id)}
                  onSaved={() => { if (teamId) void getMySubmissions(teamId).then(setSubmissions).catch(() => undefined); }} />
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
