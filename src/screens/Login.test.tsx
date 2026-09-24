import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./Login";

// `globals: false` em vitest.config.ts: sem afterEach global, o cleanup
// automático do Testing Library não roda sozinho entre os testes.
afterEach(cleanup);

// Spec: o session_id do login pendente vive só em memória — nunca no
// localStorage. Confere ao fim de todo exemplo, não só nos que mexem nele.
afterEach(() => {
  expect(localStorage.length).toBe(0);
});

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Login", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onSignedIn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    onSignedIn = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("passo 1: envia e-mail e senha e, com session_id na resposta, mostra o campo de código sem expô-lo", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(200, { mfa_required: true, session_id: "sess-secreta-123" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByLabelText("Código");

    const [ url, init ] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/session");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email_address: "a@b.com",
      password: "correcthorsebatterystaple"
    });

    expect(document.body.textContent).not.toContain("sess-secreta-123");
    expect(localStorage.length).toBe(0);
  });

  it("passo 2: envia o código e chama onSignedIn com o Me convertido", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(200, { mfa_required: true, session_id: "sess-1" }));
    fetchMock.mockResolvedValueOnce(
      reply(200, {
        id: "m1",
        email_address: "a@b.com",
        mfa_verified_at: "2026-01-01T00:00:00Z",
        expires_at: "2026-01-01T01:00:00Z"
      })
    );

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await user.type(await screen.findByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(onSignedIn).toHaveBeenCalledWith({ id: "m1", emailAddress: "a@b.com", expiresAt: "2026-01-01T01:00:00Z" });

    const [ url, init ] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("/session/challenge");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ session_id: "sess-1", code: "123456" });
  });

  it("InvalidCredentials no passo 1 mostra a mensagem única", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(401, { error: "invalid_credentials" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "senhaerrada12345");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("e-mail, senha ou código inválidos");
    expect(screen.getByLabelText("E-mail")).not.toBeNull();
  });

  it("InvalidCredentials no passo 2 mostra a mensagem e volta ao passo 1 sem reaproveitar a sessão pendente", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(200, { mfa_required: true, session_id: "sess-1" }));
    fetchMock.mockResolvedValueOnce(reply(401, { error: "invalid_session" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await user.type(await screen.findByLabelText("Código"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("e-mail, senha ou código inválidos");
    await waitFor(() => expect(screen.getByLabelText("Senha")).not.toBeNull());
    expect(screen.queryByLabelText("Código")).toBeNull();

    // O passo 1 volta a chamar POST /session — a sessão pendente anterior não é reaproveitada.
    fetchMock.mockResolvedValueOnce(reply(200, { mfa_required: true, session_id: "sess-2" }));
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await screen.findByLabelText("Código");
    const [ url ] = fetchMock.mock.calls[2];
    expect(String(url)).toBe("/session");
  });

  it("RateLimited mostra 'muitas tentativas, aguarde'", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(429, { error: "too_many_requests" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("muitas tentativas, aguarde");
  });

  it("mostra a notice recebida por prop (ex.: sessão expirada)", () => {
    render(<Login onSignedIn={onSignedIn} notice="sessão expirada" />);
    expect(screen.getByRole("alert").textContent).toBe("sessão expirada");
  });

  // I2: Login relançava NetworkError, RequestRejected (403 de Origin, 500,
  // 404...) e AuthRequired sem mensagem nenhuma — a exceção não tratada
  // derrubava o formulário sem nenhum retorno visível ao mantenedor.
  it("NetworkError no passo 1 mostra 'sem conexão com a API'", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("sem conexão com a API");
  });

  it("RequestRejected (ex.: 500 ou 403 de Origin) no passo 1 mostra uma mensagem genérica, nunca fica mudo", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(500, { error: "internal_server_error" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("não foi possível entrar agora — tente de novo");
  });

  it("um 401 fora do catálogo conhecido (AuthRequired) no passo 1 mostra a mensagem genérica, não fica mudo", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(401, { error: "algo_novo_e_desconhecido" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("não foi possível entrar agora — tente de novo");
  });

  it("RequestRejected no passo 2 mostra a mensagem genérica sem descartar a sessão pendente", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(200, { mfa_required: true, session_id: "sess-1" }));
    fetchMock.mockResolvedValueOnce(reply(500, { error: "internal_server_error" }));

    render(<Login onSignedIn={onSignedIn} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await user.type(await screen.findByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("não foi possível entrar agora — tente de novo");
    expect(screen.getByLabelText("Código")).not.toBeNull();
  });
  // O 403 de Origin recusa TUDO por configuração local: nenhuma credencial
  // passa, e a frase genérica não dá pista. A dica só existe onde o host
  // esperado é conhecido — o servidor de dev o injeta, um build publicado
  // não —, então a mesma tela continua muda fora de dev.
  it("403 com host esperado conhecido nomeia os dois hosts em vez da mensagem genérica", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(403, { error: "forbidden_origin" }));

    render(<Login onSignedIn={onSignedIn} expectedOrigin="http://maintenance.localhost:5177" />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("http://maintenance.localhost:5177");
    expect(alert.textContent).toContain(window.location.origin);
  });

  it("403 sem host esperado mantém a mensagem genérica — o caso do build publicado", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply(403, { error: "forbidden_origin" }));

    render(<Login onSignedIn={onSignedIn} expectedOrigin={null} />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "correcthorsebatterystaple");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("não foi possível entrar agora — tente de novo");
  });
});
