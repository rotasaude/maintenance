// src/screens/FieldMaps.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FieldMaps } from "./FieldMaps";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}
function calls(fetchMock: ReturnType<typeof vi.fn>, operation: string) {
  return fetchMock.mock.calls.filter((call) => bodyOf(call).query.includes(operation));
}

type Route = (body: { query: string; variables: Record<string, unknown> }) => Promise<Response> | Response;

function route(fetchMock: ReturnType<typeof vi.fn>, handlers: Record<string, Route>) {
  fetchMock.mockImplementation((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const name = Object.keys(handlers).find((op) => body.query.includes(op));
    return Promise.resolve(name ? handlers[name](body) : reply(500, {}));
  });
}

const CITIES = [ { slug: "curitiba", name: "Curitiba", uf: "PR" }, { slug: "maringa", name: "Maringá", uf: "PR" } ];
const READY_CURITIBA = {
  citySlug: "curitiba", state: "ready", version: "2026-11-01", sizeBytes: "41234567", builtAt: "2026-11-02T12:00:00Z", errorCode: null
};
const BASE = { version: "2026-11-01", ageDays: 12 };

function mapsReply(over: { cities?: unknown[]; fieldMaps?: unknown[]; fieldMapBase?: unknown } = {}) {
  return reply(200, { data: {
    cities: over.cities ?? CITIES,
    fieldMaps: over.fieldMaps ?? [ READY_CURITIBA ],
    fieldMapBase: "fieldMapBase" in over ? over.fieldMapBase : BASE
  } });
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<FieldMaps />, { wrapper });
}

const disabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled;

