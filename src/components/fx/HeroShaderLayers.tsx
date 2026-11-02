/*
 * Shader WebGL dell'hero costruiti su @paper-design/shaders-react, il motore dei
 * "Shader Hero", "Mesh drift" e "God Rays" di 21st.dev (stesso approccio di ItalFUT).
 * Paper mette in pausa il rendering fuori schermo e con la scheda nascosta;
 * qui il movimento si congela anche con prefers-reduced-motion e Save-Data.
 * Caricato in lazy da HeroBackdrop: non pesa sul bundle iniziale.
 */
import { useEffect } from "react";
import { GodRays, MeshGradient } from "@paper-design/shaders-react";

/* Palette brand: ink #010a08, rosa #e42278, rosa chiaro #ed7bab, cipria #f5d3dd, carta #f9f9f9 */
const palettes = {
  night: ["#010a08", "#14030c", "#3d0a24", "#e42278", "#071511", "#7a1446"],
  light: ["#fff6f9", "#f6bdd3", "#e42278", "#ffe6ef", "#ed7bab", "#fbeaf1"],
} as const;

function lowPower() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
  );
  return reduce || saveData;
}

export default function HeroShaderLayers({ night, onReady }: { night: boolean; onReady: () => void }) {
  useEffect(() => {
    const id = window.requestAnimationFrame(onReady);
    return () => window.cancelAnimationFrame(id);
  }, [onReady]);
  const still = lowPower();
  const mobile = window.innerWidth < 760;
  return (
    <>
      <MeshGradient
        className="sl-hero-fx__layer"
        colors={[...palettes[night ? "night" : "light"]]}
        distortion={0.9}
        swirl={0.28}
        grainMixer={0}
        grainOverlay={night ? 0.07 : 0.035}
        speed={still ? 0 : 0.26}
        frame={still ? 14000 : undefined}
        scale={1.2}
        rotation={200}
        offsetX={0.12}
        maxPixelCount={mobile ? 900_000 : 2_400_000}
        minPixelRatio={1}
      />
      <GodRays
        className="sl-hero-fx__layer sl-hero-fx__layer--rays"
        colorBack="#00000000"
        colorBloom={night ? "#e42278" : "#ffffff"}
        colors={night ? ["#ffd6e74d", "#e4227838", "#ed7bab24", "#ffffff12"] : ["#ffffff99", "#ffe3ee80", "#ed7bab33", "#ffffff40"]}
        offsetX={0.62}
        offsetY={-1.05}
        density={0.3}
        spotty={0.28}
        midSize={0.2}
        midIntensity={night ? 0.22 : 0.3}
        intensity={night ? 0.42 : 0.55}
        bloom={night ? 0.22 : 0.35}
        speed={still ? 0 : 0.35}
        frame={still ? 8000 : undefined}
        maxPixelCount={mobile ? 500_000 : 1_400_000}
        minPixelRatio={1}
      />
    </>
  );
}
