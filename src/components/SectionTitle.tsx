import type { ReactNode } from "react";
import { Typography } from "@mui/material";

export function SectionTitle({
  title, action, leading, variant = "primary",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  leading?: ReactNode;
  variant?: "primary" | "group" | "subsection";
}) {
  return (
    <div className={`section-head section-head--${variant}`}>
      <div>
        <div className={leading ? "section-head__title-line" : undefined}>
          {leading}
          <Typography component="h2" variant="h2">{title}</Typography>
        </div>
      </div>
      {action}
    </div>
  );
}
