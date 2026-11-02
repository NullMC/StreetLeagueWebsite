import type { ReactNode } from "react";
import { Typography } from "@mui/material";

export function SectionTitle({
  title, accent, action, leading, variant = "primary", as = "h2",
}: {
  eyebrow?: string;
  title: string;
  /** Parte finale del titolo resa in serif corsivo (il testo del titolo non cambia). */
  accent?: string;
  /** "h1" per il titolo principale della pagina (uno solo per pagina). */
  as?: "h1" | "h2";
  action?: ReactNode;
  leading?: ReactNode;
  variant?: "primary" | "group" | "subsection";
}) {
  const accentStart = accent && title.endsWith(accent) ? title.length - accent.length : -1;
  return (
    <div className={`section-head section-head--${variant}`}>
      <div>
        <div className={leading ? "section-head__title-line" : undefined}>
          {leading}
          <Typography component={as} variant="h2">
            {accentStart > 0 ? (
              <>
                {title.slice(0, accentStart)}
                <span className="sl-accent">{accent}</span>
              </>
            ) : title}
          </Typography>
        </div>
      </div>
      {action}
    </div>
  );
}
