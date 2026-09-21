import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider } from "../lib/session";
import { Maintainers } from "./Maintainers";

afterEach(cleanup);

const OWN_ID = "m1";
const OWN_EMAIL = "eu@rotasaude.app";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function sessionReply() {
  return reply(200, { id: OWN_ID, email_address: OWN_EMAIL, expires_at: "2026-01-01T01:00:00Z" });
}

function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

function operationCalls(fetchMock: ReturnType<typeof vi.fn>, operation: string) {
  return fetchMock.mock.calls.filter((call) => {
    const url = String(call[0]);
    if (url !== "/graphql") return false;
    return bodyOf(call).query.includes(operation);
  });
}

function maintainersReply(rows: unknown[]) {
  return reply(200, { data: { maintainers: rows } });
}

function renderMaintainers() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  }
  return render(<Maintainers />, { wrapper });
}

const OWN_ROW = { id: OWN_ID, emailAddress: OWN_EMAIL, active: true, enrolled: true, createdAt: "2026-01-01T00:00:00Z" };
const OTHER_ROW = { id: "m2", emailAddress: "outro@rotasaude.app", active: false, enrolled: false, createdAt: "2026-01-02T00:00:00Z" };

describe("Maintainers", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lista e-mail, ativo/desativado e matriculado/convite pendente", async () => {
    fetchMock.mockImplementation((url: string) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") return Promise.resolve(maintainersReply([ OWN_ROW, OTHER_ROW ]));
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();

    expect(await screen.findByText(OWN_EMAIL)).not.toBeNull();
    expect(screen.getByText("outro@rotasaude.app")).not.toBeNull();
    expect(screen.getByText("ativo")).not.toBeNull();
    expect(screen.getByText("desativado")).not.toBeNull();
    expect(screen.getByText("matriculado")).not.toBeNull();
    expect(screen.getByText("convite pendente")).not.toBeNull();
  });

  it("convidar com sucesso chama inviteMaintainer, mostra a mensagem e reconsulta a lista", async () => {
    const user = userEvent.setup();
    let maintainersCallCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation InviteMaintainer")) {
          expect(body.variables).toEqual({ emailAddress: "novo@rotasaude.app", code: "123456" });
          return Promise.resolve(reply(200, { data: { inviteMaintainer: { ok: true, errors: [] } } }));
        }
        maintainersCallCount += 1;
        return Promise.resolve(maintainersReply(maintainersCallCount === 1 ? [ OWN_ROW ] : [ OWN_ROW, OTHER_ROW ]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();
    await screen.findByText(OWN_EMAIL);

    await user.type(screen.getByLabelText("E-mail"), "novo@rotasaude.app");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "convidar" }));

    expect(await screen.findByText(
      "Convite registrado. O link é entregue pelo `rake maintainer:invite` no servidor."
    )).not.toBeNull();

    await waitFor(() => expect(operationCalls(fetchMock, "query Maintainers")).toHaveLength(2));
    expect(await screen.findByText("outro@rotasaude.app")).not.toBeNull();
  });

  it("erro no path emailAddress aparece ao lado do campo de e-mail", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation InviteMaintainer")) {
          return Promise.resolve(reply(200, {
            data: { inviteMaintainer: { ok: false, errors: [ { path: "emailAddress", message: "e-mail inválido" } ] } }
          }));
        }
        return Promise.resolve(maintainersReply([ OWN_ROW ]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();
    await screen.findByText(OWN_EMAIL);

    await user.type(screen.getByLabelText("E-mail"), "invalido");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "convidar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("e-mail inválido");
  });

  it("campo de código mostra o aviso de espera e, em erro no code, o aviso de bloqueio; o código é limpo depois", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation InviteMaintainer")) {
          return Promise.resolve(reply(200, {
            data: { inviteMaintainer: { ok: false, errors: [ { path: "code", message: "código inválido" } ] } }
          }));
        }
        return Promise.resolve(maintainersReply([ OWN_ROW ]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();
    await screen.findByText(OWN_EMAIL);

    expect(screen.getByText("Se acabou de entrar, espere o próximo código.")).not.toBeNull();

    const codeField = screen.getByLabelText("Código") as HTMLInputElement;
    await user.type(screen.getByLabelText("E-mail"), "gente@rotasaude.app");
    await user.type(codeField, "000000");
    await user.click(screen.getByRole("button", { name: "convidar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("código inválido");
    expect(screen.getByText("Tentativas erradas contam para o bloqueio da conta.")).not.toBeNull();

    await waitFor(() => expect(codeField.value).toBe(""));
  });

  it("desativar pede confirmação (dois cliques); erro da API (último ativo) aparece na linha", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation DeactivateMaintainer")) {
          expect(body.variables).toEqual({ id: "m2" });
          return Promise.resolve(reply(200, {
            data: { deactivateMaintainer: { ok: false, errors: [ { path: "id", message: "é o último mantenedor ativo" } ] } }
          }));
        }
        return Promise.resolve(maintainersReply([ OWN_ROW, OTHER_ROW ]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();
    await screen.findByText(OWN_EMAIL);

    const otherRow = screen.getByText("outro@rotasaude.app").closest("tr");
    if (!otherRow) throw new Error("linha não encontrada");
    const rowScope = within(otherRow);

    const deactivateButton = rowScope.getByRole("button");
    await user.click(deactivateButton);

    // Primeiro clique só troca o rótulo — nenhuma chamada de mutation ainda.
    expect(operationCalls(fetchMock, "mutation DeactivateMaintainer")).toHaveLength(0);

    await user.click(rowScope.getByRole("button"));

    await waitFor(() => expect(operationCalls(fetchMock, "mutation DeactivateMaintainer")).toHaveLength(1));
    expect((await rowScope.findByRole("alert")).textContent).toBe("é o último mantenedor ativo");
  });

  it("o botão 'desativar' não aparece na própria linha do mantenedor da sessão", async () => {
    fetchMock.mockImplementation((url: string) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") return Promise.resolve(maintainersReply([ OWN_ROW, OTHER_ROW ]));
      return Promise.resolve(reply(204, undefined));
    });

    renderMaintainers();
    await screen.findByText(OWN_EMAIL);
    await screen.findByText("outro@rotasaude.app");

    const ownRow = screen.getByText(OWN_EMAIL).closest("tr");
    if (!ownRow) throw new Error("linha não encontrada");
    expect(within(ownRow).queryByRole("button")).toBeNull();

    const otherRow = screen.getByText("outro@rotasaude.app").closest("tr");
    if (!otherRow) throw new Error("linha não encontrada");
    expect(within(otherRow).queryByRole("button")).not.toBeNull();
  });
});
