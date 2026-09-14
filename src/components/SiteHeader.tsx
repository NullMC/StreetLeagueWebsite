import { useState } from "react";
import { Link } from "react-router-dom";
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
export function SiteHeader() {
  const { profile, loading } = useAdminSession();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="site-header">
        <Logo />
        <nav className="desktop-nav">
          {links.map(([label, to]) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        {!loading && profile && (
          <div className="header-admin">
            <span className="header-admin__label">
              <span
                className="header-admin__name"
                style={{ color: "var(--pink)" }}
              >
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
            onClick={() => setOpen(!open)}
            aria-label="Apri menu"
          >
            <span />
            <span />
          </button>
        </div>
        <div className="second-site-header">
        <div className="second-site-header__right"> 
          <a className="contact-link" href="https://www.instagram.com/__streetleague__/">
            <FontAwesomeIcon icon={faInstagram} />
          </a>
          <a className="contact-link" href="https://www.tiktok.com/@_streetleague_?lang=en">
            <FontAwesomeIcon icon={faTiktok} />
          </a>
          <a className="contact-link" href="https://www.youtube.com/@streetleague2k25">
            <FontAwesomeIcon icon={faYoutube} />
          </a>
        </div>
      </div>
      </header>
      {open && (
        <div className="mobile-menu">
          <nav>
            {links.map(([label, to]) => (
              <Link key={to} to={to} onClick={() => setOpen(false)}>
                {label}
              </Link>
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
