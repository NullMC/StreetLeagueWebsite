import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

async function requireSuperAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Autenticazione richiesta.");
  }

  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Sessione non valida.");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (
    !profile ||
    profile.role !== "super_admin" ||
    profile.is_active !== true
  ) {
    throw new Error("Permessi insufficienti.");
  }

  return data.user;
}

async function setCode(profileId: string, code: string) {
  const { error } = await adminClient.rpc("set_admin_access_code", {
    p_user_id: profileId,
    p_code: code,
  });

  if (error) throw error;
}

async function listUsers() {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, full_name, username, email, role, is_active, created_at")
    .in("role", ["super_admin", "admin", "operator", "viewer"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    const currentUser = await requireSuperAdmin(req);
    const body = await req.json();
    const action = cleanText(body.action);

    if (action === "list") {
      return response({ users: await listUsers() });
    }

    if (action === "create") {
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const fullName = cleanText(body.full_name);
      const code = cleanText(body.code);


      if (!username || username.length < 3 || username.length > 32) {
        return response({ error: "Username non valido." }, 400);
      }
      if (!email) {
        return response({ error: "Email obbligatoria." }, 400);
      }
      if (code.length < 8) {
        return response(
          { error: "Il codice di accesso deve avere almeno 8 caratteri." },
          400,
        );
      }

      const { data: duplicateUsername } = await adminClient
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .maybeSingle();

      if (duplicateUsername) {
        return response({ error: "Username già utilizzato." }, 409);
      }

      const { data: duplicateEmail } = await adminClient
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (duplicateEmail) {
        return response({ error: "Email già utilizzata." }, 409);
      }

      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            username,
            full_name: fullName || null,
          },
        });

      if (createError || !created.user) {
        throw createError ?? new Error("Creazione utente non riuscita.");
      }

      const userId = created.user.id;

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({
          username,
          email,
          full_name: fullName || null,
          role: "admin",
          is_active: true,
        })
        .eq("id", userId);

      if (profileError) {
        await adminClient.auth.admin.deleteUser(userId);
        throw profileError;
      }

      try {
        await setCode(userId, code);
      } catch (error) {
        await adminClient.auth.admin.deleteUser(userId);
        throw error;
      }

      return response({ ok: true, user_id: userId }, 201);
    }

    if (action === "update") {
      const userId = cleanText(body.user_id);
      const username = normalizeUsername(body.username);
      const email = normalizeEmail(body.email);
      const fullName = cleanText(body.full_name);
      const code = cleanText(body.code);


      if (!userId) return response({ error: "user_id obbligatorio." }, 400);
      if (!username || username.length < 3 || username.length > 32) {
        return response({ error: "Username non valido." }, 400);
      }
      if (!email) return response({ error: "Email obbligatoria." }, 400);
      if (code && code.length < 8) {
        return response(
          { error: "Il nuovo codice deve avere almeno 8 caratteri." },
          400,
        );
      }

      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) return response({ error: "Utente non trovato." }, 404);
      if (target.role === "super_admin") {
        return response(
          {
            error:
              "Il Super Admin non può essere modificato da questa procedura.",
          },
          400,
        );
      }

      const { data: duplicateUsername } = await adminClient
        .from("profiles")
        .select("id")
        .ilike("username", username)
        .neq("id", userId)
        .maybeSingle();

      if (duplicateUsername) {
        return response({ error: "Username già utilizzato." }, 409);
      }

      const { data: duplicateEmail } = await adminClient
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .neq("id", userId)
        .maybeSingle();

      if (duplicateEmail) {
        return response({ error: "Email già utilizzata." }, 409);
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        {
          email,
          email_confirm: true,
          user_metadata: {
            username,
            full_name: fullName || null,
          },
        },
      );

      if (authError) throw authError;

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({
          username,
          email,
          full_name: fullName || null,
          role: "admin",
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      if (code) {
        await setCode(userId, code);
      }

      return response({ ok: true });
    }

    if (action === "activate" || action === "deactivate") {
      const userId = cleanText(body.user_id);
      if (!userId) return response({ error: "user_id obbligatorio." }, 400);

      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) return response({ error: "Utente non trovato." }, 404);
      if (target.role === "super_admin") {
        return response(
          { error: "Il Super Admin non può essere disattivato." },
          400,
        );
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ is_active: action === "activate" })
        .eq("id", userId);

      if (error) throw error;

      return response({ ok: true });
    }

    if (action === "delete") {
      const userId = cleanText(body.user_id);
      if (!userId) return response({ error: "user_id obbligatorio." }, 400);
      if (userId === currentUser.id) {
        return response(
          { error: "Non puoi eliminare il tuo stesso account." },
          400,
        );
      }

      const { data: target, error: targetError } = await adminClient
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) return response({ error: "Utente non trovato." }, 404);
      if (target.role === "super_admin") {
        return response(
          { error: "Il Super Admin non può essere eliminato." },
          400,
        );
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      return response({ ok: true });
    }

    return response({ error: "Azione non riconosciuta." }, 400);
  } catch (error) {
    console.error("admin-users error:", error);
    return response(
      {
        error: error instanceof Error ? error.message : "Errore interno.",
      },
      500,
    );
  }
});
