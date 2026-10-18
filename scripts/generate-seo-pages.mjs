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
const SOCIAL_IMAGE = `${SITE_URL}/assets/nebula-landscape.webp`;
const LOGO_IMAGE = `${SITE_URL}/assets/pittogrammaBlack.webp`;
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
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
    logo: { "@type": "ImageObject", url: LOGO_IMAGE },
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
  const parent = route.startsWith("/competizioni/")
    ? { name: "Competizioni", url: `${SITE_URL}/competizioni` }
    : route.startsWith("/squadre/") || route.startsWith("/giocatori/")
      ? { name: "Squadre", url: `${SITE_URL}/squadre` }
      : route.startsWith("/partite/")
        ? { name: "Competizioni", url: `${SITE_URL}/competizioni` }
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
  let html = setTitle(template, page.title);
  for (const [name, value] of Object.entries({
    description: page.description,
    robots,
    googlebot: robots,
    author: BRAND_NAME,
    "theme-color": "#010A08",
    "twitter:card": "summary_large_image",
    "twitter:title": page.title,
    "twitter:description": page.description,
    "twitter:image": shareImage,
    "twitter:image:alt": shareImageAlt,
  })) html = setMeta(html, "name", name, value);
  for (const [property, value] of Object.entries({
    "og:site_name": BRAND_NAME,
    "og:locale": "it_IT",
    "og:type": "website",
    "og:title": page.title,
    "og:description": page.description,
    "og:url": canonical,
    "og:image": shareImage,
    "og:image:alt": shareImageAlt,
  })) html = setMeta(html, "property", property, value);
  html = setCanonical(html, canonical);
  const schema = makeJsonLd(route, page, canonical, page.mainEntity);
  const schemaTag = `<script type="application/ld+json" id="street-league-seo-jsonld">${escapeJsonLd(schema)}</script>`;
  const schemaPattern = /<script\b(?=[^>]*\bid\s*=\s*["']street-league-seo-jsonld["'])[^>]*>[\s\S]*?<\/script>/i;
  html = schemaPattern.test(html) ? html.replace(schemaPattern, schemaTag) : html.replace("</head>", `    ${schemaTag}\n  </head>`);
  return html;
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
function buildSitemap(routes) {
  const unique = [...new Set(routes)].filter((route) => route !== "/admin" && !route.startsWith("/admin/"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((route) => `  <url><loc>${xmlEscape(canonicalFor(route))}</loc></url>`).join("\n")}\n</urlset>\n`;
}
async function createDynamicRoutes(template, sitemapRoutes, tables) {
  const { competitions, teams, players, matches } = tables;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  for (const competition of competitions) {
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
    sitemapRoutes.push(route);
  }
  const groups = new Map();
  for (const competition of competitions) {
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
    sitemapRoutes.push(route);
  }
  for (const team of teams) {
    if (!team.id || !team.name) continue;
    const route = `/squadre/${encodeURIComponent(team.id)}`;
    const page = {
      title: `${team.name} | Squadre | Street League Bari`,
      description: `Scopri la rosa, i giocatori e le partite di ${team.name} nella Street League Bari.`,
      shareImage: team.logo_url || undefined,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" }, { name: "Squadre", path: "/squadre" }, { name: team.name, path: route },
      ]),
      mainEntity: {
        "@type": "SportsTeam", name: team.name, url: canonicalFor(route),
        ...(team.logo_url ? { logo: absoluteImageUrl(team.logo_url), image: absoluteImageUrl(team.logo_url) } : {}),
        sport: "Association football", memberOf: { "@id": ORGANIZATION_ID },
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(route);
  }
  for (const player of players) {
    if (!player.id || !player.first_name || !player.last_name) continue;
    const name = `${player.first_name} ${player.last_name}`.trim();
    const team = teamById.get(player.team_id);
    const route = `/giocatori/${encodeURIComponent(player.id)}`;
    const image = player.bg_less_image_url;
    const page = {
      title: `${name} | Giocatori | Street League Bari`,
      description: `Profilo e statistiche di ${name}${team ? ` della squadra ${team.name}` : ""}, nella Street League Bari.`,
      shareImage: image || undefined,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" }, { name: "Squadre", path: "/squadre" }, { name, path: route },
      ]),
      mainEntity: {
        "@type": "Person", name, url: canonicalFor(route),
        ...(image ? { image: absoluteImageUrl(image) } : {}),
        ...(team ? { memberOf: { "@type": "SportsTeam", name: team.name, url: canonicalFor(`/squadre/${encodeURIComponent(team.id)}`) } } : {}),
      },
    };
    await writeRoute(template, route, page);
    sitemapRoutes.push(route);
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
      title: `${name} | Partita | Street League Bari`,
      description: `${name}.${result} Dettagli, eventi e formazioni della Street League Bari${competition ? ` — ${competition.name}` : ""}.`,
      breadcrumbs: makeBreadcrumbs([
        { name: "Home", path: "/" }, { name: "Competizioni", path: "/competizioni" }, { name, path: route },
      ]),
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
    sitemapRoutes.push(route);
  }
}

async function main() {
  const template = await readFile(path.join(DIST, "index.html"), "utf8");
  const sitemapRoutes = [];
  for (const page of staticPages) {
    await writeRoute(template, page.path, page);
    if (page.indexable !== false) sitemapRoutes.push(page.path);
  }

  const baseUrl = await readEnvValue("VITE_SUPABASE_URL");
  const key = (await readEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY")) ||
    (await readEnvValue("VITE_SUPABASE_ANON_KEY"));
  let generatedEntityRoutes = 0;
  if (baseUrl && key) {
    try {
      const [competitions, teams, players, matches] = await Promise.all([
        loadPublicTable(baseUrl, key, "competitions", "id,name,slug,status,season_label,start_date,end_date,statistics_group"),
        loadPublicTable(baseUrl, key, "teams", "id,name,slug,logo_url"),
        loadPublicTable(baseUrl, key, "players", "id,team_id,first_name,last_name,bg_less_image_url"),
        loadPublicTable(baseUrl, key, "matches", "id,competition_id,home_team_id,away_team_id,kickoff_at,status,home_score,away_score,venue"),
      ]);
      const before = sitemapRoutes.length;
      await createDynamicRoutes(template, sitemapRoutes, { competitions, teams, players, matches });
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
