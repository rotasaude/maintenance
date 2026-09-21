import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider } from "../lib/session";
import { Tokens } from "./Tokens";

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

function tokensReply(rows: unknown[]) {
  return reply(200, { data: { maintenanceTokens: rows } });
}

function citiesReply(rows: unknown[]) {
  return reply(200, { data: { cities: rows } });
}

function renderTokens(queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  }
  return render(<Tokens />, { wrapper });
}

function cacheContainsSecret(queryClient: QueryClient, secret: string): boolean {
  const inQueries = queryClient.getQueryCache().getAll().some((q) => JSON.stringify(q.state).includes(secret));
  const inMutations = queryClient.getMutationCache().getAll().some((m) => JSON.stringify(m.state).includes(secret));
  return inQueries || inMutations;
}

const TOKEN_NO_SCOPE = {
  id: "t1", name: "grafana", access: "read", citySlugs: [],
  expiresAt: "2026-03-01T00:00:00Z", revokedAt: null, lastUsedAt: "2026-01-15T00:00:00Z"
};
const TOKEN_SCOPED_REVOKED = {
  id: "t2", name: "backup", access: "read_write", citySlugs: [ "curitiba" ],
  expiresAt: "2026-04-01T00:00:00Z", revokedAt: "2026-02-01T00:00:00Z", lastUsedAt: null
};

const CITY_ROWS = [ { slug: "curitiba", name: "Curitiba" }, { slug: "maringa", name: "Maringá" } ];

