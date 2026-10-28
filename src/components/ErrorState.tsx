// Mensagem de erro anunciada por leitor de tela (spec: role="alert").
// `quiet`: cópia só visual de uma frase já anunciada em outro ponto da tela (sem alert, fora da árvore de acessibilidade).
export function ErrorState({ message, quiet }: { message: string; quiet?: boolean }) {
  return (
    <div
      role={quiet ? undefined : "alert"}
      aria-hidden={quiet || undefined}
      style={{
        padding: "10px 12px",
        border: "1px solid var(--rule2)",
        borderRadius: 6,
        background: "var(--down-bg)",
        color: "var(--down)",
        fontSize: 12.5
      }}
    >
      {message}
    </div>
  );
}
