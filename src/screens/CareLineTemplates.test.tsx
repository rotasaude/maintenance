// src/screens/CareLineTemplates.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { C2_V1, C3_V1, C4_V1, C4_V2, C6_V1, C7_V1, renderScreen, reply } from "./CareLineTemplates.fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CareLineTemplates", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });

  const listing = (list: unknown[]) => fetchMock.mockImplementation(() =>
    Promise.resolve(reply(200, { data: { careLineTemplates: list } })));
  const rowOf = (text: string) => screen.getByRole("row", { name: new RegExp(text) });

  it("uma linha por chave, a versão vigente, a soma dos pontos e as chaves sem versão", async () => {
    listing([ C4_V2, C4_V1, C3_V1 ]);
    renderScreen();
    expect(await screen.findByText("C4 — Pessoa com diabetes")).not.toBeNull();
    const c4 = rowOf("C4 — Pessoa com diabetes");
    expect(within(c4).getByText("v2")).not.toBeNull();
    expect(within(c4).getByText("20/10/2026, 10:00")).not.toBeNull();
    expect(within(c4).getByText("100")).not.toBeNull();
    expect(screen.getAllByRole("row", { name: /C4 — Pessoa com diabetes/ })).toHaveLength(1);
    const c2 = rowOf("C2 — Cuidado da criança até 2 anos");
    expect(within(c2).getByText("sem versão")).not.toBeNull();
    expect(within(c2).getByRole("button", { name: "primeira versão" })).not.toBeNull();
    expect(screen.getByText(/só vale para a cidade que a adotar/)).not.toBeNull();
  });

  it("versões: o histórico da chave, da mais nova para a mais antiga, com a regra e os avançados", async () => {
    const user = userEvent.setup();
    listing([ C4_V2, C4_V1, C3_V1 ]);
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C4 — Pessoa com diabetes/ })).findByRole("button", { name: "versões" }));
    const history = screen.getByRole("region", { name: "Versões de C4 — Pessoa com diabetes" });
    const versions = within(history).getAllByRole("listitem").filter((li) => li.getAttribute("data-version"));
    expect(versions.map((li) => li.getAttribute("data-version"))).toEqual([ "2", "1" ]);
    expect(within(versions[0]).getByText("vigente")).not.toBeNull();
    expect(within(history).getAllByText("CIAP-2 T89, T90 · CID-10 E10, E11, E14 · condição declarada: diabetes")).toHaveLength(2);
    expect(within(versions[0]).getByText(
      "Hemoglobina glicada em 12 meses: exame SIGTAP 0202010503 (pedido ou resultado) · 1× em 365 dias, até o fim da janela · janela móvel · 15 pontos"
    )).not.toBeNull();
    await user.click(within(screen.getByRole("row", { name: /C3 — Gestante e puérpera/ })).getByRole("button", { name: "versões" }));
    const c3 = screen.getByRole("region", { name: "Versões de C3 — Gestante e puérpera" });
    expect(within(c3).getByText("regras avançadas (preservadas na versão nova): todas de: procedimento SIGTAP 0214010074 | procedimento SIGTAP 0214010040")).not.toBeNull();
  });

  it("histórico: o autor da versão ('por <e-mail>') ou 'carga inicial' quando não há", async () => {
    const user = userEvent.setup();
    listing([ C4_V2, C4_V1 ]);
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C4 — Pessoa com diabetes/ })).findByRole("button", { name: "versões" }));
    const history = screen.getByRole("region", { name: "Versões de C4 — Pessoa com diabetes" });
    const [ v2, v1 ] = within(history).getAllByRole("listitem").filter((li) => li.getAttribute("data-version"));
    expect(within(v2).getByText("por mantenedor@rotasaude.app")).not.toBeNull();
    expect(within(v1).getByText("carga inicial")).not.toBeNull();
    expect(within(v1).queryByText(/^por /)).toBeNull();
  });

  it("C2, C6 e C7 (elegibilidade só de idade, sexo e identidades) abrem sem quebrar", async () => {
    const user = userEvent.setup();
    listing([ C2_V1, C6_V1, C7_V1 ]);
    renderScreen();
    await user.click(within(await screen.findByRole("row", { name: /C2 — Cuidado da criança/ })).getByRole("button", { name: "versões" }));
    expect(within(screen.getByRole("region", { name: "Versões de C2 — Cuidado da criança até 2 anos" })).getByText("até 730 dias de vida")).not.toBeNull();
    await user.click(within(screen.getByRole("row", { name: /C6 — Pessoa idosa/ })).getByRole("button", { name: "versões" }));
    expect(within(screen.getByRole("region", { name: "Versões de C6 — Pessoa idosa" })).getByText("a partir de 60 anos")).not.toBeNull();
    await user.click(within(screen.getByRole("row", { name: /C7 — Mulher/ })).getByRole("button", { name: "versões" }));
    expect(within(screen.getByRole("region", { name: "Versões de C7 — Mulher e prevenção do câncer" }))
      .getByText("exceto CIAP-2 X37 · de 25 a 64 anos · sexo feminino · inclui: homem trans")).not.toBeNull();
  });

  it("pontos inteiros: a soma sai sem casas decimais", async () => {
    listing([ C2_V1, C4_V2 ]);
    renderScreen();
    expect(within(await screen.findByRole("row", { name: /C2 — Cuidado da criança/ })).getByText("100")).not.toBeNull();
    expect(within(screen.getByRole("row", { name: /C4 — Pessoa com diabetes/ })).getByText("100")).not.toBeNull();
  });

  it("pontos inteiros: uma versão que não soma 100 mostra a soma como está, sem vírgula", async () => {
    listing([ { ...C4_V2, practices: [ C4_V2.practices[0] ] } ]);
    renderScreen();
    const r = await screen.findByRole("row", { name: /C4 — Pessoa com diabetes/ });
    expect(within(r).getByText("85")).not.toBeNull();
    expect(within(r).queryByText("100")).toBeNull();
    expect(r.textContent).not.toMatch(/\d,\d/);
  });

  it("histórico: a condição que sugere a linha aparece quando difere da elegibilidade", async () => {
    const user = userEvent.setup();
    listing([ { ...C4_V2, declaredCondition: "hypertension" }, C4_V1 ]);
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C4 — Pessoa com diabetes/ })).findByRole("button", { name: "versões" }));
    const [ v2, v1 ] = within(screen.getByRole("region", { name: "Versões de C4 — Pessoa com diabetes" })).getAllByRole("listitem")
      .filter((li) => li.getAttribute("data-version"));
    expect(within(v2).getByText("sugere a linha: hipertensão")).not.toBeNull();
    expect(within(v1).queryByText(/sugere a linha/)).toBeNull();
  });

  it("chave desconhecida do api aparece crua, sem 'primeira versão' nem 'nova versão'", async () => {
    const user = userEvent.setup();
    listing([ { ...C2_V1, key: "future_c9", indicator: "C9", name: "Futura" } ]);
    renderScreen();
    const r = await screen.findByRole("row", { name: /future_c9/ });
    expect(within(r).getByRole("button", { name: "versões" })).not.toBeNull();
    expect(within(r).queryByRole("button", { name: /primeira versão|nova versão/ })).toBeNull();
    await user.click(within(r).getByRole("button", { name: "versões" }));
    expect(screen.getByRole("region", { name: "Versões de future_c9" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "nova versão" })).toBeNull();
  });

  it("catálogo vazio: as seis chaves sem versão", async () => {
    listing([]);
    renderScreen();
    expect(await screen.findByText("C7 — Mulher e prevenção do câncer")).not.toBeNull();
    expect(screen.getAllByText("sem versão")).toHaveLength(6);
  });

  it("api sem o 23: só esta tela cai, com a frase", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      data: null, errors: [ { message: "Field 'careLineTemplates' doesn't exist on type 'Query'", extensions: { code: "undefinedField" } } ]
    })));
    renderScreen();
    expect((await screen.findByRole("alert")).textContent)
      .toBe("esta API ainda não tem o catálogo de linhas de cuidado — o api do módulo 23 precisa subir antes do maintenance");
  });
});
