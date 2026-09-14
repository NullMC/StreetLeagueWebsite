import { useRef } from "react";
import type { ReactNode } from "react";

type ContentCarouselProps = {
  children: ReactNode[];
};

export function ContentCarousel({ children }: ContentCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  if (!children.length) return null;

  const move = (direction: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const card = viewport.querySelector<HTMLElement>(".content-carousel__item");
    const amount = (card?.offsetWidth ?? viewport.clientWidth * 0.86) + 14;
    viewport.scrollBy({ left: amount * direction, behavior: "smooth" });
  };

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 8;
    if (!atEnd || children.length < 2) return;

    window.setTimeout(() => {
      const current = viewportRef.current;
      if (!current) return;
      current.scrollTo({ left: 0, behavior: "auto" });
    }, 220);
  };

  return (
    <div className="content-carousel">
      <div className="content-carousel__toolbar">
        <span className="eyebrow">Scorri per esplorare</span>
        <div className="content-carousel__controls">
          <button type="button" onClick={() => move(-1)} aria-label="Contenuto precedente">
            ←
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Contenuto successivo">
            →
          </button>
        </div>
      </div>
      <div
        className="content-carousel__viewport"
        ref={viewportRef}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Ultimi contenuti"
      >
        {children.map((child, index) => (
          <div className="content-carousel__item" key={index}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
