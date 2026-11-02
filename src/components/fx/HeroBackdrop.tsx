import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";

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

/* Punti luce deterministici (nessuno spostamento di layout tra un render e l'altro). */
const POINTS = [
  { x: "8%", y: "22%", s: 5, d: 11, delay: 0 },
  { x: "18%", y: "68%", s: 4, d: 13, delay: 2.2 },
  { x: "29%", y: "12%", s: 3, d: 9, delay: 4.1 },
  { x: "41%", y: "78%", s: 6, d: 12, delay: 1.3 },
  { x: "53%", y: "30%", s: 3, d: 10, delay: 5.4 },
  { x: "64%", y: "58%", s: 5, d: 14, delay: 3.1 },
  { x: "72%", y: "16%", s: 4, d: 9.5, delay: 0.7 },
  { x: "83%", y: "72%", s: 3, d: 12.5, delay: 6.2 },
  { x: "91%", y: "34%", s: 6, d: 15, delay: 2.8 },
  { x: "36%", y: "46%", s: 2, d: 8, delay: 7.1 },
  { x: "77%", y: "44%", s: 2, d: 8.5, delay: 4.6 },
  { x: "12%", y: "88%", s: 3, d: 11.5, delay: 3.7 },
];

/**
 * Sfondo cinematografico dell'hero a livelli:
 * immagine di fallback (in pagina) → mesh gradient WebGL + raggi di luce → punti luce → grana → sfumatura.
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
      <div className="sl-hero-fx__glow">
        {POINTS.map((point, index) => (
          <i
            key={index}
            style={
              {
                "--x": point.x,
                "--y": point.y,
                "--s": point.s + "px",
                "--d": point.d + "s",
                "--delay": "-" + point.delay + "s",
                "--dx": (index % 2 ? -1 : 1) * (10 + index * 2) + "px",
                "--dy": -(14 + (index % 4) * 8) + "px",
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="sl-hero-fx__grain" />
    </div>
  );
}
