import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/global.css";
import "./styles/street.css";
import "./styles/hero-scroller.css";
import "./styles/app-layout.css";
import "./styles/chrome-responsive.css";
import "./styles/sponsor-neutral.css";
import "./styles/partner-tweaks.css";
import "./styles/light-theme.css";
import "./styles/partners-background-fix.css";
import "./styles/admin.css";
import Home from "./pages/Home";
import Competitions from "./pages/Competitions";
import Standings from "./pages/Standings";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import Players from "./pages/Players";
import PlayerDetail from "./pages/PlayerDetail";
import CompetitionDetail from "./pages/CompetitionDetail";
import Stats from "./pages/Stats";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import Partners from "./pages/Partners";
import Collaborate from "./pages/Collaborate";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/competizioni" element={<Competitions />} />
        <Route path="/competizioni/:competitionId" element={<CompetitionDetail />} />
        <Route path="/classifica" element={<Standings />} />
        <Route path="/squadre" element={<Teams />} />
        <Route path="/squadre/:teamId" element={<TeamDetail />} />
        <Route path="/giocatori" element={<Players />} />
        <Route path="/giocatori/:playerId" element={<PlayerDetail />} />
        <Route path="/statistiche" element={<Stats />} />
        <Route path="/partite" element={<Matches />} />
        <Route path="/partite/:matchId" element={<MatchDetail />} />
        <Route path="/partner" element={<Partners />} />
        <Route path="/collabora" element={<Collaborate />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
