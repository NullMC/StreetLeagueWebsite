import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Seo } from "./Seo";
import { SiteAura } from "./fx/SiteAura";
import { LiquidGlassDefs } from "./fx/LiquidGlassDefs";
import { useCinematics } from "./fx/useCinematics";

/** Riporta in cima a ogni cambio pagina e gestisce gli anchor (#sezione) nelle navigazioni SPA. */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      let attempts = 0;
      let timer = 0;
      const tryScroll = () => {
        const target = document.getElementById(
          decodeURIComponent(hash.slice(1)),
        );
        if (target) {
          target.scrollIntoView({ block: "start" });
          return;
        }
        if (attempts++ < 20) timer = window.setTimeout(tryScroll, 100);
      };
      tryScroll();
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return undefined;
  }, [pathname, hash]);

  return null;
}

export function AppLayout({ children }: { children: ReactNode }) {
  useCinematics();

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Vai al contenuto
      </a>
      <a className="skip-link skip-link--nav" href="#site-navigation">
        Vai alla navigazione
      </a>
      <a className="skip-link skip-link--footer" href="#site-footer">
        Vai al footer
      </a>

      <LiquidGlassDefs />
      <SiteAura />
      <div className="sl-scroll-progress" aria-hidden="true" />
      <ScrollManager />
      <SiteHeader />
      <Seo />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
