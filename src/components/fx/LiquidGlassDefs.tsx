import { useEffect } from "react";

/**
 * Filtri SVG condivisi: "liquid glass" e bomboletta spray (vedi sotto).
 * Liquid glass: rifrazione del contenuto dietro le superfici in vetro.
 * Solo i browser Chromium supportano filtri SVG dentro backdrop-filter: lì viene attivata la classe
 * `sl-liquid`; gli altri browser usano il vetro sfocato standard.
 */
export function LiquidGlassDefs() {
  useEffect(() => {
    const brands = (
      navigator as Navigator & {
        userAgentData?: { brands?: Array<{ brand: string }> };
      }
    ).userAgentData?.brands;
    const isChromium = Boolean(
      brands?.some((entry) =>
        /Chromium|Google Chrome|Microsoft Edge/i.test(entry.brand),
      ),
    );
    const reduced = window.matchMedia(
      "(prefers-reduced-transparency: reduce)",
    ).matches;
    if (isChromium && !reduced)
      document.documentElement.classList.add("sl-liquid");
    return () => document.documentElement.classList.remove("sl-liquid");
  }, []);

  return (
    <svg
      className="sl-liquid-defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <filter
        id="sl-liquid-glass"
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.014"
          numOctaves="2"
          seed="11"
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation="2.4" result="soft" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="soft"
          scale="46"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      {/*
        Bomboletta spray sulle scritte (titoli e accenti): nebbia di vernice rosa dal bordo
        irregolare con pochi puntini di overspray, al posto del bagliore.
        Le macchie di vernice con colature degli sfondi sono immagini: public/assets/spray/.
      */}
      <filter
        id="sl-spray-text"
        x="-10%"
        y="-40%"
        width="120%"
        height="180%"
        colorInterpolationFilters="sRGB"
      >
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="thick" />
        <feGaussianBlur in="thick" stdDeviation="6" result="mist" />
        {/* Bordo irregolare della nebbia di vernice (rumore a bassa frequenza) */}
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="blotch" />
        <feDisplacementMap in="mist" in2="blotch" scale="14" xChannelSelector="R" yChannelSelector="G" result="cloud" />
        {/* Pochi puntini fini di overspray */}
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="6" result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  6 0 0 0 -3.9" result="dots" />
        <feComposite in="cloud" in2="dots" operator="arithmetic" k1="0.8" k2="0.55" result="spray" />
        <feFlood className="sl-spray-paint sl-spray-paint--text" result="paint" />
        <feComposite in="paint" in2="spray" operator="in" result="painted" />
        <feMerge>
          <feMergeNode in="painted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}