describe("FieldMaps", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("cidade sem linha em field_maps aparece 'sem mapa' com Gerar", async () => {
    route(fetchMock, { "query FieldMaps": () => mapsReply({ fieldMaps: [ READY_CURITIBA ] }) });
    renderScreen();
    const maringa = await screen.findByRole("row", { name: /Maringá/ });
    expect(within(maringa).getByText("sem mapa")).not.toBeNull();
    expect(within(maringa).getByRole("button", { name: "Gerar de novo Maringá" })).not.toBeNull();
    const curitiba = screen.getByRole("row", { name: /Curitiba/ });
    expect(within(curitiba).getByText("pronto")).not.toBeNull();
    expect(within(curitiba).getByText("39,3 MB")).not.toBeNull();
    expect(within(curitiba).getByText("01/11/2026")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("base em dia: versão e idade, sem aviso", async () => {
    route(fetchMock, { "query FieldMaps": () => mapsReply() });
    renderScreen();
    const base = await screen.findByRole("region", { name: "Base do Brasil" });
    expect(await within(base).findByText("versão 01/11/2026 · há 12 dias")).not.toBeNull();
    expect(within(base).queryByText(/mais de 90 dias/)).toBeNull();
  });

  it("gerar: uma mutation só, com o slug; depois relê e diz que o job roda em segundo plano", async () => {
    const user = userEvent.setup();
    let finish: (r: Response) => void = () => {};
    route(fetchMock, {
      "query FieldMaps": () => mapsReply(),
      "mutation BuildFieldMap": () => new Promise<Response>((resolve) => { finish = resolve; })
    });
    renderScreen();
    const button = await screen.findByRole("button", { name: "Gerar de novo Maringá" });
    await user.dblClick(button);
    await waitFor(() => expect(calls(fetchMock, "mutation BuildFieldMap")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation BuildFieldMap")[0]).variables).toEqual({ citySlug: "maringa" });
    // Enquanto roda, nenhuma outra geração nem a cópia da base se oferecem.
    expect(disabled(screen.getByRole("button", { name: "Gerar de novo Curitiba" }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: "Atualizar base" }))).toBe(true);

    finish(reply(200, { data: { buildFieldMap: { ok: true, errors: [] } } }));
    expect((await screen.findByRole("status")).textContent).toBe("pedido enviado — o job gera o arquivo em segundo plano");
    await waitFor(() => expect(calls(fetchMock, "query FieldMaps")).toHaveLength(2));
    expect(calls(fetchMock, "mutation BuildFieldMap")).toHaveLength(1);
  });

  it("gerar desabilitado com o mapa em geração", async () => {
    route(fetchMock, { "query FieldMaps": () => mapsReply({
      fieldMaps: [ { ...READY_CURITIBA, state: "building" } ]
    }) });
    renderScreen();
    const curitiba = await screen.findByRole("row", { name: /Curitiba/ });
    expect(within(curitiba).getByText("gerando…")).not.toBeNull();
    expect(disabled(within(curitiba).getByRole("button", { name: "Gerar de novo Curitiba" }))).toBe(true);
    expect(disabled(screen.getByRole("button", { name: "Gerar de novo Maringá" }))).toBe(false);
  });

  it("sem base: a frase da base e nenhum Gerar habilitado; Atualizar base segue disponível", async () => {
    route(fetchMock, { "query FieldMaps": () => mapsReply({ fieldMaps: [], fieldMapBase: null }) });
    renderScreen();
    const base = await screen.findByRole("region", { name: "Base do Brasil" });
    expect(await within(base).findByText("a base do Brasil ainda não foi copiada")).not.toBeNull();
    for (const name of [ "Gerar de novo Curitiba", "Gerar de novo Maringá" ]) {
      expect(disabled(screen.getByRole("button", { name }))).toBe(true);
    }
    expect(disabled(screen.getByRole("button", { name: "Atualizar base" }))).toBe(false);
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("base com mais de 90 dias: aviso; atualizar base pede confirmação e manda a mutation", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query FieldMaps": () => mapsReply({ fieldMapBase: { version: "2026-07-17", ageDays: 120 } }),
      "mutation RefreshFieldMapBase": () => reply(200, { data: { refreshFieldMapBase: { ok: true, errors: [] } } })
    });
    renderScreen();
    const base = await screen.findByRole("region", { name: "Base do Brasil" });
    expect(await within(base).findByText("base com mais de 90 dias — atualize antes de gerar")).not.toBeNull();
    expect(within(base).getByText("versão 17/07/2026 · há 120 dias")).not.toBeNull();

    await user.click(within(base).getByRole("button", { name: "Atualizar base" }));
    expect(calls(fetchMock, "mutation RefreshFieldMapBase")).toHaveLength(0);
    await user.click(within(base).getByRole("button", { name: "confirmar: copiar a base de novo" }));

    await waitFor(() => expect(calls(fetchMock, "mutation RefreshFieldMapBase")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation RefreshFieldMapBase")[0]).variables).toEqual({});
    expect((await screen.findByRole("status")).textContent).toBe("pedido enviado — o job copia a base em segundo plano");
    await waitFor(() => expect(calls(fetchMock, "query FieldMaps")).toHaveLength(2));
  });

  it("cópia em curso: a recusa aparece e nada é relido como sucesso", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query FieldMaps": () => mapsReply(),
      "mutation RefreshFieldMapBase": () => reply(200, { data: { refreshFieldMapBase: {
        ok: false, errors: [ { path: "base", message: "cópia em curso" } ]
      } } })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Atualizar base" }));
    await user.click(screen.getByRole("button", { name: "confirmar: copiar a base de novo" }));
    expect((await screen.findByRole("alert")).textContent).toBe("cópia em curso");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falhou: mostra o motivo; boundary_missing com a frase", async () => {
    route(fetchMock, { "query FieldMaps": () => mapsReply({ fieldMaps: [
      { citySlug: "curitiba", state: "failed", version: null, sizeBytes: null, builtAt: null, errorCode: "boundary_missing" },
      { citySlug: "maringa", state: "failed", version: null, sizeBytes: null, builtAt: null, errorCode: "disk_full" }
    ] }) });
    renderScreen();
    const curitiba = await screen.findByRole("row", { name: /Curitiba/ });
    expect(within(curitiba).getByText("falhou")).not.toBeNull();
    expect(within(curitiba).getByText("a cidade não tem a caixa do município (código IBGE)")).not.toBeNull();
    expect(within(screen.getByRole("row", { name: /Maringá/ })).getByText("disk_full")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("errors da mutation aparecem; nada é relido como sucesso", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query FieldMaps": () => mapsReply(),
      "mutation BuildFieldMap": () => reply(200, { data: { buildFieldMap: {
        ok: false, errors: [ { path: "citySlug", message: "cidade não está ativa (suspended)" } ]
      } } })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Gerar de novo Maringá" }));
    expect((await screen.findByRole("alert")).textContent).toBe("cidade não está ativa (suspended)");
    expect(screen.queryByRole("status")).toBeNull();
    expect(calls(fetchMock, "query FieldMaps")).toHaveLength(1);
    expect(disabled(screen.getByRole("button", { name: "Gerar de novo Maringá" }))).toBe(false);
  });

  it("recusa do envelope (payload nulo): código e mensagem", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query FieldMaps": () => mapsReply(),
      "mutation BuildFieldMap": () => reply(200, {
        data: { buildFieldMap: null },
        errors: [ { message: "token sem acesso", path: [ "buildFieldMap" ], extensions: { code: "FORBIDDEN" } } ]
      })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "Gerar de novo Maringá" }));
    expect((await screen.findByRole("alert")).textContent).toBe("FORBIDDEN — token sem acesso");
  });

  it("atualizar relê a tela", async () => {
    const user = userEvent.setup();
    route(fetchMock, { "query FieldMaps": () => mapsReply() });
    renderScreen();
    await screen.findByRole("row", { name: /Maringá/ });
    await user.click(screen.getByRole("button", { name: "atualizar" }));
    await waitFor(() => expect(calls(fetchMock, "query FieldMaps")).toHaveLength(2));
  });

  it("api sem o 24c: explica a ordem de deploy", async () => {
    route(fetchMock, { "query FieldMaps": () => reply(200, { errors: [
      { message: "Field 'fieldMaps' doesn't exist on type 'Query'", extensions: { code: "undefinedField" } }
    ] }) });
    renderScreen();
    expect(await screen.findByText(/o api ainda não tem os mapas de campo/)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Atualizar base" })).toBeNull();
  });
});
