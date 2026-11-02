import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

export type NavItem = { label: string; to: string };

/**
 * Navigazione desktop con indicatore "limelight" (ispirato a Limelight Nav, 21st.dev):
 * un fascio di luce scorre sotto la voce attiva e segue la voce in hover.
 */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const listRef = useRef<HTMLUListElement>(null);
  const [beam, setBeam] = useState<{ x: number; w: number; visible: boolean }>({
    x: 0,
    w: 0,
    visible: false,
  });

  const moveTo = (element: HTMLElement | null) => {
    const list = listRef.current;
    if (!list || !element) {
      setBeam((current) => ({ ...current, visible: false }));
      return;
    }
    const listBox = list.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    setBeam({ x: box.left - listBox.left, w: box.width, visible: true });
  };

  const moveToActive = () => {
    moveTo(listRef.current?.querySelector<HTMLElement>("a.active") ?? null);
  };

  useLayoutEffect(() => {
    moveToActive();
    const onResize = () => moveToActive();
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav className="sl-nav" aria-label="Navigazione principale desktop">
      <ul ref={listRef} className="sl-nav__list" onMouseLeave={moveToActive}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
                viewTransition
              to={item.to}
              end={item.to === "/"}
              onMouseEnter={(event) => moveTo(event.currentTarget)}
              onFocus={(event) => moveTo(event.currentTarget)}
              onBlur={moveToActive}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
        <li
          className={"sl-nav__limelight" + (beam.visible ? " is-visible" : "")}
          aria-hidden="true"
          style={{ transform: `translateX(${beam.x}px)`, width: beam.w }}
        />
      </ul>
    </nav>
  );
}
