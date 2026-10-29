import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getActiveCompetitions, getMatches, getPlayers, getTeams } from "../lib/api";
import { ensureFreshAdminSession } from "../lib/admin";
import { isStaffPosition } from "../lib/awards";
import { supabase } from "../lib/supabase";
import type { Competition, Match, MatchEvent, MatchLineup, Player, Team } from "../types";

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
    const [l, e] = await Promise.all([
      supabase.from("match_lineups").select("*").eq("match_id", id),
      supabase.from("match_events").select("*").eq("match_id", id).order("minute"),
    ]);
    if (l.error) throw l.error;
    if (e.error) throw e.error;
    const updated = (l.data ?? []) as MatchLineup[];
    setLineups(updated);
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
    setLineups([]); setEvents([]); setDraft({});
    setEventId(""); setPlayerId(""); setKind("goal"); setMinute("1"); setNote("");
    if (!selectedMatchId) { setMatchLoading(false); return; }
    setMatchLoading(true);
    void Promise.all([
      supabase!.from("match_lineups").select("*").eq("match_id", selectedMatchId),
      supabase!.from("match_events").select("*").eq("match_id", selectedMatchId).order("minute"),
    ]).then(([l, e]) => {
      if (l.error) throw l.error;
      if (e.error) throw e.error;
      if (!active) return;
      const updated = (l.data ?? []) as MatchLineup[];
      setLineups(updated);
      setDraft(Object.fromEntries(updated.map((item) =>
        [item.player_id, { selected: true, starter: item.starter }])));
      setEvents((e.data ?? []) as MatchEvent[]);
    }).catch((cause) => { if (active) setError(describeError(cause)); })
      .finally(() => { if (active) setMatchLoading(false); });
    return () => { active = false; };
  }, [selectedMatchId]);

  const lineupTeamIds = new Set(lineups.map((entry) => entry.team_id));
  const bothLineups = Boolean(selectedMatch &&
    lineupTeamIds.has(selectedMatch.home_team_id) && lineupTeamIds.has(selectedMatch.away_team_id));
  const canRecordEvents = Boolean(selectedMatch?.status === "finished" && bothLineups);
  const matchPlayers = players.filter((player) =>
    selectedMatch && [selectedMatch.home_team_id, selectedMatch.away_team_id].includes(player.team_id));
  const eligibleEventPlayers = matchPlayers.filter((player) =>
    kind === "presidential_penalty"
      ? isStaffPosition(player.position, player.role)
      : lineups.some((entry) => entry.player_id === player.id) &&
        !isStaffPosition(player.position, player.role));
  const resolvedPlayerId = eligibleEventPlayers.some((player) => player.id === playerId)
    ? playerId : (eligibleEventPlayers[0]?.id ?? "");

  async function saveLineup(teamId: string) {
    if (!selectedMatch || !supabase) return;
    const roster = players.filter((player) => player.team_id === teamId &&
      !isStaffPosition(player.position, player.role));
    const chosen = roster.filter((player) => draft[player.id]?.selected);
    if (!chosen.length) { setError("Seleziona almeno un giocatore per confermare la formazione."); return; }
    setBusy(teamId); setMessage(""); setError("");
    try {
      await ensureFreshAdminSession();
      const keep = new Set(chosen.map((player) => player.id));
      const removed = lineups.filter((row) => row.team_id === teamId && !keep.has(row.player_id));
      if (removed.length) {
        const { error: deleteError } = await supabase.from("match_lineups").delete()
          .eq("match_id", selectedMatch.id).eq("team_id", teamId)
          .in("player_id", removed.map((row) => row.player_id));
        if (deleteError) throw deleteError;
      }
      const { error: saveError } = await supabase.from("match_lineups").upsert(
        chosen.map((player) => ({
          match_id: selectedMatch.id, team_id: teamId, player_id: player.id,
          starter: draft[player.id]?.starter ?? true, shirt_number: player.shirt_number,
        })), { onConflict: "match_id,player_id" });
      if (saveError) throw saveError;
      await refreshMatch(selectedMatch.id, teamId);
      setMessage("Formazione " + (teams.find((team) => team.id === teamId)?.name ?? "") + " salvata.");
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
    if (!Number.isInteger(numericMinute) || numericMinute < 1 || numericMinute > 60) {
      setError("Il minuto deve essere un intero compreso tra 1 e 60."); return;
    }
    if (!resolvedPlayerId) { setError("Seleziona un giocatore valido per l'evento."); return; }
    setBusy("event"); setMessage(""); setError("");
    try {
      await ensureFreshAdminSession();
      const payload = {
        match_id: selectedMatch.id, player_id: resolvedPlayerId,
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
      <p className="admin-help-text">Prepara le formazioni delle due squadre. Dopo la partita, inserisci dal referto arbitrale gol, rigori presidenziali e cartellini (minuti 1–60).</p>
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
            <p>Seleziona gli iscritti in campo o in panchina per ciascuna squadra; salva ciascuna formazione separatamente.</p>
          </div>
          <div className="match-report-admin__teams">
            {[selectedMatch.home_team_id, selectedMatch.away_team_id].map((teamId) => {
              const team = teams.find((entry) => entry.id === teamId);
              const roster = players.filter((player) =>
                player.team_id === teamId && !isStaffPosition(player.position, player.role));
              return (
                <section className="match-report-admin__team" key={teamId}>
                  <div className="match-report-admin__team-title">
                    {team?.logo_url && <img src={team.logo_url} alt="" />}
                    <h4>{team?.name ?? "Squadra"}</h4>
                    <span>{lineups.filter((entry) => entry.team_id === teamId).length} registrati</span>
                  </div>
                  {matchLoading ? <p>Caricamento…</p> : roster.length ? (
                    <div className="match-report-admin__roster">
                      {roster.map((player) => (
                        <div className="match-report-admin__roster-row" key={player.id}>
                          <label>
                            <input type="checkbox" checked={draft[player.id]?.selected ?? false}
                              onChange={(e) => setDraft((old) => ({
                                ...old, [player.id]: { selected: e.target.checked, starter: old[player.id]?.starter ?? true },
                              }))} />
                            <span>#{player.shirt_number ?? "—"} {nameOf(player)}</span>
                          </label>
                          <select aria-label={"Ruolo in formazione di " + nameOf(player)}
                            disabled={!draft[player.id]?.selected}
                            value={draft[player.id]?.starter === false ? "bench" : "starter"}
                            onChange={(e) => setDraft((old) => ({
                              ...old, [player.id]: { selected: true, starter: e.target.value === "starter" },
                            }))}>
                            <option value="starter">Titolare</option>
                            <option value="bench">Panchina</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : <p className="admin-help-text">Nessun giocatore registrato per questa squadra.</p>}
                  <button type="button" className="btn btn--primary" disabled={Boolean(busy) || matchLoading || !roster.length}
                    onClick={() => void saveLineup(teamId)}>Salva formazione</button>
                </section>
              );
            })}
          </div>
          <section className="match-report-admin__events">
            <div className="match-report-admin__section-head">
              <h3>Riepilogo · referto arbitrale</h3>
              <p>{events.length} eventi registrati · minuto 1–60</p>
            </div>
            {!bothLineups && <p className="admin-help-text" role="status">Per inserire gli eventi, salva prima la formazione di entrambe le squadre.</p>}
            {selectedMatch.status !== "finished" && <p className="admin-help-text" role="status">Il referto è inseribile soltanto quando la partita è impostata come terminata nella sezione Partite.</p>}
            <form className="match-report-admin__event-form" onSubmit={(e) => void saveEvent(e)}>
              <label>Evento
                <select value={kind} disabled={!canRecordEvents} onChange={(e) => { setKind(e.target.value as EventKind); setPlayerId(""); }}>
                  {kinds.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>Minuto
                <input type="number" min={1} max={60} step={1} required value={minute}
                  disabled={!canRecordEvents} onChange={(e) => setMinute(e.target.value)} />
              </label>
              <label>Giocatore
                <select value={resolvedPlayerId} required disabled={!canRecordEvents || !eligibleEventPlayers.length}
                  onChange={(e) => setPlayerId(e.target.value)}>
                  {!eligibleEventPlayers.length && <option value="">Nessun giocatore idoneo</option>}
                  {eligibleEventPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {teams.find((team) => team.id === player.team_id)?.name} · {nameOf(player)}
                    </option>
                  ))}
                </select>
              </label>
              <label>Note (facoltative)
                <input value={note} disabled={!canRecordEvents} onChange={(e) => setNote(e.target.value)} placeholder="Es. calcio di rigore" />
              </label>
              <div className="match-report-admin__event-actions">
                <button className="btn btn--primary" type="submit"
                  disabled={!canRecordEvents || !eligibleEventPlayers.length || Boolean(busy)}>
                  {eventId ? "Aggiorna evento" : "Aggiungi evento"}
                </button>
                {eventId && <button type="button" className="btn btn--ghost" onClick={resetEvent}>Annulla modifica</button>}
              </div>
            </form>
            {matchLoading ? <p>Caricamento eventi…</p> : events.length ? (
              <div className="match-report-admin__event-list">
                {events.map((entry) => (
                  <div className="match-report-admin__event-item" key={entry.id}>
                    <strong>{entry.minute ?? "—"}'</strong>
                    <span>{kinds.find((option) => option.value === entry.event_type)?.label ?? entry.event_type}</span>
                    <span>{players.find((player) => player.id === entry.player_id) ? nameOf(players.find((player) => player.id === entry.player_id)!) : "—"}</span>
                    <button type="button" className="btn btn--ghost btn--small" disabled={Boolean(busy)} onClick={() => {
                      setEventId(entry.id); setKind(entry.event_type as EventKind);
                      setMinute(String(entry.minute ?? 1)); setPlayerId(entry.player_id ?? ""); setNote(entry.note ?? "");
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
