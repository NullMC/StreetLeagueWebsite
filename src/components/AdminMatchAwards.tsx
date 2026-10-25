import { useEffect, useMemo, useState } from "react";
import { getActiveCompetitions, getMatches, getPlayers, getTeams } from "../lib/api";
import { ensureFreshAdminSession } from "../lib/admin";
import { isGoalkeeperPosition, isStaffPosition } from "../lib/awards";
import { supabase } from "../lib/supabase";
import type { Competition, GoalkeeperMatchRating, Match, MatchdayMvpVote, Player, Team } from "../types";

type AwardData = {
  competitions: Competition[];
  teams: Team[];
  players: Player[];
};

const playerName = (player: Player) => player.first_name + " " + player.last_name;
const dayFor = (match: Match) => match.matchday?.trim() ?? "";
const dayLabel = (day: string) => /^\\d+$/.test(day) ? "Giornata " + day : day;
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
  const [mvps, setMvps] = useState<MatchdayMvpVote[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [competitionId, setCompetitionId] = useState("");
  const [matchId, setMatchId] = useState("");
  const [keeperMatchday, setKeeperMatchday] = useState("");
  const [matchday, setMatchday] = useState("");
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
      supabase.from("competition_matchday_mvp").select("competition_id,matchday,player_id"),
    ]);
    if (ratingsResult.error) throw ratingsResult.error;
    if (mvpResult.error) throw mvpResult.error;
    setRatings(ratingsResult.data as GoalkeeperMatchRating[]);
    setMvps(mvpResult.data as MatchdayMvpVote[]);
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
  const selectedMatchday = matchdays.includes(matchday) ? matchday : (matchdays[0] ?? "");
  const canNominateMvp = Boolean(selectedMatchday && competitionMatches.some(
    (match) => dayFor(match) === selectedMatchday && match.status === "finished",
  ));

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
    .filter((player) => registeredTeamIds.has(player.team_id) && !isStaffPosition(player.position, player.role))
    .filter((player) => playerSearchable(player).includes(mvpSearch.trim().toLocaleLowerCase("it")));
  const currentMvp = mvps.find(
    (item) => item.competition_id === selectedCompetition?.id && item.matchday === selectedMatchday,
  );
  const nominationCounts = new Map<string, number>();
  mvps.filter((item) => item.competition_id === selectedCompetition?.id).forEach((item) => {
    nominationCounts.set(item.player_id, (nominationCounts.get(item.player_id) ?? 0) + 1);
  });

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
    if (!supabase || !selectedCompetition || !selectedMatchday || !canNominateMvp) return;
    setBusyKey("mvp");
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: saveError } = await supabase.from("competition_matchday_mvp")
        .upsert({
          competition_id: selectedCompetition.id,
          matchday: selectedMatchday,
          player_id: player.id,
        }, { onConflict: "competition_id,matchday" });
      if (saveError) throw saveError;
      await refreshAwards();
      setMessage("MVP assegnato a " + playerName(player) + " per " + selectedMatchday + ".");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusyKey("");
    }
  }

  async function removeMvp() {
    if (!supabase || !selectedCompetition || !selectedMatchday) return;
    setBusyKey("mvp");
    setError(""); setMessage("");
    try {
      await ensureFreshAdminSession();
      const { error: deleteError } = await supabase.from("competition_matchday_mvp")
        .delete().eq("competition_id", selectedCompetition.id).eq("matchday", selectedMatchday);
      if (deleteError) throw deleteError;
      await refreshAwards();
      setMessage("Nomination MVP della giornata rimossa.");
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
        <p>Valuta ogni portiere da 1 a 5 per partita terminata e scegli un MVP per ogni giornata di una competizione attiva. La classifica portieri usa la media dei voti; gli MVP vengono contati per giornate vinte.</p>
      </header>

      <label className="admin-awards__field">
        <span>Competizione attiva</span>
        <select
          value={selectedCompetition?.id ?? ""}
          onChange={(event) => {
            setCompetitionId(event.target.value);
            setMatchId(""); setMatchday(""); setKeeperMatchday("");
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
            )}
          </section>

          <section className="admin-awards__panel">
            <h3>Nomination MVP · per giornata</h3>
            <p className="admin-help-text">Il menu include tutti i numeri di giornata registrati nelle partite della competizione, anche quelle ancora programmate. Puoi assegnare una nomination quando almeno una partita della giornata risulta terminata.</p>
            <label className="admin-awards__field">
              <span>Giornata della competizione</span>
              <select value={selectedMatchday} disabled={matchesLoading || !matchdays.length} onChange={(event) => {
                setMatchday(event.target.value); setMvpSearch("");
              }}>
                {matchdays.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
              </select>
            </label>
            <label className="admin-awards__field">
              <span>Cerca giocatore MVP</span>
              <input type="search" value={mvpSearch} onChange={(event) => setMvpSearch(event.target.value)} placeholder="Nome o cognome…" />
            </label>
            {currentMvp && (
              <div className="admin-awards__current" role="status">
                MVP di {selectedMatchday}: <strong>{playerName((data?.players ?? []).find((player) => player.id === currentMvp.player_id) ?? {
                  id: currentMvp.player_id, team_id: "", first_name: "Giocatore", last_name: "non disponibile",
                  shirt_number: null, position: null, profile_image_url: null, bg_less_image_url: null,
                })}</strong>
                <button className="btn btn--ghost" type="button" disabled={Boolean(busyKey)} onClick={() => void removeMvp()}>Rimuovi</button>
              </div>
            )}
            {!matchesLoading && !selectedMatchday ? <p className="admin-help-text">Nessuna giornata registrata nelle partite della competizione. Compila il campo “Giornata” nella sezione Partite.</p> : null}
            {selectedMatchday && !canNominateMvp ? <p className="admin-help-text" role="status">Nessuna partita terminata in questa giornata: potrai assegnare l'MVP dopo aver concluso almeno un incontro.</p> : null}
            {selectedMatchday ? (
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
                        {currentMvp?.player_id === player.id ? "MVP della giornata ✓" : "Assegna MVP"}
                      </button>
                    </div>
                  </div>
                ))}
                {!mvpPlayers.length && <p className="admin-help-text">Nessun giocatore trovato in questa competizione.</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
