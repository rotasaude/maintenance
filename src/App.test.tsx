import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { SessionProvider } from "./lib/session";

afterEach(cleanup);

// Fix round 1 (Task 5, ruling P3): o token do convite é lido UMA vez, fora
// de qualquer componente (src/main.tsx), antes de createRoot — não mais via
// useState(() => readInvitationToken(...)) dentro de App. Um inicializador
// preguiçoso de useState parece rodar uma vez, mas o StrictMode do React 18
// chama o inicializador DUAS VEZES de propósito, em dev, para flagar
// inicializadores impuros — e ler o fragmento e limpar a URL É impuro. A
// primeira chamada lê e limpa; a segunda já vê a URL limpa e devolve null.
// Por isso este teste renderiza sob <StrictMode>, exatamente como main.tsx
// faz de verdade — sem isso o regressão não aparece.
vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,FAKE")
}));

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" }
  });
}

function renderApp(initialInvitationToken: string | null) {
  const queryClient = new QueryClient();
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <App initialInvitationToken={initialInvitationToken} />
        </SessionProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

describe("App — o token do convite sobrevive ao StrictMode", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("com initialInvitationToken definido, mostra a tela de matrícula e matricula com o token exato", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url) === "/invitations/enroll") {
        return Promise.resolve(reply(200, {
          email_address: "novo@rotasaude.app",
          otpauth_uri: "otpauth://totp/RotaSaude:novo@rotasaude.app?secret=CHAVE123&issuer=RotaSaude",
          secret: "CHAVE123"
        }));
      }
      // GET /session do SessionProvider — resolve logo, sem sessão.
      return Promise.resolve(reply(401, { error: "unauthenticated" }));
    });

    renderApp("token-do-convite-abc");

    expect(await screen.findByText("novo@rotasaude.app")).not.toBeNull();

    // Duas regressões numa só asserção: o token não pode virar null sob o
    // StrictMode (a causa raiz deste fix round), e /invitations/enroll —
    // que ROTACIONA o otp_secret do mantenedor a cada chamada — não pode
    // ser chamado duas vezes (achado durante a verificação manual: a
    // segunda chamada some sob `alive`, mas ainda assim rotaciona o
    // segredo de verdade no servidor, e qual delas "vence" no banco não é
    // garantidamente a que a UI mostra).
    const enrollCalls = fetchMock.mock.calls.filter(([ url ]) => String(url) === "/invitations/enroll");
    expect(enrollCalls).toHaveLength(1);
    expect(JSON.parse((enrollCalls[0][1] as RequestInit).body as string)).toEqual({
      token: "token-do-convite-abc"
    });
  });

  it("sem token, mostra a tela de entrar normalmente", async () => {
    fetchMock.mockResolvedValue(reply(401, { error: "unauthenticated" }));

    renderApp(null);

    expect(await screen.findByRole("heading", { name: "Entrar" })).not.toBeNull();
  });

  it("ao concluir a matrícula, a tela de entrar mostra a mensagem de sucesso como notice", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    fetchMock.mockImplementation((url: string) => {
      const path = String(url);
      if (path === "/invitations/enroll") {
        return Promise.resolve(reply(200, {
          email_address: "novo@rotasaude.app",
          otpauth_uri: "otpauth://totp/RotaSaude:novo@rotasaude.app?secret=CHAVE123&issuer=RotaSaude",
          secret: "CHAVE123"
        }));
      }
      if (path === "/invitations/accept") return Promise.resolve(reply(204));
      return Promise.resolve(reply(401, { error: "unauthenticated" }));
    });

    renderApp("token-do-convite-abc");
    await screen.findByText("novo@rotasaude.app");

    await user.type(screen.getByLabelText("Senha"), "senha-com-mais-de-12");
    await user.type(screen.getByLabelText("Confirmar senha"), "senha-com-mais-de-12");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Concluir matrícula" }));

    expect(await screen.findByRole("heading", { name: "Entrar" })).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(
      "Matrícula concluída. Entre com sua senha e o código do autenticador."
    );
  });

  // I5: maintenanceEnv() agora FALHA ALTO num build de produção sem
  // VITE_MAINTENANCE_ENV (em vez de assumir "development" e esconder a
  // faixa de ambiente). Chamado no topo de App, em render — sem tratamento,
  // isso derrubaria a árvore inteira e deixaria a tela em branco. import.meta.env
  // é mutável em runtime sob o Vitest (não há substituição estática como no
  // build real), então este teste simula o build de produção mutando os
  // dois campos e desfazendo no fim, sem depender de nenhum outro teste.
  it("um erro ao determinar o ambiente mostra uma mensagem visível, nunca a tela em branco", async () => {
    const originalProd = import.meta.env.PROD;
    const originalEnvVar = import.meta.env.VITE_MAINTENANCE_ENV;
    // import.meta.env é um proxy que só guarda strings — atribuir undefined
    // vira a STRING "undefined" (e o valor deixaria de contar como
    // "ausente"). "" é o jeito certo de simular a variável não definida.
    Object.assign(import.meta.env, { PROD: true, VITE_MAINTENANCE_ENV: "" });

    fetchMock.mockResolvedValue(reply(401, { error: "unauthenticated" }));

    try {
      renderApp(null);
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe("VITE_MAINTENANCE_ENV é obrigatória em build de produção");
    } finally {
      Object.assign(import.meta.env, { PROD: originalProd });
      if (originalEnvVar === undefined) delete (import.meta.env as Record<string, unknown>).VITE_MAINTENANCE_ENV;
      else import.meta.env.VITE_MAINTENANCE_ENV = originalEnvVar;
    }
  });
});
