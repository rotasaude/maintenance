import { ErrorState } from "./ErrorState";

// I4/spec §5: toda ação sensível (convidar mantenedor, criar token de
// serviço) pede de novo o código do autenticador — "step-up". Maintainers
// foi a primeira tela a levar os dois avisos que o mantenedor precisa: que
// um código pedido agora mesmo pode não valer ainda (o TOTP troca a cada 30
// segundos), e que um código errado conta para o MESMO contador de bloqueio
// da senha (spec §6). Tokens precisa dos dois avisos idênticos — extraídos
// aqui para as duas telas não divergirem, em vez de duplicar a string.
export const STEP_UP_CODE_HELP_TEXT = "Se acabou de entrar, espere o próximo código.";
export const STEP_UP_CODE_LOCK_WARNING = "Tentativas erradas contam para o bloqueio da conta.";

// Erro do campo "código" de um step-up: a mensagem da API (via ErrorState,
// role="alert") seguida do aviso de bloqueio — sempre os dois juntos, nunca
// só um.
export function StepUpCodeError({ message }: { message: string }) {
  return (
    <>
      <ErrorState message={message} />
      <p style={{ margin: 0, fontSize: 11, color: "var(--ink3)" }}>{STEP_UP_CODE_LOCK_WARNING}</p>
    </>
  );
}
