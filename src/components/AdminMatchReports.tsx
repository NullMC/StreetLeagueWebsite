import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getActiveCompetitions, getMatchWildcards, getMatches, getPlayers, getTeams } from "../lib/api";
import { ensureFreshAdminSession } from "../lib/admin";
import { isStaffPosition } from "../lib/awards";
import { supabase } from "../lib/supabase";
import { WILDCARD_POSITIONS } from "../types";
import type { Competition, Match, MatchEvent, MatchLineup, MatchWildcard, Player, Team, WildcardPosition } from "../types";
import { MATCH_DURATION_MINUTES, isValidMatchMinute } from "../lib/matchDuration";

type EventKind = "goal" | "presidential_penalty" | "yellow_card" | "red_card";
const kinds: { value: EventKind; label: string }[] = [
  { value: "goal", label: "Gol" },
  { value: "presidential_penalty", label: "Rigore presidenziale" },
  { value: "yellow_card", label: "Cartellino giallo" },
  { value: "red_card", label: "Cartellino rosso" },
];
const matchLabel = (match: Match, teams: Team[]) => {
  const name = (id: string) => teams.find((team) => team.id === id)?.name ?? "Squadra";
  return name(match.home_team_id) + " – " + name(match.away_team_id);
};
const nameOf = (player: Player) => player.first_name + " " + player.last_name;
const isStaff = (player: Player) => isStaffPosition(player.position, player.role);
/** Players first (by shirt number), then STAFF members. */
const byRosterOrder = (a: Player, b: Player) =>
  Number(isStaff(a)) - Number(isStaff(b)) ||
  (a.shirt_number ?? 999) - (b.shirt_number ?? 999) ||
  nameOf(a).localeCompare(nameOf(b), "it");
const WILDCARD_MAX = 80;
const WILDCARD_PREFIX = "wc:";
type WildcardDraft = { name: string; position: WildcardPosition };
const emptyWildcard: WildcardDraft = { name: "", position: "Centrocampista" };
const wildcardDraftOf = (row?: MatchWildcard): WildcardDraft =>
  row ? { name: row.full_name, position: row.position } : emptyWildcard;
const dayOf = (match: Match) => match.matchday?.trim() ?? "";
const dayLabel = (day: string) => /^\d+$/.test(day) ? "Giornata " + day : day;
const describeError = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : error instanceof Error ? error.message : "Operazione non riuscita.";

