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
        Bomboletta spray: al posto dei bagliori morbidi, vernice nebulizzata con grana
        e puntini (overspray), come una tag su un muro.
        - sl-spray: alone di vernice rosa attorno alla sagoma (testi, pulsanti, card, loghi)
        - sl-spray-cloud: sfuma a spruzzo una macchia di colore (aloni di sfondo)
      */}
      <filter
        id="sl-spray"
        x="-25%"
        y="-60%"
        width="150%"
        height="220%"
        colorInterpolationFilters="sRGB"
      >
        <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="thick" />
        <feGaussianBlur in="thick" stdDeviation="5" result="mist" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="4" result="grain" />
        <feDisplacementMap in="mist" in2="grain" scale="20" xChannelSelector="R" yChannelSelector="G" result="scatter" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.25" result="dots" />
        <feComposite in="scatter" in2="dots" operator="arithmetic" k1="1.15" k2="0.3" result="spray" />
        <feFlood className="sl-spray-paint" result="paint" />
        <feComposite in="paint" in2="spray" operator="in" result="painted" />
        <feMerge>
          <feMergeNode in="painted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Variante per le scritte: quasi solo puntini, così la tag resta leggibile */}
      <filter
        id="sl-spray-text"
        x="-10%"
        y="-40%"
        width="120%"
        height="180%"
        colorInterpolationFilters="sRGB"
      >
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="thick" />
        <feGaussianBlur in="thick" stdDeviation="4" result="mist" />
        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="2" result="grain" />
        <feDisplacementMap in="mist" in2="grain" scale="16" xChannelSelector="R" yChannelSelector="G" result="scatter" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.4 0 0 0 -1.5" result="dots" />
        <feComposite in="scatter" in2="dots" operator="arithmetic" k1="1" k2="0.06" result="spray" />
        <feFlood className="sl-spray-paint sl-spray-paint--text" result="paint" />
        <feComposite in="paint" in2="spray" operator="in" result="painted" />
        <feMerge>
          <feMergeNode in="painted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter
        id="sl-spray-cloud"
        x="-15%"
        y="-15%"
        width="130%"
        height="130%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="1" seed="9" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="42" xChannelSelector="R" yChannelSelector="G" result="scatter" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.2 0 0 0 -1.25" result="dots" />
        <feComposite in="scatter" in2="dots" operator="arithmetic" k1="1.1" k2="0.35" />
      </filter>
    </svg>
  );
}
