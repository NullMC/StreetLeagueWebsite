import { supabase } from "./supabase";
import { optimizeImage } from "./imageCompress";

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

export async function ensureFreshAdminSession() {
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
    profile.role !== "super_admin"
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

/** Files are uniquely named and never overwritten, so browsers and the CDN can keep them for a year. */
const MEDIA_CACHE_SECONDS = "31536000";

export async function uploadMedia(original: File, folder: string) {
  const client = sb();
  // Resize and re-encode before upload: every byte served counts towards the Supabase egress quota.
  const file = await optimizeImage(original, folder);
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = crypto.randomUUID() + "." + extension;
  const path = folder + "/" + safeName;
  const bucket = client.storage.from("street-league-media");

  // Keep long-lived admin sessions usable even after the browser has been idle.
  await ensureFreshAdminSession();

  let result = await bucket.upload(path, file, {
    upsert: false,
    cacheControl: MEDIA_CACHE_SECONDS,
  });

  // If the stored access token is stale, refresh it once and retry the upload.
  if (result.error && isExpiredJwtError(result.error)) {
    await refreshAdminSession();
    result = await bucket.upload(path, file, {
      upsert: false,
      cacheControl: MEDIA_CACHE_SECONDS,
    });
  }

  if (result.error) throw result.error;

  const { data } = bucket.getPublicUrl(path);
  return data.publicUrl;
}


const MEDIA_BUCKET = "street-league-media";

/** Object path inside the media bucket ("logos/<uuid>.webp"), or null for any other URL. */
export function mediaPathFromUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const marker = "/" + MEDIA_BUCKET + "/";
  const index = value.indexOf(marker);
  if (index < 0) return null;
  const path = decodeURIComponent(value.slice(index + marker.length).split(/[?#]/)[0]);
  return path && !path.includes("..") ? path : null;
}

/**
 * Deletes the given media files, but only those that no record points to any more
 * (checked on the database across every table). Never throws: a failed cleanup
 * must not block saving or deleting a record. Returns the removed paths.
 */
export async function removeUnusedMedia(urls: unknown[]): Promise<string[]> {
  const client = sb();
  const paths = [...new Set(urls.map(mediaPathFromUrl).filter((path): path is string => Boolean(path)))];
  const removable: string[] = [];
  for (const path of paths) {
    const { data, error } = await client.rpc("media_reference_count", { p_path: path });
    // Without the helper (migration 27 missing) nothing is deleted.
    if (error || typeof data !== "number") { if (error) console.warn("Controllo media non riuscito:", error.message); continue; }
    if (data === 0) removable.push(path);
  }
  if (!removable.length) return [];
  const { error } = await client.storage.from(MEDIA_BUCKET).remove(removable);
  if (error) { console.warn("Eliminazione media non riuscita:", error.message); return []; }
  return removable;
}

export type UnusedMedia = { name: string; size: number; created_at: string };

/** Files older than one day that no record uses (admin only). */
export async function listUnusedMedia(): Promise<UnusedMedia[]> {
  const client = sb();
  const { data, error } = await client.rpc("list_unused_media");
  if (error) throw error;
  return ((data ?? []) as UnusedMedia[]).map((row) => ({ ...row, size: Number(row.size) }));
}

/** Deletes files listed by listUnusedMedia, re-checking each one first. */
export async function purgeUnusedMedia(names: string[]): Promise<number> {
  const removed = await removeUnusedMedia(names.map((name) => "/" + MEDIA_BUCKET + "/" + name));
  return removed.length;
}
