import { supabase } from "./supabase";
import { ensureFreshAdminSession, normalizeFunctionError } from "./admin";
import type { MatchLineupSubmission } from "../types";

/**
 * President accounts sign in with username + password. The username is mapped to a
 * fixed internal e-mail address: no e-mail is ever sent to it.
 */
export const PRESIDENT_EMAIL_DOMAIN = "presidenti.streetleaguebari.it";

function sb() {
  if (!supabase) throw new Error("Supabase non configurato.");
  return supabase;
}

export const normalizePresidentUsername = (value: string) =>
  value.trim().toLowerCase().replace(/@.*$/, "").replace(/\s+/g, "-");

export async function signInPresident(username: string, password: string) {
  const name = normalizePresidentUsername(username);
  if (!name || !password) throw new Error("Inserisci username e password.");
  const { error } = await sb().auth.signInWithPassword({
    email: name + "@" + PRESIDENT_EMAIL_DOMAIN,
    password,
  });
  if (error) {
    throw new Error(/invalid login|invalid credentials/i.test(error.message)
      ? "Username o password non validi."
      : /banned/i.test(error.message)
        ? "Account disattivato: contatta l'organizzazione."
        : error.message);
  }
}

/** Team of the signed-in president, or null when the session is not an active president. */
export async function getPresidentTeamId(): Promise<string | null> {
  const client = sb();
  const { data: { session } } = await client.auth.getSession();
  if (!session) return null;
  const { data, error } = await client.rpc("current_president_team");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function getMySubmissions(teamId: string): Promise<MatchLineupSubmission[]> {
  const { data, error } = await sb().from("match_lineup_submissions").select("*").eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []) as MatchLineupSubmission[];
}

/** Back office: who sent each lineup (staff only, through RLS). Empty before migration 30. */
export async function getLineupSubmissions(matchId: string): Promise<MatchLineupSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("match_lineup_submissions").select("*").eq("match_id", matchId);
  if (error) return [];
  return (data ?? []) as MatchLineupSubmission[];
}

export type PresidentLineupInput = {
  matchId: string;
  players: { player_id: string; starter: boolean }[];
  keeperId: string | null;
  wildcardName: string;
  wildcardStarter: boolean;
};

export type PresidentSaveResult = { members: number; wildcard: string | null; submitted_at: string };

/** Every check (team, deadline, roster) runs again on the server. */
export async function savePresidentLineup(input: PresidentLineupInput): Promise<PresidentSaveResult> {
  const { data, error } = await sb().rpc("president_save_lineup", {
    p_match_id: input.matchId,
    p_players: input.players,
    p_keeper_id: input.keeperId,
    p_wildcard_name: input.wildcardName,
    p_wildcard_starter: input.wildcardStarter,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object") throw new Error("Il server non ha confermato il salvataggio: riprova.");
  return data as PresidentSaveResult;
}

export async function changePresidentPassword(password: string) {
  if (password.length < 10) throw new Error("La nuova password deve avere almeno 10 caratteri.");
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Super admin: president accounts (Edge Function "president-admin")
// ---------------------------------------------------------------------------
export type PresidentAccount = {
  team_id: string;
  team_name: string;
  competitions: string[];
  president: {
    username: string | null;
    is_active: boolean;
    created_at: string;
    last_sign_in_at: string | null;
  } | null;
};

export type PresidentCredential = { team_id: string; team_name: string; username: string; password: string };

async function callPresidentAdmin<T>(body: Record<string, unknown>): Promise<T> {
  await ensureFreshAdminSession();
  const { data, error } = await sb().functions.invoke("president-admin", { body });
  if (error) throw await normalizeFunctionError(error);
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const listPresidentAccounts = () =>
  callPresidentAdmin<{ teams: PresidentAccount[] }>({ action: "list" }).then((data) => data.teams);

export const createPresidentAccount = (teamId: string) =>
  callPresidentAdmin<{ credentials: PresidentCredential[] }>({ action: "create", team_id: teamId });

export const createMissingPresidentAccounts = () =>
  callPresidentAdmin<{ credentials: PresidentCredential[]; failures: { team_name: string; error: string }[] }>({ action: "create_missing" });

export const resetPresidentPassword = (teamId: string) =>
  callPresidentAdmin<{ credentials: PresidentCredential[] }>({ action: "reset", team_id: teamId });

export const setPresidentActive = (teamId: string, active: boolean) =>
  callPresidentAdmin<{ ok: boolean }>({ action: "set_active", team_id: teamId, active });
