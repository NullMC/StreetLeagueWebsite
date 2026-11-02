// Cloudflare rebuild trigger: latest main includes TypeScript compatibility fixes.
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MaterialUiProvider } from "./components/MaterialUiProvider";
// Font self-hosted (nessuna richiesta bloccante a Google Fonts).
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/barlow-condensed/900-italic.css";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/unbounded/wght.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles/global.css";
import "./styles/street.css";
import "./styles/app-layout.css";
import "./styles/chrome-responsive.css";
import "./styles/sponsor-neutral.css";
import "./styles/partner-tweaks.css";
import "./styles/light-theme.css";
import "./styles/admin.css";
import "./styles/team-potm.css";
import "./styles/admin-mobile.css";
import "./styles/home-redesign.css";
import "./styles/home-calendar-mobile.css";
import "./styles/night-mode.css";
import "./styles/material-overhaul.css";
import "./styles/platform-rework.css";
import "./styles/transfer-market.css";
import "./styles/team-competition-enhancements.css";
import "./styles/match-editorial.css";
// Design system Street League: caricato per ultimo, definisce token e componenti condivisi.
import "./styles/sl-system.css";
// Effetti: shader, liquid glass, glow e cinematismo.
import "./styles/sl-fx.css";
// Tipografia: font display (Unbounded, Instrument Serif, Barlow Condensed) solo sui titoli, Archivo per il testo.
import "./styles/sl-type.css";
// Livello di dettaglio uniforme: card, classifiche, azioni, sfondi e scroll.
import "./styles/sl-polish.css";
import HomeRedesigned from "./pages/HomeRedesigned";
import { AppLayout } from "./components/AppLayout";
import { SkeletonCards } from "./components/ui/Skeleton";

// Code splitting per pagina: la home resta nel bundle iniziale, il resto si scarica on demand.
const Competitions = lazy(() => import("./pages/Competitions"));
const Standings = lazy(() => import("./pages/Standings"));
const StatsDetail = lazy(() => import("./pages/StatsDetail"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const CompetitionDetail = lazy(() => import("./pages/CompetitionDetail"));
const Stats = lazy(() => import("./pages/Stats"));
const MatchDetail = lazy(() => import("./pages/MatchDetail"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));
const TransferMarket = lazy(() => import("./pages/TransferMarket"));
const Partners = lazy(() => import("./pages/Partners"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <div className="sl-page-fallback">
      <SkeletonCards label="Caricamento pagina…" count={3} />
    </div>
  );
}

// Il tema viene già impostato in index.html prima del rendering (niente flash); qui resta come fallback.
if (!document.documentElement.dataset.theme) {
  let initialTheme: string | null = null;
  try {
    initialTheme = window.localStorage.getItem("street-league-theme");
  } catch {
    initialTheme = null;
  }
  document.documentElement.dataset.theme = initialTheme === "night" ? "night" : "light";
}

function App() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomeRedesigned />} />
        <Route path="/competizioni" element={<Competitions />} />
        <Route path="/calciomercato" element={<TransferMarket />} />
        <Route path="/competizioni/gruppo/:groupName" element={<CompetitionDetail />} />
        <Route path="/competizioni/:competitionId" element={<CompetitionDetail />} />
        <Route path="/classifica" element={<Standings />} />
        <Route path="/squadre" element={<Navigate to="/#home-teams" replace />} />
        <Route path="/squadre/:teamId" element={<TeamDetail />} />
        <Route path="/giocatori/:playerId" element={<PlayerDetail />} />
        <Route path="/statistiche" element={<Stats />} />
        <Route path="/statistiche/:groupId/:statKey" element={<StatsDetail />} />
        <Route path="/partite/:matchId" element={<MatchDetail />} />
        <Route path="/articoli/:articleId" element={<ArticleDetail />} />
        <Route path="/partner" element={<Partners />} />
        <Route path="/collabora" element={<Navigate to="/partner#collabora" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MaterialUiProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MaterialUiProvider>
  </React.StrictMode>,
);
