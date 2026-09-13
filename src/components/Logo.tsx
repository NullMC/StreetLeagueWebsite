export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className={`brand ${compact ? "brand--compact" : ""}`}
      href="/"
      aria-label="Street League home"
    >
      <img src="/assets/street-league-logo.png" alt="Street League" />
    </a>
  );
}
