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

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session) {
    return null;
  }

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

export async function uploadMedia(file: File, folder: string) {
  const client = sb();
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = `${crypto.randomUUID()}.${extension}`;
  const path = `${folder}/${safeName}`;

  const { error } = await client.storage
    .from("street-league-media")
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
    });

  if (error) throw error;

  const { data } = client.storage
    .from("street-league-media")
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function callAdminUsers(payload: Record<string, unknown>) {
  const client = sb();
  const { data, error } = await client.functions.invoke("admin-users", {
    body: payload,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
