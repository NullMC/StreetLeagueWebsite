// Lista tesserati da stampare ogni settimana (bianco e nero): un PDF per serie (Street A/B/C),
// una pagina A4 per squadra con giocatori (caselle Titolare / Panchina), staff (casella Presente)
// e il riquadro per scrivere a mano la Wildcard della partita.
//
//   npm run tesserati            -> stampa/tesserati-serie-a.pdf, -b.pdf, -c.pdf
//
// Legge i dati pubblici da Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY da .env.local)
// e crea i PDF con Google Chrome o Microsoft Edge in modalità headless.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "stampa");
const SERIES = { "Street A": "Serie A", "Street B": "Serie B", "Street C": "Serie C" };
const BROWSERS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

async function readEnvValue(name) {
  if (process.env[name]) return process.env[name];
  for (const file of [".env.local", ".env"]) {
    try {
      const line = (await readFile(path.join(ROOT, file), "utf8")).split(/\r?\n/)
        .find((row) => row.match(new RegExp(`^\\s*${name}\\s*=`)));
      if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    } catch {}
  }
  return "";
}

async function rest(base, key, table, params) {
  const url = new URL(`/rest/v1/${table}`, base);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Lettura ${table} non riuscita: HTTP ${response.status}`);
  return response.json();
}

const fold = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isStaff = (p) => String(p.position ?? "").trim().toUpperCase() === "STAFF" || String(p.role ?? "").trim().toUpperCase() === "STAFF";
function role(position, short = false) {
  const p = fold(position);
  const r = p.includes("portier") ? ["Portiere", "POR"]
    : p.includes("difens") || p.includes("terzin") ? ["Difensore", "DIF"]
    : p.includes("centrocamp") ? ["Centrocampista", "CEN"]
    : p.includes("attacc") || p.includes("punta") ? ["Attaccante", "ATT"]
    : [String(position ?? "—").trim() || "—", String(position ?? "—").trim().slice(0, 3).toUpperCase() || "—"];
  return short ? r[1] : r[0];
}
const fileUri = (p) => pathToFileURL(p).href;

const BOX = "<i class='box'></i>";
function playerTable(players, compact) {
  const head = `<tr><th class='num'>N°</th><th>Cognome e nome</th><th class='role'>Ruolo</th><th class='chk'>Tit.</th><th class='chk'>Panc.</th></tr>`;
  const rows = players.map((p) => `<tr><td class='num'>${esc(p.shirt_number ?? "")}</td>`
    + `<td class='name'><b>${esc(String(p.last_name ?? "").trim())}</b> ${esc(String(p.first_name ?? "").trim())}</td>`
    + `<td class='role'>${esc(role(p.position, compact))}</td><td class='chk'>${BOX}</td><td class='chk'>${BOX}</td></tr>`).join("");
  return `<table class='${compact ? "compact" : ""}'>${head}${rows}</table>`;
}
function staffTable(staff) {
  const rows = staff.map((p) => `<tr><td class='name'><b>${esc(String(p.last_name ?? "").trim())}</b> ${esc(String(p.first_name ?? "").trim())}</td>`
    + `<td class='chk'>${BOX}</td></tr>`).join("");
  return `<table class='staff'><tr><th>Cognome e nome</th><th class='chk wide'>Presente</th></tr>${rows}</table>`;
}

function teamPage(team, members, series, competition, stamp, logo) {
  const staff = members.filter(isStaff).sort((a, b) => fold(a.last_name).localeCompare(fold(b.last_name)) || fold(a.first_name).localeCompare(fold(b.first_name)));
  const players = members.filter((p) => !isStaff(p)).sort((a, b) =>
    (a.shirt_number ?? 1e9) - (b.shirt_number ?? 1e9) || fold(a.last_name).localeCompare(fold(b.last_name)));
  // Long rosters on two columns so every team fits one page with the Wildcard box.
  const playersHtml = players.length > 20
    ? `<div class='cols'>${playerTable(players.slice(0, Math.ceil(players.length / 2)), true)}${playerTable(players.slice(Math.ceil(players.length / 2)), true)}</div>`
    : playerTable(players, false);
  const teamLogo = team.logo_url ? `<img class='logo' src='${esc(team.logo_url)}' alt=''>` : "<div class='logo empty'></div>";
  return `<section class="page">
  <div class="top"><img src="${logo}" alt="Street League"><div class="series"><b>${esc(series)}</b> · ${esc(competition)}<br>Lista tesserati</div></div>
  <div class="team">${teamLogo}<div><h1>${esc(team.name)}</h1><p>${players.length} giocatori · ${staff.length} staff</p></div>
    <div class="match">Partita <span></span><br>Data <span></span></div></div>
  <h2>Giocatori · ${players.length}</h2>
  ${playersHtml}
  ${staff.length ? `<h2>Staff · ${staff.length}</h2>${staffTable(staff)}` : ""}
  <div class="wildcard">
    <div class="title">Wildcard · partita corrente</div>
    <div class="hint">Giocatore esterno per questa partita (facoltativo): da compilare a mano.</div>
    <div class="line">Nome e cognome<span class="fill"></span><span class="pick">${BOX}Titolare</span><span class="pick">${BOX}Panchina</span></div>
    <div class="roles">Ruolo <span>${BOX}Portiere</span><span>${BOX}Difensore</span><span>${BOX}Centrocampista</span><span>${BOX}Attaccante</span></div>
  </div>
  <div class="foot"><span>Street League Bari · ${esc(series)} · Tit. = titolare, Panc. = panchina</span><span>Aggiornata al ${stamp}</span></div>
</section>`;
}

function css(fonts) {
  return `
@font-face { font-family: 'Archivo'; src: url('${fonts.archivo}') format('woff2'); font-weight: 100 900; }
@font-face { font-family: 'Unbounded'; src: url('${fonts.unbounded}') format('woff2'); font-weight: 200 900; }
@font-face { font-family: 'Barlow'; src: url('${fonts.barlow}') format('woff2'); font-weight: 800; font-style: italic; }
@page { size: A4; margin: 11mm 12mm 10mm; }
* { box-sizing: border-box; }
/* Bianco e nero: nessun colore, grigi chiari solo per le righe alterne */
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Archivo', Arial, sans-serif; color: #000; font-size: 10.5pt; }
img { filter: grayscale(1); }
.page { height: 276mm; display: flex; flex-direction: column; break-after: page; }
.page:last-child { break-after: auto; }
.top { display: flex; align-items: center; justify-content: space-between; padding-bottom: 3mm; border-bottom: 1.4pt solid #000; }
.top img { height: 9mm; }
.top .series { font: 800 8.5pt 'Unbounded', sans-serif; letter-spacing: .06em; text-transform: uppercase; text-align: right; }
.team { display: flex; align-items: center; gap: 5mm; margin: 4.5mm 0 3mm; }
.team .logo { width: 19mm; height: 19mm; border-radius: 50%; object-fit: cover; border: .8pt solid #000; }
.team .logo.empty { background: #eee; }
.team h1 { margin: 0; font: 800 20pt/1 'Unbounded', sans-serif; letter-spacing: -.03em; text-transform: uppercase; }
.team p { margin: 1.6mm 0 0; font-size: 9pt; color: #333; }
.team .match { margin-left: auto; font-size: 9pt; font-weight: 700; line-height: 2.1; text-align: right; }
.team .match span { display: inline-block; width: 46mm; border-bottom: .8pt solid #000; margin-left: 2mm; }
h2 { margin: 3mm 0 1.4mm; font: 800 italic 12.5pt 'Barlow', sans-serif; text-transform: uppercase; letter-spacing: .02em; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 7.5pt; letter-spacing: .07em; text-transform: uppercase; color: #333; font-weight: 700; padding: 0 1.6mm 1.2mm; border-bottom: 1pt solid #000; }
td { padding: 0 1.6mm; height: 6.1mm; border-bottom: .5pt solid #bbb; vertical-align: middle; }
tr:nth-child(even) td { background: #f1f1f1; }
.num { width: 11mm; font-weight: 800; font-variant-numeric: tabular-nums; }
td.name b { font-weight: 800; text-transform: uppercase; }
.role { width: 32mm; }
.compact .role { width: 12mm; font-size: 8.5pt; }
.compact td.name { font-size: 9.5pt; }
.chk { width: 12mm; text-align: center; }
th.chk.wide { width: 18mm; }
.box { display: inline-block; width: 4.2mm; height: 4.2mm; border: 1pt solid #000; background: #fff; vertical-align: middle; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 5mm; }
.wildcard { margin-top: auto; border: 1.2pt dashed #000; border-radius: 3mm; padding: 3.5mm 5mm 3.5mm; }
.wildcard .title { font: 800 9pt 'Unbounded', sans-serif; letter-spacing: .05em; text-transform: uppercase; }
.wildcard .hint { font-size: 8pt; color: #333; margin: 1mm 0 1mm; }
.line { display: flex; align-items: flex-end; gap: 3mm; margin-top: 5mm; font-size: 9pt; font-weight: 700; }
.line .fill { flex: 1; border-bottom: .8pt solid #000; height: 5mm; }
.line .pick, .roles span { display: inline-flex; align-items: center; gap: 1.5mm; }
.roles { display: flex; gap: 6mm; margin-top: 4.5mm; font-size: 9pt; font-weight: 700; align-items: center; }
.foot { margin-top: 2.5mm; font-size: 7pt; color: #444; display: flex; justify-content: space-between; }
`;
}

const run = promisify(execFile);

async function main() {
  const base = await readEnvValue("VITE_SUPABASE_URL");
  const key = await readEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!base || !key) throw new Error("Mancano VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY in .env.local");
  const browser = BROWSERS.find((entry) => existsSync(entry));
  if (!browser) throw new Error("Chrome o Edge non trovati: imposta CHROME_PATH");

  const competitions = (await rest(base, key, "competitions", { select: "id,name", order: "name" }))
    .filter((c) => SERIES[c.name]);
  const links = await rest(base, key, "competition_teams", { select: "competition_id,team_id" });
  const teams = await rest(base, key, "teams", { select: "id,name,logo_url" });
  const players = await rest(base, key, "players", { select: "id,team_id,first_name,last_name,shirt_number,position", limit: "5000" });

  const fonts = {
    archivo: fileUri(path.join(ROOT, "node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2")),
    unbounded: fileUri(path.join(ROOT, "node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2")),
    barlow: fileUri(path.join(ROOT, "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-italic.woff2")),
  };
  const logo = fileUri(path.join(ROOT, "public/assets/logo.png"));
  const stamp = new Date().toLocaleDateString("it-IT");
  const work = await mkdtemp(path.join(os.tmpdir(), "tesserati-"));
  await mkdir(OUT, { recursive: true });
  try {
    for (const competition of competitions) {
      const series = SERIES[competition.name];
      const teamIds = new Set(links.filter((l) => l.competition_id === competition.id).map((l) => l.team_id));
      const seriesTeams = teams.filter((t) => teamIds.has(t.id)).sort((a, b) => fold(a.name).localeCompare(fold(b.name)));
      const pages = seriesTeams.map((team) => teamPage(team, players.filter((p) => p.team_id === team.id), series, competition.name, stamp, logo)).join("");
      const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Tesserati ${series}</title><style>${css(fonts)}</style></head><body>${pages}</body></html>`;
      const slug = series.toLowerCase().replace(/\s+/g, "-");
      const htmlPath = path.join(work, `tesserati-${slug}.html`);
      const pdfPath = path.join(OUT, `tesserati-${slug}.pdf`);
      await writeFile(htmlPath, html, "utf8");
      // Debug: TESSERATI_HTML_DIR=<cartella> salva anche l'HTML per controllarlo nel browser.
      if (process.env.TESSERATI_HTML_DIR) await writeFile(path.join(process.env.TESSERATI_HTML_DIR, `tesserati-${slug}.html`), html, "utf8");
      await run(browser, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=15000",
        `--user-data-dir=${path.join(work, "profile")}`, `--print-to-pdf=${pdfPath}`, fileUri(htmlPath)], { timeout: 180000 });
      if (!existsSync(pdfPath)) throw new Error(`PDF non creato: ${pdfPath}`);
      console.log(`${series}: ${seriesTeams.length} squadre -> ${path.relative(ROOT, pdfPath)}`);
    }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => { console.error(error.message || error); process.exit(1); });
