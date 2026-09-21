import { useEffect, useRef, useState, type FormEvent } from "react";
import { toDataURL } from "qrcode";
import { rest } from "../lib/api";
import { RequestRejected } from "../lib/errors";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";

// Matrícula a partir do convite (spec §6, Task 5): dois POSTs sem sessão,
// protegidos só pelo token de uso único do link. O QR é desenhado NO
// NAVEGADOR (biblioteca `qrcode`, sem rede) — o segredo do TOTP nunca sai
// daqui além do POST de aceite, e nunca vai para outro host.
type EnrollPayload = { email_address: string; otpauth_uri: string; secret: string };

const MIN_PASSWORD_LENGTH = 12;
const WEAK_PASSWORD_MESSAGE = `a senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
const INVALID_CODE_MESSAGE = "código inválido — use o código atual do autenticador";
const INVALID_INVITATION_MESSAGE = "convite inválido, usado ou expirado";
const MISMATCH_MESSAGE = "as senhas não coincidem";
const DONE_MESSAGE = "Matrícula concluída. Entre com sua senha e o código do autenticador.";

// Fix round 1 (ruling P4): nenhuma tela mostra o `code` cru de um
// RequestRejected — ele é uma palavra de máquina (`http_404`,
// `weak_password`...), não uma frase para o mantenedor ler. Todo código
// conhecido tem sua mensagem aqui; o que não está no mapa cai na mensagem
// genérica, nunca no `.message` do erro (que É o código, veja
// src/lib/errors.ts). Erros que NÃO são RequestRejected (NetworkError,
// RateLimited...) já têm uma mensagem em português pronta para leitura —
// esses usam `.message` normalmente.
const REQUEST_MESSAGES: Record<string, string> = {
  http_404: INVALID_INVITATION_MESSAGE,
  weak_password: WEAK_PASSWORD_MESSAGE,
  invalid_code: INVALID_CODE_MESSAGE
};
const GENERIC_MESSAGE = "não foi possível concluir o convite — tente de novo";

function messageFor(err: unknown): string {
  if (err instanceof RequestRejected) return REQUEST_MESSAGES[err.code] ?? GENERIC_MESSAGE;
  if (err instanceof Error) return err.message;
  return GENERIC_MESSAGE;
}

// Fix round 1 (ruling P4): `onDone` carrega a mensagem de sucesso — quem
// mostra é a tela de entrar (App passa como `notice` do Login), não esta
// tela: `setDone` seguido de `onDone()` no mesmo lote nunca chegava a
// pintar nada, porque o pai já desmontava `Invitation` antes do commit.
export function Invitation({ token, onDone }: { token: string; onDone(message: string): void }) {
  const [ enrollment, setEnrollment ] = useState<EnrollPayload | null>(null);
  const [ qrDataUrl, setQrDataUrl ] = useState<string | null>(null);
  const [ loadError, setLoadError ] = useState<string | null>(null);

  const [ password, setPassword ] = useState("");
  const [ confirmPassword, setConfirmPassword ] = useState("");
  const [ code, setCode ] = useState("");
  const [ formError, setFormError ] = useState<string | null>(null);
  const [ busy, setBusy ] = useState(false);

  // Fix round 1 (achado durante a verificação manual do StrictMode): o
  // `alive` sozinho evita um SETSTATE indevido de um efeito já descartado,
  // mas não evita a SEGUNDA CHAMADA de rede em si — e /invitations/enroll
  // ROTACIONA o otp_secret do mantenedor a cada chamada (ver o controller).
  // Sob StrictMode (mount → cleanup → mount), duas chamadas reais saem, e
  // qual das duas grava por último no banco depende da ordem de resposta
  // do servidor — não necessariamente a mesma que a UI acaba mostrando.
  // Verificado ao vivo: a UI mostrou um secret que não era mais o do banco,
  // e o código gerado a partir dele foi recusado como inválido.
  //
  // Uma primeira tentativa guardou só "já pedi esse token" num ref e pulava
  // o efeito inteiro na segunda invocação — e quebrou: a PRIMEIRA invocação
  // (a que faz o fetch) tem seu `alive` derrubado pela PRÓPRIA limpeza
  // antes da resposta chegar, e a segunda invocação (a que sobrevive) não
  // tinha feito fetch nenhum para aplicar. Ninguém nunca aplicava o
  // resultado. A correção: o REF guarda a PROMISE em voo, não só um sinal —
  // toda invocação do efeito (a descartada e a sobrevivente) espera a MESMA
  // promise e aplica o resultado se ainda estiver viva; só quem cria a
  // promise (a primeira) de fato chama `rest(...)`/`fetch`.
  const enrollRequestRef = useRef<{ token: string; promise: Promise<EnrollPayload> } | null>(null);

  useEffect(() => {
    let alive = true;

    if (enrollRequestRef.current?.token !== token) {
      enrollRequestRef.current = { token, promise: rest<EnrollPayload>("POST", "/invitations/enroll", { token }) };
    }
    const { promise } = enrollRequestRef.current;

    (async () => {
      try {
        const payload = await promise;
        const dataUrl = await toDataURL(payload.otpauth_uri);
        if (!alive) return;
        setEnrollment(payload);
        setQrDataUrl(dataUrl);
      } catch (err) {
        if (!alive) return;
        setLoadError(messageFor(err));
      }
    })();
    return () => { alive = false; };
  }, [ token ]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) { setFormError(MISMATCH_MESSAGE); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { setFormError(WEAK_PASSWORD_MESSAGE); return; }

    setBusy(true);
    try {
      await rest("POST", "/invitations/accept", { token, password, code });
      onDone(DONE_MESSAGE);
    } catch (err) {
      setFormError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div style={{ maxWidth: 320, margin: "64px auto" }}>
        <ErrorState message={loadError} />
      </div>
    );
  }

  if (!enrollment || !qrDataUrl) return <p>carregando…</p>;

  return (
    <div style={{ maxWidth: 320, margin: "64px auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Matricular autenticador</h1>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink2)" }}>{enrollment.email_address}</p>

      <img src={qrDataUrl} alt="QR do autenticador" style={{ width: 200, height: 200 }} />
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink3)" }}>
        Não conseguiu ler o QR? Cadastre a chave manualmente: <code>{enrollment.secret}</code>
      </p>

      {formError && <ErrorState message={formError} />}

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field
          label="Senha"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <Field
          label="Confirmar senha"
          type="password"
          name="password-confirmation"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
        <Field
          label="Código"
          name="code"
          autoComplete="one-time-code"
          helpText="Código de 6 dígitos do app autenticador, já com a chave acima cadastrada."
          value={code}
          onChange={setCode}
        />
        <Button type="submit" busy={busy}>Concluir matrícula</Button>
      </form>
    </div>
  );
}
