// Mensagem neutra para uma lista vazia (ex.: "nenhuma cidade") ou para uma
// tela ainda não construída (ex.: "em breve"). Sem role especial: não é
// erro, é um estado normal — ErrorState é quem carrega role="alert".
export function EmptyState({ message }: { message: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "24px 12px",
        textAlign: "center",
        color: "var(--ink3)",
        fontSize: 13
      }}
    >
      {message}
    </p>
  );
}
