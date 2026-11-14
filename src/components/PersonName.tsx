import type { CSSProperties } from "react";

/**
 * Name of a player or staff member. A double first name ("Marco Antonio") and a double
 * surname ("De Santis") always stay on one line: the text can only wrap between the two.
 * `stacked` puts the surname on its own line (cards with a large name).
 */
export function PersonName({ first, last, stacked = false }: { first: string; last: string; stacked?: boolean }) {
  const firstName = (first ?? "").trim();
  const lastName = (last ?? "").trim();
  return (
    <>
      {firstName && <span className="sl-name-part">{firstName}</span>}
      {firstName && lastName ? (stacked ? <br /> : " ") : null}
      {lastName && <span className="sl-name-part">{lastName}</span>}
    </>
  );
}

/**
 * Inline style for a stacked name: exposes the length of the longest line so the CSS can
 * shrink the font when a long first name or surname would not fit the card.
 */
export function nameLengthStyle(first: string, last: string): CSSProperties {
  const chars = Math.max((first ?? "").trim().length, (last ?? "").trim().length, 6);
  return { "--name-chars": chars } as CSSProperties;
}
