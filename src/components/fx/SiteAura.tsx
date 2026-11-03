/**
 * Sfondo unico della piattaforma, sul modello dei gradienti "aura", "Silk Blend"
 * e "Grained Gradient" di 21st.dev: due aure rosa che respirano lentamente,
 * una luce setosa che scorre sul fondo e una grana leggera. Solo CSS
 * (animazioni su transform), fisso dietro a tutte le pagine; stili in sl-polish.css.
 */
export function SiteAura() {
  return (
    <div className="sl-aura" aria-hidden="true">
      <span className="sl-aura__orb sl-aura__orb--a" />
      <span className="sl-aura__orb sl-aura__orb--b" />
      <span className="sl-aura__silk" />
      <span className="sl-aura__grain" />
    </div>
  );
}
