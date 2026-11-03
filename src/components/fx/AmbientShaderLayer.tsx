/*
 * Mesh gradient d'atmosfera per le pagine indice: stesso motore dell'hero
 * (@paper-design/shaders-react) ma con palette a basso contrasto, poca
 * distorsione e movimento lentissimo, così resta sullo sfondo senza distrarre.
 * Caricato in lazy da AmbientBackdrop.
 */
import { useEffect } from "react";
import { MeshGradient } from "@paper-design/shaders-react";

const palettes = {
  night: ["#010a08", "#14030c", "#2c0819", "#5a1034", "#06120e"],
  light: ["#fbf8f9", "#fde9f1", "#f7cfdf", "#fff6f9", "#f4dbe5"],
} as const;

function lowPower() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
  );
  return reduce || saveData;
}

export default function AmbientShaderLayer({ night, onReady }: { night: boolean; onReady: () => void }) {
  useEffect(() => {
    const id = window.requestAnimationFrame(onReady);
    return () => window.cancelAnimationFrame(id);
  }, [onReady]);
  const still = lowPower();
  return (
    <MeshGradient
      className="sl-ambient__layer"
      colors={[...palettes[night ? "night" : "light"]]}
      distortion={0.55}
      swirl={0.1}
      grainMixer={0}
      grainOverlay={night ? 0.05 : 0.02}
      speed={still ? 0 : 0.12}
      frame={still ? 9000 : undefined}
      scale={1.4}
      rotation={200}
      maxPixelCount={900_000}
      minPixelRatio={1}
    />
  );
}
