import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { getCompetitions, getTeams } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Competition, Player, Team } from "../types";

type MarketEntry = {
  id: string;
  competition_id: string;
  team_id: string;
  slot_number: number;
  player_id: string | null;
  external_first_name: string | null;
  external_last_name: string | null;
  external_position: string | null;
  external_shirt_number: number | null;
  external_photo_url: string | null;
  notes: string | null;
  players?: Player | Player[] | null;
};

type CompetitionBoard = {
  competition: Competition;
  teams: Team[];
};

const statusOrder: Record<Competition["status"], number> = {
  active: 0,
  upcoming: 1,
  finished: 2,
};

function resolvePlayer(entry: MarketEntry): Player | null {
  if (!entry.players) return null;
  return Array.isArray(entry.players) ? (entry.players[0] ?? null) : entry.players;
}

function slotLabel(slot: number) {
  return String(slot).padStart(2, "0");
}

function TransferPlayerCard({
  slotNumber,
  entry,
  destinationTeam,
  competitionId,
  teamById
}: {
  slotNumber: number;
  entry?: MarketEntry;
  destinationTeam: Team;
  competitionId: string;
  teamById: Map<string, Team>;
  onPlatformMissing?: boolean;
}) {
  if (!entry) {
    return (
      <article className="transfer-slot transfer-slot--empty" aria-label={`Slot ${slotNumber} libero per ${destinationTeam.name}`}>
        <span className="transfer-slot__number">{slotLabel(slotNumber)}</span>
        <span className="transfer-slot__plus" aria-hidden="true">+</span>
        <strong>Slot libero</strong>
        <small>Nuovo acquisto</small>
      </article>
    );
  }

  const player = resolvePlayer(entry);
  const isExternal = !player;
  const firstName = player?.first_name || entry.external_first_name || "";
  const lastName = player?.last_name || entry.external_last_name || "";
  const position = player?.position || entry.external_position;
  const shirtNumber = player?.shirt_number ?? entry.external_shirt_number;
  const photo = player?.profile_image_url || player?.bg_less_image_url || entry.external_photo_url;
  const currentTeam = player ? teamById.get(player.team_id) : undefined;
  const belongsToCompetition = Boolean(currentTeam?.competition_ids?.includes(competitionId));
  const sourceLabel = isExternal
    ? "Nuovo giocatore"
    : player?.team_id === destinationTeam.id
      ? "Rosa attuale"
      : belongsToCompetition
        ? "Mercato interno"
        : "Da fuori competizione";
  const content = (
    <>
      <div className="transfer-slot__number">{slotLabel(slotNumber)}</div>
      <div className="transfer-slot__portrait">
        {photo ? (
          <img src={photo} alt={`${firstName} ${lastName}`.trim()} loading="lazy" />
        ) : (
          <span aria-hidden="true">{(firstName[0] || "?").toLocaleUpperCase("it-IT")}{(lastName[0] || "").toLocaleUpperCase("it-IT")}</span>
        )}
        {shirtNumber != null ? <b className="transfer-slot__shirt">#{shirtNumber}</b> : null}
      </div>
      <div className="transfer-slot__body">
        <span className="transfer-slot__source">{sourceLabel}</span>
        <h3>{firstName} {lastName}</h3>
        <p>{position || "Giocatore"}</p>
        {entry.notes ? <small className="transfer-slot__notes">{entry.notes}</small> : null}
      </div>
      {currentTeam && currentTeam.id !== destinationTeam.id ? (
        <span className="transfer-slot__former-team">
          {currentTeam.logo_url ? <img src={currentTeam.logo_url} alt="" aria-hidden="true" /> : null}
          {currentTeam.name}
        </span>
      ) : null}
    </>
  );

  return player ? (
    <a className="transfer-slot transfer-slot--filled" href={`/giocatori/${player.id}`} aria-label={`${firstName} ${lastName}, slot ${slotNumber}`}>
      {content}
    </a>
  ) : (
    <article className="transfer-slot transfer-slot--filled" aria-label={`${firstName} ${lastName}, slot ${slotNumber}`}>
      {content}
    </article>
  );
}

export default function TransferMarket() {
  const [boards, setBoards] = useState<CompetitionBoard[]>([]);
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [marketTableMissing, setMarketTableMissing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setPageError("");
      setMarketTableMissing(false);
      try {
        const [competitions, teams] = await Promise.all([getCompetitions(), getTeams()]);
        if (!mounted) return;

        const orderedCompetitions = [...competitions].sort(
          (a, b) => statusOrder[a.status] - statusOrder[b.status] ||
            a.name.localeCompare(b.name, "it"),
        );
        setBoards(orderedCompetitions.map((competition) => ({
          competition,
          teams: teams
            .filter((team) => team.competition_ids?.includes(competition.id))
            .sort((a, b) => a.name.localeCompare(b.name, "it")),
        })));

        if (!supabase) {
          setPageError("La connessione al database non è configurata.");
          return;
        }

        const { data, error } = await supabase
          .from("transfer_market_entries")
          .select("*, players(*)")
          .order("slot_number", { ascending: true });
        if (error) {
          if (!mounted) return;
          setMarketTableMissing(true);
          setEntries([]);
          return;
        }

        if (mounted) setEntries((data ?? []) as unknown as MarketEntry[]);
      } catch (error) {
        console.error("Transfer market data error:", error);
        if (mounted) setPageError("Non è stato possibile caricare i dati del calcio mercato.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, []);

  const teamById = useMemo(
    () => new Map(boards.flatMap((board) => board.teams).map((team) => [team.id, team] as const)),
    [boards],
  );
  const entryBySlot = useMemo(() => {
    const map = new Map<string, MarketEntry>();
    entries.forEach((entry) => map.set(`${entry.competition_id}:${entry.team_id}:${entry.slot_number}`, entry));
    return map;
  }, [entries]);

  return (
    <PageShell>
      <div className="page transfer-market-page">
        <header className="transfer-market-hero">
          <span className="eyebrow">Street League / Roster update</span>
          <SectionTitle title="Calcio mercato" />
          <p>Nuovi innesti, trasferimenti tra squadre e giocatori in arrivo da altre competizioni: ogni squadra ha sei slot disponibili.</p>
          <div className="transfer-market-hero__meta">
            <span><strong>6</strong> slot per squadra</span>
            <span><strong>{entries.length}</strong> giocatori inseriti</span>
          </div>
        </header>

        {pageError ? <p className="transfer-market-alert">{pageError}</p> : null}
        {marketTableMissing ? (
          <div className="transfer-market-alert">
            <strong>Calcio mercato da collegare al database</strong>
            <p>Per attivare gli slot persistenti, esegui il file <code>supabase/17_transfer_market.sql</code> nel SQL Editor del progetto Supabase.</p>
          </div>
        ) : null}

        {loading ? (
          <p className="transfer-market-state">Caricamento competizioni e giocatori…</p>
        ) : boards.length ? (
          <div className="transfer-market-competitions">
            {boards.map(({ competition, teams }) => {
              const competitionEntries = entries.filter((entry) => entry.competition_id === competition.id);
              const filledSlots = competitionEntries.length;
              return (
                <section className="transfer-competition" key={competition.id}>
                  <div className="transfer-competition__head">
                    <div>
                      <span className={`transfer-competition__status transfer-competition__status--${competition.status}`}>{competition.status === "active" ? "Attiva" : competition.status === "upcoming" ? "In arrivo" : "Conclusa"}</span>
                      <h2>{competition.name}</h2>
                      {competition.season_label ? <p>{competition.season_label}</p> : null}
                    </div>
                    <span className="transfer-competition__count">{filledSlots} slot occupati</span>
                  </div>

                  {teams.length ? (
                    <div className="transfer-competition__teams">
                      {teams.map((team) => {
                        const teamEntries = entries.filter((entry) => entry.competition_id === competition.id && entry.team_id === team.id);
                        return (
                          <section className="transfer-team" key={`${competition.id}:${team.id}`}>
                            <div className="transfer-team__head">
                              {team.logo_url ? <img src={team.logo_url} alt="" aria-hidden="true" /> : <span className="transfer-team__logo-placeholder" aria-hidden="true">{team.name.slice(0, 1).toLocaleUpperCase("it-IT")}</span>}
                              <div>
                                <h3>{team.name}</h3>
                                <p>{teamEntries.length} / 6 slot occupati</p>
                              </div>
                              <span className="transfer-team__scroll-hint">Scorri gli slot <span aria-hidden="true">→</span></span>
                            </div>
                            <div className="transfer-team__slots" aria-label={`Calcio mercato ${team.name}`}>
                              {Array.from({ length: 6 }, (_, index) => {
                                const slotNumber = index + 1;
                                const entry = entryBySlot.get(`${competition.id}:${team.id}:${slotNumber}`);
                                return <TransferPlayerCard key={slotNumber} slotNumber={slotNumber} entry={entry} destinationTeam={team} competitionId={competition.id} teamById={teamById} />;
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="Nessuna squadra registrata" text="Le squadre compariranno qui quando saranno associate a questa competizione." />
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nessuna competizione disponibile" text="Le squadre e gli slot del calcio mercato appariranno qui quando saranno registrate le competizioni." />
        )}
      </div>
    </PageShell>
  );
}
