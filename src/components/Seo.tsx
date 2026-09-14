import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Street League";
const DEFAULT_DESCRIPTION =
  "Street League: competizioni, partite, squadre, giocatori e statistiche del torneo.";

type SeoConfig = {
  title: string;
  description: string;
};

function getSeo(pathname: string): SeoConfig {
  if (pathname === "/") {
    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
    };
  }
  if (pathname === "/competizioni" || pathname.startsWith("/competizioni/")) {
    return {
      title: `Competizioni | ${SITE_NAME}`,
      description: "Scopri le competizioni e i relativi dettagli.",
    };
  }
  if (pathname === "/classifica") {
    return {
      title: `Classifica | ${SITE_NAME}`,
      description: "Classifica aggiornata sulla base dei risultati registrati.",
    };
  }
  if (pathname === "/squadre" || pathname.startsWith("/squadre/")) {
    return {
      title: `Squadre | ${SITE_NAME}`,
      description: "Squadre e rose della Street League.",
    };
  }
  if (pathname === "/giocatori" || pathname.startsWith("/giocatori/")) {
    return {
      title: `Giocatori | ${SITE_NAME}`,
      description: "Giocatori, ruoli e statistiche della Street League.",
    };
  }
  if (pathname === "/statistiche") {
    return {
      title: `Statistiche | ${SITE_NAME}`,
      description: "Statistiche dei giocatori calcolate dai dati delle gare.",
    };
  }
  if (pathname === "/partite" || pathname.startsWith("/partite/")) {
    return {
      title: `Partite | ${SITE_NAME}`,
      description: "Calendario, risultati ed eventi delle partite.",
    };
  }
  if (pathname === "/partner") {
    return {
      title: `Partner | ${SITE_NAME}`,
      description: "I partner che sostengono la Street League.",
    };
  }
  if (pathname === "/collabora") {
    return {
      title: `Collabora | ${SITE_NAME}`,
      description: "Scopri come collaborare con Street League.",
    };
  }
  if (pathname === "/admin") {
    return {
      title: `Admin | ${SITE_NAME}`,
      description: "Area riservata di gestione Street League.",
    };
  }
  return {
    title: `Pagina non trovata | ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
  };
}

function upsertMeta(name: string, content: string) {
  let node = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.name = name;
    document.head.appendChild(node);
  }
  node.content = content;
}

function upsertProperty(property: string, content: string) {
  let node = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
  }
  node.content = content;
}

export function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const config = getSeo(pathname);
    const canonical = new URL(pathname, window.location.origin).href;
    const noindex = pathname === "/admin" || pathname.startsWith("/admin/");

    document.title = config.title;
    upsertMeta("description", config.description);
    upsertMeta("robots", noindex ? "noindex,nofollow" : "index,follow");

    upsertProperty("og:title", config.title);
    upsertProperty("og:description", config.description);
    upsertProperty("og:type", "website");
    upsertProperty("og:url", canonical);

    upsertMeta("twitter:card", "summary");
    upsertMeta("twitter:title", config.title);
    upsertMeta("twitter:description", config.description);

    let canonicalLink = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
  }, [pathname]);

  return null;
}
