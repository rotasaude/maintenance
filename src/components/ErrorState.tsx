// Mensagem de erro anunciada por leitor de tela (spec: role="alert").
export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
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
