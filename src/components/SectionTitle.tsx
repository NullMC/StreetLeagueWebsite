import type { ReactNode } from "react";
export function SectionTitle({
  eyebrow,
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
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
