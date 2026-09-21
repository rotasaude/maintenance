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
        border: "1px solid var(--accent)",
        borderRadius: 6,
        background: "var(--accent)",
        color: "white",
        fontSize: 13,
        fontWeight: 600,
        opacity: disabled || busy ? 0.6 : 1
      }}
    >
      {busy ? "…" : children}
    </button>
  );
}
