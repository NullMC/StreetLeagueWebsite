import { useEffect, useState } from "react";
import { Drawer, IconButton } from "@mui/material";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { useAdminSession } from "../hooks/useAdminSession";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInstagram,
  faYoutube,
  faTiktok,
} from "@fortawesome/free-brands-svg-icons";
import {
  faArrowsRotate,
  faChartLine,
  faHandshake,
  faHouse,
  faListOl,
  faLock,
  faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { MobileDock } from "./ui/MobileDock";
import { ThemeToggle } from "./ui/ThemeToggle";

const links = [
  { label: "Home", to: "/", icon: faHouse },
  { label: "Competizioni", to: "/competizioni", icon: faTrophy },
  { label: "Classifica", to: "/classifica", icon: faListOl },
  { label: "Statistiche Giocatori", to: "/statistiche", icon: faChartLine },
  { label: "Calciomercato", to: "/calciomercato", icon: faArrowsRotate },
  { label: "Sponsor & collabora", to: "/partner", icon: faHandshake },
  { label: "Admin", to: "/admin", icon: faLock },
];

const dockLinks = [
  { label: "Home", to: "/", icon: faHouse },
  { label: "Competizioni", to: "/competizioni", icon: faTrophy },
  { label: "Classifica", to: "/classifica", icon: faListOl },
  { label: "Statistiche", to: "/statistiche", icon: faChartLine },
];

const socialLinks = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/__streetleague__/",
    icon: faInstagram,
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@_streetleague_?lang=en",
    icon: faTiktok,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@streetleague2k25",
    icon: faYoutube,
  },
];

export function SiteHeader() {
  const { profile, loading } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sl-header${scrolled ? " is-scrolled" : ""}`}
        id="site-navigation"
        tabIndex={-1}
      >
        <div className="sl-header__inner">
          <Logo />

          <div className="sl-header__actions">
            {!loading && profile && (
              <div className="sl-header__admin" aria-label="Utente autenticato">
                <span className="sl-header__admin-dot" aria-hidden="true" />
                <span className="sl-header__admin-name">
                  {profile.full_name || profile.username}
                </span>
              </div>
            )}

            <div
              className="sl-header__socials"
              aria-label="Social Street League"
            >
              {socialLinks.map(({ label, href, icon }) => (
                <a
                  className="sl-icon-btn sl-icon-btn--quiet"
                  href={href}
                  key={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <FontAwesomeIcon icon={icon} aria-hidden="true" />
                </a>
              ))}
            </div>

            <ThemeToggle />

            <a
              className="sl-header__contact"
              href="mailto:streetleaguebari@gmail.com"
            >
              Contact
            </a>

            <button
              className={`sl-icon-btn sl-burger${open ? " is-open" : ""}`}
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Chiudi menu" : "Apri menu"}
              aria-expanded={open}
              aria-controls="mobile-navigation"
              type="button"
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            className: `mobile-menu--mui sl-drawer${open ? " is-open" : ""}`,
            id: "mobile-navigation",
          },
        }}
      >
        <div className="mobile-menu__head">
          <span className="eyebrow">Street League</span>
          <IconButton
            className="mobile-menu__close"
            type="button"
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
            size="small"
          >
            ×
          </IconButton>
        </div>
        <nav className="mobile-menu__nav" aria-label="Navigazione principale">
          {links.map(({ label, to, icon }) => (
            <NavLink
              viewTransition
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <span className="mobile-menu__nav-icon" aria-hidden="true">
                <FontAwesomeIcon icon={icon} />
              </span>
              <span className="mobile-menu__nav-label">{label}</span>
              <span className="mobile-menu__nav-arrow" aria-hidden="true">
                ↗
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="mobile-menu__footer">
          <a
            className="mobile-menu__contact"
            href="mailto:streetleaguebari@gmail.com"
            onClick={() => setOpen(false)}
          >
            Contatta Street League
          </a>
          <div
            className="mobile-menu__socials"
            aria-label="Social Street League"
          >
            {socialLinks.map(({ label, href, icon }) => (
              <a
                className="social-link"
                href={href}
                key={label}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
              >
                <FontAwesomeIcon icon={icon} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </Drawer>

      <MobileDock
        items={dockLinks}
        menuOpen={open}
        onMenu={() => setOpen(true)}
      />
    </>
  );
}
