import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNightTheme, webglAvailable } from "./HeroBackdrop";

const AmbientShaderLayer = lazy(() => import("./AmbientShaderLayer"));

/*
 * Solo le pagine indice hanno l'atmosfera: home (ha il suo hero), dettagli
 * (squadra, giocatore, partita, articolo hanno già un'intestazione propria)
 * e admin restano senza, per non ripetere lo stesso sfondo ovunque.
 */
const AMBIENT_ROUTES = new Set(["/competizioni", "/classifica", "/statistiche", "/calciomercato", "/partner"]);

export function AmbientBackdrop() {
  const { pathname } = useLocation();
  const night = useNightTheme();
  const [gl, setGl] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGl(webglAvailable());
  }, []);

  if (!AMBIENT_ROUTES.has(pathname.replace(/\/+$/, ""))) return null;

  return (
    <div className={`sl-ambient${ready ? " is-ready" : ""}`} aria-hidden="true">
      {gl ? (
        <Suspense fallback={null}>
          <AmbientShaderLayer night={night} onReady={() => setReady(true)} />
        </Suspense>
      ) : null}
    </div>
  );
}
