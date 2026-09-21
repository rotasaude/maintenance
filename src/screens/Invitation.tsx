import { useEffect, useState, type FormEvent } from "react";
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

export function Invitation({ token, onDone }: { token: string; onDone(): void }) {
  const [ enrollment, setEnrollment ] = useState<EnrollPayload | null>(null);
  const [ qrDataUrl, setQrDataUrl ] = useState<string | null>(null);
  const [ loadError, setLoadError ] = useState<string | null>(null);

  const [ password, setPassword ] = useState("");
  const [ confirmPassword, setConfirmPassword ] = useState("");
  const [ code, setCode ] = useState("");
  const [ formError, setFormError ] = useState<string | null>(null);
  const [ done, setDone ] = useState(false);
  const [ busy, setBusy ] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const payload = await rest<EnrollPayload>("POST", "/invitations/enroll", { token });
        const dataUrl = await toDataURL(payload.otpauth_uri);
        if (!alive) return;
        setEnrollment(payload);
        setQrDataUrl(dataUrl);
      } catch (err) {
        if (!alive) return;
        setLoadError(err instanceof RequestRejected ? INVALID_INVITATION_MESSAGE : (err as Error).message);
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
      setDone(true);
      onDone();
    } catch (err) {
      if (err instanceof RequestRejected && err.code === "weak_password") setFormError(WEAK_PASSWORD_MESSAGE);
      else if (err instanceof RequestRejected && err.code === "invalid_code") setFormError(INVALID_CODE_MESSAGE);
      else setFormError((err as Error).message);
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

      {done && <p role="status">{DONE_MESSAGE}</p>}
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
