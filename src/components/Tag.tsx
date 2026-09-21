import type { ReactNode } from "react";
import { toneColor, type Tone } from "../theme/tokens";

// Selo curto (ex.: "schema atrasado"). `tone` escolhe a cor semântica; sem
// tone, cai no neutro — nunca inventa dado, só rotula o que a tela já tem.
export function Tag({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const { fg, bg } = toneColor(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        color: fg,
        background: bg,
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}
