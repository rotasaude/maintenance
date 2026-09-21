import { useState, type FormEvent } from "react";
import { rest } from "../lib/api";
import { InvalidCredentials, NetworkError, RateLimited } from "../lib/errors";
import { toMe, type Me, type SessionPayload } from "../lib/session";
import { Field } from "../components/Field";
import { Button } from "../components/Button";
import { ErrorState } from "../components/ErrorState";

// Entrada em dois passos (spec §5): senha e depois o código do app
// autenticador. O session_id do passo intermediário vive só neste estado —
// nunca em localStorage, nunca na URL — e some ao voltar ao passo 1.
type Step = "credentials" | "code";
type LoginFailure = { error?: string };

// I2: nenhuma falha pode deixar o formulário mudo. InvalidCredentials e
// RateLimited já têm mensagem pronta em português (src/lib/errors.ts);
// NetworkError também. Qualquer outra coisa — RequestRejected (403 de
// Origin, 500, 404...), AuthRequired, ou algo inesperado — cai na mensagem
// genérica: nunca relança sem mostrar nada.
const GENERIC_LOGIN_ERROR = "não foi possível entrar agora — tente de novo";

function messageFor(err: unknown): string {
  if (err instanceof InvalidCredentials || err instanceof RateLimited || err instanceof NetworkError) {
    return err.message;
  }
  return GENERIC_LOGIN_ERROR;
}

export function Login({ onSignedIn, notice }: { onSignedIn(me: Me): void; notice?: string | null }) {
  const [ step, setStep ] = useState<Step>("credentials");
  const [ emailAddress, setEmailAddress ] = useState("");
  const [ password, setPassword ] = useState("");
  const [ code, setCode ] = useState("");
  const [ sessionId, setSessionId ] = useState<string | null>(null);
  const [ error, setError ] = useState<string | null>(null);
  const [ busy, setBusy ] = useState(false);

  function backToCredentials(message: string) {
    setError(message);
    setSessionId(null);
    setCode("");
    setPassword("");
    setStep("credentials");
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = await rest<LoginFailure & { session_id: string }>(
        "POST", "/session", { email_address: emailAddress, password }
      );
      setSessionId(payload.session_id);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!sessionId) return;
    setError(null);
    setBusy(true);
    try {
      const payload = await rest<SessionPayload>("POST", "/session/challenge", { session_id: sessionId, code });
      onSignedIn(toMe(payload));
    } catch (err) {
      if (err instanceof InvalidCredentials) backToCredentials(err.message);
      else setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  const shownMessage = error ?? notice ?? null;

  return (
    <div style={{ maxWidth: 320, margin: "64px auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Entrar</h1>
      {shownMessage && <ErrorState message={shownMessage} />}

      {step === "credentials" && (
        <form onSubmit={submitCredentials} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field
            label="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            value={emailAddress}
            onChange={setEmailAddress}
          />
          <Field
            label="Senha"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          <Button type="submit" busy={busy}>Entrar</Button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field
            label="Código"
            name="code"
            autoComplete="one-time-code"
            helpText="Código de 6 dígitos do seu app autenticador."
            value={code}
            onChange={setCode}
          />
          <Button type="submit" busy={busy}>Confirmar</Button>
        </form>
      )}
    </div>
  );
}
