import { useEffect, useState } from "react";
import { Avatar, CircularProgress, Paper, Typography } from "@mui/material";
import { getLatestTopSeven, getPlayers, getTeams } from "../lib/api";
import { formatTopSevenMonth, TOP_SEVEN_LABELS, TOP_SEVEN_SLOTS } from "../lib/topSeven";
import { formatKeeperAverage } from "../lib/awards";
import type { Player, Team, TopSevenEntry, TopSevenSlot } from "../types";

type Slot = { entry: TopSevenEntry; player: Player; team: Team | undefined } | null;
type Pitch = Record<TopSevenSlot, Slot[]>;
type Loaded = { pitch: Pitch; periodMonth: string };

const EMPTY_PITCH: Pitch = { goalkeeper: [null], defender: [null, null], midfielder: [null, null], attacker: [null, null] };

function PlayerSlot({ slot, role }: { slot: Slot; role: TopSevenSlot }) {
  const label = TOP_SEVEN_LABELS[role];
  if (!slot) {
    return <div className="top-seven-player top-seven-player--empty"><Avatar className="top-seven-player__avatar">?</Avatar><strong>In attesa</strong><small>{label}</small></div>;
  }
  const { entry, player, team } = slot;
  const photo = player.profile_image_url || player.bg_less_image_url || undefined;
  // Goalkeepers: average of all their end-of-match ratings instead of goals and assists.
  const stats = role === "goalkeeper"
    ? (entry.keeper_average != null
      ? `Media voto ${formatKeeperAverage(entry.keeper_average)} · ${entry.keeper_votes ?? 0} ${entry.keeper_votes === 1 ? "partita" : "partite"}`
      : "Nessun voto")
    : `${entry.goals} gol · ${entry.assists} assist`;
  return <a className="top-seven-player" href={"/giocatori/" + player.id}>
    <div className="top-seven-player__photo-wrap">
      <Avatar className="top-seven-player__avatar" src={photo} alt={player.first_name + " " + player.last_name}>{player.first_name.slice(0, 1)}{player.last_name.slice(0, 1)}</Avatar>
      {team?.logo_url ? <img loading="lazy" decoding="async" className="top-seven-player__team-logo" src={team.logo_url} alt="" /> : null}
    </div>
    <strong>{player.first_name} {player.last_name}</strong><small>{team?.name ?? ""}</small>
    <span className="top-seven-player__stats">{stats}</span><small className="top-seven-player__role">{label}</small>
  </a>;
}

/**
 * Top 7 of the month as last compiled from the back office (POTM & Staff del mese).
 * It does not change while statistics grow: it is replaced only by a new compilation.
 */
export function TopSevenOfMonth() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const snapshot = await getLatestTopSeven();
        if (!snapshot) { if (mounted) setLoaded(null); return; }
        const [players, teams] = await Promise.all([getPlayers(), getTeams()]);
        const playerById = new Map(players.map((player) => [player.id, player] as const));
        const teamById = new Map(teams.map((team) => [team.id, team] as const));
        const pitch: Pitch = { goalkeeper: [], defender: [], midfielder: [], attacker: [] };
        (snapshot.players ?? []).forEach((entry) => {
          const player = playerById.get(entry.player_id);
          if (player && pitch[entry.slot]) pitch[entry.slot].push({ entry, player, team: teamById.get(entry.team_id) });
        });
        (Object.keys(TOP_SEVEN_SLOTS) as TopSevenSlot[]).forEach((role) => {
          pitch[role] = Array.from({ length: TOP_SEVEN_SLOTS[role] }, (_, index) => pitch[role][index] ?? null);
        });
        if (mounted) setLoaded({ pitch, periodMonth: snapshot.period_month });
      } catch (error) {
        console.error("Top 7 monthly data error:", error);
        if (mounted) setLoaded(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const pitch = loaded?.pitch ?? EMPTY_PITCH;
  const row = (role: TopSevenSlot) => pitch[role].map((slot, index) => <PlayerSlot key={slot?.player.id || role + "-" + index} slot={slot} role={role} />);
  return <Paper component="section" variant="outlined" className="top-seven-section" elevation={0}>
    <div className="top-seven-heading"><div><Typography component="h2" variant="h2">Top 7 <span className="sl-accent">del mese</span></Typography>
      <Typography component="p" className="top-seven-subtitle">I migliori interpreti tra le competizioni attive{loaded ? " · " + formatTopSevenMonth(loaded.periodMonth) : ""}</Typography></div>
    </div>
    <Typography component="p" className="top-seven-method">Selezione mensile per squadra basata su presenze, gol, assist, MVP, clean sheet, voti dei portieri e cartellini registrati.</Typography>
    {loading ? <div className="top-seven-loading"><CircularProgress size={30} /></div> : <div className="top-seven-pitch">
      <div className="top-seven-row top-seven-row--attack">{row("attacker")}</div>
      <div className="top-seven-row top-seven-row--midfield">{row("midfielder")}</div>
      <div className="top-seven-row top-seven-row--defence">{row("defender")}</div>
      <div className="top-seven-row top-seven-row--keeper">{row("goalkeeper")}</div>
    </div>}
  </Paper>;
}
