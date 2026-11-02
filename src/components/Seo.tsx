import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  getActiveCompetitions, getCompetitions, getMatches, getPlayers, getSocialContentById, getStatisticsGroups, getTeams,
} from "../lib/api";

const SITE_URL = "https://streetleaguebari.it";
const SITE_NAME = "Street League Bari";
const BRAND_NAME = "Street League";
const SITE_DESCRIPTION =
  "Street League Bari: torneo di calcio, competizioni, calendario partite, risultati, squadre e statistiche aggiornate.";
// JPEG 1920×1080 con estensione corretta: i crawler social leggono tipo e dimensioni senza indovinare.
const SOCIAL_IMAGE = `${SITE_URL}/assets/og-street-league.jpg`;
const SOCIAL_IMAGE_WIDTH = "1920";
const SOCIAL_IMAGE_HEIGHT = "1080";
const LOGO_IMAGE = `${SITE_URL}/assets/logo.png`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOCIAL_PROFILES = [
  "https://www.instagram.com/__streetleague__/",
  "https://www.youtube.com/@streetleague2k25",
  "https://www.tiktok.com/@_streetleague_?lang=en",
];

type SeoConfig = {
  title: string;
  description: string;
  indexable?: boolean;
  /** og:type: "article" per gli articoli, "profile" per i giocatori, altrimenti "website". */
  type?: "website" | "article" | "profile";
  publishedTime?: string;
};
type Breadcrumb = { name: string; url: string };
type ResolvedSeo = {
  config: SeoConfig;
  mainEntity?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
  shareImage?: string;
};

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return (pathname.startsWith("/") ? pathname : `/${pathname}`).replace(/\/+$/, "") || "/";
}

