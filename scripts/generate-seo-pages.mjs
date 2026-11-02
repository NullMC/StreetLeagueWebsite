import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = "https://streetleaguebari.it";
const SITE_NAME = "Street League Bari";
const BRAND_NAME = "Street League";
const SITE_DESCRIPTION =
  "Street League Bari: torneo di calcio, competizioni, calendario partite, risultati, squadre e statistiche aggiornate.";
// JPEG 1920×1080 con estensione corretta (il vecchio .webp era un JPEG rinominato).
const SOCIAL_IMAGE = `${SITE_URL}/assets/og-street-league.jpg`;
const LOGO_IMAGE = `${SITE_URL}/assets/logo.png`;
const STAT_PAGES = [
  { key: "goals", title: "Classifica marcatori" },
  { key: "mvps", title: "Classifica MVP" },
  { key: "goalkeepers", title: "Classifica portieri" },
  { key: "staff", title: "Classifica staff" },
];
/** Link principali, ripetuti nel contenuto statico di ogni pagina per i crawler senza JavaScript. */
const PRIMARY_LINKS = [
  { href: "/", label: "Home" },
  { href: "/competizioni", label: "Competizioni" },
  { href: "/classifica", label: "Classifiche" },
  { href: "/statistiche", label: "Statistiche" },
  { href: "/calciomercato", label: "Calciomercato" },
  { href: "/partner", label: "Sponsor e collaborazioni" },
];
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOCIAL_PROFILES = [
  "https://www.instagram.com/__streetleague__/",
  "https://www.youtube.com/@streetleague2k25",
  "https://www.tiktok.com/@_streetleague_?lang=en",
];
const PAGE_SIZE = 1000;

