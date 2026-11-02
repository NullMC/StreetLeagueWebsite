/** Skeleton di caricamento: il testo resta disponibile agli screen reader. */
export function SkeletonCards({
  label,
  count = 3,
  variant = "card",
}: {
  label: string;
  count?: number;
  variant?: "card" | "tile" | "row";
}) {
  return (
    <div
      className={`sl-skeleton sl-skeleton--${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="sl-visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="sl-skeleton__item" key={index} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
