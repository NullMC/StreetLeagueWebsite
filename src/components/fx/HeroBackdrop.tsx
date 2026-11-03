import { lazy, Suspense, useEffect, useState } from "react";

const HeroShaderLayers = lazy(() => import("./HeroShaderLayers"));

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const isNightTheme = () => document.documentElement.dataset.theme === "night";

/** Segue il tema (data-theme su <html>) per ricolorare gli shader al cambio. */
function useNightTheme() {
  const [night, setNight] = useState(isNightTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setNight(isNightTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return night;
}

/**
 * Sfondo cinematografico dell'hero a livelli:
 * immagine di fallback (in pagina) → mesh gradient WebGL + raggi di luce → grana → sfumatura.
 */
export function HeroBackdrop() {
  const night = useNightTheme();
  const [gl, setGl] = useState(false);
  // Dissolvenza sopra l'immagine statica appena il modulo degli shader è montato.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGl(webglAvailable());
  }, []);

  return (
    <div className={`sl-hero-fx${ready ? " is-ready" : ""}`} aria-hidden="true">
      {gl ? (
        <Suspense fallback={null}>
          <div className="sl-hero-fx__shaders">
            <HeroShaderLayers night={night} onReady={() => setReady(true)} />
          </div>
        </Suspense>
      ) : null}
      <div className="sl-hero-fx__grain" />
    </div>
  );
}