export function AdminMatchReports() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [matchday, setMatchday] = useState("");
  const [matchId, setMatchId] = useState("");
  const [lineups, setLineups] = useState<MatchLineup[]>([]);
  const [draft, setDraft] = useState<Record<string, { selected: boolean; starter: boolean }>>({});
  const [savedWildcards, setSavedWildcards] = useState<MatchWildcard[]>([]);
  const [wildcards, setWildcards] = useState<Record<string, WildcardDraft>>({});
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [kind, setKind] = useState<EventKind>("goal");
  const [minute, setMinute] = useState("1");
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([ensureFreshAdminSession(), getActiveCompetitions(), getTeams(), getPlayers(), getMatches()])
      .then(([, competitionsData, teamsData, playersData, matchesData]) => {
        if (!active) return;
        setCompetitions(competitionsData);
        setTeams(teamsData);
        setPlayers(playersData);
        setMatches(matchesData);
      }).catch((cause) => { if (active) setError(describeError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedCompetition = competitions.find((entry) => entry.id === competitionId) ?? competitions[0];
  const competitionMatches = useMemo(() =>
    matches.filter((match) => match.competition_id === selectedCompetition?.id)
      .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches, selectedCompetition?.id],
  );
  const matchdays = useMemo(() =>
    Array.from(new Set(competitionMatches.map(dayOf).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "it", { numeric: true })),
    [competitionMatches],
  );
  const availableMatches = competitionMatches.filter((match) => !matchday || dayOf(match) === matchday);
  const selectedMatch = availableMatches.find((match) => match.id === matchId) ?? availableMatches[0];
  const selectedMatchId = selectedMatch?.id ?? "";

  async function refreshMatch(id: string, savedTeamId?: string) {
    if (!supabase) return;
    const [l, e, w] = await Promise.all([
      supabase.from("match_lineups").select("*").eq("match_id", id),
      supabase.from("match_events").select("*").eq("match_id", id).order("minute"),
      getMatchWildcards(id),
    ]);
    if (l.error) throw l.error;
    if (e.error) throw e.error;
    const updated = (l.data ?? []) as MatchLineup[];
    setLineups(updated);
    setSavedWildcards(w);
    if (savedTeamId) {
      setWildcards((old) => ({ ...old, [savedTeamId]: wildcardDraftOf(w.find((row) => row.team_id === savedTeamId)) }));
    }
    setDraft((previous) => {
      const fresh: Record<string, { selected: boolean; starter: boolean }> = Object.fromEntries(
        updated.map((item) => [item.player_id, { selected: true, starter: item.starter }]),
      );
      // Saving one team must not discard pending selections in the opposite roster.
      if (savedTeamId) {
        players.filter((player) => player.team_id !== savedTeamId).forEach((player) => {
          if (previous[player.id]) fresh[player.id] = previous[player.id];
        });
      }
      return fresh;
    });
    setEvents((e.data ?? []) as MatchEvent[]);
  }

  useEffect(() => {
    let active = true;
    setLineups([]); setEvents([]); setDraft({}); setSavedWildcards([]); setWildcards({});
    setEventId(""); setPlayerId(""); setKind("goal"); setMinute("1"); setNote("");
    if (!selectedMatchId) { setMatchLoading(false); return; }
    setMatchLoading(true);
    void Promise.all([
      supabase!.from("match_lineups").select("*").eq("match_id", selectedMatchId),
      supabase!.from("match_events").select("*").eq("match_id", selectedMatchId).order("minute"),
      getMatchWildcards(selectedMatchId),
    ]).then(([l, e, w]) => {
      if (l.error) throw l.error;
      if (e.error) throw e.error;
      if (!active) return;
      const updated = (l.data ?? []) as MatchLineup[];
      setLineups(updated);
      setDraft(Object.fromEntries(updated.map((item) =>
        [item.player_id, { selected: true, starter: item.starter }])));
      setEvents((e.data ?? []) as MatchEvent[]);
      setSavedWildcards(w);
      setWildcards(Object.fromEntries(w.map((row) => [row.team_id, wildcardDraftOf(row)])));
    }).catch((cause) => { if (active) setError(describeError(cause)); })
      .finally(() => { if (active) setMatchLoading(false); });
    return () => { active = false; };
  }, [selectedMatchId]);

  const lineupTeamIds = new Set(lineups.map((entry) => entry.team_id));
  const bothLineups = Boolean(selectedMatch &&
    lineupTeamIds.has(selectedMatch.home_team_id) && lineupTeamIds.has(selectedMatch.away_team_id));
  // Reports can be edited at any time, whatever the match status.
  const canRecordEvents = bothLineups;
  const matchPlayers = players.filter((player) =>
    selectedMatch && [selectedMatch.home_team_id, selectedMatch.away_team_id].includes(player.team_id));
  // STAFF score only through the presidential goal; cards go to any lineup member, STAFF included.
  const eligibleEventPlayers = matchPlayers.filter((player) =>
    kind === "presidential_penalty"
      ? isStaff(player)
      : lineups.some((entry) => entry.player_id === player.id) &&
        (kind !== "goal" || !isStaff(player))).sort(byRosterOrder);
  // The Wildcard of each team can score and be booked, never take the presidential goal.
  const eligibleWildcards = kind === "presidential_penalty" ? [] : savedWildcards;
  const actorIds = [
    ...eligibleEventPlayers.map((player) => player.id),
    ...eligibleWildcards.map((wildcard) => WILDCARD_PREFIX + wildcard.id),
  ];
  const resolvedPlayerId = actorIds.includes(playerId) ? playerId : (actorIds[0] ?? "");
  const actorName = (entry: MatchEvent) => {
    if (entry.wildcard_id) {
      const wildcard = savedWildcards.find((row) => row.id === entry.wildcard_id);
      return (wildcard?.full_name ?? "Wildcard") + " (Wildcard)";
    }
    const player = players.find((row) => row.id === entry.player_id);
    return player ? nameOf(player) + (isStaff(player) ? " (Staff)" : "") : "—";
  };

  async function saveLineup(teamId: string) {
    if (!selectedMatch || !supabase) return;
    const roster = players.filter((player) => player.team_id === teamId);
    const chosen = roster.filter((player) => draft[player.id]?.selected);
    const saved = lineups.filter((row) => row.team_id === teamId);
    if (!chosen.length && saved.length &&
      !window.confirm("Nessun membro selezionato: la formazione salvata di questa squadra verrà rimossa. Continuare?")) return;
    const wildcard = wildcards[teamId] ?? emptyWildcard;
    const wildcardName = wildcard.name.trim().replace(/\s+/g, " ").slice(0, WILDCARD_MAX);
    const savedWildcard = savedWildcards.find((row) => row.team_id === teamId);
    if (wildcardName && wildcardName.length < 2) { setError("Inserisci nome e cognome della Wildcard."); return; }
    if (!wildcardName && savedWildcard && !window.confirm(
      "La Wildcard " + savedWildcard.full_name + " verrà rimossa dalla partita, insieme all'eventuale MVP, al voto da portiere e ai suoi eventi nel referto. Continuare?")) return;
    setBusy(teamId); setMessage(""); setError("");
    try {
      await ensureFreshAdminSession();
      if (!wildcardName && savedWildcard) {
        const { error: wildcardError } = await supabase.from("match_wildcards").delete().eq("id", savedWildcard.id);
        if (wildcardError) throw wildcardError;
      } else if (wildcardName && (wildcardName !== savedWildcard?.full_name || wildcard.position !== savedWildcard?.position)) {
        const { error: wildcardError } = await supabase.from("match_wildcards").upsert({
          match_id: selectedMatch.id, team_id: teamId, full_name: wildcardName, position: wildcard.position,
        }, { onConflict: "match_id,team_id" });
        if (wildcardError) throw wildcardError;
      }
      const keep = new Set(chosen.map((player) => player.id));
      const removed = saved.filter((row) => !keep.has(row.player_id));
      if (removed.length) {
        const { error: deleteError } = await supabase.from("match_lineups").delete()
          .eq("match_id", selectedMatch.id).eq("team_id", teamId)
          .in("player_id", removed.map((row) => row.player_id));
        if (deleteError) throw deleteError;
      }
      if (chosen.length) {
        const { error: saveError } = await supabase.from("match_lineups").upsert(
          chosen.map((player) => ({
            match_id: selectedMatch.id, team_id: teamId, player_id: player.id,
            // STAFF members are listed apart from starters and bench.
            starter: isStaff(player) ? false : draft[player.id]?.starter ?? true,
            shirt_number: player.shirt_number,
          })), { onConflict: "match_id,player_id" });
        if (saveError) throw saveError;
      }
      await refreshMatch(selectedMatch.id, teamId);
      const teamName = teams.find((team) => team.id === teamId)?.name ?? "";
      setMessage(chosen.length || !saved.length
        ? "Formazione " + teamName + " salvata."
        : "Formazione " + teamName + " rimossa.");
    } catch (cause) { setError(describeError(cause)); }
    finally { setBusy(""); }
  }

  function resetEvent() {
    setEventId(""); setKind("goal"); setMinute("1"); setPlayerId(""); setNote("");
  }
  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !selectedMatch || !canRecordEvents) return;
    const numericMinute = Number(minute);
    if (!isValidMatchMinute(numericMinute)) {
      setError(`Il minuto deve essere un intero compreso tra 1 e ${MATCH_DURATION_MINUTES}.`); return;
    }
    if (!resolvedPlayerId) { setError("Seleziona un giocatore valido per l'evento."); return; }
    setBusy("event"); setMessage(""); setError("");
    try {
      await ensureFreshAdminSession();
      const isWildcard = resolvedPlayerId.startsWith(WILDCARD_PREFIX);
      const editedEvent = events.find((entry) => entry.id === eventId);
      const payload = {
        match_id: selectedMatch.id,
        player_id: isWildcard ? null : resolvedPlayerId,
        // Send wildcard_id only when it is involved, so player events keep working on older schemas.
        ...(isWildcard ? { wildcard_id: resolvedPlayerId.slice(WILDCARD_PREFIX.length) }
          : editedEvent?.wildcard_id ? { wildcard_id: null } : {}),
        event_type: kind, minute: numericMinute, note: note.trim() || null,
        related_player_id: null,
      };
      const result = eventId
        ? await supabase.from("match_events").update(payload).eq("id", eventId)
        : await supabase.from("match_events").insert(payload);
      if (result.error) throw result.error;
      await refreshMatch(selectedMatch.id);
      resetEvent();
      setMessage(eventId ? "Evento aggiornato." : "Evento inserito nel referto.");
    } catch (cause) { setError(describeError(cause)); }
    finally { setBusy(""); }
  }
  async function deleteEvent(id: string) {
    if (!supabase || !selectedMatch || !window.confirm("Eliminare questo evento?")) return;
    setBusy("event"); setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: deleteError } = await supabase.from("match_events").delete()
        .eq("id", id).eq("match_id", selectedMatch.id);
      if (deleteError) throw deleteError;
      await refreshMatch(selectedMatch.id);
      if (eventId === id) resetEvent();
      setMessage("Evento eliminato.");
    } catch (cause) { setError(describeError(cause)); }
    finally { setBusy(""); }
  }

  if (loading) return <p className="admin-help">Caricamento competizioni e partite…</p>;
  return (
    <div className="match-report-admin">
      <header className="admin-resource__head">
        <div><span className="eyebrow">Gestione partite</span><h2>Formazioni e referti</h2></div>
      </header>
      <p className="admin-help-text">Prepara le formazioni delle due squadre, STAFF e Wildcard compresi, e inserisci dal referto arbitrale gol, rigori presidenziali e cartellini (minuti 1–{MATCH_DURATION_MINUTES}). Formazioni e referto sono modificabili in qualsiasi momento, anche a partita terminata.</p>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-message" role="status">{message}</p>}
      {!competitions.length && <p className="admin-help">Non ci sono competizioni attive.</p>}
      <div className="match-report-admin__filters">
        <label>Competizione attiva
          <select value={selectedCompetition?.id ?? ""} onChange={(e) => {
            setCompetitionId(e.target.value); setMatchday(""); setMatchId(""); setError(""); setMessage("");
          }}>
            {competitions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </label>
        <label>Giornata
          <select value={matchday} onChange={(e) => { setMatchday(e.target.value); setMatchId(""); }}>
            <option value="">Tutte le giornate</option>
            {matchdays.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
          </select>
        </label>
        <label>Partita
          <select value={selectedMatchId} disabled={!availableMatches.length} onChange={(e) => setMatchId(e.target.value)}>
            {availableMatches.map((match) => <option key={match.id} value={match.id}>{matchLabel(match, teams)} · {dayOf(match) || "Senza giornata"} · {match.status}</option>)}
          </select>
        </label>
      </div>
      {!selectedMatch ? <p className="admin-help">Nessuna partita trovata per questi filtri.</p> : (
        <>
          <div className="match-report-admin__section-head">
            <h3>Formazioni · {matchLabel(selectedMatch, teams)}</h3>
            <p>Seleziona i giocatori in campo o in panchina e lo STAFF presente; indica l'eventuale Wildcard. Salva ciascuna formazione separatamente.</p>
          </div>
          <div className="match-report-admin__teams">
            {[selectedMatch.home_team_id, selectedMatch.away_team_id].map((teamId) => {
              const team = teams.find((entry) => entry.id === teamId);
              const roster = players.filter((player) => player.team_id === teamId).sort(byRosterOrder);
              return (
                <section className="match-report-admin__team" key={teamId}>
                  <div className="match-report-admin__team-title">
                    {team?.logo_url && <img src={team.logo_url} alt="" />}
                    <h4>{team?.name ?? "Squadra"}</h4>
                    <span>{lineups.filter((entry) => entry.team_id === teamId).length} registrati</span>
                  </div>
                  <fieldset className="match-report-admin__wildcard" disabled={matchLoading}>
                    <legend>Wildcard <small>facoltativa · giocatore esterno per questa partita</small></legend>
                    <input aria-label={"Nome della Wildcard di " + (team?.name ?? "squadra")}
                      value={(wildcards[teamId] ?? emptyWildcard).name} maxLength={WILDCARD_MAX}
                      placeholder="Nome e cognome" autoComplete="off"
                      onChange={(e) => setWildcards((old) => ({ ...old, [teamId]: { ...(old[teamId] ?? emptyWildcard), name: e.target.value } }))} />
                    <select aria-label={"Ruolo della Wildcard di " + (team?.name ?? "squadra")}
                      value={(wildcards[teamId] ?? emptyWildcard).position}
                      onChange={(e) => setWildcards((old) => ({ ...old, [teamId]: { ...(old[teamId] ?? emptyWildcard), position: e.target.value as WildcardPosition } }))}>
                      {WILDCARD_POSITIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                    </select>
                  </fieldset>
                  {matchLoading ? <p>Caricamento…</p> : roster.length ? (
                    <div className="match-report-admin__roster">
                      {roster.map((player) => (
                        <div className={"match-report-admin__roster-row" + (isStaff(player) ? " is-staff" : "")} key={player.id}>
                          <label>
                            <input type="checkbox" checked={draft[player.id]?.selected ?? false}
                              onChange={(e) => setDraft((old) => ({
                                ...old, [player.id]: { selected: e.target.checked, starter: old[player.id]?.starter ?? true },
                              }))} />
                            <span>{isStaff(player) ? "" : "#" + (player.shirt_number ?? "—") + " "}{nameOf(player)}</span>
                          </label>
                          {isStaff(player) ? <span className="match-report-admin__staff-tag">Staff</span> : <select aria-label={"Ruolo in formazione di " + nameOf(player)}
                            disabled={!draft[player.id]?.selected}
                            value={draft[player.id]?.starter === false ? "bench" : "starter"}
                            onChange={(e) => setDraft((old) => ({
                              ...old, [player.id]: { selected: true, starter: e.target.value === "starter" },
                            }))}>
                            <option value="starter">Titolare</option>
                            <option value="bench">Panchina</option>
                          </select>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="admin-help-text">Nessun membro registrato per questa squadra.</p>}
                  <button type="button" className="btn btn--primary" disabled={Boolean(busy) || matchLoading}
                    onClick={() => void saveLineup(teamId)}>Salva formazione</button>
                </section>
              );
            })}
          </div>
          <section className="match-report-admin__events">
            <div className="match-report-admin__section-head">
              <h3>Riepilogo · referto arbitrale</h3>
              <p>{events.length} eventi registrati · minuto 1–{MATCH_DURATION_MINUTES}</p>
            </div>
            {!bothLineups && <p className="admin-help-text" role="status">Per inserire gli eventi, salva prima la formazione di entrambe le squadre.</p>}
            <form className="match-report-admin__event-form" onSubmit={(e) => void saveEvent(e)}>
              <label>Evento
                <select value={kind} disabled={!canRecordEvents} onChange={(e) => { setKind(e.target.value as EventKind); setPlayerId(""); }}>
                  {kinds.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>Minuto
                <input type="number" min={1} max={MATCH_DURATION_MINUTES} step={1} required value={minute}
                  disabled={!canRecordEvents} onChange={(e) => setMinute(e.target.value)} />
              </label>
              <label>{kind === "presidential_penalty" ? "Membro STAFF" : kind === "goal" ? "Giocatore o Wildcard" : "Giocatore, STAFF o Wildcard"}
                <select value={resolvedPlayerId} required disabled={!canRecordEvents || !actorIds.length}
                  onChange={(e) => setPlayerId(e.target.value)}>
                  {!actorIds.length && <option value="">Nessun membro idoneo</option>}
                  {eligibleEventPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {teams.find((team) => team.id === player.team_id)?.name} · {nameOf(player)}{isStaff(player) ? " (Staff)" : ""}
                    </option>
                  ))}
                  {eligibleWildcards.map((wildcard) => (
                    <option key={wildcard.id} value={WILDCARD_PREFIX + wildcard.id}>
                      {teams.find((team) => team.id === wildcard.team_id)?.name} · {wildcard.full_name} (Wildcard)
                    </option>
                  ))}
                </select>
              </label>
              <label>Note (facoltative)
                <input value={note} disabled={!canRecordEvents} onChange={(e) => setNote(e.target.value)} placeholder="Es. calcio di rigore" />
              </label>
              <div className="match-report-admin__event-actions">
                <button className="btn btn--primary" type="submit"
                  disabled={!canRecordEvents || !actorIds.length || Boolean(busy)}>
                  {eventId ? "Aggiorna evento" : "Aggiungi evento"}
                </button>
                {eventId && <button type="button" className="btn btn--ghost" onClick={resetEvent}>Annulla modifica</button>}
              </div>
            </form>
            {matchLoading ? <p>Caricamento eventi…</p> : events.length ? (
              <div className="match-report-admin__event-list">
                {events.some((entry) => !isValidMatchMinute(entry.minute)) ? (
                  <p className="admin-error" role="status">
                    Alcuni eventi salvati in precedenza hanno un minuto fuori dall'intervallo
                    1–{MATCH_DURATION_MINUTES}. Correggili dal referto: non vengono mostrati
                    nella timeline pubblica finché il minutaggio non è valido.
                  </p>
                ) : null}
                {[...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)).map((entry) => (
                  <div className={"match-report-admin__event-item" + (!isValidMatchMinute(entry.minute) ? " match-report-admin__event-item--invalid" : "")} key={entry.id}>
                    <strong>{entry.minute ?? "—"}'</strong>
                    <span>{kinds.find((option) => option.value === entry.event_type)?.label ?? entry.event_type}{!isValidMatchMinute(entry.minute) ? " · Minuto da correggere" : ""}</span>
                    <span>{actorName(entry)}</span>
                    <button type="button" className="btn btn--ghost btn--small" disabled={Boolean(busy)} onClick={() => {
                      setEventId(entry.id); setKind(entry.event_type as EventKind);
                      setMinute(String(entry.minute ?? 1)); setPlayerId(entry.wildcard_id ? WILDCARD_PREFIX + entry.wildcard_id : entry.player_id ?? ""); setNote(entry.note ?? "");
                    }}>Modifica</button>
                    <button type="button" className="btn btn--danger btn--small" disabled={Boolean(busy)}
                      onClick={() => void deleteEvent(entry.id)}>Elimina</button>
                  </div>
                ))}
              </div>
            ) : <p className="admin-help-text">Nessun evento nel referto della partita.</p>}
          </section>
        </>
      )}
    </div>
  );
}
