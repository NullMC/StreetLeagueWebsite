import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getActiveCompetition, getTeams, getMatches } from "../lib/api";
import type { Team, Match } from "../types";
type Row = Team & {
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};
export default function Standings() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const c = await getActiveCompetition();
      if (!c) {
        setRows([]);
        return;
      }
      const [teams, m] = await Promise.all([getTeams(c.id), getMatches(c.id)]);
      const map = new Map(
        teams.map((t) => [
          t.id,
          { ...t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 },
        ]),
      );
      m.filter((x) => x.status === "finished").forEach((x) => {
        const h = map.get(x.home_team_id),
          a = map.get(x.away_team_id);
        if (!h || !a || x.home_score == null || x.away_score == null) return;
        h.p++;
        a.p++;
        h.gf += x.home_score;
        h.ga += x.away_score;
        a.gf += x.away_score;
        a.ga += x.home_score;
        if (x.home_score > x.away_score) {
          h.w++;
          h.pts += 3;
          a.l++;
        } else if (x.home_score < x.away_score) {
          a.w++;
          a.pts += 3;
          h.l++;
        } else {
          h.d++;
          a.d++;
          h.pts++;
          a.pts++;
        }
      });
      setRows(
        [...map.values()]
          .map((r) => ({ ...r, gd: r.gf - r.ga }))
          .sort((a, b) => b.pts - a.pts || b.gd - a.gd),
      );
    })();
  }, []);
  const empty = useMemo(() => !rows.length, [rows]);
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="Competizione attuale" title="Classifica" />
        {empty ? (
          <EmptyState
            title="Nessuna classifica"
            text="La classifica viene derivata dalle partite concluse presenti nel database."
          />
        ) : (
          <div className="leaderboard">
            <div className="table-row head">
              <span>#</span>
              <span>Squadra</span>
              <span>P</span>
              <span>W</span>
              <span>D</span>
              <span>L</span>
              <span>DG</span>
              <span>PTS</span>
            </div>
            {rows.map((r, i) => (
              <div className="table-row" key={r.id}>
                <span className="position">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{r.name}</strong>
                <span>{r.p}</span>
                <span>{r.w}</span>
                <span>{r.d}</span>
                <span>{r.l}</span>
                <span>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
                <strong>{r.pts}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
