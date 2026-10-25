import { useEffect, useMemo, useState } from "react";
import { getActiveCompetitions, getMatches, getPlayers, getTeams } from "../lib/api";
import { ensureFreshAdminSession } from "../lib/admin";
import { isGoalkeeperPosition, isStaffPosition } from "../lib/awards";
import { supabase } from "../lib/supabase";
import type { Competition, GoalkeeperMatchRating, Match, MatchMvp, Player, Team } from "../types";

type AwardData = {
  competitions: Competition[];
  teams: Team[];
  players: Player[];
};

const playerName = (player: Player) => player.first_name + " " + player.last_name;
const dayFor = (match: Match) => match.matchday?.trim() ?? "";
const dayLabel = (day: string) => /^\d+$/.test(day) ? "Giornata " + day : day;
const matchStatus: Record<Match["status"], string> = {
  scheduled: "Programmata",
  live: "In corso",
  finished: "Terminata",
  postponed: "Rinviata",
};
const playerSearchable = (player: Player) =>
  (playerName(player) + " " + player.last_name + " " + player.first_name).toLocaleLowerCase("it");

function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const text = String(error.message);
    if (text.includes("relation") && text.includes("does not exist") ||
        text.includes("schema cache")) {
      return "Esegui prima la migrazione SQL supabase/19_goalkeeper_votes_and_matchday_mvp.sql in Supabase.";
    }
    return text;
  }
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

