import type { ReactNode } from "react";

/**
 * Compatibility wrapper for pages that still use the previous PageShell API.
 * Global chrome now lives in AppLayout, mounted once in main.tsx.
 */
export function PageShell({
  children,
  title: _title,
  eyebrow: _eyebrow,
}: {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  return <>{children}</>;
}
