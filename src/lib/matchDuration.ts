/** Regulation time for Street League matches. Match events belong to minutes 1–50. */
export const MATCH_DURATION_MINUTES = 50;
export function isValidMatchMinute(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= 1 && value <= MATCH_DURATION_MINUTES;
}
