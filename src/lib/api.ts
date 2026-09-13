import { supabase } from './supabase';
import type { Competition, Match, Team, Player, Partner, SocialContent, MatchEvent } from '../types';

export async function getCompetitions(): Promise<Competition[]> { if(!supabase) return []; const {data,error}=await supabase.from('competitions').select('*').order('start_date',{ascending:false}); if(error) throw error; return data as Competition[]; }
export async function getActiveCompetition(): Promise<Competition|null> { if(!supabase) return null; const {data,error}=await supabase.from('competitions').select('*').eq('status','active').order('start_date',{ascending:false}).limit(1).maybeSingle(); if(error) throw error; return data as Competition|null; }
export async function getTeams(competitionId?:string): Promise<Team[]> { if(!supabase) return []; let q=supabase.from('teams').select('*').order('name'); if(competitionId) q=q.eq('competition_id',competitionId); const {data,error}=await q; if(error) throw error; return data as Team[]; }
export async function getPlayers(teamId?:string): Promise<Player[]> { if(!supabase) return []; let q=supabase.from('players').select('*').order('last_name'); if(teamId) q=q.eq('team_id',teamId); const {data,error}=await q; if(error) throw error; return data as Player[]; }
export async function getMatches(competitionId?:string): Promise<Match[]> { if(!supabase) return []; let q=supabase.from('matches').select('*').order('kickoff_at',{ascending:true}); if(competitionId) q=q.eq('competition_id',competitionId); const {data,error}=await q; if(error) throw error; return data as Match[]; }
export async function getPartners(): Promise<Partner[]> { if(!supabase) return []; const {data,error}=await supabase.from('partners').select('*').order('tier').order('sort_order'); if(error) throw error; return data as Partner[]; }
export async function getSocialContent(): Promise<SocialContent[]> { if(!supabase) return []; const {data,error}=await supabase.from('social_contents').select('*').order('published_at',{ascending:false}).limit(9); if(error) throw error; return data as SocialContent[]; }
export async function getMatch(id:string): Promise<Match|null> { if(!supabase) return null; const {data,error}=await supabase.from('matches').select('*').eq('id',id).maybeSingle(); if(error) throw error; return data as Match|null; }
export async function getMatchEvents(matchId:string): Promise<MatchEvent[]> { if(!supabase) return []; const {data,error}=await supabase.from('match_events').select('*').eq('match_id',matchId).order('minute',{ascending:true}); if(error) throw error; return data as MatchEvent[]; }
export function subscribeToCompetition(onChange: () => void) {
  if (!supabase) return () => {};

  const client = supabase;
  const existingChannel = client
    .getChannels()
    .find((channel) => channel.topic === 'realtime:street-league-live');

  if (existingChannel) {
    void client.removeChannel(existingChannel);
  }

  const channel = client
    .channel('street-league-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'competitions' },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_events' },
      onChange
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

