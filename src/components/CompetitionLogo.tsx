import type { Competition } from "../types";

export type CompetitionLogoSize = "tiny" | "small" | "heading" | "card" | "hero";

export function getCompetitionLogoUrl(competition: Pick<Competition, "logo_url" | "hero_image_url">): string | null {
  const logo = competition.logo_url?.trim();
  if (logo) return logo;
  return competition.hero_image_url?.trim() || null;
}

export function CompetitionLogo({
  competition, size = "small", className = "",
}: {
  competition: Pick<Competition, "logo_url" | "hero_image_url">;
  size?: CompetitionLogoSize;
  className?: string;
}) {
  const src = getCompetitionLogoUrl(competition);
  if (!src) return null;
  return <img className={["competition-logo", `competition-logo--${size}`, className].filter(Boolean).join(" ")} src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" />;
}

export function CompetitionLogoStack({
  competitions, size = "small", className = "",
}: {
  competitions: Array<Pick<Competition, "id" | "logo_url" | "hero_image_url">>;
  size?: CompetitionLogoSize;
  className?: string;
}) {
  const visible = competitions.filter((competition) => getCompetitionLogoUrl(competition));
  if (!visible.length) return null;
  const stackClass = visible.length > 1 ? "competition-logo-stack--multiple" : "";
  return <span className={["competition-logo-stack", stackClass, className].filter(Boolean).join(" ")}>
    {visible.map((competition) => <CompetitionLogo key={competition.id} competition={competition} size={size} />)}
  </span>;
}
