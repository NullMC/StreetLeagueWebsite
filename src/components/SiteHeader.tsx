import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Logo } from "./Logo";
import { useAdminSession } from "../hooks/useAdminSession";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInstagram,
  faYoutube,
  faTiktok,
} from "@fortawesome/free-brands-svg-icons";

const links = [
  ["Home", "/"],
  ["Competizioni", "/competizioni"],
  ["Classifica", "/classifica"],
  ["Squadre", "/squadre"],
  ["Giocatori", "/giocatori"],
  ["Statistiche", "/statistiche"],
  ["Partners", "/partner"],
  ["Collabora", "/collabora"],
  ["Admin", "/admin"],
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

  return (
    <>
      <header className="site-header">
        <Logo />

        <nav className="desktop-nav" id="site-navigation" aria-label="Navigazione principale">
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              {label}
            </NavLink>
          ))}
        </nav>

        {!loading && profile && (
          <div className="header-admin" aria-label="Utente autenticato">
            <span className="header-admin__label">
              <span className="header-admin__name">
                {profile.full_name || profile.username}
              </span>
            </span>
          </div>
        )}

        <div className="header-right">
          <a className="contact-link" href="mailto:streetleaguebari@gmail.com">
            Contact
          </a>
          <button
            className="menu-btn"
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

        <div className="second-site-header" aria-label="Social Street League">
          <div className="second-site-header__right">
            {socialLinks.map(({ label, href, icon }) => (
              <a
                className="contact-link social-link"
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
      </header>

      {open && (
        <div className="mobile-menu" id="mobile-navigation">
          <nav aria-label="Navigazione mobile">
            {links.map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <a
            href="mailto:streetleaguebari@gmail.com"
            onClick={() => setOpen(false)}
          >
            Contact
          </a>
        </div>
      )}
    </>
  );
}
