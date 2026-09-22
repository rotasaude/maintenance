import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CityDetail } from "./CityDetail";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

function operationCalls(fetchMock: ReturnType<typeof vi.fn>, operation: string) {
  return fetchMock.mock.calls.filter((call) => bodyOf(call).query.includes(`query ${operation}`));
}

const HEADER_REPLY = reply(200, {
  data: {
    city: {
      slug: "sp",
      name: "São Paulo",
      uf: "SP",
      status: "ACTIVE",
      schemaVersion: "12",
      schemaBehind: false,
      createdAt: "2026-01-01T00:00:00Z",
      channel: { phoneNumberId: "pn-1", wabaId: "waba-1", displayPhoneNumber: "+55 11 90000-0000", active: true }
    }
  }
});

function renderDetail(onBack: () => void = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<CityDetail slug="sp" onBack={onBack} />, { wrapper });
}

describe("CityDetail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("carrega só o topo (plataforma + canal) ao abrir; cada aba consulta só quando aberta", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(HEADER_REPLY.clone()));

    renderDetail();

    expect(await screen.findByText("São Paulo")).not.toBeNull();
    expect(screen.getByText("+55 11 90000-0000")).not.toBeNull();

    // Nenhuma aba consultada ainda — só a consulta de topo saiu.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(operationCalls(fetchMock, "CityHeader")).toHaveLength(1);
    for (const op of [ "CityProfile", "CityProtocolVersions", "CityRecipients", "CityAccounts", "CityCounts", "CityOperations" ]) {
      expect(operationCalls(fetchMock, op)).toHaveLength(0);
    }

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(
        reply(200, {
          data: { city: { slug: "sp", accounts: [ { login: "op1", roles: [ "operator" ], active: true, mfaEnrolled: true } ] } }
        })
      )
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Contas" }));

    await waitFor(() => expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(1));
    expect(await screen.findByText("op1")).not.toBeNull();

    // Abrir "Contas" não disparou nenhuma outra aba.
    for (const op of [ "CityProfile", "CityProtocolVersions", "CityRecipients", "CityCounts", "CityOperations" ]) {
      expect(operationCalls(fetchMock, op)).toHaveLength(0);
    }
  });

  it("erro de campo CITY_UNREACHABLE numa aba mostra código e mensagem só nela; o topo continua visível", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query CityHeader")) return Promise.resolve(HEADER_REPLY.clone());
      if (body.query.includes("query CityAccounts")) {
        return Promise.resolve(
          reply(200, {
            data: { city: null },
            errors: [
              { message: "banco da cidade inacessível", path: [ "city", "accounts" ], extensions: { code: "CITY_UNREACHABLE" } }
            ]
          })
        );
      }
      if (body.query.includes("query CityProfile")) {
        return Promise.resolve(
          reply(200, { data: { city: { slug: "sp", consentTermVersion: "v3", profile: { name: "São Paulo", uf: "SP", ibgeCode: "3550308" } } } })
        );
      }
      return Promise.resolve(reply(200, { data: { city: { slug: "sp" } } }));
    });

    renderDetail();
    await screen.findByText("São Paulo");

    await user.click(screen.getByRole("button", { name: "Contas" }));
    expect((await screen.findByRole("alert")).textContent).toBe("CITY_UNREACHABLE — banco da cidade inacessível");

    // O topo segue visível apesar do erro na aba.
    expect(screen.getByText("São Paulo")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Perfil" }));
    expect(await screen.findByText("3550308")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("CITY_ARCHIVED com a cidade inteira nula (path só ['city']) mostra o código e a mensagem na aba", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query CityHeader")) return Promise.resolve(HEADER_REPLY.clone());
      if (body.query.includes("query CityCounts")) {
        return Promise.resolve(
          reply(200, {
            data: { city: null },
            errors: [ { message: "cidade arquivada", path: [ "city" ], extensions: { code: "CITY_ARCHIVED" } } ]
          })
        );
      }
      return Promise.resolve(reply(200, { data: { city: { slug: "sp" } } }));
    });

    renderDetail();
    await screen.findByText("São Paulo");

    await user.click(screen.getByRole("button", { name: "Contagens" }));
    expect((await screen.findByRole("alert")).textContent).toBe("CITY_ARCHIVED — cidade arquivada");
  });

  it("CITY_READ_FAILED aparece do mesmo jeito", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query CityHeader")) return Promise.resolve(HEADER_REPLY.clone());
      if (body.query.includes("query CityOperations")) {
        return Promise.resolve(
          reply(200, {
            data: { city: null },
            errors: [ { message: "falha ao ler o banco da cidade", path: [ "city", "operations" ], extensions: { code: "CITY_READ_FAILED" } } ]
          })
        );
      }
      return Promise.resolve(reply(200, { data: { city: { slug: "sp" } } }));
    });

    renderDetail();
    await screen.findByText("São Paulo");

    await user.click(screen.getByRole("button", { name: "Operação" }));
    expect((await screen.findByRole("alert")).textContent).toBe("CITY_READ_FAILED — falha ao ler o banco da cidade");
  });

  it("'atualizar' numa aba refaz só a consulta daquela aba", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query CityHeader")) return Promise.resolve(HEADER_REPLY.clone());
      if (body.query.includes("query CityAccounts")) {
        return Promise.resolve(
          reply(200, { data: { city: { slug: "sp", accounts: [ { login: "op1", roles: [], active: true, mfaEnrolled: false } ] } } })
        );
      }
      return Promise.resolve(reply(200, { data: { city: { slug: "sp" } } }));
    });

    renderDetail();
    await screen.findByText("São Paulo");

    await user.click(screen.getByRole("button", { name: "Contas" }));
    await screen.findByText("op1");
    await waitFor(() => expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "atualizar" }));

    await waitFor(() => expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(2));
    expect(operationCalls(fetchMock, "CityHeader")).toHaveLength(1);
    for (const op of [ "CityProfile", "CityProtocolVersions", "CityRecipients", "CityCounts", "CityOperations" ]) {
      expect(operationCalls(fetchMock, op)).toHaveLength(0);
    }
  });

  it("reabrir uma aba já carregada serve do cache — só 'atualizar' abre conexão nova (ruling P5, spec §6: sem atualização automática)", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query CityHeader")) return Promise.resolve(HEADER_REPLY.clone());
      if (body.query.includes("query CityAccounts")) {
        return Promise.resolve(
          reply(200, { data: { city: { slug: "sp", accounts: [ { login: "op1", roles: [], active: true, mfaEnrolled: false } ] } } })
        );
      }
      if (body.query.includes("query CityProfile")) {
        return Promise.resolve(
          reply(200, { data: { city: { slug: "sp", consentTermVersion: "v3", profile: { name: "São Paulo", uf: "SP", ibgeCode: "3550308" } } } })
        );
      }
      return Promise.resolve(reply(200, { data: { city: { slug: "sp" } } }));
    });

    renderDetail();
    await screen.findByText("São Paulo");

    await user.click(screen.getByRole("button", { name: "Contas" }));
    await screen.findByText("op1");
    await waitFor(() => expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Perfil" }));
    await screen.findByText("3550308");

    await user.click(screen.getByRole("button", { name: "Contas" }));
    await screen.findByText("op1");

    // Reabrir "Contas" (já carregada) serve do cache: nenhuma segunda
    // conexão com o banco da cidade — só "atualizar" pede uma nova.
    expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "atualizar" }));
    await waitFor(() => expect(operationCalls(fetchMock, "CityAccounts")).toHaveLength(2));
  });

  // I3: um 403 (Origin recusada pelo api) na consulta de topo não pode
  // devolver o código cru (http_403) — nunca o código, sempre a mensagem
  // genérica em português.
  it("erro 403 da API na consulta de topo nunca mostra o código cru na tela", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({}), { status: 403 })));

    renderDetail();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("http_");
    expect(document.body.textContent).not.toContain("http_403");
  });
});
