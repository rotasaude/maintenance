// src/screens/LabTemplates.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LabTemplates } from "./LabTemplates";

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

const HB = {
  id: "a1", key: "hemoglobin", name: "Hemoglobina", loinc: "718-7", unit: "g/dL", valueType: "numeric", choices: [],
  decimals: 1, position: 1,
  referenceRanges: [
    { sex: "male", ageMinDays: 6570, ageMaxDays: 43800, low: 13.5, high: 17.5, text: null },
    { sex: "female", ageMinDays: 6570, ageMaxDays: 43800, low: 12, high: 15.5, text: null }
  ]
};
const HCT = {
  id: "a2", key: "hematocrit", name: "Hematócrito", loinc: "4544-3", unit: "%", valueType: "numeric", choices: [],
  decimals: 1, position: 2, referenceRanges: []
};
const HEMOGRAMA = {
  id: "t1", sigtapCode: "0202020380", name: "Hemograma completo", sector: "hematology", material: "sangue total",
  container: "tubo roxo (EDTA)", suggestedMethod: "automação hematológica", preparation: null, active: true,
  analytes: [ HCT, HB ]
};
const GLICOSE = {
  id: "t2", sigtapCode: "0202010473", name: "Glicose", sector: "biochemistry", material: "soro",
  container: "tubo cinza (fluoreto)", suggestedMethod: null, preparation: "jejum de 8 horas", active: false, analytes: []
};
const CREATININA = {
  id: "t3", sigtapCode: "0202010317", name: "Creatinina", sector: "biochemistry", material: "soro",
  container: "tubo amarelo (gel)", suggestedMethod: null, preparation: null, active: true, analytes: []
};

function templatesReply(list: unknown[] = [ HEMOGRAMA, GLICOSE ]) {
  return reply(200, { data: { labExamTemplates: list } });
}
const SAVED = () => reply(200, { data: { upsertLabExamTemplate: { ok: true, errors: [] } } });

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<LabTemplates />, { wrapper });
}
const rowOf = (text: string) => screen.getByRole("row", { name: new RegExp(text) });
const form = () => screen.getByRole("region", { name: "Exame do catálogo-base" });
const input = (label: string) => within(form()).getByLabelText(label) as HTMLInputElement;