describe("Tokens", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  function stubDefault(rows: unknown[] = [ TOKEN_NO_SCOPE, TOKEN_SCOPED_REVOKED ], cities: unknown[] = CITY_ROWS) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("query CitiesForTokenScope")) return Promise.resolve(citiesReply(cities));
        if (body.query.includes("query MaintenanceTokens")) return Promise.resolve(tokensReply(rows));
        return Promise.resolve(reply(204, undefined));
      }
      return Promise.resolve(reply(204, undefined));
    });
  }

  it("lista nome, acesso, cidades ('todas' quando vazio), validade, último uso e revogado", async () => {
    stubDefault();
    renderTokens();

    expect(await screen.findByText("grafana")).not.toBeNull();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("backup")).not.toBeNull();

    // acesso
    expect(table.getByText("leitura")).not.toBeNull();
    expect(table.getByText("leitura e escrita")).not.toBeNull();

    // cidades: vazio -> "todas"; com escopo -> lista as cidades
    expect(table.getByText("todas")).not.toBeNull();
    expect(table.getByText("curitiba")).not.toBeNull();

    // validade
    expect(table.getByText("2026-03-01T00:00:00Z")).not.toBeNull();
    expect(table.getByText("2026-04-01T00:00:00Z")).not.toBeNull();

    // último uso: presente ou "—" quando nulo
    expect(table.getByText("2026-01-15T00:00:00Z")).not.toBeNull();

    // status
    expect(table.getByText("ativo")).not.toBeNull();
    expect(table.getByText("revogado")).not.toBeNull();
  });

  it("cidades sem nenhuma marcada mostra aviso; marcar uma remove o aviso", async () => {
    stubDefault();
    const user = userEvent.setup();
    renderTokens();

    await screen.findByText("grafana");

    expect(screen.getByText("sem cidades marcadas, o token alcança todas")).not.toBeNull();

    await user.click(screen.getByLabelText("Curitiba"));

    expect(screen.queryByText("sem cidades marcadas, o token alcança todas")).toBeNull();
  });

  it("criar chama createMaintenanceToken com os dados do formulário e validade convertida para ISO", async () => {
    const user = userEvent.setup();
    const before = Date.now();

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation CreateMaintenanceToken")) {
          expect(body.variables.name).toBe("grafana");
          expect(body.variables.access).toBe("read_write");
          expect(body.variables.citySlugs).toEqual([ "curitiba" ]);
          expect(body.variables.code).toBe("123456");
          const expiresAt = new Date(body.variables.expiresAt as string);
          const days = (expiresAt.getTime() - before) / 86_400_000;
          expect(days).toBeGreaterThan(44.9);
          expect(days).toBeLessThan(45.1);
          return Promise.resolve(reply(200, {
            data: { createMaintenanceToken: { ok: true, secretOnce: "s3gr3d0", errors: [] } }
          }));
        }
        if (body.query.includes("query CitiesForTokenScope")) return Promise.resolve(citiesReply(CITY_ROWS));
        return Promise.resolve(tokensReply([]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderTokens();
    await screen.findByLabelText("Curitiba");

    await user.type(screen.getByLabelText("Nome"), "grafana");
    await user.selectOptions(screen.getByLabelText("Acesso"), "read_write");
    await user.click(screen.getByLabelText("Curitiba"));
    const validityField = screen.getByLabelText("Validade (dias)");
    await user.clear(validityField);
    await user.type(validityField, "45");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "criar token" }));

    await waitFor(() => expect(operationCalls(fetchMock, "mutation CreateMaintenanceToken")).toHaveLength(1));
  });

  it("validade fora de 1-90 não chama a API", async () => {
    stubDefault();
    const user = userEvent.setup();
    renderTokens();
    await screen.findByText("grafana");

    await user.type(screen.getByLabelText("Nome"), "grafana");
    const validityField = screen.getByLabelText("Validade (dias)");
    await user.clear(validityField);
    await user.type(validityField, "91");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "criar token" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(operationCalls(fetchMock, "mutation CreateMaintenanceToken")).toHaveLength(0);
  });

  it("mostra o segredo uma vez e o remove do DOM e do cache do React Query ao fechar", async () => {
    stubDefault([], []);
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation CreateMaintenanceToken")) {
          return Promise.resolve(reply(200, {
            data: { createMaintenanceToken: { ok: true, secretOnce: "shh-secret-value", errors: [] } }
          }));
        }
        if (body.query.includes("query CitiesForTokenScope")) return Promise.resolve(citiesReply([]));
        return Promise.resolve(tokensReply([]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderTokens(queryClient);
    await screen.findByText("nenhum token");

    await user.type(screen.getByLabelText("Nome"), "grafana");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "criar token" }));

    expect(await screen.findByText("shh-secret-value")).not.toBeNull();
    expect(screen.getByText("Este segredo não será mostrado de novo.")).not.toBeNull();

    // enquanto o painel está aberto, o segredo já não está em nenhuma
    // entrada do cache do React Query (query nem mutation)
    expect(cacheContainsSecret(queryClient, "shh-secret-value")).toBe(false);

    await user.click(screen.getByRole("button", { name: "copiar" }));
    expect(writeText).toHaveBeenCalledWith("shh-secret-value");

    await user.click(screen.getByRole("button", { name: "fechei" }));

    expect(screen.queryByText("shh-secret-value")).toBeNull();
    expect(cacheContainsSecret(queryClient, "shh-secret-value")).toBe(false);
  });

  it("revogar pede confirmação e reconsulta a lista", async () => {
    const user = userEvent.setup();
    let tokensCallCount = 0;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation RevokeMaintenanceToken")) {
          expect(body.variables).toEqual({ id: "t1" });
          return Promise.resolve(reply(200, { data: { revokeMaintenanceToken: { ok: true, errors: [] } } }));
        }
        if (body.query.includes("query CitiesForTokenScope")) return Promise.resolve(citiesReply([]));
        tokensCallCount += 1;
        return Promise.resolve(tokensReply(
          tokensCallCount === 1 ? [ TOKEN_NO_SCOPE ] : [ { ...TOKEN_NO_SCOPE, revokedAt: "2026-02-10T00:00:00Z" } ]
        ));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderTokens();
    await screen.findByText("grafana");

    const row = screen.getByText("grafana").closest("tr");
    if (!row) throw new Error("linha não encontrada");
    const rowScope = within(row);

    const revokeButton = rowScope.getByRole("button", { name: "revogar" });
    await user.click(revokeButton);

    expect(operationCalls(fetchMock, "mutation RevokeMaintenanceToken")).toHaveLength(0);

    await user.click(rowScope.getByRole("button", { name: "confirmar revogação" }));

    await waitFor(() => expect(operationCalls(fetchMock, "mutation RevokeMaintenanceToken")).toHaveLength(1));
    await waitFor(() => expect(operationCalls(fetchMock, "query MaintenanceTokens")).toHaveLength(2));
    expect(await screen.findByText("revogado")).not.toBeNull();
  });

  it("errors da API aparecem pelo path", async () => {
    stubDefault([], []);
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(sessionReply());
      if (path === "/graphql") {
        const body = bodyOf([ url, init ]);
        if (body.query.includes("mutation CreateMaintenanceToken")) {
          return Promise.resolve(reply(200, {
            data: { createMaintenanceToken: { ok: false, secretOnce: null, errors: [ { path: "name", message: "nome já usado" } ] } }
          }));
        }
        if (body.query.includes("query CitiesForTokenScope")) return Promise.resolve(citiesReply([]));
        return Promise.resolve(tokensReply([]));
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderTokens();
    await screen.findByText("nenhum token");

    await user.type(screen.getByLabelText("Nome"), "grafana");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "criar token" }));

    expect((await screen.findByRole("alert")).textContent).toBe("nome já usado");
  });
});
