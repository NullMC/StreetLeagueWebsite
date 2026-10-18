import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/PageShell";
import { SectionTitle } from "../components/SectionTitle";
import { EmptyState } from "../components/EmptyState";
import { TeamCarousel } from "../components/TeamCarousel";
import { getTeams } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Player, Team } from "../types";

type MarketEntry = {
  id: string;
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

function resolvePlayer(entry: MarketEntry): Player | null {
  if (!entry.players) return null;
  return Array.isArray(entry.players) ? (entry.players[0] ?? null) : entry.players;
}

function TransferPlayerCard({
  slotNumber,
  entry,
}: {
  slotNumber: number;
  entry?: MarketEntry;
}) {
  if (!entry) {
    return (
      <article
        className="stat-card team-roster-card transfer-slot transfer-slot--empty"
        aria-label={"Slot " + slotNumber + " disponibile"}
      >
        <div className="player-card__content">
          <span className="eyebrow">{"Slot " + slotNumber + " / Disponibile"}</span>
          <h3>Slot<br />disponibile</h3>
        </div>
      </article>
    );
  }

  const player = resolvePlayer(entry);
  const firstName = player?.first_name || entry.external_first_name || "";
  const lastName = player?.last_name || entry.external_last_name || "";
  const position = player?.position || entry.external_position;
  const shirtNumber = player?.shirt_number ?? entry.external_shirt_number;
  const photo = player?.profile_image_url || player?.bg_less_image_url || entry.external_photo_url;
  const imageClass = !player || player.profile_image_url
    ? "player-card__photo-image"
    : "player-card__photo-image player-card__photo-image--cutout";

  const content = (
    <>
      {photo ? (
        <span className="player-card__photo" aria-hidden="true">
          <img src={photo} alt="" loading="lazy" className={imageClass} />
        </span>
      ) : null}
      <div className="player-card__content">
        <span className="eyebrow">
          {"#" + (shirtNumber ?? "—") + " / " + (position || "Giocatore")}
        </span>
        <h3>
          {firstName}
          <br />
          {lastName}
        </h3>
      </div>
    </>
  );

  return player ? (
    <a
      className="stat-card team-roster-card transfer-slot transfer-slot--filled"
      href={"/giocatori/" + player.id}
      aria-label={firstName + " " + lastName + ", slot " + slotNumber}
    >
      {content}
    </a>
  ) : (
    <article
      className="stat-card team-roster-card transfer-slot transfer-slot--filled"
      aria-label={firstName + " " + lastName + ", slot " + slotNumber}
    >
      {content}
    </article>
  );
}

export default function TransferMarket() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [entries, setEntries] = useState<MarketEntry[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
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
        const allTeams = await getTeams();
        if (!mounted) return;
        setTeams(allTeams.sort((a, b) => a.name.localeCompare(b.name, "it")));

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
    return () => {
      mounted = false;
    };
  }, []);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const entryBySlot = useMemo(() => {
    const map = new Map<string, MarketEntry>();
    entries.forEach((entry) => map.set(entry.team_id + ":" + entry.slot_number, entry));
    return map;
  }, [entries]);
  const filledSlots = selectedTeam
    ? entries.filter((entry) => entry.team_id === selectedTeam.id).length
    : 0;

  return (
    <PageShell>
      <div className="page transfer-market-page">
        <header className="transfer-market-hero">
          <SectionTitle title="Calcio mercato" />
          <p>Seleziona una squadra per visualizzare i sei slot disponibili per i nuovi innesti.</p>
        </header>

        {pageError ? <p className="transfer-market-alert">{pageError}</p> : null}
        {marketTableMissing ? (
          <div className="transfer-market-alert">
            <strong>Calcio mercato da collegare al database</strong>
            <p>Per una nuova installazione esegui <code>supabase/17_transfer_market.sql</code>. Se avevi già creato la tabella precedente, esegui <code>supabase/18_transfer_market_team_slots.sql</code>.</p>
          </div>
        ) : null}

        {loading ? (
          <p className="transfer-market-state">Caricamento squadre…</p>
        ) : teams.length ? (
          <section className="transfer-market-team-picker" aria-label="Selezione squadra">
            <SectionTitle title="Squadre" variant="subsection" />
            <TeamCarousel
              teams={teams}
              label="Seleziona una squadra per aprire il suo calcio mercato"
              selectedTeamId={selectedTeamId}
              onSelect={(team) => setSelectedTeamId(team.id)}
            />
          </section>
        ) : (
          <EmptyState
            title="Nessuna squadra disponibile"
            text="Le squadre appariranno qui quando saranno registrate nella piattaforma."
          />
        )}

        {selectedTeam ? (
          <section className="transfer-market-selected" aria-live="polite">
            <div className="transfer-market-selected__heading">
              <div className="transfer-market-selected__identity">
                {selectedTeam.logo_url ? (
                  <img src={selectedTeam.logo_url} alt="" aria-hidden="true" />
                ) : null}
                <div>
                  <h2>{selectedTeam.name}</h2>
                </div>
              </div>
              {!marketTableMissing ? (
                <span className="transfer-market-selected__count">{filledSlots} / 6 slot occupati</span>
              ) : null}
            </div>

            {marketTableMissing ? (
              <EmptyState
                title="Slot non disponibili"
                text="Configura la tabella del calcio mercato in Supabase per visualizzare gli slot."
              />
            ) : (
              <div className="transfer-market-slots" aria-label={"Slot calcio mercato " + selectedTeam.name}>
                {Array.from({ length: 6 }, (_, index) => {
                  const slotNumber = index + 1;
                  const entry = entryBySlot.get(selectedTeam.id + ":" + slotNumber);
                  return <TransferPlayerCard key={slotNumber} slotNumber={slotNumber} entry={entry} />;
                })}
              </div>
            )}
          </section>
        ) : (
          <div className="transfer-market-selection-empty">
            <EmptyState
              title="Seleziona una squadra"
              text="Clicca sul logo di una squadra per aprire qui sotto i suoi sei slot di mercato."
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
