import { useEffect, useState } from "react";
import { Paper, Typography } from "@mui/material";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { MatchCard } from "../components/MatchCard";
import { EmptyState } from "../components/EmptyState";
import { SponsorWatermarkStrip } from "../components/SponsorWatermarkStrip";
import { getActiveCompetitions, getMatches, getTeams } from "../lib/api";
import type { Competition, Match, Team } from "../types";

type CompetitionMatches = { competition: Competition; matches: Match[]; teams: Team[] };

export default function Matches() {
  const [groups, setGroups] = useState<CompetitionMatches[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const competitions = await getActiveCompetitions();
        const [matchSets, teamSets] = await Promise.all([
          Promise.all(competitions.map(competition => getMatches(competition.id))),
          Promise.all(competitions.map(competition => getTeams(competition.id))),
        ]);
        if (!mounted) return;
        setGroups(competitions.map((competition, index) => ({
          competition, matches: matchSets[index] || [], teams: teamSets[index] || [],
        })));
      } catch (error) {
        console.error("Calendar loading error:", error);
        if (mounted) setGroups([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  return <PageShell>
    <div className="page matches-page">
      <section className="page-sponsor-band" aria-label="Calendario e sponsor">
        <div className="page-sponsor-band__inner">
          <SectionTitle title="Calendario partite" />
          <Typography component="p" className="lede">Risultati e prossimi incontri, suddivisi per competizione attiva.</Typography>
          <SponsorWatermarkStrip />
        </div>
      </section>
      {loading ? <p className="admin-message">Caricamento calendario…</p> : !groups.length
        ? <EmptyState title="Nessuna competizione attiva" text="Il calendario sarà disponibile quando saranno attive le competizioni." />
        : <div className="matches-competition-list">
            {groups.map(({ competition, matches, teams }) => <Paper component="section" variant="outlined" className="matches-competition-group" key={competition.id} elevation={0}>
              <div className="matches-competition-group__heading">
                <SectionTitle title={competition.name} variant="group" />
                <Typography component="span" className="matches-competition-group__count">{matches.length} {matches.length === 1 ? "partita" : "partite"}</Typography>
              </div>
              {matches.length
                ? <div className="match-grid">{matches.map(match => <MatchCard key={match.id} match={match} home={teams.find(team => team.id === match.home_team_id)} away={teams.find(team => team.id === match.away_team_id)} />)}</div>
                : <EmptyState title="Nessuna partita programmata" text="Le gare di questa competizione saranno mostrate qui." />}
            </Paper>)}
          </div>}
    </div>
  </PageShell>;
}
