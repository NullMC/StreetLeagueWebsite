import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

// Support both legacy service_role secrets and the newer secret key format.
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

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase server credentials for auth-username");
      return response({ error: "Configurazione autenticazione incompleta." }, 500);
    }

    const body = await req.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();

    if (!username || !code) {
      return response({ error: "Username e codice di accesso sono obbligatori." }, 400);
    }

    if (code.length < 8) {
      return response({ error: "Codice di accesso non valido." }, 401);
    }

    const { data: matches, error: verifyError } = await adminClient.rpc(
      "verify_admin_access_code",
      {
        p_username: username,
        p_code: code,
      },
    );

    if (verifyError) {
      console.error("verify_admin_access_code failed:", verifyError);
      return response({ error: verifyError.message }, 500);
    }

    const profile = matches?.[0];

    if (!profile || !profile.email || !profile.is_active) {
      return response({ error: "Username o codice di accesso non validi." }, 401);
    }

    if (profile.role !== "super_admin") {
      return response({ error: "L'account non ha i permessi per accedere al back office." }, 403);
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (linkError) {
      console.error("generateLink failed:", linkError);
      return response({ error: linkError.message }, 500);
    }

    const tokenHash = linkData?.properties?.hashed_token;

    if (!tokenHash) {
      console.error("generateLink response missing hashed_token", linkData);
      return response({ error: "Token di autenticazione non disponibile." }, 500);
    }

    return response({ ok: true, token_hash: tokenHash });
  } catch (error) {
    console.error("auth-username error:", error);
    return response({
      error: error instanceof Error ? error.message : "Errore interno.",
    }, 500);
  }
});
