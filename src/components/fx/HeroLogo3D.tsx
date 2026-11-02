import type { CSSProperties } from "react";

/* Spessore del logo: strati con la sagoma del logo, impilati lungo l'asse Z. */
const DEPTH_LAYERS = 18;

/**
 * Logo Street League in 3D (solo CSS): faccia frontale, spessore estruso con la sagoma
 * del logo, riflesso speculare che scorre, alone e ombra a terra.
 * Inquadratura cinematica leggermente laterale, oscillazione lenta, inclinazione col puntatore
 * (variabili --tilt-x / --tilt-y impostate dall'hero). Statico con prefers-reduced-motion.
 */
export function HeroLogo3D() {
  return (
    <div className="sl-logo3d">
      <div className="sl-logo3d__halo" aria-hidden="true" />
      <div className="sl-logo3d__stage">
        <div className="sl-logo3d__object">
          {Array.from({ length: DEPTH_LAYERS }, (_, index) => (
            <span
              key={index}
              className="sl-logo3d__slice"
              style={{ "--z": index + 1 } as CSSProperties}
              aria-hidden="true"
            />
          ))}
          <img
            className="sl-logo3d__face"
            src="/assets/logo.png"
            alt="Logo Street League"
            width="581"
            height="430"
            fetchPriority="high"
          />
          <span className="sl-logo3d__sheen" aria-hidden="true" />
        </div>
      </div>
      <div className="sl-logo3d__shadow" aria-hidden="true" />
    </div>
  );
}
