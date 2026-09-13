import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
const cats = [
  "Reti",
  "Presenze",
  "Assist",
  "Gialli",
  "Rossi",
  "Falli",
  "Clean sheets",
  "MVP",
];
export default function Stats() {
  return (
    <PageShell>
      <div className="page">
        <SectionTitle eyebrow="" title="Statistiche" />
        <p className="lede">
          Le metriche vengono calcolate dagli eventi di gara, non inserite come
          valori aggregati manualmente.
        </p>
        <div className="leaders">
          {cats.map((c) => (
            <div className="stat-card" key={c}>
              <span className="eyebrow">{c}</span>
              <h3>Leader</h3>
              <div className="stat-card__value">—</div>
              <div className="rank-list">
                <div className="rank-row">
                  <span>01</span>
                  <span>—</span>
                </div>
                <div className="rank-row">
                  <span>02</span>
                  <span>—</span>
                </div>
                <div className="rank-row">
                  <span>03</span>
                  <span>—</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="section">
          <EmptyState
            title="- - -"
            text="Le statistiche appariranno qui quando saranno registrate nel database."
          />
        </div>
      </div>
    </PageShell>
  );
}