describe("LabTemplates", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("lista os exames com setor, material, componentes e situação, sem undefined/null", async () => {
    route(fetchMock, { "query LabExamTemplates": () => templatesReply() });
    renderScreen();

    expect(await screen.findByText("Hemograma completo")).not.toBeNull();
    const hb = rowOf("0202020380");
    expect(within(hb).getByText("Hematologia")).not.toBeNull();
    expect(within(hb).getByText("sangue total · tubo roxo (EDTA)")).not.toBeNull();
    expect(within(hb).getByText("2")).not.toBeNull();
    expect(within(hb).getByText("ativo")).not.toBeNull();
    const gl = rowOf("0202010473");
    expect(within(gl).getByText("Bioquímica")).not.toBeNull();
    expect(within(gl).getByText("0")).not.toBeNull();
    expect(within(gl).getByText("inativo")).not.toBeNull();
    expect(screen.getByText(/os exames já adotados pelas cidades e os laudos não mudam/)).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("nenhum exame no catálogo-base", async () => {
    route(fetchMock, { "query LabExamTemplates": () => templatesReply([]) });
    renderScreen();
    expect(await screen.findByText("nenhum exame no catálogo-base")).not.toBeNull();
  });

  it("editar um exame: o formulário vem preenchido, salva com as mudanças e relê o catálogo", async () => {
    const user = userEvent.setup();
    route(fetchMock, { "query LabExamTemplates": () => templatesReply(), "mutation UpsertLabExamTemplate": SAVED });
    renderScreen();

    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));
    expect(input("Nome").value).toBe("Hemograma completo");
    expect((within(form()).getByLabelText("Setor") as HTMLSelectElement).value).toBe("hematology");
    expect(input("Preparo do paciente").value).toBe("");
    await user.type(input("Preparo do paciente"), "sem jejum");
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));

    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabExamTemplate")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation UpsertLabExamTemplate")[0]).variables).toEqual({
      id: "t1", sigtapCode: "0202020380", name: "Hemograma completo", sector: "hematology", material: "sangue total",
      container: "tubo roxo (EDTA)", suggestedMethod: "automação hematológica", preparation: "sem jejum", active: true
    });
    expect((await screen.findByRole("status")).textContent).toBe("Exame salvo.");
    await waitFor(() => expect(calls(fetchMock, "query LabExamTemplates").length).toBeGreaterThanOrEqual(2));
  });

  it("desativar: o exame sai de uso sem ser apagado", async () => {
    const user = userEvent.setup();
    route(fetchMock, { "query LabExamTemplates": () => templatesReply(), "mutation UpsertLabExamTemplate": SAVED });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));
    await user.click(within(form()).getByLabelText("ativo (aparece para adoção)"));
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabExamTemplate")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation UpsertLabExamTemplate")[0]).variables.active).toBe(false);
  });

  it("novo exame: salva sem id, com o texto aparado, e depois de reler abre os componentes do exame criado", async () => {
    const user = userEvent.setup();
    let listed: unknown[] = [ HEMOGRAMA ];
    route(fetchMock, {
      "query LabExamTemplates": () => templatesReply(listed),
      "mutation UpsertLabExamTemplate": () => { listed = [ HEMOGRAMA, CREATININA ]; return SAVED(); }
    });
    renderScreen();

    await screen.findByText("Hemograma completo");
    await user.click(screen.getByRole("button", { name: "novo exame" }));
    await user.type(input("Código SIGTAP"), " 0202010317 ");
    await user.type(input("Nome"), "Creatinina");
    await user.selectOptions(within(form()).getByLabelText("Setor"), "biochemistry");
    await user.type(input("Material"), "soro");
    await user.type(input("Recipiente"), "tubo amarelo (gel)");
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));

    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabExamTemplate")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation UpsertLabExamTemplate")[0]).variables).toEqual({
      id: null, sigtapCode: "0202010317", name: "Creatinina", sector: "biochemistry", material: "soro",
      container: "tubo amarelo (gel)", suggestedMethod: null, preparation: null, active: true
    });
    const components = await screen.findByRole("region", { name: "Componentes de Creatinina" });
    expect(within(components).getByText("nenhum componente")).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Exame salvo.");
    expect(input("Nome").value).toBe("Creatinina");
  });

  it("recusa do api: mostra a frase e mantém o que foi digitado", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query LabExamTemplates": () => templatesReply(),
      "mutation UpsertLabExamTemplate": () => reply(200, { data: { upsertLabExamTemplate: {
        ok: false, errors: [ { path: "sigtapCode", message: "duplicate_sigtap" } ]
      } } })
    });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(screen.getByRole("button", { name: "novo exame" }));
    await user.type(input("Código SIGTAP"), "0202010473");
    await user.type(input("Nome"), "Glicemia de jejum");
    await user.type(input("Material"), "plasma");
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));

    expect((await screen.findByRole("alert")).textContent).toBe("já existe um exame do catálogo-base com este código SIGTAP");
    expect(input("Código SIGTAP").value).toBe("0202010473");
    expect(input("Nome").value).toBe("Glicemia de jejum");
    expect(input("Material").value).toBe("plasma");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("setor desconhecido (api mais novo): aparece cru e salvar não o troca", async () => {
    const user = userEvent.setup();
    const CITO = { ...GLICOSE, id: "t9", sigtapCode: "0203010019", name: "Citopatológico", sector: "cytology" };
    route(fetchMock, { "query LabExamTemplates": () => templatesReply([ CITO ]), "mutation UpsertLabExamTemplate": SAVED });
    renderScreen();
    await screen.findByText("Citopatológico");
    expect(within(rowOf("0203010019")).getByText("cytology")).not.toBeNull();
    await user.click(within(rowOf("0203010019")).getByRole("button", { name: "editar" }));
    expect((within(form()).getByLabelText("Setor") as HTMLSelectElement).value).toBe("cytology");
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabExamTemplate")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation UpsertLabExamTemplate")[0]).variables.sector).toBe("cytology");
  });

  it("componentes do exame em ordem, com as faixas de referência em português", async () => {
    const user = userEvent.setup();
    route(fetchMock, { "query LabExamTemplates": () => templatesReply() });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));

    const components = screen.getByRole("region", { name: "Componentes de Hemograma completo" });
    const rows = within(components).getAllByRole("row");
    expect(within(rows[1]).getByText("hemoglobin")).not.toBeNull();
    expect(within(rows[1]).getByText("718-7")).not.toBeNull();
    expect(within(rows[1]).getByText("g/dL")).not.toBeNull();
    expect(within(rows[1]).getByText("numérico")).not.toBeNull();
    expect(within(rows[1]).getByText("masculino, 18 a–120 a: 13,5–17,5; feminino, 18 a–120 a: 12–15,5")).not.toBeNull();
    expect(within(rows[2]).getByText("hematocrit")).not.toBeNull();
    expect(within(rows[2]).getByText("sem faixa")).not.toBeNull();
  });

  it("recusa do envelope (payload nulo): mostra o código e a mensagem do api", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query LabExamTemplates": () => templatesReply(),
      "mutation UpsertLabExamTemplate": () => reply(200, {
        data: { upsertLabExamTemplate: null },
        errors: [ { message: "sessão sem permissão de escrita", path: [ "upsertLabExamTemplate" ], extensions: { code: "FORBIDDEN" } } ]
      })
    });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    expect((await screen.findByRole("alert")).textContent).toBe("FORBIDDEN — sessão sem permissão de escrita");
  });

  it("api sem o 21b: explica a ordem de deploy", async () => {
    route(fetchMock, { "query LabExamTemplates": () => reply(200, {
      errors: [ {
        message: "Field 'labExamTemplates' doesn't exist on type 'Query'",
        extensions: { code: "undefinedField", typeName: "Query", fieldName: "labExamTemplates" }
      } ]
    }) });
    renderScreen();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 21b precisa subir antes do maintenance/);
  });

  it("falha de rede ao salvar: mostra o alerta, mantém o digitado e relê o catálogo", async () => {
    const user = userEvent.setup();
    route(fetchMock, {
      "query LabExamTemplates": () => templatesReply(),
      "mutation UpsertLabExamTemplate": () => Promise.reject(new TypeError("Failed to fetch"))
    });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));
    await user.type(input("Preparo do paciente"), "sem jejum");
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    expect((await screen.findByRole("alert")).textContent).toBe("sem conexão com a API");
    expect(input("Nome").value).toBe("Hemograma completo");
    expect(input("Preparo do paciente").value).toBe("sem jejum");
    await waitFor(() => expect(calls(fetchMock, "query LabExamTemplates").length).toBeGreaterThanOrEqual(2));
  });

  it("api recusa a requisição (504): mostra a mensagem própria e mantém o formulário", async () => {
    const user = userEvent.setup();
    route(fetchMock, { "query LabExamTemplates": () => templatesReply(), "mutation UpsertLabExamTemplate": () => reply(504, {}) });
    renderScreen();
    await screen.findByText("Hemograma completo");
    await user.click(within(rowOf("0202020380")).getByRole("button", { name: "editar" }));
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    expect((await screen.findByRole("alert")).textContent).toBe("a API recusou a requisição");
    expect(input("Nome").value).toBe("Hemograma completo");
  });

  it("limites do api: os campos limitam a digitação e um nome já longo demais não é enviado", async () => {
    const user = userEvent.setup();
    const LONG = { ...GLICOSE, id: "t8", sigtapCode: "0202010999", name: "x".repeat(121) };
    route(fetchMock, { "query LabExamTemplates": () => templatesReply([ LONG ]), "mutation UpsertLabExamTemplate": SAVED });
    renderScreen();
    await screen.findByText("x".repeat(121));
    await user.click(within(rowOf("0202010999")).getByRole("button", { name: "editar" }));
    expect(input("Nome").maxLength).toBe(120);
    expect(input("Material").maxLength).toBe(60);
    expect(input("Recipiente").maxLength).toBe(60);
    expect(input("Método sugerido").maxLength).toBe(160);
    await user.click(within(form()).getByRole("button", { name: "salvar exame" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Nome: no máximo 120 caracteres");
    expect(calls(fetchMock, "mutation UpsertLabExamTemplate")).toHaveLength(0);
  });
});