function decodeSegment(value: string | undefined): string {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Testo semplice da HTML formattato (articoli), con spazi normalizzati. */
function plainText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Taglia sul confine di parola: descrizioni entro ~155 caratteri, titoli entro il limite dato. */
function clip(value: string, max = 155): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

const STAT_TITLES: Record<string, string> = {
  goals: "Classifica marcatori",
  mvps: "Classifica MVP",
  goalkeepers: "Classifica portieri",
  clean_sheets: "Classifica portieri",
  staff: "Classifica staff",
};

function getSeo(pathname: string): SeoConfig {
  const path = normalizePath(pathname);
  if (path === "/") return {
    title: "Street League Bari | Torneo di calcio e classifiche",
    description: SITE_DESCRIPTION,
  };
  if (path === "/calciomercato") return {
    title: `Calcio mercato | ${SITE_NAME}`,
    description: "Scopri i nuovi innesti e i trasferimenti delle squadre Street League, con sei slot unici per squadra.",
  };
  if (path === "/competizioni" || path.startsWith("/competizioni/")) return {
    title: `Competizioni di calcio | ${SITE_NAME}`,
    description: "Consulta competizioni, gironi, squadre partecipanti e risultati della Street League Bari.",
  };
  if (path === "/classifica") return {
    title: `Classifiche e risultati | ${SITE_NAME}`,
    description: "Consulta le classifiche delle competizioni Street League, i punti e i risultati delle squadre.",
  };
  if (path === "/squadre") return {
    title: `Squadre | ${SITE_NAME}`,
    description: "Consulta le squadre della Street League Bari nella pagina principale.",
    indexable: false,
  };
  if (path.startsWith("/squadre/")) return {
    title: `Squadra | ${SITE_NAME}`,
    description: "Profilo della squadra, rosa dei giocatori e partite nella Street League Bari.",
  };
  if (path.startsWith("/giocatori/")) return {
    title: `Giocatore | ${SITE_NAME}`,
    description: "Profilo del giocatore, statistiche e rendimento nelle competizioni Street League.",
  };
  if (path.startsWith("/statistiche/")) {
    const statKey = decodeSegment(path.split("/").filter(Boolean).at(-1));
    const statTitle = STAT_TITLES[statKey] ?? "Classifica statistiche";
    return {
      title: `${statTitle} | ${SITE_NAME}`,
      description: `Consulta la ${statTitle.toLocaleLowerCase("it")} delle competizioni attive Street League Bari.`,
    };
  }
  if (path === "/statistiche") return {
    title: `Statistiche dei giocatori | ${SITE_NAME}`,
    description: "Marcatori, MVP, clean sheet e statistiche disciplinari delle competizioni Street League Bari.",
  };
  if (path.startsWith("/partite/")) return {
    title: `Partita | ${SITE_NAME}`,
    description: "Dettagli della partita Street League: risultato, squadre, eventi e formazioni.",
  };
  if (path.startsWith("/articoli/")) return {
    title: `Articolo | ${SITE_NAME}`,
    description: "Racconti, risultati e protagonisti della Street League Bari.",
    type: "article",
  };
  if (path === "/partner") return {
    title: `Sponsor e collaborazioni | ${SITE_NAME}`,
    description: "Scopri gli sponsor della Street League Bari e le opportunità di collaborazione con il torneo.",
  };
  if (path === "/admin" || path.startsWith("/admin/")) return {
    title: `Area riservata | ${SITE_NAME}`,
    description: "Area operativa riservata Street League.",
    indexable: false,
  };
  if (path === "/collabora") return {
    title: `Collabora con Street League | ${SITE_NAME}`,
    description: "Contatta Street League Bari per valutare una collaborazione o una sponsorizzazione.",
    indexable: false,
  };
  return {
    title: `Pagina non trovata | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    indexable: false,
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

function removeMeta(selector: string) {
  document.querySelectorAll(selector).forEach((node) => node.remove());
}

function upsertProperty(property: string, content: string) {
  let node = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute("property", property);
    document.head.appendChild(node);
  }
  node.content = content;
}

function absoluteImageUrl(value: string | null | undefined): string {
  if (!value?.trim()) return SOCIAL_IMAGE;
  try {
    const url = new URL(value, `${SITE_URL}/`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : SOCIAL_IMAGE;
  } catch {
    return SOCIAL_IMAGE;
  }
}

function isDynamicEntityPath(pathname: string): boolean {
  const parts = normalizePath(pathname).split("/").filter(Boolean);
  if (parts[0] === "competizioni") {
    return parts.length === 2 || (parts[1] === "gruppo" && parts.length >= 3);
  }
  if (parts[0] === "statistiche") return parts.length === 3;
  return ["squadre", "giocatori", "partite", "articoli"].includes(parts[0]) && parts.length === 2;
}

function canonicalFor(pathname: string): string {
  return new URL(normalizePath(pathname), `${SITE_URL}/`).href;
}

function upsertCanonical(url: string) {
  let node = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!node) {
    node = document.createElement("link");
    node.rel = "canonical";
    document.head.appendChild(node);
  }
  node.href = url;
}

function organizationSchema() {
  return {
    "@type": "SportsOrganization",
    "@id": ORGANIZATION_ID,
    name: BRAND_NAME,
    alternateName: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    logo: { "@type": "ImageObject", url: LOGO_IMAGE, width: 581, height: 430 },
    image: SOCIAL_IMAGE,
    sport: "Association football",
    areaServed: {
      "@type": "City",
      name: "Bari",
      containedInPlace: { "@type": "Country", name: "Italy" },
    },
    email: "streetleaguebari@gmail.com",
    sameAs: SOCIAL_PROFILES,
  };
}

function createStructuredData(
  canonical: string,
  config: SeoConfig,
  breadcrumbs: Breadcrumb[],
  mainEntity?: Record<string, unknown>,
) {
  const graph: Record<string, unknown>[] = [
    organizationSchema(),
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: BRAND_NAME,
      inLanguage: "it-IT",
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: config.title,
      description: config.description,
      inLanguage: "it-IT",
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      about: { "@id": ORGANIZATION_ID },
      ...(mainEntity ? { mainEntity } : {}),
    },
  ];
  if (breadcrumbs.length > 1) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function upsertStructuredData(data: Record<string, unknown>) {
  let node = document.getElementById("street-league-seo-jsonld") as HTMLScriptElement | null;
  if (!node) {
    node = document.createElement("script");
    node.id = "street-league-seo-jsonld";
    node.type = "application/ld+json";
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

function breadcrumbsFor(pathname: string, config: SeoConfig, canonical: string): Breadcrumb[] {
  const path = normalizePath(pathname);
  if (path === "/") return [{ name: "Home", url: `${SITE_URL}/` }];
  // Solo genitori indicizzabili: /squadre reindirizza alla home e non compare nelle briciole.
  let parent: Breadcrumb | undefined;
  if (path.startsWith("/competizioni/") || path.startsWith("/partite/")) parent = { name: "Competizioni", url: `${SITE_URL}/competizioni` };
  else if (path.startsWith("/statistiche/")) parent = { name: "Statistiche", url: `${SITE_URL}/statistiche` };
  return [
    { name: "Home", url: `${SITE_URL}/` },
    ...(parent ? [parent] : []),
    { name: config.title.split(" | ")[0], url: canonical },
  ];
}

function applySeo(pathname: string, resolved: ResolvedSeo) {
  const path = normalizePath(pathname);
  const { config } = resolved;
  const canonical = canonicalFor(path);
  const shareImage = absoluteImageUrl(resolved.shareImage);
  const hasCustomShareImage = Boolean(resolved.shareImage && shareImage !== SOCIAL_IMAGE);
  const shareImageAlt = hasCustomShareImage
    ? `${config.title.split(" | ")[0]} — Street League`
    : "Street League Bari — calcio, competizioni e community";
  const description = clip(config.description);
  const robots = config.indexable === false
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  document.title = config.title;
  upsertMeta("description", description);
  upsertMeta("robots", robots);
  upsertMeta("googlebot", robots);
  upsertMeta("author", BRAND_NAME);

  upsertProperty("og:site_name", BRAND_NAME);
  upsertProperty("og:locale", "it_IT");
  upsertProperty("og:title", config.title);
  upsertProperty("og:description", description);
  upsertProperty("og:type", config.type ?? "website");
  upsertProperty("og:url", canonical);
  upsertProperty("og:image", shareImage);
  upsertProperty("og:image:alt", shareImageAlt);
  if (hasCustomShareImage) {
    removeMeta('meta[property="og:image:width"], meta[property="og:image:height"], meta[property="og:image:type"]');
  } else {
    upsertProperty("og:image:width", SOCIAL_IMAGE_WIDTH);
    upsertProperty("og:image:height", SOCIAL_IMAGE_HEIGHT);
    upsertProperty("og:image:type", "image/jpeg");
  }
  if (config.type === "article" && config.publishedTime) {
    upsertProperty("article:published_time", config.publishedTime);
    upsertProperty("article:section", "Street League");
  } else {
    removeMeta('meta[property^="article:"]');
  }

  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:title", config.title);
  upsertMeta("twitter:description", description);
  upsertMeta("twitter:image", shareImage);
  upsertMeta("twitter:image:alt", shareImageAlt);
  upsertCanonical(canonical);
  upsertStructuredData(
    createStructuredData(
      canonical,
      { ...config, description },
      resolved.breadcrumbs ?? breadcrumbsFor(path, config, canonical),
      resolved.mainEntity,
    ),
  );
}

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** " · 4 nov 2026": rende univoci i titoli di andata e ritorno tra le stesse squadre (uguale al prerender). */
function matchDateLabel(value: string | null | undefined): string {
  const iso = isoDate(value);
  if (!iso) return "";
  return " · " + new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}

async function resolveDynamicSeo(pathname: string, fallback: SeoConfig): Promise<ResolvedSeo> {
  const path = normalizePath(pathname);
  const parts = path.split("/").filter(Boolean).map(decodeSegment);

  if (parts[0] === "competizioni" && parts[1] === "gruppo" && parts[2]) {
    const groupName = parts.slice(2).join("/");
    const competitions = await getCompetitions();
    // Stesso criterio della pagina: solo competizioni attive del gruppo (le altre mostrano "non trovata").
    const members = competitions.filter((item) =>
      item.status === "active" && item.statistics_group?.trim() === groupName.trim(),
    );
    if (!members.length) return { config: { ...fallback, indexable: false } };
    const name = members[0].statistics_group?.trim() || groupName;
    const canonical = canonicalFor(path);
    const config = {
      title: `${name} | Competizioni di calcio | ${SITE_NAME}`,
      description: `Consulta squadre, partite e statistiche del gruppo ${name} nella Street League Bari.`,
    };
    return {
      config,
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Competizioni", url: `${SITE_URL}/competizioni` },
        { name, url: canonical },
      ],
      mainEntity: { "@type": "SportsEvent", name, url: canonical, sport: "Association football", organizer: { "@id": ORGANIZATION_ID } },
    };
  }

  if (parts[0] === "competizioni" && parts.length === 2) {
    const competitions = await getCompetitions();
    const competition = competitions.find((item) => item.id === parts[1] && item.status === "active");
    if (!competition) return { config: { ...fallback, indexable: false } };
    const season = competition.season_label ? ` — stagione ${competition.season_label}` : "";
    const config = {
      title: `${competition.name} | ${SITE_NAME}`,
      description: `Calendario, squadre e risultati di ${competition.name}${season} nella Street League Bari.`,
    };
    const canonical = canonicalFor(path);
    const entity: Record<string, unknown> = {
      "@type": "SportsEvent", name: competition.name, url: canonical,
      sport: "Association football", organizer: { "@id": ORGANIZATION_ID },
    };
    const startDate = isoDate(competition.start_date);
    const endDate = isoDate(competition.end_date);
    if (startDate) entity.startDate = startDate;
    if (endDate) entity.endDate = endDate;
    return {
      config, mainEntity: entity,
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Competizioni", url: `${SITE_URL}/competizioni` },
        { name: competition.name, url: canonical },
      ],
    };
  }

  if (parts[0] === "squadre" && parts.length === 2) {
    const teams = await getTeams();
    const team = teams.find((item) => item.id === parts[1] || item.slug === parts[1]);
    if (!team) return { config: { ...fallback, indexable: false } };
    const canonical = canonicalFor(path);
    const config = {
      title: `${team.name} | Squadre | ${SITE_NAME}`,
      description: `Scopri la rosa, i giocatori e le partite di ${team.name} nella Street League Bari.`,
    };
    return {
      config,
      shareImage: team.logo_url || undefined,
      mainEntity: {
        "@type": "SportsTeam", name: team.name, url: canonical,
        ...(team.logo_url ? { logo: absoluteImageUrl(team.logo_url), image: absoluteImageUrl(team.logo_url) } : {}),
        sport: "Association football", memberOf: { "@id": ORGANIZATION_ID },
      },
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: team.name, url: canonical },
      ],
    };
  }

  if (parts[0] === "giocatori" && parts.length === 2) {
    const [players, teams] = await Promise.all([getPlayers(), getTeams()]);
    const player = players.find((item) => item.id === parts[1]);
    if (!player) return { config: { ...fallback, indexable: false } };
    const team = teams.find((item) => item.id === player.team_id);
    const name = `${player.first_name} ${player.last_name}`.trim();
    const canonical = canonicalFor(path);
    const image = player.profile_image_url || player.bg_less_image_url;
    const config: SeoConfig = {
      title: team ? `${name} – ${team.name} | ${SITE_NAME}` : `${name} | Giocatori | ${SITE_NAME}`,
      description: `Profilo e statistiche di ${name}${team ? ` della squadra ${team.name}` : ""}, nella Street League Bari.`,
      type: "profile",
    };
    return {
      config,
      shareImage: image || undefined,
      mainEntity: {
        "@type": "Person", name, url: canonical, ...(image ? { image: absoluteImageUrl(image) } : {}),
        ...(team ? { memberOf: { "@type": "SportsTeam", name: team.name, url: `${SITE_URL}/squadre/${encodeURIComponent(team.id)}` } } : {}),
      },
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        ...(team ? [{ name: team.name, url: `${SITE_URL}/squadre/${encodeURIComponent(team.id)}` }] : []),
        { name, url: canonical },
      ],
    };
  }

  if (parts[0] === "partite" && parts.length === 2) {
    const [matches, teams, competitions] = await Promise.all([getMatches(), getTeams(), getCompetitions()]);
    const match = matches.find((item) => item.id === parts[1]);
    if (!match) return { config: { ...fallback, indexable: false } };
    const home = teams.find((team) => team.id === match.home_team_id);
    const away = teams.find((team) => team.id === match.away_team_id);
    const competition = competitions.find((item) => item.id === match.competition_id);
    const homeName = home?.name ?? "Casa";
    const awayName = away?.name ?? "Trasferta";
    const name = `${homeName} – ${awayName}`;
    const result = match.status === "finished" && match.home_score !== null && match.away_score !== null
      ? ` Risultato: ${match.home_score}-${match.away_score}.` : "";
    const config = {
      title: `${name}${matchDateLabel(match.kickoff_at)} | Partita | ${SITE_NAME}`,
      description: `${name}.${result} Dettagli, eventi e formazioni della Street League Bari${competition ? ` — ${competition.name}` : ""}.`,
    };
    const canonical = canonicalFor(path);
    const eventStatus = match.status === "finished" ? "https://schema.org/EventCompleted"
      : match.status === "live" ? "https://schema.org/EventInProgress"
      : match.status === "postponed" ? "https://schema.org/EventPostponed"
      : "https://schema.org/EventScheduled";
    const startDate = isoDate(match.kickoff_at);
    const event: Record<string, unknown> = {
      "@type": "SportsEvent", name, url: canonical, eventStatus,
      sport: "Association football", organizer: { "@id": ORGANIZATION_ID },
      ...(startDate ? { startDate } : {}),
      ...(match.venue ? { location: { "@type": "Place", name: match.venue } } : {}),
      ...(home ? { homeTeam: { "@type": "SportsTeam", name: home.name, url: `${SITE_URL}/squadre/${encodeURIComponent(home.id)}` } } : {}),
      ...(away ? { awayTeam: { "@type": "SportsTeam", name: away.name, url: `${SITE_URL}/squadre/${encodeURIComponent(away.id)}` } } : {}),
      ...(competition ? { superEvent: { "@type": "SportsEvent", name: competition.name, url: `${SITE_URL}/competizioni/${encodeURIComponent(competition.id)}` } } : {}),
      ...(match.status === "finished" && match.home_score !== null && match.away_score !== null
        ? { description: `Risultato finale: ${homeName} ${match.home_score} - ${match.away_score} ${awayName}.` } : {}),
    };
    return {
      config, mainEntity: event,
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Competizioni", url: `${SITE_URL}/competizioni` },
        { name, url: canonical },
      ],
    };
  }

  if (parts[0] === "statistiche" && parts.length === 3) {
    const statTitle = STAT_TITLES[parts[2]];
    if (!statTitle) return { config: { ...fallback, indexable: false } };
    const groups = await getStatisticsGroups(await getActiveCompetitions());
    const group = groups.find((item) => item.id === parts[1]);
    if (!group) return { config: { ...fallback, indexable: false } };
    const canonical = canonicalFor(path);
    const label = `${statTitle} ${group.name}`;
    return {
      config: {
        title: `${label} | ${SITE_NAME}`,
        description: `${label}: la graduatoria aggiornata dei giocatori della Street League Bari, partita dopo partita.`,
      },
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Statistiche", url: `${SITE_URL}/statistiche` },
        { name: label, url: canonical },
      ],
    };
  }

  if (parts[0] === "articoli" && parts.length === 2) {
    const article = await getSocialContentById(parts[1]);
    if (!article?.title) return { config: { ...fallback, indexable: false } };
    const canonical = canonicalFor(path);
    const body = plainText(article.article_body) || plainText(article.description);
    const image = article.thumbnail_url || article.image_url || undefined;
    const published = isoDate(article.published_at);
    const config: SeoConfig = {
      title: `${clip(article.title, 70)} | ${SITE_NAME}`,
      description: body || `${article.title}: il racconto della Street League Bari.`,
      type: "article",
      publishedTime: published,
    };
    return {
      config,
      shareImage: image,
      mainEntity: {
        "@type": "NewsArticle",
        headline: clip(article.title, 110),
        url: canonical,
        mainEntityOfPage: { "@id": `${canonical}#webpage` },
        ...(body ? { description: clip(body), articleBody: body } : {}),
        image: [image ? absoluteImageUrl(image) : SOCIAL_IMAGE],
        ...(published ? { datePublished: published, dateModified: published } : {}),
        inLanguage: "it-IT",
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
      },
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: clip(article.title, 70), url: canonical },
      ],
    };
  }

  return { config: fallback };
}

