import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Elementi che entrano in scena con una rivelazione cinematica allo scroll. */
const REVEAL_SELECTOR = [
  ".home-section-head",
  ".platform-page-heading",
  ".section-head--group",
  ".section-head--subsection",
  ".sl-match-rail > .slm",
  ".match-grid > .slm",
  ".team-carousel__item",
  ".home-feature-card",
  ".monthly-award-card",
  ".top-seven-section",
  ".stat-card",
  ".best-stats-card",
  ".partner-editorial-card",
  ".sl-comp-card",
  ".player-card",
  ".standings-table",
  ".leaderboard .table-row:not(.head)",
  ".match-experience__panel",
  ".detail-hero__inner",
  ".empty-state",
  ".sl-footer__inner",
].join(",");

/** Card che ricevono spotlight + bordo luminoso che segue il puntatore (Glowing Effect). */
export const GLOW_SELECTOR = [
  "[data-spotlight]",
  ".team-carousel__item",
  ".stat-card",
  ".best-stats-card",
  ".partner-editorial-card",
  ".sl-comp-card",
  ".player-card",
  ".standings-table",
  ".match-experience__panel",
  ".monthly-award-card",
].join(",");

const MAGNETIC_SELECTOR =
  ".sl-btn, .sl-icon-btn, .home-section-head__link, .slm__gallery";
const TICKER_SELECTOR =
  ".stat-card__value, .standings-table .table-row > strong, .slm__score > span:not(.slm__sep)";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Conta da 0 al valore finale (Number Ticker). Si interrompe se React aggiorna il testo nel frattempo. */
function tick(element: HTMLElement) {
  if (element.dataset.ticked) return;
  element.dataset.ticked = "1";
  const node = element.firstChild;
  if (
    !node ||
    node.nodeType !== Node.TEXT_NODE ||
    element.childNodes.length !== 1
  )
    return;
  const original = node.nodeValue ?? "";
  const match = /^([+-]?)(\d+)(?:,(\d+))?$/.exec(original.trim());
  if (!match) return;
  const sign = match[1];
  const decimals = match[3]?.length ?? 0;
  const target = Number(match[2] + (decimals ? "." + match[3] : ""));
  if (!target) return;
  const duration = 900;
  const startedAt = performance.now();
  let lastWritten = original;
  const step = (now: number) => {
    if (node.nodeValue !== lastWritten) return; // React ha cambiato il valore: interrompi
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    lastWritten =
      progress >= 1
        ? original
        : sign + (target * eased).toFixed(decimals).replace(".", ",");
    node.nodeValue = lastWritten;
    if (progress < 1) window.requestAnimationFrame(step);
  };
  lastWritten = sign + (0).toFixed(decimals).replace(".", ",");
  node.nodeValue = lastWritten;
  window.requestAnimationFrame(step);
}

export function useCinematics() {
  const { pathname } = useLocation();

  // Rivelazioni allo scroll + number ticker
  useEffect(() => {
    if (prefersReducedMotion() || !("IntersectionObserver" in window))
      return undefined;
    const root = document.documentElement;
    root.classList.add("sl-cine");

    const io = new IntersectionObserver(
      (entries) => {
        const entering = entries.filter((entry) => entry.isIntersecting);
        entering.forEach((entry, index) => {
          const element = entry.target as HTMLElement;
          element.style.setProperty(
            "--sl-delay",
            `${Math.min(index, 8) * 70}ms`,
          );
          element.dataset.reveal = "in";
          io.unobserve(element);
          element.querySelectorAll<HTMLElement>(TICKER_SELECTOR).forEach(tick);
          if (element.matches(TICKER_SELECTOR)) tick(element);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const register = (scope: ParentNode) => {
      scope
        .querySelectorAll<HTMLElement>(REVEAL_SELECTOR)
        .forEach((element) => {
          if (element.dataset.reveal) return;
          if (element.closest(".admin-layout, .sl-hero")) return;
          element.dataset.reveal = "pending";
          io.observe(element);
        });
    };

    let scheduled = 0;
    const main = document.getElementById("root") ?? document.body;
    register(main);
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(() => {
        scheduled = 0;
        register(main);
      });
    });
    mo.observe(main, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      // Ciò che resta in attesa (es. footer condiviso tra pagine) non deve rimanere nascosto.
      document
        .querySelectorAll<HTMLElement>('[data-reveal="pending"]')
        .forEach((element) => {
          element.dataset.reveal = "in";
        });
      if (scheduled) window.cancelAnimationFrame(scheduled);
    };
  }, [pathname]);

  // Spotlight / bordo luminoso / pulsanti magnetici: un solo listener delegato
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return undefined;
    const reduced = prefersReducedMotion();
    let frame = 0;
    let lastEvent: PointerEvent | null = null;
    let magnetic: HTMLElement | null = null;

    const releaseMagnetic = () => {
      if (!magnetic) return;
      magnetic.style.removeProperty("--mag-x");
      magnetic.style.removeProperty("--mag-y");
      magnetic = null;
    };

    const update = () => {
      frame = 0;
      const event = lastEvent;
      if (!event) return;
      const target = event.target as Element | null;
      const card = target?.closest?.<HTMLElement>(GLOW_SELECTOR);
      if (card) {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - box.left}px`);
        card.style.setProperty("--my", `${event.clientY - box.top}px`);
      }
      if (reduced) return;
      const button = target?.closest?.<HTMLElement>(MAGNETIC_SELECTOR) ?? null;
      if (button !== magnetic) releaseMagnetic();
      if (button) {
        const box = button.getBoundingClientRect();
        const dx = (event.clientX - (box.left + box.width / 2)) / box.width;
        const dy = (event.clientY - (box.top + box.height / 2)) / box.height;
        button.style.setProperty("--mag-x", `${(dx * 8).toFixed(2)}px`);
        button.style.setProperty("--mag-y", `${(dy * 6).toFixed(2)}px`);
        magnetic = button;
      }
    };

    const onMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", releaseMagnetic);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", releaseMagnetic);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}
