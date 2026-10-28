// src/screens/NotifiableDiseases.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { V1, V2, V3, renderScreen, reply } from "./NotifiableDiseases.fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("NotifiableDiseases", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  const listing = (list: unknown[]) => fetchMock.mockImplementation(() => Promise.resolve(reply(200, { data: { notifiableDiseases: list } })));

  it("a vigente com portaria, vigência, doenças e a agendada", async () => {
    listing([ V3, V2, V1 ]);
    renderScreen();
    expect(await screen.findByText("v2 · Portaria GM/MS nº 11.211/2026 · vigente desde 01/10/2026 · 2 doenças · publicada por mantenedor@rotasaude.app"))
      .not.toBeNull();
    expect(screen.getByText("agendada para 01/12/2026")).not.toBeNull();
    const table = screen.getByRole("table");
    const sarampo = within(table).getByRole("row", { name: /Sarampo/ });
    expect(within(sarampo).getByText("imediata (24 h)")).not.toBeNull();
    expect(within(sarampo).getByText("B059")).not.toBeNull();
    expect(within(sarampo).getByText("A71")).not.toBeNull();
    expect(within(sarampo).getByText("ficha de investigação de sarampo")).not.toBeNull();
    const dengue = within(table).getByRole("row", { name: /Dengue/ });
    expect(within(dengue).getByText("A90, A91")).not.toBeNull();
    expect(within(dengue).getByText("semanal (7 dias)")).not.toBeNull();
    expect(within(dengue).getByText("óbito por dengue: imediata, notificar à mão")).not.toBeNull();
    expect(within(dengue).getByText("ficha de investigação de dengue")).not.toBeNull();
    expect(screen.getByText(/As notificações já feitas ficam com a versão em que nasceram/)).not.toBeNull();
  });

  it("colunas e células vazias: repetição em dias, ficha do Sinan e CIAP-2 ausentes como traço", async () => {
    listing([ V2, V1 ]);
    renderScreen();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent))
      .toEqual([ "Doença", "Prazo", "CID-10", "CIAP-2", "Repetição", "Ficha do Sinan", "Fonte dos códigos" ]);
    const sarampo = within(table).getByRole("row", { name: /Sarampo/ });
    expect(within(sarampo).getByText("30 dias")).not.toBeNull();
    expect(within(sarampo).getByText("—")).not.toBeNull();
    const dengue = within(table).getByRole("row", { name: /Dengue/ });
    expect(within(dengue).getAllByText("—")).toHaveLength(1); // CIAP-2 vazio; a ficha do Sinan da dengue existe
    expect(screen.queryByText(/agendada para/)).toBeNull();
  });

  it("a nota da versão vigente aparece junto do resumo", async () => {
    listing([ V2, V1 ]);
    renderScreen();
    expect(await screen.findByText("nota da versão: inclui sarampo")).not.toBeNull();
  });

  it("carga inicial: vigente sem autor", async () => {
    listing([ { ...V1, current: true } ]);
    renderScreen();
    expect(await screen.findByText("v1 · Portaria GM/MS nº 11.211/2026 · vigente desde 01/03/2026 · 1 doença · carga inicial")).not.toBeNull();
  });

  it("versões: do mais novo ao mais antigo, com o estado", async () => {
    const user = userEvent.setup();
    listing([ V1, V2, V3 ]);
    renderScreen();
    await user.click(await screen.findByRole("button", { name: "versões" }));
    const history = screen.getByRole("region", { name: "Versões da lista" });
    const items = within(history).getAllByRole("listitem").filter((li) => li.getAttribute("data-version"));
    expect(items.map((li) => li.getAttribute("data-version"))).toEqual([ "3", "2", "1" ]);
    expect(within(items[0]).getByText("agendada")).not.toBeNull();
    expect(within(items[1]).getByText("vigente")).not.toBeNull();
    expect(within(items[2]).getByText("anterior")).not.toBeNull();
    expect(within(items[2]).getByText(/carga inicial/)).not.toBeNull();
    expect(within(items[1]).getByText(/inclui sarampo/)).not.toBeNull();
    expect(within(items[1]).getByText(/vigência 01\/10\/2026/)).not.toBeNull();
    expect(within(items[1]).getByText(/2 doenças/)).not.toBeNull();
    expect(within(items[1]).getByText(/mantenedor@rotasaude\.app/)).not.toBeNull();
    await user.click(within(history).getByRole("button", { name: "fechar" }));
    expect(screen.queryByRole("region", { name: "Versões da lista" })).toBeNull();
  });

  it("sem nenhuma versão: estado vazio e primeira versão, que abre o formulário vazio", async () => {
    const user = userEvent.setup();
    listing([]);
    renderScreen();
    expect(await screen.findByText("nenhuma versão da lista")).not.toBeNull();
    const first = screen.getByRole("button", { name: "primeira versão" }) as HTMLButtonElement;
    expect(first.disabled).toBe(false);
    await user.click(first);
    const form = screen.getByRole("region", { name: "Versão nova" });
    expect(within(form).queryAllByRole("row").filter((r) => within(r).queryByRole("button"))).toHaveLength(0);
    expect(within(form).getByRole("button", { name: "publicar versão 1" })).not.toBeNull();
  });

  it("há versões e nenhuma em vigor: avisa e mostra a agendada", async () => {
    listing([ { ...V3, version: 1, current: false } ]);
    renderScreen();
    expect(await screen.findByText("nenhuma versão em vigor ainda")).not.toBeNull();
    expect(screen.getByText("agendada para 01/12/2026")).not.toBeNull();
  });

  it("api sem o 25: só esta tela cai, com a frase", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      data: null, errors: [ { message: "Field 'notifiableDiseases' doesn't exist on type 'Query'", extensions: { code: "undefinedField" } } ] })));
    renderScreen();
    expect((await screen.findByRole("alert")).textContent)
      .toBe("esta API ainda não tem a lista de doenças de notificação — o api do módulo 25 precisa subir antes do maintenance");
  });
});