export function Seo() {
  const { pathname } = useLocation();
  useEffect(() => {
    let active = true;
    const fallback = getSeo(pathname);
    const canonical = canonicalFor(pathname);
    const existingCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    const hasMatchingPrerenderedMetadata = existingCanonical === canonical;

    // Preserve build-generated metadata while the dynamic page data is loading.
    // Client navigation still gets an immediate fallback because its canonical
    // points to the page that was open before this route change.
    if (!hasMatchingPrerenderedMetadata) applySeo(pathname, { config: fallback });

    void resolveDynamicSeo(pathname, fallback).then((resolved) => {
      if (!active) return;

      // If a direct-loaded prerendered entity cannot be re-read momentarily,
      // keep its specific title, canonical, social image and structured data.
      if (
        hasMatchingPrerenderedMetadata &&
        resolved.config.title === fallback.title &&
        !resolved.mainEntity &&
        !resolved.breadcrumbs
      ) return;

      applySeo(pathname, resolved);
    }).catch((error) => {
      console.warn("SEO metadata fallback:", error);
      // Never leave an unresolved detail URL looking like an indexable generic page.
      if (active && !hasMatchingPrerenderedMetadata && isDynamicEntityPath(pathname)) {
        applySeo(pathname, { config: { ...fallback, indexable: false } });
      }
    });
    return () => { active = false; };
  }, [pathname]);
  return null;
}
