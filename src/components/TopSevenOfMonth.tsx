import { useEffect, useState } from "react";
import { Avatar, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import { getAllMatchEvents, getAllMatchLineups, getAllMatchMvps, getCompetitions, getMatches, getPlayers, getTeams, subscribeToCompetition } from "../lib/api";
import type { Match, MatchEvent, MatchLineup, MatchMvp, Player, Team } from "../types";

type Role = "goalkeeper" | "defender" | "midfielder" | "attacker";
type Candidate = {
  player: Player; team: Team; role: Role | null; appearances: number; goals: number; assists: number;
  mvps: number; cleanSheets: number; yellowCards: number; redCards: number; points: number;
};
type Lineup = { goalkeeper: Candidate | null; defenders: Array<Candidate | null>; midfielders: Array<Candidate | null>; attacker: Candidate | null };

function roleFromPosition(value: string | null | undefined): Role | null {
  const p = (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[._-]/g, " ");
  if (p.includes("staff")) return null;

  if (
    p.includes("portier") || p.includes("goalkeeper") || p.includes("goalie") ||
    p === "keeper" || ["gk", "por", "pt", "goal"].includes(p)
  ) return "goalkeeper";

  if (
    p.includes("difensor") || p.includes("defender") || p.includes("terzin") ||
    p.includes("braccetto") || p.includes("difesa") ||
    ["dif", "def", "df", "dc", "d", "cb", "lb", "rb", "lwb", "rwb"].includes(p)
  ) return "defender";

  if (
    p.includes("centrocamp") || p.includes("midfield") || p.includes("mediano") ||
    p.includes("mezzala") || p.includes("trequartista") || p.includes("regista") ||
    ["cen", "mid", "cm", "mf", "cc", "mc", "med", "cam", "cdm", "mco"].includes(p)
  ) return "midfielder";

  if (
    p.includes("attacc") || p.includes("forward") || p.includes("punta") ||
    p.includes("centravanti") || p.includes("striker") ||
    ["fw", "att", "st", "cf", "a"].includes(p)
  ) return "attacker";

  return null;
}
function isStaff(player: Player) {
  return player.role?.trim().toUpperCase() === "STAFF" || player.position?.trim().toUpperCase() === "STAFF";
}
function compareCandidates(a: Candidate, b: Candidate) {
  return b.points-a.points || b.goals-a.goals || b.assists-a.assists || b.mvps-a.mvps || b.appearances-a.appearances ||
    (a.player.last_name+" "+a.player.first_name).localeCompare(b.player.last_name+" "+b.player.first_name,"it");
}

function makeLineup(matches: Match[], teams: Team[], players: Player[], events: MatchEvent[], lineups: MatchLineup[], mvps: MatchMvp[], date: Date): Lineup {
  const monthlyMatches = matches.filter(match => {
    const kickoff = new Date(match.kickoff_at);
    return kickoff.getFullYear()===date.getFullYear() && kickoff.getMonth()===date.getMonth() &&
      (match.status==="finished" || match.status==="live");
  });
  const byMatch = new Map(monthlyMatches.map(match=>[match.id,match] as const));
  const matchIds = new Set(monthlyMatches.map(match=>match.id));
  const teamById = new Map(teams.map(team=>[team.id,team] as const));
  const playerById = new Map(players.filter(player=>!isStaff(player)).map(player=>[player.id,player] as const));
  type Totals = { appearances:number; goals:number; assists:number; mvps:number; cleanSheets:number; yellowCards:number; redCards:number };
  const totals = new Map<string,Totals>();
  playerById.forEach((player,id)=>{ if(teamById.has(player.team_id)) totals.set(id,{appearances:0,goals:0,assists:0,mvps:0,cleanSheets:0,yellowCards:0,redCards:0}); });

  lineups.forEach(entry=>{
    const match=byMatch.get(entry.match_id); const total=totals.get(entry.player_id); const player=playerById.get(entry.player_id);
    if(!match||!total||!player) return;
    total.appearances+=1;
    if(roleFromPosition(player.position)==="goalkeeper"&&match.status==="finished"){
      const conceded=match.home_team_id===entry.team_id?match.away_score:match.home_score;
      if(conceded===0) total.cleanSheets+=1;
    }
  });
  events.forEach(event=>{
    if(!matchIds.has(event.match_id)||!event.player_id) return;
    const total=totals.get(event.player_id); if(!total) return;
    if(event.event_type==="goal"||event.event_type==="presidential_penalty") total.goals+=1;
    if(event.event_type==="assist") total.assists+=1;
    if(event.event_type==="yellow_card") total.yellowCards+=1;
    if(event.event_type==="red_card") total.redCards+=1;
  });
  mvps.forEach(entry=>{ if(matchIds.has(entry.match_id)){const total=totals.get(entry.player_id);if(total)total.mvps+=1;} });

  const candidates: Candidate[]=[];
  totals.forEach((total,playerId)=>{
    const player=playerById.get(playerId); const team=player?teamById.get(player.team_id):undefined;
    if(!player||!team||(!total.appearances&&!total.goals&&!total.assists&&!total.mvps))return;
    candidates.push({player,team,role:roleFromPosition(player.position),...total,points:total.goals*5+total.assists*3+total.mvps*4+total.cleanSheets*4+total.appearances-total.yellowCards-total.redCards*3});
  });
  const bestByTeam=new Map<string,Candidate>();
  candidates.sort(compareCandidates).forEach(candidate=>{if(!bestByTeam.has(candidate.team.id))bestByTeam.set(candidate.team.id,candidate);});
  const available=Array.from(bestByTeam.values()).sort(compareCandidates);
  const usedTeams=new Set<string>();
  function pick(role:Role,count:number):Array<Candidate|null>{
    return Array.from({length:count},()=>{
      const selected=available.find(candidate=>candidate.role===role&&!usedTeams.has(candidate.team.id));
      if(!selected)return null;
      usedTeams.add(selected.team.id);return selected;
    });
  }
  return {goalkeeper:pick("goalkeeper",1)[0]||null,defenders:pick("defender",3),midfielders:pick("midfielder",2),attacker:pick("attacker",1)[0]||null};
}

function PlayerSlot({candidate,label}:{candidate:Candidate|null;label:string}){
  if(!candidate)return <div className="top-seven-player top-seven-player--empty"><Avatar className="top-seven-player__avatar">?</Avatar><strong>In attesa</strong><small>{label}</small></div>;
  const player=candidate.player; const photo=player.profile_image_url||player.bg_less_image_url||undefined;
  return <a className="top-seven-player" href={"/giocatori/"+player.id}>
    <div className="top-seven-player__photo-wrap">
      <Avatar className="top-seven-player__avatar" src={photo} alt={player.first_name+" "+player.last_name}>{player.first_name.slice(0,1)}{player.last_name.slice(0,1)}</Avatar>
      {candidate.team.logo_url?<img className="top-seven-player__team-logo" src={candidate.team.logo_url} alt=""/>:null}
    </div>
    <strong>{player.first_name} {player.last_name}</strong><small>{candidate.team.name}</small>
    <span className="top-seven-player__stats">{candidate.goals} gol · {candidate.assists} assist</span><small className="top-seven-player__role">{label}</small>
  </a>;
}

export function TopSevenOfMonth(){
  const [lineup,setLineup]=useState<Lineup|null>(null); const [loading,setLoading]=useState(true);
  const [monthLabel]=useState(()=>new Intl.DateTimeFormat("it-IT",{month:"long",year:"numeric"}).format(new Date()));
  useEffect(()=>{
    let mounted=true; const now=new Date();
    async function load(){
      setLoading(true);
      try{
        const competitions=await getCompetitions();
        const [players,teamSets,matchSets,events,allLineups,mvps]=await Promise.all([
          getPlayers(),Promise.all(competitions.map(competition=>getTeams(competition.id))),
          Promise.all(competitions.map(competition=>getMatches(competition.id))),
          getAllMatchEvents(),getAllMatchLineups(),getAllMatchMvps(),
        ]);
        const teamsById=new Map<string,Team>();teamSets.flat().forEach(team=>teamsById.set(team.id,team));
        const matchesUnique=Array.from(new Map(matchSets.flat().map(match=>[match.id,match] as const)).values());
        if(mounted)setLineup(makeLineup(matchesUnique,Array.from(teamsById.values()),players,events,allLineups,mvps,now));
      }catch(error){console.error("Top 7 monthly data error:",error);if(mounted)setLineup(null);}
      finally{if(mounted)setLoading(false);}
    }
    void load();
    const unsubscribe = subscribeToCompetition(() => { void load(); });
    return () => {
      mounted = false;
      unsubscribe();
    };
  },[]);
  const empty:Lineup={goalkeeper:null,defenders:[null,null,null],midfielders:[null,null],attacker:null};
  const current=lineup||empty;
  return <Paper component="section" variant="outlined" className="top-seven-section" elevation={0}>
    <div className="top-seven-heading"><div><Typography component="h2" variant="h2">Top 7 del mese</Typography>
      <Typography component="p" className="top-seven-subtitle">I migliori interpreti tra tutte le competizioni · {monthLabel}</Typography></div>
      <Chip label="FORMAZIONE 1–3–2–1" size="small" className="top-seven-chip"/></div>
    <Typography component="p" className="top-seven-method">Selezione mensile per squadra basata su presenze, gol, assist, MVP, clean sheet e cartellini registrati.</Typography>
    {loading?<div className="top-seven-loading"><CircularProgress size={30}/></div>:<div className="top-seven-pitch">
      <div className="top-seven-row top-seven-row--attack"><PlayerSlot candidate={current.attacker} label="Attaccante"/></div>
      <div className="top-seven-row top-seven-row--midfield">{current.midfielders.map((candidate,index)=><PlayerSlot key={candidate?.player.id||"mid-"+index} candidate={candidate} label="Centrocampista"/>)}</div>
      <div className="top-seven-row top-seven-row--defence">{current.defenders.map((candidate,index)=><PlayerSlot key={candidate?.player.id||"def-"+index} candidate={candidate} label="Difensore"/>)}</div>
      <div className="top-seven-row top-seven-row--keeper"><PlayerSlot candidate={current.goalkeeper} label="Portiere"/></div>
    </div>}
  </Paper>;
}
