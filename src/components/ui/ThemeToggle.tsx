import { useState } from "react";
import { flushSync } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

const THEME_KEY = "street-league-theme";

/**
 * Interruttore tema con rivelazione circolare tramite View Transitions API
 * (ripiega su un cambio istantaneo se l'API non c'è o se l'utente riduce il movimento).
 */
export function ThemeToggle() {
  const [nightMode, setNightMode] = useState(
    () => document.documentElement.dataset.theme === "night",
  );

  const apply = (next: boolean) => {
    document.documentElement.dataset.theme = next ? "night" : "light";
    try {
      window.localStorage.setItem(THEME_KEY, next ? "night" : "light");
    } catch {
      /* storage non disponibile: il tema resta valido per la sessione */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next ? "#010A08" : "#F9F9F9");
    setNightMode(next);
  };

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const next = !nightMode;
    const doc = document as ViewTransitionDocument;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!doc.startViewTransition || reduced) {
      apply(next);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${box.left + box.width / 2}px`);
    root.style.setProperty("--vt-y", `${box.top + box.height / 2}px`);
    root.classList.add("sl-vt-theme");
    const transition = doc.startViewTransition(() => {
      flushSync(() => apply(next));
    }) as { finished?: Promise<void> } | undefined;
    const cleanup = () => root.classList.remove("sl-vt-theme");
    if (transition?.finished) transition.finished.then(cleanup, cleanup);
    else window.setTimeout(cleanup, 800);
  };

  return (
    <button
      className={`sl-icon-btn theme-switch${nightMode ? " is-night" : ""}`}
      type="button"
      role="switch"
      aria-checked={nightMode}
      aria-label={nightMode ? "Disattiva night mode" : "Attiva night mode"}
      title={nightMode ? "Disattiva night mode" : "Attiva night mode"}
      onClick={toggle}
    >
      <FontAwesomeIcon
        className="theme-switch__icon"
        icon={nightMode ? faSun : faMoon}
        aria-hidden="true"
      />
    </button>
  );
}
