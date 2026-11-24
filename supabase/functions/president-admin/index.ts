// Street League: credenziali dei presidenti di squadra (solo super admin).
//
// Actions (POST JSON { action, team_id?, active? }):
//   list            teams registered to an active competition, with their president account
//   create          new president account for one team            -> returns username + password
//   create_missing  accounts for every registered team without one -> returns usernames + passwords
//   reset           new password for a team's president (open sessions are closed)
//   set_active      enable / disable a president account (disabling closes open sessions)
//
// Passwords are generated here, returned once to the super admin and never stored in clear.
// The caller must be signed in as an active super admin: the token is checked against the
// Auth server and the profile role is read with the service role, never trusted from the client.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_DOMAIN = "presidenti.streetleaguebari.it";
const BAN_FOREVER = "876000h";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

function getServerKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      return parsed.default ?? Object.values(parsed)[0] ?? "";
    } catch {
      return "";
    }
  }
  return "";
}

const serviceRoleKey = getServerKey();
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function requireSuperAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Sessione mancante. Effettua l'accesso al back office.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sessione scaduta. Effettua nuovamente l'accesso.");
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !profile.is_active || profile.role !== "super_admin") {
    throw new HttpError(403, "Operazione riservata al super admin.");
  }
  return data.user.id;
}

/** 12 characters, no look-alike symbols (0/O, 1/l/I), at least one upper, lower and digit. */
function generatePassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  for (;;) {
    let out = "";
    while (out.length < length) {
      const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
      for (const byte of bytes) {
        if (byte < limit && out.length < length) out += alphabet[byte % alphabet.length];
      }
    }
    if (/[A-Z]/.test(out) && /[a-z]/.test(out) && /\d/.test(out)) return out;
  }
}

const usernameOf = (slug: string) =>
  slug.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

type Team = { id: string; name: string; slug: string };

/** Teams registered to at least one active competition. */
async function registeredTeams() {
  const { data: competitions, error } = await admin
    .from("competitions").select("id, name").eq("status", "active");
  if (error) throw error;
  const ids = (competitions ?? []).map((row) => row.id);
  if (!ids.length) return [] as (Team & { competitions: string[] })[];
  const { data: links, error: linkError } = await admin
    .from("competition_teams").select("team_id, competition_id").in("competition_id", ids);
  if (linkError) throw linkError;
  const teamIds = [...new Set((links ?? []).map((row) => row.team_id))];
  if (!teamIds.length) return [];
  const { data: teams, error: teamError } = await admin
    .from("teams").select("id, name, slug").in("id", teamIds).order("name");
  if (teamError) throw teamError;
  const names = new Map((competitions ?? []).map((row) => [row.id, row.name as string]));
  return (teams ?? []).map((team) => ({
    ...(team as Team),
    competitions: (links ?? []).filter((row) => row.team_id === team.id)
      .map((row) => names.get(row.competition_id) ?? "").filter(Boolean),
  }));
}

async function presidentOf(teamId: string) {
  const { data, error } = await admin
    .from("team_presidents").select("profile_id").eq("team_id", teamId).maybeSingle();
  if (error) throw error;
  return data?.profile_id as string | undefined;
}

async function requireRegisteredTeam(teamId: unknown) {
  if (typeof teamId !== "string" || !teamId) throw new HttpError(400, "Squadra non indicata.");
  const team = (await registeredTeams()).find((row) => row.id === teamId);
  if (!team) throw new HttpError(400, "La squadra non è iscritta a una competizione attiva.");
  return team;
}

async function createPresident(team: Team) {
  if (await presidentOf(team.id)) throw new HttpError(409, "La squadra " + team.name + " ha già un presidente.");
  const username = usernameOf(team.slug || team.name);
  if (!username) throw new HttpError(400, "Slug della squadra " + team.name + " non valido.");
  const { data: clash, error: clashError } = await admin
    .from("profiles").select("id").ilike("username", username).limit(1);
  if (clashError) throw clashError;
  if (clash?.length) throw new HttpError(409, "Lo username " + username + " è già in uso.");

  const password = generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: username + "@" + EMAIL_DOMAIN,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: "Presidente " + team.name },
  });
  if (error || !data.user) throw new HttpError(400, "Creazione account non riuscita: " + (error?.message ?? ""));

  const userId = data.user.id;
  // The auth trigger creates the profile; make sure it is a plain, active, non-staff profile.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId, username, email: username + "@" + EMAIL_DOMAIN,
    full_name: "Presidente " + team.name, role: "viewer", is_active: true,
  }, { onConflict: "id" });
  const { error: linkError } = profileError
    ? { error: profileError }
    : await admin.from("team_presidents").insert({ profile_id: userId, team_id: team.id });
  if (linkError) {
    await admin.auth.admin.deleteUser(userId);
    throw linkError;
  }
  return { team_id: team.id, team_name: team.name, username, password };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server credentials for president-admin");
      return response({ error: "Configurazione del server incompleta." }, 500);
    }
    await requireSuperAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "list") {
      const teams = await registeredTeams();
      const { data: links, error } = await admin
        .from("team_presidents").select("team_id, profile_id, created_at, profiles(username, is_active)");
      if (error) throw error;
      const { data: users, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (usersError) throw usersError;
      const lastSignIn = new Map(users.users.map((user) => [user.id, user.last_sign_in_at ?? null]));
      return response({
        teams: teams.map((team) => {
          const link = (links ?? []).find((row) => row.team_id === team.id);
          const profile = link?.profiles as unknown as { username: string | null; is_active: boolean } | null;
          return {
            team_id: team.id,
            team_name: team.name,
            competitions: team.competitions,
            president: link ? {
              username: profile?.username ?? null,
              is_active: profile?.is_active ?? false,
              created_at: link.created_at,
              last_sign_in_at: lastSignIn.get(link.profile_id) ?? null,
            } : null,
          };
        }),
      });
    }

    if (action === "create") {
      const team = await requireRegisteredTeam(body.team_id);
      return response({ credentials: [await createPresident(team)] });
    }

    if (action === "create_missing") {
      const credentials = [];
      const failures = [];
      for (const team of await registeredTeams()) {
        if (await presidentOf(team.id)) continue;
        try {
          credentials.push(await createPresident(team));
        } catch (error) {
          failures.push({ team_name: team.name, error: error instanceof Error ? error.message : "Errore" });
        }
      }
      return response({ credentials, failures });
    }

    if (action === "reset" || action === "set_active") {
      const team = await requireRegisteredTeam(body.team_id);
      const userId = await presidentOf(team.id);
      if (!userId) throw new HttpError(404, "La squadra " + team.name + " non ha ancora un presidente.");
      const { data: profile } = await admin.from("profiles").select("username, role").eq("id", userId).maybeSingle();
      if (profile?.role !== "viewer") throw new HttpError(409, "L'account collegato non è un account presidente.");

      if (action === "reset") {
        const password = generatePassword();
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        await admin.rpc("revoke_user_sessions", { p_user_id: userId });
        return response({ credentials: [{ team_id: team.id, team_name: team.name, username: profile.username, password }] });
      }

      const active = body.active === true;
      const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BAN_FOREVER });
      if (banError) throw banError;
      const { error: profileError } = await admin.from("profiles").update({ is_active: active }).eq("id", userId);
      if (profileError) throw profileError;
      if (!active) await admin.rpc("revoke_user_sessions", { p_user_id: userId });
      return response({ ok: true, active });
    }

    return response({ error: "Azione non riconosciuta." }, 400);
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message }, error.status);
    console.error("president-admin error:", error);
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Errore interno.";
    return response({ error: message }, 500);
  }
});
