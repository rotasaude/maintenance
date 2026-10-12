// Tons semânticos do maintenance. Os valores vivem no tema `rota`
// (src/theme/vendor/tokens.css, do contracts/design-tokens); aqui só o nome.
export type Tone = "ok" | "warn" | "down" | "info" | "accent" | "neutral" | "urgent";

export const toneColor = (t: Tone | string | undefined): { fg: string; bg: string } => {
  switch (t) {
    case "ok":      return { fg: "var(--ok)", bg: "var(--ok-bg)" };
    case "warn":    return { fg: "var(--warn)", bg: "var(--warn-bg)" };
    case "down":
    case "urgent":  return { fg: "var(--down)", bg: "var(--down-bg)" };
    case "info":    return { fg: "var(--info)", bg: "var(--info-bg)" };
    case "accent":  return { fg: "var(--accent)", bg: "var(--accent-bg)" };
    default:        return { fg: "var(--ink2)", bg: "var(--sunken)" };
  }
};
