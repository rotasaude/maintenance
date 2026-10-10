// src/screens/MedicationCatalog.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MedicationCatalog } from "./MedicationCatalog";

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

const RELEASE = { id: "r1", importedAt: "2026-10-09T12:00:00Z", itemsCount: 6778, hiddenCount: 2 };
const REVIEW = [
  { catmatCode: 271234, sourceDescription: "PARACETAMOL, CONCENTRACAO: 200MG/ML, FORMA FARMACEUTICA:", parseStatus: "review" },
  { catmatCode: 270001, sourceDescription: "KIT DE MEDICAMENTOS DIVERSOS", parseStatus: "review" }
];

function catalogReply(release: unknown = RELEASE, review: unknown[] = REVIEW) {
  return reply(200, { data: { medicationCatalog: { currentRelease: release, reviewItems: review } } });
}

type Route = (body: { query: string; variables: Record<string, unknown> }) => Promise<Response> | Response;

function route(fetchMock: ReturnType<typeof vi.fn>, handlers: Record<string, Route>) {
  fetchMock.mockImplementation((_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const name = Object.keys(handlers).find((op) => body.query.includes(op));
    return Promise.resolve(name ? handlers[name](body) : reply(500, {}));
  });
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<MedicationCatalog />, { wrapper });
}

describe("MedicationCatalog", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("mostra a versão atual e os itens para revisar, sem undefined/null", async () => {
    route(fetchMock, { "query MedicationCatalog": () => catalogReply() });
    renderScreen();

    expect(await screen.findByText("importado em 09/10/2026, 09:00 · 6.778 itens · 2 ocultos para revisão")).not.toBeNull();
    const review = screen.getByRole("region", { name: "Itens para revisar" });
    expect(within(review).getByText("271234")).not.toBeNull();
    expect(within(review).getByText("KIT DE MEDICAMENTOS DIVERSOS")).not.toBeNull();
    expect(within(review).getAllByText("para revisar")).toHaveLength(2);
    expect(bodyOf(calls(fetchMock, "query MedicationCatalog")[0]).variables).toEqual({ first: 50 });
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("nenhuma importação ainda e nada para revisar", async () => {
    route(fetchMock, { "query MedicationCatalog": () => catalogReply(null, []) });
    renderScreen();
    expect(await screen.findByText("nenhuma importação ainda — até a primeira, a receita só aceita texto livre")).not.toBeNull();
    expect(screen.getByText("nenhum item para revisar")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("mais ocultos do que a página: avisa quantos faltam", async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ catmatCode: 300000 + i, sourceDescription: `ITEM ${i}`, parseStatus: "review" }));
    route(fetchMock, { "query MedicationCatalog": () => catalogReply({ ...RELEASE, hiddenCount: 312 }, many) });
    renderScreen();
    expect(await screen.findByText("mostrando 50 de 312 itens ocultos")).not.toBeNull();
  });

  it("importar o CATMAT pede confirmação, trava os dois botões enquanto roda e diz o resultado", async () => {
    const user = userEvent.setup();
    let finish: (r: Response) => void = () => {};
    route(fetchMock, {
      "query MedicationCatalog": () => catalogReply(),
      "mutation ImportMedicationCatalog": () => new Promise<Response>((resolve) => { finish = resolve; })
    });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "importar o CATMAT" }));
    expect(calls(fetchMock, "mutation ImportMedicationCatalog")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: importar o CATMAT agora" }));

    expect((await screen.findByRole("status")).textContent).toBe("importando… pode levar alguns minutos — não feche esta aba");
    expect((screen.getByRole("button", { name: "importar as listas da Anvisa" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls(fetchMock, "mutation ImportMedicationCatalog")).toHaveLength(1);

    finish(reply(200, { data: { importMedicationCatalog: {
      ok: true, releaseId: "r2", added: 40, changed: 7, removed: 12, errors: []
    } } }));

    expect(await screen.findByText(
      "Catálogo importado: 40 entraram, 7 mudaram, 12 saíram. Os que saíram deixam de aparecer na busca da receita; receitas já emitidas não mudam."
    )).not.toBeNull();
    await waitFor(() => expect(calls(fetchMock, "query MedicationCatalog").length).toBeGreaterThanOrEqual(2));
    expect((screen.getByRole("button", { name: "importar as listas da Anvisa" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("Compras.gov fora do ar: diz que nada mudou e a versão continua a mesma", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query MedicationCatalog": () => catalogReply(),
      "mutation ImportMedicationCatalog": () => reply(200, { data: { importMedicationCatalog: {
        ok: false, releaseId: null, added: null, changed: null, removed: null,
        errors: [ { path: "catalog", message: "source_unavailable" } ]
      } } })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "importar o CATMAT" }));
    await user.click(screen.getByRole("button", { name: "confirmar: importar o CATMAT agora" }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("o Compras.gov não respondeu — nada mudou; tente de novo mais tarde");
    expect(screen.getByText("importado em 09/10/2026, 09:00 · 6.778 itens · 2 ocultos para revisão")).not.toBeNull();
  });

  it("importar as listas da Anvisa: diz quantos foram marcados", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query MedicationCatalog": () => catalogReply(),
      "mutation ImportAnvisaLists": () => reply(200, { data: { importAnvisaLists: {
        ok: true, antimicrobials: 118, controlled: 402, errors: []
      } } })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "importar as listas da Anvisa" }));
    await user.click(screen.getByRole("button", { name: "confirmar: importar as listas da Anvisa agora" }));
    expect(await screen.findByText(
      "Listas da Anvisa importadas: 118 antimicrobianos (RDC 471) e 402 controlados (Portaria 344) marcados no catálogo."
    )).not.toBeNull();
  });

  it("recusa do envelope (payload nulo): mostra o código e a mensagem do api", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query MedicationCatalog": () => catalogReply(),
      "mutation ImportAnvisaLists": () => reply(200, {
        data: { importAnvisaLists: null },
        errors: [ { message: "sessão sem permissão de escrita", path: [ "importAnvisaLists" ], extensions: { code: "FORBIDDEN" } } ]
      })
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "importar as listas da Anvisa" }));
    await user.click(screen.getByRole("button", { name: "confirmar: importar as listas da Anvisa agora" }));
    expect((await screen.findByRole("alert")).textContent).toBe("FORBIDDEN — sessão sem permissão de escrita");
  });

  it("api sem o 19c: explica a ordem de deploy", async () => {
    route(fetchMock, { "query MedicationCatalog": () => reply(200, {
      errors: [ {
        message: "Field 'medicationCatalog' doesn't exist on type 'Query'",
        extensions: { code: "undefinedField", typeName: "Query", fieldName: "medicationCatalog" }
      } ]
    }) });
    renderScreen();
    expect((await screen.findByRole("alert")).textContent)
      .toMatch(/o api do módulo 19c precisa subir antes do maintenance/);
  });

  it("falha de rede na importação: mostra o alerta e relê a versão atual", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query MedicationCatalog": () => catalogReply(),
      "mutation ImportMedicationCatalog": () => reply(504, {})
    });
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "importar o CATMAT" }));
    await user.click(screen.getByRole("button", { name: "confirmar: importar o CATMAT agora" }));
    expect(await screen.findByRole("alert")).not.toBeNull();
    await waitFor(() => expect(calls(fetchMock, "query MedicationCatalog").length).toBeGreaterThanOrEqual(2));
  });
});
