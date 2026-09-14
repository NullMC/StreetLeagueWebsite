import { Link } from "react-router-dom";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      className={`brand ${compact ? "brand--compact" : ""}`}
      to="/"
      aria-label="Street League home"
    >
      <img src="/assets/pittogrammaBlack.png" alt="Street League" />
    </Link>
  );
}
