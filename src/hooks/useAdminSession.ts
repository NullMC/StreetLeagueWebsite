import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getCurrentAdminProfile, type AdminProfile } from "../lib/admin";

export function useAdminSession() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadProfile() {
      try {
        const currentProfile = await getCurrentAdminProfile();

        if (mounted) {
          setProfile(currentProfile?.is_active ? currentProfile : null);
        }
      } catch (error) {
        console.error("Errore caricamento profilo admin:", error);

        if (mounted) {
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        // Evitiamo di effettuare query Supabase
        // direttamente dentro il callback realtime.
        setTimeout(() => {
          if (mounted) {
            void loadProfile();
          }
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    profile,
    loading,
    isAuthenticated: profile !== null,
  };
}
