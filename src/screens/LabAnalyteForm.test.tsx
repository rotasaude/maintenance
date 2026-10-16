// src/screens/LabAnalyteForm.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LabAnalyteForm } from "./LabAnalyteForm";
import type { AnalyteView } from "../lib/labTemplates";

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

const HB: AnalyteView = {
  id: "a1", key: "hemoglobin", name: "Hemoglobina", loinc: "718-7", unit: "g/dL", valueType: "numeric", choices: [],
  decimals: 1, position: 1,
  referenceRanges: [
    { sex: "male", ageMinDays: 6570, ageMaxDays: 43800, low: 13.5, high: 17.5, text: null },
    { sex: "female", ageMinDays: 6570, ageMaxDays: 43800, low: 12, high: 15.5, text: null }
  ]
};
const MALE_IN = { sex: "male", ageMinDays: 6570, ageMaxDays: 43800, low: 13.5, high: 17.5, text: null };
const FEMALE_IN = { sex: "female", ageMinDays: 6570, ageMaxDays: 43800, low: 12, high: 15.5, text: null };
const SAVED = () => reply(200, { data: { upsertLabAnalyteTemplate: { ok: true, errors: [] } } });

function renderForm(analyte: AnalyteView | null = HB) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  render(<LabAnalyteForm templateId="t1" analyte={analyte} nextPosition={3} onSaved={onSaved} onClose={onClose} />, { wrapper });
  return { onSaved, onClose };
}
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: "salvar componente" });
const rangeRows = () => within(screen.getByRole("table", { name: "Faixas de referência" })).getAllByRole("row");
const sent = (fetchMock: ReturnType<typeof vi.fn>) => bodyOf(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")[0]).variables;

describe("LabAnalyteForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("editar: faixas vêm com vírgula e voltam como número", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    const { onSaved } = renderForm();

    expect(field("Nome do componente").value).toBe("Hemoglobina");
    expect(field("faixa 1: baixo").value).toBe("13,5");
    expect((screen.getByLabelText("faixa 2: sexo") as HTMLSelectElement).value).toBe("female");
    await user.clear(field("faixa 1: alto"));
    await user.type(field("faixa 1: alto"), "17,8");
    await user.click(save());

    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock)).toEqual({
      id: "a1", labExamTemplateId: "t1", key: "hemoglobin", name: "Hemoglobina", loinc: "718-7", unit: "g/dL",
      valueType: "numeric", choices: [], decimals: 1, position: 1,
      referenceRanges: [ { ...MALE_IN, high: 17.8 }, FEMALE_IN ]
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Componente salvo."));
  });

  it("novo componente: ponto de milhar é recusado antes de enviar", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    renderForm(null);

    expect(field("Ordem").value).toBe("3");
    await user.type(field("Chave"), "platelets");
    await user.type(field("Nome do componente"), "Plaquetas");
    await user.type(field("Unidade"), "/mm³");
    await user.type(field("faixa 1: baixo"), "150.000");
    await user.type(field("faixa 1: alto"), "450000");
    await user.click(save());

    expect((await screen.findByRole("alert")).textContent)
      .toBe("faixa 1: \"baixo\" não é um número — use vírgula para decimais e não use ponto de milhar");
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(0);

    await user.clear(field("faixa 1: baixo"));
    await user.type(field("faixa 1: baixo"), "150000");
    await user.click(save());
    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock)).toEqual({
      id: null, labExamTemplateId: "t1", key: "platelets", name: "Plaquetas", loinc: null, unit: "/mm³",
      valueType: "numeric", choices: [], decimals: 0, position: 3,
      referenceRanges: [ { sex: "any", ageMinDays: 0, ageMaxDays: 43800, low: 150000, high: 450000, text: null } ]
    });
  });

  it("acrescentar e remover faixas", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    renderForm();

    expect(rangeRows()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "acrescentar faixa" }));
    expect(rangeRows()).toHaveLength(4);
    expect((screen.getByLabelText("faixa 3: sexo") as HTMLSelectElement).value).toBe("any");
    expect(field("faixa 3: idade máxima em dias").value).toBe("43800");
    await user.type(field("faixa 3: texto"), "ver laudo");
    await user.click(within(rangeRows()[1]).getByRole("button", { name: "remover" }));
    expect(rangeRows()).toHaveLength(3);
    await user.click(save());

    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock).referenceRanges).toEqual([
      FEMALE_IN,
      { sex: "any", ageMinDays: 0, ageMaxDays: 43800, low: null, high: null, text: "ver laudo" }
    ]);
  });

  it("recusa do api (chave repetida no exame, que só o servidor vê): mostra a frase e mantém o digitado", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, { data: { upsertLabAnalyteTemplate: {
      ok: false, errors: [ { path: "key", message: "duplicate_analyte_key" } ]
    } } })));
    const { onSaved } = renderForm();

    await user.clear(field("Chave"));
    await user.type(field("Chave"), "hematocrit");
    await user.clear(field("faixa 1: baixo"));
    await user.type(field("faixa 1: baixo"), "13");
    await user.click(save());

    expect((await screen.findByRole("alert")).textContent).toBe("já existe um componente com esta chave neste exame");
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1);
    expect(field("Chave").value).toBe("hematocrit");
    expect(field("faixa 1: baixo").value).toBe("13");
    expect(field("faixa 2: alto").value).toBe("15,5");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("falha de rede ao salvar: mostra o texto e mantém o digitado", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
    const { onSaved } = renderForm();

    await user.clear(field("faixa 1: alto"));
    await user.type(field("faixa 1: alto"), "18");
    await user.click(save());

    expect((await screen.findByRole("alert")).textContent).toBe("sem conexão com a API");
    expect(field("faixa 1: alto").value).toBe("18");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    [ "faixa sem baixo, alto nem texto", (u: ReturnType<typeof userEvent.setup>) => u.clear(field("faixa 1: baixo")).then(() => u.clear(field("faixa 1: alto"))),
      "faixa 1: informe baixo, alto ou um texto" ],
    [ "baixo maior que alto", async (u: ReturnType<typeof userEvent.setup>) => { await u.clear(field("faixa 1: baixo")); await u.type(field("faixa 1: baixo"), "20"); },
      "faixa 1: \"baixo\" passa de \"alto\"" ],
    [ "idade mínima maior que a máxima", async (u: ReturnType<typeof userEvent.setup>) => {
      await u.clear(field("faixa 1: idade mínima em dias")); await u.type(field("faixa 1: idade mínima em dias"), "200");
      await u.clear(field("faixa 1: idade máxima em dias")); await u.type(field("faixa 1: idade máxima em dias"), "100");
    }, "faixa 1: a idade mínima passa da máxima" ],
    [ "idade acima de 43800 dias", (u: ReturnType<typeof userEvent.setup>) => u.clear(field("faixa 1: idade máxima em dias")).then(() => u.type(field("faixa 1: idade máxima em dias"), "50000")),
      "faixa 1: a idade passa de 43800 dias (120 anos)" ],
    [ "chave inválida", (u: ReturnType<typeof userEvent.setup>) => u.clear(field("Chave")).then(() => u.type(field("Chave"), "Hemo-1")),
      "Chave: começa com letra, até 40 caracteres; minúsculas, números e _ (ex.: hemoglobina)" ],
    [ "LOINC inválido", (u: ReturnType<typeof userEvent.setup>) => u.clear(field("LOINC")).then(() => u.type(field("LOINC"), "7187")),
      "LOINC: formato 718-7 (até 7 dígitos, hífen e 1 dígito)" ],
    [ "ordem não inteira", (u: ReturnType<typeof userEvent.setup>) => u.clear(field("Ordem")).then(() => u.type(field("Ordem"), "2,5")),
      "ordem: use um número inteiro" ]
  ])("recusa antes de enviar: %s", async (_name, act, phrase) => {
    const user = userEvent.setup();
    renderForm();
    await act(user);
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(phrase);
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(0);
  });

  it("nome vazio é recusado antes de enviar", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.clear(field("Nome do componente"));
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe("campo obrigatório vazio: Nome do componente");
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(0);
  });

  it("opções repetidas ou fora do limite são recusadas no tipo lista, mas ignoradas nos outros", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    renderForm(null);
    await user.type(field("Chave"), "color");
    await user.type(field("Nome do componente"), "Cor");
    await user.selectOptions(screen.getByLabelText("Tipo de valor"), "choice");
    await user.type(field("Opções (uma por linha)"), "amarelo{enter}amarelo");
    await user.type(field("faixa 1: texto"), "amarelo");
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent)
      .toBe("a lista precisa de 1 a 20 opções distintas, cada uma com até 60 caracteres");
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(0);

    await user.selectOptions(screen.getByLabelText("Tipo de valor"), "text");
    await user.click(save());
    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock).choices).toEqual([]);
  });

  it("tipo lista: opções uma por linha, aparadas e sem linha vazia", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    renderForm(null);

    expect(screen.queryByLabelText("Opções (uma por linha)")).toBeNull();
    await user.type(field("Chave"), "color");
    await user.type(field("Nome do componente"), "Cor");
    await user.selectOptions(screen.getByLabelText("Tipo de valor"), "choice");
    await user.type(field("Opções (uma por linha)"), " amarelo-claro {enter}amarelo{enter}{enter}âmbar");
    await user.type(field("faixa 1: texto"), "amarelo-claro");
    await user.click(save());

    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock).valueType).toBe("choice");
    expect(sent(fetchMock).choices).toEqual([ "amarelo-claro", "amarelo", "âmbar" ]);
  });

  it("tipo e sexo desconhecidos (api mais novo) aparecem crus e não são trocados", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(SAVED()));
    renderForm({ ...HB, valueType: "ratio", referenceRanges: [ { ...MALE_IN, sex: "intersex" } ] });

    expect((screen.getByLabelText("Tipo de valor") as HTMLSelectElement).value).toBe("ratio");
    expect((screen.getByLabelText("faixa 1: sexo") as HTMLSelectElement).value).toBe("intersex");
    await user.click(save());
    await waitFor(() => expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(1));
    expect(sent(fetchMock).valueType).toBe("ratio");
    expect(sent(fetchMock).referenceRanges).toEqual([ { ...MALE_IN, sex: "intersex" } ]);
  });

  it("casas decimais não inteiras são recusadas antes de enviar; cancelar não envia", async () => {
    const user = userEvent.setup();
    const { onClose } = renderForm();
    await user.clear(field("Casas decimais"));
    await user.type(field("Casas decimais"), "1,5");
    await user.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe("casas decimais de 0 a 4");
    await user.click(screen.getByRole("button", { name: "cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(calls(fetchMock, "mutation UpsertLabAnalyteTemplate")).toHaveLength(0);
  });
});