export function AdminMatchAwards() {
  const [data, setData] = useState<AwardData | null>(null);
  const [ratings, setRatings] = useState<GoalkeeperMatchRating[]>([]);
  const [mvps, setMvps] = useState<MatchMvp[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [competitionId, setCompetitionId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [keeperMatchday, setKeeperMatchday] = useState("");
  const [mvpMatchday, setMvpMatchday] = useState("");
  const [mvpMatchId, setMvpMatchId] = useState("");
  const [keeperSearch, setKeeperSearch] = useState("");
  const [mvpSearch, setMvpSearch] = useState("");
  const [draftRatings, setDraftRatings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshAwards() {
    if (!supabase) throw new Error("Supabase non configurato.");
    const [ratingsResult, mvpResult] = await Promise.all([
      supabase.from("goalkeeper_match_ratings").select("match_id,player_id,rating"),
      supabase.from("match_mvp").select("match_id,player_id"),
    ]);
    if (ratingsResult.error) throw ratingsResult.error;
    if (mvpResult.error) throw mvpResult.error;
    setRatings(ratingsResult.data as GoalkeeperMatchRating[]);
    setMvps((mvpResult.data ?? []) as MatchMvp[]);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await ensureFreshAdminSession();
        const [competitions, teams, players] = await Promise.all([
          getActiveCompetitions(),
          getTeams(),
          getPlayers(),
        ]);
        if (!mounted) return;
        setData({ competitions, teams, players });
        await refreshAwards();
        if (mounted) setError("");
      } catch (caught) {
        if (mounted) setError(errorText(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const selectedCompetition = data?.competitions.find((entry) => entry.id === competitionId)
    ?? data?.competitions[0];
  // Query the selected competition directly; include all fixture statuses so
  // scheduled and live matches still contribute their recorded matchday.
  useEffect(() => {
    const id = selectedCompetition?.id;
    if (!id) {
      setMatches([]);
      setMatchesLoading(false);
      return;
    }
    let active = true;
    setMatches([]);
    setMatchesLoading(true);
    void getMatches(id)
      .then((rows) => { if (active) setMatches(rows); })
      .catch((caught) => { if (active) setError(errorText(caught)); })
      .finally(() => { if (active) setMatchesLoading(false); });
    return () => { active = false; };
  }, [selectedCompetition?.id]);

  const competitionMatches = useMemo(() =>
    matches
      .filter((match) => match.competition_id === selectedCompetition?.id)
      .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime()),
    [matches, selectedCompetition?.id],
  );
  const matchdays = useMemo(() => Array.from(new Set(
    competitionMatches.map(dayFor).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b, "it", { numeric: true, sensitivity: "base" })),
    [competitionMatches],
  );
  const scopedMatches = useMemo(() =>
    competitionMatches.filter((match) => !keeperMatchday || dayFor(match) === keeperMatchday),
    [competitionMatches, keeperMatchday],
  );
  const selectedMatch = scopedMatches.find((match) => match.id === matchId) ?? scopedMatches[0];
  const canRateMatch = selectedMatch?.status === "finished";
  const mvpMatches = useMemo(() =>
    competitionMatches.filter((match) => !mvpMatchday || dayFor(match) === mvpMatchday),
    [competitionMatches, mvpMatchday],
  );
  const selectedMvpMatch = mvpMatches.find((match) => match.id === mvpMatchId) ?? mvpMatches[0];
  const canNominateMvp = selectedMvpMatch?.status === "finished";

  const registeredTeams = useMemo(
    () => (data?.teams ?? []).filter((team) => team.competition_ids?.includes(selectedCompetition?.id ?? "")),
    [data, selectedCompetition?.id],
  );
  const registeredTeamIds = new Set(registeredTeams.map((team) => team.id));
  const teamNames = new Map((data?.teams ?? []).map((team) => [team.id, team.name]));
  const keeperPlayers = (data?.players ?? [])
    .filter((player) =>
      Boolean(selectedMatch) &&
      [selectedMatch?.home_team_id, selectedMatch?.away_team_id].includes(player.team_id) &&
      isGoalkeeperPosition(player.position) && !isStaffPosition(player.position, player.role),
    )
    .filter((player) => playerSearchable(player).includes(keeperSearch.trim().toLocaleLowerCase("it")));
  const mvpPlayers = (data?.players ?? [])
    .filter((player) =>
      Boolean(selectedMvpMatch) &&
      [selectedMvpMatch?.home_team_id, selectedMvpMatch?.away_team_id].includes(player.team_id) &&
      registeredTeamIds.has(player.team_id) &&
      !isStaffPosition(player.position, player.role),
    )
    .filter((player) => playerSearchable(player).includes(mvpSearch.trim().toLocaleLowerCase("it")));
  const currentMvp = mvps.find((item) => item.match_id === selectedMvpMatch?.id);
  const eligibleMvpMatchIds = new Set(competitionMatches
    .filter((match) => match.status === "finished").map((match) => match.id));
  const nominationCounts = new Map<string, number>();
  mvps.filter((item) => eligibleMvpMatchIds.has(item.match_id)).forEach((item) => {
    nominationCounts.set(item.player_id, (nominationCounts.get(item.player_id) ?? 0) + 1);
  });
  const selectedMvpMatchLabel = selectedMvpMatch
    ? (teamNames.get(selectedMvpMatch.home_team_id) ?? "Casa") + " – " + (teamNames.get(selectedMvpMatch.away_team_id) ?? "Ospiti")
    : "";

  async function persistRating(player: Player) {
    if (!supabase || !selectedMatch || !canRateMatch) return;
    const draftKey = selectedMatch.id + ":" + player.id;
    const existing = ratings.find((row) => row.match_id === selectedMatch.id && row.player_id === player.id);
    const value = Number(draftRatings[draftKey] ?? existing?.rating ?? 0);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      setError("Seleziona un voto da 1 a 5 per il portiere.");
      return;
    }
    setBusyKey(draftKey);
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: saveError } = await supabase.from("goalkeeper_match_ratings")
        .upsert({ match_id: selectedMatch.id, player_id: player.id, rating: value },
          { onConflict: "match_id,player_id" });
      if (saveError) throw saveError;
      await refreshAwards();
      setMessage("Voto " + value + "/5 salvato per " + playerName(player) + ".");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyKey("");
    }
  }

  async function removeRating(player: Player) {
    if (!supabase || !selectedMatch) return;
    const key = selectedMatch.id + ":" + player.id;
    setBusyKey(key);
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: deleteError } = await supabase.from("goalkeeper_match_ratings")
        .delete().eq("match_id", selectedMatch.id).eq("player_id", player.id);
      if (deleteError) throw deleteError;
      setDraftRatings((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await refreshAwards();
      setMessage("Valutazione rimossa.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyKey("");
    }
  }

  async function nominateMvp(player: Player) {
    if (!supabase || !selectedMvpMatch || !canNominateMvp) return;
    setBusyKey("mvp");
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: saveError } = await supabase.from("match_mvp")
        .upsert({ match_id: selectedMvpMatch.id, player_id: player.id },
          { onConflict: "match_id" });
      if (saveError) throw saveError;
      await refreshAwards();
      setMessage("MVP assegnato a " + playerName(player) + " per " + selectedMvpMatchLabel + ".");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyKey("");
    }
  }

  async function removeMvp() {
    if (!supabase || !selectedMvpMatch) return;
    setBusyKey("mvp");
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: deleteError } = await supabase.from("match_mvp")
        .delete().eq("match_id", selectedMvpMatch.id);
      if (deleteError) throw deleteError;
      await refreshAwards();
      setMessage("MVP della partita rimosso.");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyKey("");
    }
  }

  if (loading) return <div className="admin-help"><p>Caricamento voti e nomination…</p></div>;
  return (
    <section className="admin-awards">
      <header className="admin-awards__heading">
        <h2>Voti portieri e MVP</h2>
        <p>Assegna a ogni partita terminata i voti dei portieri (da 1 a 5) e un MVP. La classifica portieri usa la media voto; la classifica MVP conta i riconoscimenti ottenuti nelle singole partite.</p>
      </header>

      <label className="admin-awards__field">
        <span>Competizione attiva</span>
        <select
          value={selectedCompetition?.id ?? ""}
          onChange={(event) => {
            setCompetitionId(event.target.value);
            setMatchId(""); setMvpMatchId(""); setMvpMatchday(""); setKeeperMatchday("");
            setKeeperSearch(""); setMvpSearch("");
            setError(""); setMessage("");
          }}
        >
          {(data?.competitions ?? []).map((competition) => (
            <option key={competition.id} value={competition.id}>{competition.name}</option>
          ))}
        </select>
      </label>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {message && <p className="admin-message" role="status">{message}</p>}
      {!data?.competitions.length && <p className="admin-help">Non ci sono competizioni attive da valutare.</p>}

      {selectedCompetition && (
        <div className="admin-awards__panels">
          <section className="admin-awards__panel">
            <h3>Voti portieri · 1–5</h3>
            <p className="admin-help-text">Seleziona una giornata e una partita della competizione. Per registrare voti da 1 a 5, la partita deve essere terminata.</p>
            <label className="admin-awards__field">
              <span>Filtra per numero di giornata</span>
              <select value={keeperMatchday} disabled={matchesLoading} onChange={(event) => {
                setKeeperMatchday(event.target.value);
                setMatchId("");
                setKeeperSearch("");
              }}>
                <option value="">Tutte le giornate</option>
                {matchdays.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
              </select>
            </label>
            <label className="admin-awards__field">
              <span>Partita</span>
              <select value={selectedMatch?.id ?? ""} disabled={matchesLoading || !scopedMatches.length} onChange={(event) => {
                setMatchId(event.target.value);
                setKeeperSearch("");
              }}>
                {scopedMatches.map((match) => (
                  <option value={match.id} key={match.id}>
                    {teamNames.get(match.home_team_id) ?? "Casa"} – {teamNames.get(match.away_team_id) ?? "Ospiti"} · {dayFor(match) ? dayLabel(dayFor(match)) : "Senza giornata"} · {matchStatus[match.status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-awards__field">
              <span>Cerca portiere</span>
              <input type="search" value={keeperSearch} onChange={(event) => setKeeperSearch(event.target.value)} placeholder="Nome o cognome…" />
            </label>
            {matchesLoading ? <p className="admin-help-text">Caricamento partite della competizione…</p> : null}
            {!matchesLoading && !selectedMatch ? <p className="admin-help-text">Nessuna partita trovata per questa competizione e giornata.</p> : null}
            {selectedMatch && !canRateMatch ? (
              <p className="admin-help-text" role="status">Partita {matchStatus[selectedMatch.status].toLowerCase()}: per inserire voti, imposta prima lo stato “Terminata” nella sezione Partite.</p>
            ) : null}
            {selectedMatch ? (
              <div className="admin-awards__players">
                {keeperPlayers.map((player) => {
                  const ratingKey = selectedMatch.id + ":" + player.id;
                  const existing = ratings.find((entry) => entry.match_id === selectedMatch.id && entry.player_id === player.id);
                  const playerScores = ratings.filter((entry) =>
                    entry.player_id === player.id &&
                    competitionMatches.some((match) => match.id === entry.match_id),
                  );
                  const average = playerScores.length
                    ? (playerScores.reduce((sum, row) => sum + Number(row.rating), 0) / playerScores.length).toFixed(1)
                    : "—";
                  return (
                    <div className="admin-awards__player" key={player.id}>
                      <div className="admin-awards__player-info">
                        <strong>{playerName(player)}</strong>
                        <small>{teamNames.get(player.team_id) ?? "—"} · Media {average} ({playerScores.length} voti)</small>
                      </div>
                      <div className="admin-awards__actions">
                        <select
                          aria-label={"Voto per " + playerName(player)}
                          value={draftRatings[ratingKey] ?? String(existing?.rating ?? "")}
                          onChange={(event) => setDraftRatings((current) => ({ ...current, [ratingKey]: event.target.value }))}
                          disabled={!canRateMatch || Boolean(busyKey)}
                        >
                          <option value="">Voto</option>
                          {[1, 2, 3, 4, 5].map((vote) => <option key={vote} value={vote}>{vote}/5</option>)}
                        </select>
                        <button className="btn btn--primary" type="button" onClick={() => void persistRating(player)} disabled={Boolean(busyKey) || !canRateMatch}>
                          {existing ? "Aggiorna" : "Salva"}
                        </button>
                        {existing && <button className="btn btn--ghost" type="button" disabled={Boolean(busyKey)} onClick={() => void removeRating(player)}>Rimuovi</button>}
                      </div>
                    </div>
                  );
                })}
                {!keeperPlayers.length && <p className="admin-help-text">Nessun portiere trovato per questa partita.</p>}
              </div>
            ) : null}
          </section>

          <section className="admin-awards__panel">
            <h3>MVP · per partita</h3>
            <p className="admin-help-text">Ogni partita può avere un solo MVP, selezionato tra i giocatori delle due squadre. Filtra per giornata e poi scegli la partita: puoi correggere il nominativo senza duplicare il riconoscimento.</p>
            <label className="admin-awards__field">
              <span>Filtra per numero di giornata</span>
              <select value={mvpMatchday} disabled={matchesLoading} onChange={(event) => {
                setMvpMatchday(event.target.value);
                setMvpMatchId("");
                setMvpSearch("");
              }}>
                <option value="">Tutte le giornate</option>
                {matchdays.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
              </select>
            </label>
            <label className="admin-awards__field">
              <span>Partita da premiare</span>
              <select value={selectedMvpMatch?.id ?? ""} disabled={matchesLoading || !mvpMatches.length} onChange={(event) => {
                setMvpMatchId(event.target.value);
                setMvpSearch("");
              }}>
                {mvpMatches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {teamNames.get(match.home_team_id) ?? "Casa"} – {teamNames.get(match.away_team_id) ?? "Ospiti"} · {dayFor(match) ? dayLabel(dayFor(match)) : "Senza giornata"} · {matchStatus[match.status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-awards__field">
              <span>Cerca giocatore MVP</span>
              <input type="search" value={mvpSearch} onChange={(event) => setMvpSearch(event.target.value)} placeholder="Nome o cognome…" />
            </label>
            {currentMvp && (
              <div className="admin-awards__current" role="status">
                MVP di {selectedMvpMatchLabel}: <strong>{playerName((data?.players ?? []).find((player) => player.id === currentMvp.player_id) ?? {
                  id: currentMvp.player_id, team_id: "", first_name: "Giocatore", last_name: "non disponibile",
                  shirt_number: null, position: null, profile_image_url: null, bg_less_image_url: null,
                })}</strong>
                <button className="btn btn--ghost" type="button" disabled={Boolean(busyKey)} onClick={() => void removeMvp()}>Rimuovi</button>
              </div>
            )}
            {!matchesLoading && !selectedMvpMatch ? <p className="admin-help-text">Non ci sono partite per la giornata o competizione selezionata.</p> : null}
            {selectedMvpMatch && !canNominateMvp ? (
              <p className="admin-help-text" role="status">La partita è {matchStatus[selectedMvpMatch.status].toLowerCase()}: imposta “Terminata” nella sezione Partite prima di assegnare l'MVP.</p>
            ) : null}
            {selectedMvpMatch ? (
              <div className="admin-awards__players">
                {mvpPlayers.map((player) => (
                  <div className="admin-awards__player" key={player.id}>
                    <div className="admin-awards__player-info">
                      <strong>{playerName(player)}</strong>
                      <small>{teamNames.get(player.team_id) ?? "—"} · Nomination MVP: <strong>{nominationCounts.get(player.id) ?? 0}</strong></small>
                    </div>
                    <div className="admin-awards__actions">
                      <button
                        className="btn btn--primary"
                        type="button"
                        disabled={Boolean(busyKey) || !canNominateMvp || currentMvp?.player_id === player.id}
                        onClick={() => void nominateMvp(player)}
                      >
                        {currentMvp?.player_id === player.id ? "MVP della partita ✓" : "Assegna MVP"}
                      </button>
                    </div>
                  </div>
                ))}
                {!mvpPlayers.length && <p className="admin-help-text">Nessun giocatore trovato tra le due squadre della partita.</p>}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}
