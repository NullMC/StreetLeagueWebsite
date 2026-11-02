import { NavLink, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faBars } from "@fortawesome/free-solid-svg-icons";

export type DockItem = { label: string; to: string; icon: IconDefinition };

/** Dock di navigazione mobile (ispirato a Floating Dock / Message Dock, 21st.dev). */
export function MobileDock({
  items,
  menuOpen,
  onMenu,
}: {
  items: DockItem[];
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav className="sl-dock" aria-label="Navigazione rapida">
      {items.map((item) => (
        <NavLink
          viewTransition
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className="sl-dock__item"
        >
          <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        className="sl-dock__item"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="mobile-navigation"
      >
        <FontAwesomeIcon icon={faBars} aria-hidden="true" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
