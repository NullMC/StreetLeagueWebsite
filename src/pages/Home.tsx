import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { DataGate } from "../components/DataGate";
import { MatchCard } from "../components/MatchCard";
import { TeamCard } from "../components/TeamCard";
import { EmptyState } from "../components/EmptyState";
import {
  getActiveCompetition,
  getMatches,
  getTeams,
  getPartners,
  getSocialContent,
  subscribeToCompetition,
} from "../lib/api";
import type {
  Competition,
  Match,
  Team,
  Partner,
  SocialContent,
} from "../types";

export default function Home() {
  const [c, setC] = useState<Competition | null>(null);
  const [m, setM] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [social, setSocial] = useState<SocialContent[]>([]);

  const load = async () => {
    try {
      const cc = await getActiveCompetition();
      setC(cc);
      setM(await getMatches(cc?.id));
      setTeams(await getTeams(cc?.id));
      setPartners(await getPartners());
      setSocial(await getSocialContent());
    } catch {
      setC(null);
    }
  };

  useEffect(() => {
    load();
    const unsubscribe = subscribeToCompetition(load);
    return unsubscribe;
  }, []);

  const upcoming = useMemo(() => m.slice(0, 6), [m]);
  const heroBackground = c?.hero_image_url || "/assets/nebula-vertical.png";
  const standings = useMemo(() => {
  const table = teams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  }));

  const standingsMap = new Map(
    table.map((entry) => [entry.team.id, entry])
  );

  m
    .filter(
      (match) =>
        match.status === "finished" &&
        match.home_score !== null &&
        match.away_score !== null
    )
    .forEach((match) => {
      const home = standingsMap.get(match.home_team_id);
      const away = standingsMap.get(match.away_team_id);

      if (!home || !away) return;

      const homeGoals = Number(match.home_score);
      const awayGoals = Number(match.away_score);

      home.played += 1;
      away.played += 1;

      home.gf += homeGoals;
      home.ga += awayGoals;

      away.gf += awayGoals;
      away.ga += homeGoals;

      if (homeGoals > awayGoals) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
      } else if (homeGoals < awayGoals) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return table
    .map((entry) => ({
      ...entry,
      gd: entry.gf - entry.ga,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.team.name.localeCompare(b.team.name)
    );
    }, [m, teams]);

  return (
    <PageShell>
      <section
        className="hero"
        style={
          {
            "--hero-image": `url("${heroBackground}")`,
          } as CSSProperties
        }
      >
        <div className="hero-inner">

          {/* LEFT SIDE */}
          <div className="hero-content">

            <h1>
              Street
              <br />
              League
            </h1>

            <div className="hero-actions">
              <a className="btn btn--primary" href="/partite">
                Calendario
              </a>

              <a className="btn btn--ghost" href="/classifica">
                Classifica
              </a>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <aside className="hero-calendar">
            <div className="hero-data-panels">

            {/* CALENDARIO */}
            <aside className="hero-calendar">
              <div className="hero-calendar__header">
                <div>
                  <span className="eyebrow">Next matches</span>
                  <h2>Calendario</h2>
                </div>

                <a
                  className="hero-calendar__all"
                  href="/partite"
                >
                  Vedi tutte
                </a>
              </div>

              {upcoming.length ? (
                <div className="hero-calendar__list">
                  {upcoming.slice(0, 3).map((match) => {
                    const home = teams.find(
                      (team) => team.id === match.home_team_id
                    );

                    const away = teams.find(
                      (team) => team.id === match.away_team_id
                    );

                    return (
                      <a
                        key={match.id}
                        href={`/partite/${match.id}`}
                        className="hero-match"
                      >
                        <div className="hero-match__meta">
                          <span>
                            {match.kickoff_at
                              ? new Date(
                                  match.kickoff_at
                                ).toLocaleDateString("it-IT", {
                                  day: "2-digit",
                                  month: "short",
                                })
                              : "—"}
                          </span>

                          <span>
                            {match.kickoff_at
                              ? new Date(
                                  match.kickoff_at
                                ).toLocaleTimeString("it-IT", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </span>
                        </div>

                        <div className="hero-match__teams">
                          <div className="hero-match__team">
                            {home?.logo_url ? (
                              <img src={home.logo_url} alt="" />
                            ) : (
                              <span className="hero-match__logo-placeholder" />
                            )}

                            <span>
                              {
                                home?.name ||
                                "—"}
                            </span>
                          </div>

                          <span className="hero-match__vs">
                            VS
                          </span>

                          <div className="hero-match__team hero-match__team--away">
                            <span>
                              {
                                away?.name ||
                                "—"}
                            </span>

                            {away?.logo_url ? (
                              <img src={away.logo_url} alt="" />
                            ) : (
                              <span className="hero-match__logo-placeholder" />
                            )}
                          </div>
                        </div>

                        <div className="hero-match__footer">
                          <span>
                            {match.matchday
                              ? `Giornata ${match.matchday}`
                              : "Match"}
                          </span>

                          <span className="hero-match__arrow">
                            →
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="hero-calendar__empty">
                  <span className="eyebrow">
                    Upcoming
                  </span>

                  <h3>
                    Nessuna partita programmata
                  </h3>

                  <p>
                    {c
                      ? "Le prossime partite verranno mostrate qui."
                      : "Competizione non ancora iniziata."}
                  </p>
                </div>
              )}
            </aside>

            {/* CLASSIFICA */}
            <aside className="hero-standings">
              <div className="hero-standings__header">
                <div>
                  <span className="eyebrow">
                    Live ranking
                  </span>

                  <h2>
                    Classifica
                  </h2>
                </div>

                <a
                  className="hero-calendar__all"
                  href="/classifica"
                >
                  Completa
                </a>
              </div>

              {standings.length ? (
                <div className="hero-standings__list">
                  {standings.slice(0, 5).map((entry, index) => (
                    <div
                      className={`hero-standing ${
                        index === 0
                          ? "hero-standing--first"
                          : ""
                      }`}
                      key={entry.team.id}
                    >
                      <span className="hero-standing__position">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div className="hero-standing__team">
                        {entry.team.logo_url ? (
                          <img
                            src={entry.team.logo_url}
                            alt=""
                          />
                        ) : (
                          <span className="hero-standing__logo-placeholder" />
                        )}

                        <span>
                          {
                            entry.team.name}
                        </span>
                      </div>

                      <div className="hero-standing__stats">
                        <span>
                          {entry.played}
                        </span>

                        <strong>
                          {entry.points}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hero-standings__empty">
                  <span className="eyebrow">
                    Ranking
                  </span>

                  <h3>
                    Classifica non disponibile
                  </h3>

                  <p>
                    La classifica verrà popolata automaticamente
                    dai risultati delle partite.
                  </p>
                </div>
              )}
            </aside>

          </div>
          </aside>

        </div>
      </section>


      <section className="section--edge leaders-section">
        <SectionTitle eyebrow="Live" title="Top performers" />
        <div className="leaders">
          {[
            ["Miglior marcatore", "0"],
            ["Top uomo-assist", "0"],
            ["Clean sheets", "0"],
          ].map(([t, v]) => (
            <div className="stat-card" key={t}>
              <span className="eyebrow">{t}</span>
              <h3>—</h3>
              <div className="stat-card__value">{v}</div>
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
      </section>

      <section className="section--edge">
        <SectionTitle
          eyebrow=""
          title="Squadre"
          action={
            <a className="btn btn--ghost" href="/squadre">
              Esplora
            </a>
          }
        />
        {teams.length ? (
          <div className="cards-grid">
            {teams.slice(0, 3).map((t) => (
              <TeamCard key={t.id} team={t} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna squadra"
            text="Le squadre compariranno qui quando saranno registrate nel database."
          />
        )}
      </section>

      <section className="sponsor-band">
        <div className="section--edge">
          <SectionTitle eyebrow="Sponsors" title="Chi sostiene il gioco" />
          <div className="partners-grid">
            {partners
              .filter((p) => p.tier === "gold")
              .slice(0, 4)
              .map((p) => (
                <div className="partner-card" key={p.id}>
                  {p.website_url ? (
                    <a
                      href={p.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.name} />
                      ) : (
                        p.name
                      )}
                    </a>
                  ) : p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  <span>Gold / {p.name}</span>
                </div>
              ))}
          </div>
          <a className="btn btn--primary" href="/collabora">
            Collabora con noi
          </a>
          {!partners.length && (
            <EmptyState
              title="Partner in attesa"
              text="La sezione è pronta per i partner Gold, Silver e Bronze da Supabase."
            />
          )}
        </div>
      </section>

      <section className="section--edge">
        <SectionTitle eyebrow="" title="Ultimi contenuti" />
        <div className="video-grid">
          {social.slice(0, 6).map((s) => (
            <a
              className="video-card"
              key={s.id}
              href={s.content_url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="video-thumb">
                {s.thumbnail_url ? (
                  <img
                    src={s.thumbnail_url}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div className="video-play">↗</div>
                )}
              </div>
              <div className="video-card__body" style={{ padding: "2rem 1rem" }}>
                <h3>{s.title}</h3>
              </div>
            </a>
          ))}
        </div>
        {!social.length && (
          <EmptyState
            title="Nessun contenuto"
            text="YouTube, Instagram e TikTok verranno alimentati dal pannello amministrativo."
          />
        )}
      </section>
    </PageShell>
  );
}
