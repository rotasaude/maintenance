import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Invitation } from "./Invitation";

afterEach(cleanup);

// Spec: o token do convite nunca fica em localStorage.
afterEach(() => {
  expect(localStorage.length).toBe(0);
});

vi.mock("qrcode", () => ({
  toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,FAKE")
}));

const TOKEN = "convite-secreto-abc123";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function enrollReply() {
  return reply(200, {
    email_address: "novo@rotasaude.app",
    otpauth_uri: "otpauth://totp/RotaSaude:novo@rotasaude.app?secret=CHAVE123&issuer=RotaSaude",
    secret: "CHAVE123"
  });
}

async function fillAcceptForm(user: ReturnType<typeof userEvent.setup>, overrides: Partial<{
  password: string;
  confirmPassword: string;
  code: string;
}> = {}) {
  const { password = "senha-com-mais-de-12", confirmPassword = password, code = "123456" } = overrides;
  await user.type(screen.getByLabelText("Senha"), password);
  await user.type(screen.getByLabelText("Confirmar senha"), confirmPassword);
  await user.type(screen.getByLabelText("Código"), code);
  await user.click(screen.getByRole("button", { name: "Concluir matrícula" }));
}

describe("Invitation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onDone: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    onDone = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("ao montar, matricula com o token e mostra e-mail, chave e QR sem chamada de rede extra", async () => {
    fetchMock.mockResolvedValueOnce(enrollReply());

    render(<Invitation token={TOKEN} onDone={onDone} />);

    expect(await screen.findByText("novo@rotasaude.app")).not.toBeNull();
    expect(screen.getByText("CHAVE123")).not.toBeNull();

    const qr = screen.getByAltText("QR do autenticador") as HTMLImageElement;
    expect(qr.src).toBe("data:image/png;base64,FAKE");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [ url, init ] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/invitations/enroll");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: TOKEN });
  });

  it("com senha, confirmação e código válidos, aceita o convite e chama onDone", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");

    await fillAcceptForm(user);

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [ url, init ] = fetchMock.mock.calls[1];
    expect(String(url)).toBe("/invitations/accept");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      token: TOKEN,
      password: "senha-com-mais-de-12",
      code: "123456"
    });
  });

  it("senha e confirmação diferentes: não chama a API e mostra a mensagem", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");

    await fillAcceptForm(user, { password: "senha-com-mais-de-12", confirmPassword: "outra-senha-diferente" });

    expect((await screen.findByRole("alert")).textContent).toBe("as senhas não coincidem");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("senha com menos de 12 caracteres: não chama a API e mostra a mensagem", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");

    await fillAcceptForm(user, { password: "curta12345", confirmPassword: "curta12345" });

    expect((await screen.findByRole("alert")).textContent).toBe("a senha precisa de pelo menos 12 caracteres");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("weak_password da API mostra a mesma mensagem de 12 caracteres", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());
    fetchMock.mockResolvedValueOnce(reply(422, { error: "weak_password" }));

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");

    await fillAcceptForm(user);

    expect((await screen.findByRole("alert")).textContent).toBe("a senha precisa de pelo menos 12 caracteres");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("invalid_code da API mostra 'código inválido — use o código atual do autenticador'", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());
    fetchMock.mockResolvedValueOnce(reply(422, { error: "invalid_code" }));

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");

    await fillAcceptForm(user);

    expect((await screen.findByRole("alert")).textContent).toBe("código inválido — use o código atual do autenticador");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("enroll com 404 mostra 'convite inválido, usado ou expirado'", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    render(<Invitation token={TOKEN} onDone={onDone} />);

    expect((await screen.findByRole("alert")).textContent).toBe("convite inválido, usado ou expirado");
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("o token nunca aparece no DOM", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(enrollReply());
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<Invitation token={TOKEN} onDone={onDone} />);
    await screen.findByText("novo@rotasaude.app");
    expect(document.body.textContent).not.toContain(TOKEN);

    await fillAcceptForm(user);
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());

    expect(document.body.textContent).not.toContain(TOKEN);
  });
});
