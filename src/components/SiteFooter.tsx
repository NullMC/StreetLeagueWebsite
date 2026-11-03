import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="sl-footer" id="site-footer" tabIndex={-1}>
      <div className="sl-footer__glow" aria-hidden="true" />
      <div className="sl-footer__inner">
        <div className="sl-footer__brand">
          <Logo compact />
        </div>
        <div className="sl-footer__nav">
          <div>
            <span>NAVIGAZIONE</span>
            <Link viewTransition to="/competizioni">
              Competizioni
            </Link>
            <Link viewTransition to="/calciomercato">
              Calcio mercato
            </Link>
            <Link viewTransition to="/#home-matches">
              Calendario
            </Link>
            <Link viewTransition to="/classifica">
              Classifica
            </Link>
            <Link viewTransition to="/#home-teams">
              Squadre
            </Link>
            <Link viewTransition to="/statistiche">
              Statistiche
            </Link>
          </div>
          <div>
            <span>STREET LEAGUE</span>
            <Link viewTransition to="/partner">
              Sponsor & collabora
            </Link>
            <a href="mailto:streetleaguebari@gmail.com">Contatti</a>
          </div>
          <div>
            <span>SOCIAL</span>
            <a
              href="https://www.instagram.com/__streetleague__/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
            <a
              href="https://www.youtube.com/@streetleague2k25"
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube
            </a>
            <a
              href="https://www.tiktok.com/@_streetleague_?lang=en"
              target="_blank"
              rel="noopener noreferrer"
            >
              TikTok
            </a>
          </div>
        </div>
      </div>
      <div className="sl-footer__wordmark" aria-hidden="true">
        <img src="/assets/scritta.png" alt="" loading="lazy" decoding="async" />
      </div>
      <div className="sl-footer__bottom">
        <span>© Street League</span>
        <span>
          Made with <span aria-hidden="true">♥</span> by{" "}
          <a
            className="sl-footer__credit"
            href="https://franksitez.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Frank
          </a>
        </span>
      </div>
    </footer>
  );
}
