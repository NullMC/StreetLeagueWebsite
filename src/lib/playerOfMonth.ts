import { supabase } from "./supabase";

export type PlayerOfMonth = {
  id: string;
  player_id: string;
  month_label: string;
  note: string | null;
  published_at: string;
  created_at: string;
  player: {
    id: string;
    first_name: string;
    last_name: string;
    shirt_number: number | null;
    position: string | null;
    team_id: string;
  } | null;
};

export async function getPlayerOfMonth(): Promise<PlayerOfMonth | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("player_of_month")
    .select(
      "id, player_id, month_label, note, published_at, created_at, player:players(id,first_name,last_name,shirt_number,position,team_id)",
    )
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as PlayerOfMonth | null) ?? null;
}
