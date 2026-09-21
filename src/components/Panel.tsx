import type { ReactNode } from "react";

// Cartão com título e ações opcionais no cabeçalho — molde reaproveitado
// pelo topo da cidade e por cada aba do detalhe.
type Props = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, actions, children }: Props) {
  return (
    <section
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 10,
        background: "var(--panel)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      {(title !== undefined || actions !== undefined) && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {title !== undefined && <h2 style={{ margin: 0, fontSize: 13.5 }}>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
