import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