const staticPages = [
  { path: "/", title: "Street League Bari | Torneo di calcio e classifiche", description: SITE_DESCRIPTION },
  { path: "/competizioni", title: "Competizioni di calcio | Street League Bari", description: "Consulta competizioni, gironi, squadre partecipanti e risultati della Street League Bari." },
  { path: "/calciomercato", title: "Calcio mercato | Street League Bari", description: "Scopri i nuovi innesti e i trasferimenti delle squadre Street League, con sei slot unici per squadra." },
  { path: "/classifica", title: "Classifiche e risultati | Street League Bari", description: "Consulta le classifiche delle competizioni Street League, i punti e i risultati delle squadre." },
  { path: "/statistiche", title: "Statistiche dei giocatori | Street League Bari", description: "Marcatori, MVP, clean sheet e statistiche disciplinari delle competizioni Street League Bari." },
  { path: "/partner", title: "Sponsor e collaborazioni | Street League Bari", description: "Scopri gli sponsor della Street League Bari e le opportunità di collaborazione con il torneo." },
  { path: "/admin", title: "Area riservata | Street League Bari", description: "Area operativa riservata Street League.", indexable: false },
  { path: "/collabora", title: "Collabora con Street League | Street League Bari", description: "Contatta Street League Bari per valutare una collaborazione o una sponsorizzazione.", indexable: false },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function canonicalFor(route) {
  const url = new URL(route, `${SITE_URL}/`);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.href;
}
function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
/** " · 4 nov 2026": rende univoci i titoli di andata e ritorno tra le stesse squadre (uguale al client). */
function matchDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return " · " + date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}
/** Taglia sul confine di parola (descrizioni entro ~155 caratteri). */
function clip(value, max = 155) {
  const text = String(value ?? "");
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}
function isoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function setTitle(html, title) {
  const tag = `<title>${escapeHtml(title)}</title>`;
  return /<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag)
    : html.replace("</head>", `    ${tag}\n  </head>`);
}
function setMeta(html, attribute, key, value) {
  const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}\\s*=\\s*["']${keyPattern}["'])[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}
function setCanonical(html, canonical) {
  const pattern = /<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeHtml(canonical)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}
function getOrganizationSchema() {
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
function defaultBreadcrumbs(route, page, canonical) {
  if (route === "/") return [{ name: "Home", url: `${SITE_URL}/` }];
  // Solo genitori indicizzabili: /squadre reindirizza alla home e non compare nelle briciole.
  const parent = route.startsWith("/competizioni/") || route.startsWith("/partite/")
    ? { name: "Competizioni", url: `${SITE_URL}/competizioni` }
    : route.startsWith("/statistiche/")
      ? { name: "Statistiche", url: `${SITE_URL}/statistiche` }
      : null;
  return [
    { name: "Home", url: `${SITE_URL}/` },
    ...(parent ? [parent] : []),
    { name: page.title.split(" | ")[0], url: canonical },
  ];
}
function makeJsonLd(route, page, canonical, mainEntity) {
  const graph = [
    getOrganizationSchema(),
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
      name: page.title,
      description: page.description,
      inLanguage: "it-IT",
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      about: { "@id": ORGANIZATION_ID },
      ...(mainEntity ? { mainEntity } : {}),
    },
  ];
  const crumbs = page.breadcrumbs ?? defaultBreadcrumbs(route, page, canonical);
  if (crumbs.length > 1) graph.push({
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: crumbs.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: item.url,
    })),
  });
  return { "@context": "https://schema.org", "@graph": graph };
}
function absoluteImageUrl(value) {
  if (!value || !String(value).trim()) return SOCIAL_IMAGE;
  try {
    const url = new URL(String(value), `${SITE_URL}/`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : SOCIAL_IMAGE;
  } catch {
    return SOCIAL_IMAGE;
  }
}
function renderHtml(template, route, page) {
  const canonical = canonicalFor(route);
  const shareImage = absoluteImageUrl(page.shareImage);
  const hasCustomShareImage = Boolean(page.shareImage && shareImage !== SOCIAL_IMAGE);
  const shareImageAlt = hasCustomShareImage ? `${page.title.split(" | ")[0]} — Street League` : "Street League Bari — calcio, competizioni e community";
  const robots = page.indexable === false
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  page = { ...page, description: clip(page.description) };
  let html = setTitle(template, page.title);
  for (const [name, value] of Object.entries({
    description: page.description,
    robots,
    googlebot: robots,
    author: BRAND_NAME,
    "twitter:card": "summary_large_image",
    "twitter:title": page.title,
    "twitter:description": page.description,
    "twitter:image": shareImage,
    "twitter:image:alt": shareImageAlt,
  })) html = setMeta(html, "name", name, value);
  for (const [property, value] of Object.entries({
    "og:site_name": BRAND_NAME,
    "og:locale": "it_IT",
    "og:type": page.type ?? "website",
    "og:title": page.title,
    "og:description": page.description,
    "og:url": canonical,
    "og:image": shareImage,
    "og:image:alt": shareImageAlt,
    ...(page.publishedTime ? { "article:published_time": page.publishedTime, "article:section": "Street League" } : {}),
  })) html = setMeta(html, "property", property, value);
  if (hasCustomShareImage) {
    html = html.replace(/\s*<meta\b(?=[^>]*\bproperty\s*=\s*["']og:image:(?:width|height|type)["'])[^>]*>/gi, "");
  }
  html = setCanonical(html, canonical);
  const schema = makeJsonLd(route, page, canonical, page.mainEntity);
  const schemaTag = `<script type="application/ld+json" id="street-league-seo-jsonld">${escapeJsonLd(schema)}</script>`;
  const schemaPattern = /<script\b(?=[^>]*\bid\s*=\s*["']street-league-seo-jsonld["'])[^>]*>[\s\S]*?<\/script>/i;
  html = schemaPattern.test(html) ? html.replace(schemaPattern, schemaTag) : html.replace("</head>", `    ${schemaTag}\n  </head>`);
  return html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${renderNoscript(page)}`);
}
/**
 * Contenuto statico per i crawler che non eseguono JavaScript: titolo, descrizione e
 * link interni della pagina. Il browser lo ignora (noscript) e React disegna la pagina.
 */
function renderNoscript(page) {
  const heading = page.heading ?? page.title.split(" | ")[0];
  const links = [...(page.links ?? []), ...PRIMARY_LINKS]
    .filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index)
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join("");
  const body = page.body ? `<p>${escapeHtml(page.body)}</p>` : "";
  return `<noscript><main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(page.description)}</p>${body}<nav aria-label="Street League"><ul>${links}</ul></nav></main></noscript>`;
}
function outputPathForRoute(route) {
  if (route === "/") return path.join(DIST, "index.html");
  const segments = route.split("/").filter(Boolean).map((segment) => {
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch {}
    if (!decoded || decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw new Error(`Unsafe route segment: ${segment}`);
    }
    return decoded;
  });
  return path.join(DIST, ...segments, "index.html");
}
async function writeRoute(template, route, page) {
  const destination = outputPathForRoute(route);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, renderHtml(template, route, page), "utf8");
}
async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
    try {
      const content = await readFile(path.join(ROOT, file), "utf8");
      const line = content.split(/\r?\n/).find((row) => row.match(new RegExp(`^\\s*${name}\\s*=`)));
      if (line) {
        let value = line.slice(line.indexOf("=") + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        else value = value.replace(/\s+#.*$/, "");
        if (value) return value;
      }
    } catch {}
  }
  return "";
}
async function loadPublicTable(baseUrl, key, table, select) {
  const all = [];
  for (let offset = 0; offset < 10000; offset += PAGE_SIZE) {
    const url = new URL(`/rest/v1/${table}`, baseUrl);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Supabase read failed for ${table}: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Unexpected Supabase response for ${table}`);
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}
function makeBreadcrumbs(items) {
  return items.map((item) => ({ name: item.name, url: canonicalFor(item.path) }));
}
function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
/** Voci della sitemap: percorso, data di ultima modifica (se nota) e immagine principale. */
function sitemapEntry(route, page = {}) {
  return { route, lastmod: page.lastmod, image: page.shareImage ? absoluteImageUrl(page.shareImage) : undefined };
}
function buildSitemap(entries) {
  const seen = new Set();
  const rows = entries
    .filter((entry) => entry.route !== "/admin" && !entry.route.startsWith("/admin/"))
    .filter((entry) => !seen.has(entry.route) && seen.add(entry.route))
    .map((entry) => {
      const parts = [`<loc>${xmlEscape(canonicalFor(entry.route))}</loc>`];
      if (entry.lastmod) parts.push(`<lastmod>${xmlEscape(entry.lastmod.slice(0, 10))}</lastmod>`);
      if (entry.image) parts.push(`<image:image><image:loc>${xmlEscape(entry.image)}</image:loc></image:image>`);
      return `  <url>${parts.join("")}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join("\n")}\n</urlset>\n`;
}
async function createDynamicRoutes(template, sitemapRoutes, tables) {
  const { competitions, teams, players, matches, articles } = tables;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  // La pagina di dettaglio mostra solo competizioni attive: le altre sarebbero soft 404.
  const activeCompetitions = competitions.filter((competition) => competition.status === "active");
  for (const competition of activeCompetitions) {
    if (!competition.id || !competition.name) continue;
    const route = `/competizioni/${encodeURIComponent(competition.id)}`;
    const season = competition.season_label ? ` — stagione ${competition.season_label}` : "";
    const page = {
      path: route,
      title: `${competition.name} | Street League Bari`,
      description: `Calendario, squadre e risultati di ${competition.name}${season} nella Street League Bari.`,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" },
        { name: "Competizioni", path: "/competizioni" },
        { name: competition.name, path: route },
      ]),
      mainEntity: {
        "@type": "SportsEvent", name: competition.name, url: canonicalFor(route),
        sport: "Association football", organizer: { "@id": ORGANIZATION_ID },
        ...(competition.start_date ? { startDate: competition.start_date } : {}),
        ...(competition.end_date ? { endDate: competition.end_date } : {}),
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
  const groups = new Map();
  for (const competition of activeCompetitions) {
    const name = String(competition.statistics_group ?? "").trim();
    if (name && !groups.has(name.toLocaleLowerCase("it"))) groups.set(name.toLocaleLowerCase("it"), name);
  }
  for (const name of groups.values()) {
    if (name.includes("/")) continue;
    const route = `/competizioni/gruppo/${encodeURIComponent(name)}`;
    const page = {
      title: `${name} | Competizioni di calcio | Street League Bari`,
      description: `Consulta squadre, partite e statistiche del gruppo ${name} nella Street League Bari.`,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" }, { name: "Competizioni", path: "/competizioni" }, { name, path: route },
      ]),
      mainEntity: { "@type": "SportsEvent", name, url: canonicalFor(route), sport: "Association football", organizer: { "@id": ORGANIZATION_ID } },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
  for (const team of teams) {
    if (!team.id || !team.name) continue;
    const route = `/squadre/${encodeURIComponent(team.id)}`;
    const page = {
      title: `${team.name} | Squadre | Street League Bari`,
      description: `Scopri la rosa, i giocatori e le partite di ${team.name} nella Street League Bari.`,
      shareImage: team.logo_url || undefined,
      breadcrumbs: makeBreadcrumbs([{ name: "Home", path: "/" }, { name: team.name, path: route }]),
      links: players
        .filter((player) => player.team_id === team.id && player.first_name && player.last_name)
        .map((player) => ({ href: `/giocatori/${encodeURIComponent(player.id)}`, label: `${player.first_name} ${player.last_name}`.trim() })),
      mainEntity: {
        "@type": "SportsTeam", name: team.name, url: canonicalFor(route),
        ...(team.logo_url ? { logo: absoluteImageUrl(team.logo_url), image: absoluteImageUrl(team.logo_url) } : {}),
        sport: "Association football", memberOf: { "@id": ORGANIZATION_ID },
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
  for (const player of players) {
    if (!player.id || !player.first_name || !player.last_name) continue;
    const name = `${player.first_name} ${player.last_name}`.trim();
    const team = teamById.get(player.team_id);
    const route = `/giocatori/${encodeURIComponent(player.id)}`;
    const image = player.bg_less_image_url;
    const teamRoute = team ? `/squadre/${encodeURIComponent(team.id)}` : null;
    const page = {
      title: team ? `${name} – ${team.name} | Street League Bari` : `${name} | Giocatori | Street League Bari`,
      description: `Profilo e statistiche di ${name}${team ? ` della squadra ${team.name}` : ""}, nella Street League Bari.`,
      type: "profile",
      shareImage: image || undefined,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" },
        ...(team ? [{ name: team.name, path: teamRoute }] : []),
        { name, path: route },
      ]),
      links: team ? [{ href: teamRoute, label: team.name }] : [],
      mainEntity: {
        "@type": "Person", name, url: canonicalFor(route),
        ...(image ? { image: absoluteImageUrl(image) } : {}),
        ...(team ? { memberOf: { "@type": "SportsTeam", name: team.name, url: canonicalFor(`/squadre/${encodeURIComponent(team.id)}`) } } : {}),
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
  for (const match of matches) {
    if (!match.id) continue;
    const home = teamById.get(match.home_team_id);
    const away = teamById.get(match.away_team_id);
    const competition = competitionById.get(match.competition_id);
    const homeName = home?.name ?? "Casa";
    const awayName = away?.name ?? "Trasferta";
    const name = `${homeName} – ${awayName}`;
    const route = `/partite/${encodeURIComponent(match.id)}`;
    const result = match.status === "finished" && match.home_score != null && match.away_score != null
      ? ` Risultato: ${match.home_score}-${match.away_score}.` : "";
    const status = match.status === "finished" ? "https://schema.org/EventCompleted"
      : match.status === "live" ? "https://schema.org/EventInProgress"
      : match.status === "postponed" ? "https://schema.org/EventPostponed"
      : "https://schema.org/EventScheduled";
    const page = {
      title: `${name}${matchDateLabel(match.kickoff_at)} | Partita | Street League Bari`,
      description: `${name}.${result} Dettagli, eventi e formazioni della Street League Bari${competition ? ` — ${competition.name}` : ""}.`,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" }, { name: "Competizioni", path: "/competizioni" }, { name, path: route },
      ]),
      links: [
        ...(home ? [{ href: `/squadre/${encodeURIComponent(home.id)}`, label: home.name }] : []),
        ...(away ? [{ href: `/squadre/${encodeURIComponent(away.id)}`, label: away.name }] : []),
        ...(competition ? [{ href: `/competizioni/${encodeURIComponent(competition.id)}`, label: competition.name }] : []),
      ],
      mainEntity: {
        "@type": "SportsEvent", name, url: canonicalFor(route), eventStatus: status,
        sport: "Association football", organizer: { "@id": ORGANIZATION_ID },
        ...(match.kickoff_at ? { startDate: match.kickoff_at } : {}),
        ...(match.venue ? { location: { "@type": "Place", name: match.venue } } : {}),
        ...(home ? { homeTeam: { "@type": "SportsTeam", name: home.name, url: canonicalFor(`/squadre/${encodeURIComponent(home.id)}`) } } : {}),
        ...(away ? { awayTeam: { "@type": "SportsTeam", name: away.name, url: canonicalFor(`/squadre/${encodeURIComponent(away.id)}`) } } : {}),
        ...(competition ? { superEvent: { "@type": "SportsEvent", name: competition.name, url: canonicalFor(`/competizioni/${encodeURIComponent(competition.id)}`) } } : {}),
        ...(result ? { description: cleanText(result) } : {}),
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
}

async function createStatsAndArticleRoutes(template, sitemapRoutes, tables) {
  const { competitions, articles } = tables;
  // Stessi gruppi della pagina Statistiche: competizioni attive unite per statistics_group.
  const groups = new Map();
  for (const competition of competitions.filter((item) => item.status === "active")) {
    const id = String(competition.statistics_group ?? "").trim() || competition.id;
    if (!groups.has(id)) groups.set(id, String(competition.statistics_group ?? "").trim() || competition.name);
  }
  for (const [groupId, groupName] of groups) {
    if (groupId.includes("/")) continue;
    for (const stat of STAT_PAGES) {
      const route = `/statistiche/${encodeURIComponent(groupId)}/${stat.key}`;
      const label = `${stat.title} ${groupName}`;
      const page = {
        title: `${label} | Street League Bari`,
        description: `${label}: la graduatoria aggiornata dei giocatori della Street League Bari, partita dopo partita.`,
        breadcrumbs: makeBreadcrumbs([
          { name: "Home", path: "/" }, { name: "Statistiche", path: "/statistiche" }, { name: label, path: route },
        ]),
      };
      await writeRoute(template, route, page);
      sitemapRoutes.push(sitemapEntry(route, page));
    }
  }
  for (const article of articles) {
    if (!article.id || !article.title) continue;
    const route = `/articoli/${encodeURIComponent(article.id)}`;
    const body = cleanText(article.article_body) || cleanText(article.description);
    const image = article.thumbnail_url || article.image_url || undefined;
    const published = isoDate(article.published_at);
    const headline = clip(article.title, 110);
    const page = {
      title: `${clip(article.title, 70)} | Street League Bari`,
      heading: article.title,
      description: body || `${article.title}: il racconto della Street League Bari.`,
      body: body.length > 155 ? body : undefined,
      type: "article",
      publishedTime: published,
      lastmod: published,
      shareImage: image,
      breadcrumbs: makeBreadcrumbs([{ name: "Home", path: "/" }, { name: clip(article.title, 70), path: route }]),
      mainEntity: {
        "@type": "NewsArticle",
        headline,
        url: canonicalFor(route),
        mainEntityOfPage: { "@id": `${canonicalFor(route)}#webpage` },
        ...(body ? { description: clip(body), articleBody: body } : {}),
        image: [image ? absoluteImageUrl(image) : SOCIAL_IMAGE],
        ...(published ? { datePublished: published, dateModified: published } : {}),
        inLanguage: "it-IT",
        author: { "@id": ORGANIZATION_ID },
        publisher: { "@id": ORGANIZATION_ID },
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(sitemapEntry(route, page));
  }
}

async function main() {
  const template = await readFile(path.join(DIST, "index.html"), "utf8");
  const sitemapRoutes = [];
  for (const page of staticPages) {
    await writeRoute(template, page.path, page);
    if (page.indexable !== false) sitemapRoutes.push(sitemapEntry(page.path, page));
  }

  const baseUrl = await readEnvValue("VITE_SUPABASE_URL");
  const key = (await readEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY")) ||
    (await readEnvValue("VITE_SUPABASE_ANON_KEY"));
  let generatedEntityRoutes = 0;
  if (baseUrl && key) {
    try {
      const [competitions, teams, players, matches, articles] = await Promise.all([
        loadPublicTable(baseUrl, key, "competitions", "id,name,slug,status,season_label,start_date,end_date,statistics_group"),
        loadPublicTable(baseUrl, key, "teams", "id,name,slug,logo_url"),
        loadPublicTable(baseUrl, key, "players", "id,team_id,first_name,last_name,bg_less_image_url"),
        loadPublicTable(baseUrl, key, "matches", "id,competition_id,home_team_id,away_team_id,kickoff_at,status,home_score,away_score,venue"),
        // Gli articoli non devono bloccare il resto: tabella opzionale.
        loadPublicTable(baseUrl, key, "social_contents", "id,title,thumbnail_url,image_url,description,article_body,published_at").catch((error) => {
          console.warn("SEO prerender: articles skipped.", error instanceof Error ? error.message : "");
          return [];
        }),
      ]);
      const before = sitemapRoutes.length;
      await createDynamicRoutes(template, sitemapRoutes, { competitions, teams, players, matches });
      await createStatsAndArticleRoutes(template, sitemapRoutes, { competitions, articles });
      generatedEntityRoutes = sitemapRoutes.length - before;
    } catch (error) {
      console.warn("SEO prerender: dynamic database pages skipped; static pages are still generated.", error instanceof Error ? error.message : "");
    }
  } else {
    console.info("SEO prerender: Supabase build variables unavailable; generating static page metadata only.");
  }

  await writeFile(path.join(DIST, "sitemap.xml"), buildSitemap(sitemapRoutes), "utf8");
  console.info(`SEO prerender complete: ${staticPages.filter((page) => page.indexable !== false).length} static indexable pages and ${generatedEntityRoutes} data pages in the sitemap.`);
}

main().catch((error) => {
  console.error("SEO prerender failed:", error);
  process.exitCode = 1;
});
