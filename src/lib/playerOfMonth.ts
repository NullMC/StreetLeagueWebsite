import { supabase } from "./supabase";

export type MonthlyAward = {
  id: string;
  player_id: string;
  award_type: "player" | "staff";
  month_label: string;
  note: string | null;
  card_image_url?: string | null;
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

export type PlayerOfMonth = MonthlyAward;
export type StaffOfMonth = MonthlyAward;

async function getLegacyPlayerOfMonth(): Promise<PlayerOfMonth | null> {
  if (!supabase) return null;
  const withGraphic = await supabase
    .from("player_of_month")
    .select("id, player_id, month_label, note, card_image_url, published_at, created_at, player:players(id,first_name,last_name,shirt_number,position,team_id)")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (withGraphic.error) {
    if (!(withGraphic.error.message || "").includes("card_image_url")) throw withGraphic.error;
    const fallback = await supabase
      .from("player_of_month")
      .select("id, player_id, month_label, note, published_at, created_at, player:players(id,first_name,last_name,shirt_number,position,team_id)")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    return fallback.data ? ({ ...fallback.data, award_type: "player", card_image_url: null } as PlayerOfMonth) : null;
  }

  return withGraphic.data ? ({ ...withGraphic.data, award_type: "player" } as PlayerOfMonth) : null;
}

async function getMonthlyAward(type: "player" | "staff"): Promise<MonthlyAward | null> {
  if (!supabase) return null;
  const result = await supabase
    .from("player_of_month")
    .select("id, player_id, award_type, month_label, note, card_image_url, published_at, created_at, player:players(id,first_name,last_name,shirt_number,position,team_id)")
    .eq("award_type", type)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    const message = result.error.message || "";
    if (message.toLowerCase().includes("award_type")) {
      return type === "player" ? getLegacyPlayerOfMonth() : null;
    }
    if (message.includes("card_image_url")) {
      const withoutGraphic = await supabase
        .from("player_of_month")
        .select("id, player_id, award_type, month_label, note, published_at, created_at, player:players(id,first_name,last_name,shirt_number,position,team_id)")
        .eq("award_type", type)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (withoutGraphic.error) throw withoutGraphic.error;
      return withoutGraphic.data ? ({ ...withoutGraphic.data, card_image_url: null } as MonthlyAward) : null;
    }
    throw result.error;
  }

  return (result.data as MonthlyAward | null) ?? null;
}

export async function getPlayerOfMonth(): Promise<PlayerOfMonth | null> {
  return getMonthlyAward("player");
}

export async function getStaffOfMonth(): Promise<StaffOfMonth | null> {
  return getMonthlyAward("staff");
}

export function subscribeToPlayerOfMonth(onChange: () => void) {
  if (!supabase) return () => {};
  const client = supabase;
  const existing = client
    .getChannels()
    .find((channel) => channel.topic === "realtime:street-league-potm");
  if (existing) void client.removeChannel(existing);

  const channel = client
    .channel("street-league-potm")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "player_of_month" },
      onChange,
    )
    .subscribe();

  return () => void client.removeChannel(channel);
}
