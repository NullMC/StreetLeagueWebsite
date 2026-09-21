import { supabase } from "./supabase";

export type AdminRole = "super_admin" | "admin" | "operator" | "viewer";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  role: AdminRole;
  is_active: boolean;
};

function sb() {
  if (!supabase) throw new Error("Supabase non configurato.");
  return supabase;
}

async function ensureFreshAdminSession() {
  const client = sb();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;
  if (!session) {
    throw new Error("Sessione amministrativa scaduta. Effettua nuovamente l'accesso.");
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    return refreshAdminSession();
  }

  return session;
}

export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  const client = sb();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, username, email, role, is_active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as AdminProfile | null;
}

export async function signInWithAccessCode(username: string, code: string) {
  const client = sb();

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedCode = code.trim();

  if (!normalizedUsername || !normalizedCode) {
    return {
      data: null,
      error: new Error("Inserisci username e codice di accesso."),
    };
  }

  try {
    const { data, error } = await client.functions.invoke("auth-username", {
      body: {
        username: normalizedUsername,
        code: normalizedCode,
      },
    });

    if (error) {
      return {
        data: null,
        error,
      };
    }

    if (!data || data.error) {
      return {
        data: null,
        error: new Error(data?.error ?? "Autenticazione non completata."),
      };
    }

    if (!data.token_hash) {
      return {
        data: null,
        error: new Error(
          "Il server non ha restituito un token di autenticazione.",
        ),
      };
    }

    const sessionResult = await client.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "email",
    });

    return sessionResult;
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Errore durante l autenticazione."),
    };
  }
}

export async function getAuthenticatedAdmin(): Promise<AdminProfile | null> {
  const client = sb();

  await ensureFreshAdminSession();

  const profile = await getCurrentAdminProfile();

  if (
    !profile ||
    !profile.is_active ||
    !["super_admin", "admin", "operator"].includes(profile.role)
  ) {
    await client.auth.signOut();
    return null;
  }

  return profile;
}

async function refreshAdminSession() {
  const client = sb();
  const { data, error } = await client.auth.refreshSession();

  if (error) throw error;
  if (!data.session) {
    throw new Error("Sessione amministrativa scaduta. Effettua nuovamente l'accesso.");
  }

  return data.session;
}

function isExpiredJwtError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /exp claim timestamp check failed|jwt.*expired|token.*expired/i.test(
    message,
  );
}

function responseStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return undefined;
  }

  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context.status : undefined;
}

async function normalizeFunctionError(error: unknown) {
  const status = responseStatus(error);

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as {
          error?: unknown;
          message?: unknown;
        };

        const detail =
          typeof body.error === "string" && body.error.trim()
            ? body.error.trim()
            : typeof body.message === "string" && body.message.trim()
              ? body.message.trim()
              : "";

        if (detail) return new Error(detail);
      } catch {
        // Keep the SDK error when the response body is not JSON.
      }

      if (status === 401) {
        return new Error(
          "Sessione Supabase scaduta o non valida. Effettua nuovamente l'accesso.",
        );
      }
    }
  }

  return error instanceof Error
    ? error
    : new Error("Errore durante la chiamata alla Edge Function.");
}

export async function uploadMedia(file: File, folder: string) {
  const client = sb();
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = crypto.randomUUID() + "." + extension;
  const path = folder + "/" + safeName;
  const bucket = client.storage.from("street-league-media");

  // Keep long-lived admin sessions usable even after the browser has been idle.
  await ensureFreshAdminSession();

  let result = await bucket.upload(path, file, {
    upsert: false,
    cacheControl: "3600",
  });

  // If the stored access token is stale, refresh it once and retry the upload.
  if (result.error && isExpiredJwtError(result.error)) {
    await refreshAdminSession();
    result = await bucket.upload(path, file, {
      upsert: false,
      cacheControl: "3600",
    });
  }

  if (result.error) throw result.error;

  const { data } = bucket.getPublicUrl(path);
  return data.publicUrl;
}

export async function callAdminUsers(payload: Record<string, unknown>) {
  const client = sb();
  await ensureFreshAdminSession();

  let result = await client.functions.invoke("admin-users", {
    body: payload,
  });

  // Retry once with a freshly refreshed JWT when the Edge Function rejects
  // the access token at the platform level.
  if (result.error && responseStatus(result.error) === 401) {
    await refreshAdminSession();
    result = await client.functions.invoke("admin-users", {
      body: payload,
    });
  }

  if (result.error) {
    throw await normalizeFunctionError(result.error);
  }

  if (result.data?.error) throw new Error(String(result.data.error));
  return result.data;
}
