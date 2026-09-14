import "../styles/collab-carousel.css";
import { useMemo, useRef, useState } from "react";
import type { ActiveCollaboration } from "../types";

export function CollabCarousel({ items }: { items: ActiveCollaboration[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const ordered = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);

  if (!ordered.length) return null;

  const move = (direction: 1 | -1) => {
    const next = (active + direction + ordered.length) % ordered.length;
    setActive(next);
    viewportRef.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  const updateActive = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;

    Array.from(viewport.children).forEach((child, index) => {
      const element = child as HTMLElement;
      const childCenter = element.offsetLeft + element.offsetWidth / 2;
      const nextDistance = Math.abs(center - childCenter);
      if (nextDistance < distance) {
        distance = nextDistance;
        closest = index;
      }
    });

    setActive(closest);
  };

  return (
    <div className="collab-carousel" aria-label="Collaborazioni attive">
      <div className="collab-carousel__toolbar">
        <div>
          <span className="eyebrow">Collaborazioni attive</span>
          <p>Scorri per vedere le iniziative attualmente attive.</p>
        </div>
        {ordered.length > 1 && (
          <div className="collab-carousel__controls">
            <button type="button" onClick={() => move(-1)} aria-label="Collaborazione precedente">←</button>
            <button type="button" onClick={() => move(1)} aria-label="Collaborazione successiva">→</button>
          </div>
        )}
      </div>
      <div className="collab-carousel__viewport" ref={viewportRef} onScroll={updateActive}>
        {ordered.map((item, index) => (
          <article className={`collab-carousel__item ${index === active ? "is-active" : ""}`} key={item.id}>
            <div className="collab-carousel__poster">
              <img src={item.flyer_url} alt="Volantino collaborazione attiva" />
            </div>
          </article>
        ))}
      </div>
      {ordered.length > 1 && (
        <div className="collab-carousel__dots" aria-hidden="true">
          {ordered.map((item, index) => <span key={item.id} className={index === active ? "is-active" : ""} />)}
        </div>
      )}
    </div>
  );
}
