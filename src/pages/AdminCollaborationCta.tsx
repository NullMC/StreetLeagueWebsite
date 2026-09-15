import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAuthenticatedAdmin } from "../lib/admin";
import type { AdminProfile } from "../lib/admin";

type Collaboration = {
  id: string;
  title: string;
  cta_url: string | null;
};

export default function AdminCollaborationCta() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [items, setItems] = useState<Collaboration[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const canWrite =
    profile?.role === "super_admin" || profile?.role === "admin";

  const load = async () => {
    if (!supabase || !canWrite) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("active_collaborations")
        .select("id, title, cta_url")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as Collaboration[]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossibile caricare le collaborazioni.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void getAuthenticatedAdmin()
      .then((admin) => {
        if (mounted) setProfile(admin);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [profile?.id, canWrite]);

  const updateLocal = (id: string, value: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, cta_url: value } : item)),
    );
  };

  const save = async (event: FormEvent, item: Collaboration) => {
    event.preventDefault();
    if (!supabase || !canWrite) return;
    setMessage("");
    try {
      const ctaUrl = item.cta_url?.trim() || null;
      if (ctaUrl) {
        const parsed = new URL(ctaUrl);
        if (!/^https?:$/.test(parsed.protocol)) {
          throw new Error("Il link CTA deve iniziare con http:// o https://.");
        }
      }
      const { error } = await supabase
        .from("active_collaborations")
        .update({ cta_url: ctaUrl })
        .eq("id", item.id);
      if (error) throw error;
      setMessage(`CTA aggiornata per “${item.title}”.`);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, cta_url: ctaUrl } : entry,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    }
  };

  if (!canWrite || !items.length) return null;

  return (
    <section className="admin-cta-manager" aria-labelledby="admin-cta-title">
      <div className="admin-cta-manager__inner">
        <div className="admin-cta-manager__head">
          <div>
            <span className="eyebrow">Collab attive / CTA</span>
            <h2 id="admin-cta-title">Link call to action</h2>
            <p>
              Imposta il link aperto dal pulsante <strong>Info ↗</strong> nelle card delle collaborazioni.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="admin-message">Caricamento…</p>
        ) : (
          <div className="admin-cta-manager__list">
            {items.map((item) => (
              <form
                className="admin-cta-manager__row"
                key={item.id}
                onSubmit={(event) => void save(event, item)}
              >
                <div className="admin-cta-manager__title">
                  <strong>{item.title}</strong>
                </div>
                <label>
                  URL CTA
                  <input
                    type="url"
                    value={item.cta_url ?? ""}
                    onChange={(event) => updateLocal(item.id, event.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </label>
                <button className="btn btn--primary btn--small" type="submit">
                  Salva CTA
                </button>
              </form>
            ))}
          </div>
        )}
        {message && <p className="admin-message">{message}</p>}
      </div>
    </section>
  );
}
