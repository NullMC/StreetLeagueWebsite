import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="site-footer" tabIndex={-1}>
      <div className="footer-brand">
        <Logo compact />
      </div>
      <div className="footer-nav">
        <div>
          <span>NAVIGAZIONE</span>
          <a href="/competizioni">Competizioni</a>
          <a href="/calciomercato">Calcio mercato</a>
          <a href="/partite">Calendario</a>
          <a href="/classifica">Classifica</a>
          <a href="/#home-teams">Squadre</a>
          <a href="/statistiche">Statistiche</a>
        </div>
        <div>
          <span>STREET LEAGUE</span>
          <a href="/partner">Sponsor & collabora</a>
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
      <div className="footer-bottom">
        <span>© Street League</span>
        <span>
          Made with <span aria-hidden="true">♥</span> by{" "}
          <a
            href="https://franksitez.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--pink)" }}
          >
            Frank
          </a>
        </span>
      </div>
    </footer>
  );
}
