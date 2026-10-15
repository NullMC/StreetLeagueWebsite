import type { ReactNode } from "react";
import { Typography } from "@mui/material";
export function SectionTitle({
  title,
  action,
  variant = "primary",
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  variant?: "primary" | "group" | "subsection";
}) {
  return (
    <div className={`section-head section-head--${variant}`}>
      <div>
        <Typography component="h2" variant="h2">{title}</Typography>
      </div>
      {action}
    </div>
  );
}
