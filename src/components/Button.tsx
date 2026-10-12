import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
};

export function Button({ children, type = "button", disabled, busy, onClick }: Props) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
      data-busy={busy || undefined}
      style={{
        padding: "9px 16px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        // Desabilitado se distingue por fundo, texto e borda tracejada — nunca
        // só por opacidade, que some no contraste.
        ...(disabled || busy
          ? { border: "2px dashed var(--rule2)", background: "var(--sunken)", color: "var(--ink2)", cursor: "default" }
          : { border: "1px solid var(--accent)", background: "var(--accent)", color: "var(--on-accent)" })
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
