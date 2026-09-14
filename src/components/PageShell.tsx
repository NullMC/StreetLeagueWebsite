import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Seo } from "./Seo";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Seo />
      <a className="skip-link" href="#main-content">
        Vai al contenuto
      </a>
      <a className="skip-link skip-link--nav" href="#site-navigation">
        Vai alla navigazione
      </a>
      <a className="skip-link skip-link--footer" href="#site-footer">
        Vai al footer
      </a>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
