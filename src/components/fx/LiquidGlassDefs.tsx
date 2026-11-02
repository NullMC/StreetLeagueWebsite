import { useEffect } from "react";

/**
 * Filtro SVG per l'effetto "liquid glass": rifrazione del contenuto dietro le superfici in vetro.
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
    </svg>
  );
}
