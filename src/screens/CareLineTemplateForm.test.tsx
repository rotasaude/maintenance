// src/screens/CareLineTemplateForm.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { C2_V1, C3_FULL_ELIGIBILITY, C3_FULL_PRACTICES, C3_FULL_V1, C3_V1, C4_V1, C4_V2, renderScreen, reply } from "./CareLineTemplates.fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

type Body = { query: string; variables: Record<string, unknown> };
const bodyOf = (call: unknown[]): Body => JSON.parse((call[1] as RequestInit).body as string);
type SentPractice = { key: string; source: string; points: number; all_of?: unknown; cbo_filter?: string[] };

describe("CareLineTemplateForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let upsertReply: () => Response;
  beforeEach(() => {
    upsertReply = () => reply(200, { data: { upsertCareLineTemplate: { ok: true, errors: [] } } });
    fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Body;
      if (body.query.includes("mutation UpsertCareLineTemplate")) return Promise.resolve(upsertReply());
      return Promise.resolve(reply(200, { data: { careLineTemplates: [ C4_V2, C4_V1, C3_V1 ] } }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  const upserts = () => fetchMock.mock.calls.filter((c) => bodyOf(c).query.includes("mutation UpsertCareLineTemplate"));
  const lists = () => fetchMock.mock.calls.filter((c) => bodyOf(c).query.includes("query CareLineTemplates"));
  const form = () => screen.getByRole("region", { name: "Versão nova do catálogo-base" });
  const practice = (n: number) => within(form()).getByRole("group", { name: `Boa prática ${n}` });
  const publish = (user: ReturnType<typeof userEvent.setup>) => user.click(within(form()).getByRole("button", { name: "publicar versão" }));

  async function openNewVersion(user: ReturnType<typeof userEvent.setup>, line = /C4 — Pessoa com diabetes/) {
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: line })).findByRole("button", { name: "versões" }));
    await user.click(screen.getByRole("button", { name: "nova versão" }));
  }

  it("publica versão nova a partir da vigente, com o aviso ANTES do botão de que as cidades adotam", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    const notice = within(form()).getByText(/só vale para a cidade que a adotar/);
    const button = within(form()).getByRole("button", { name: "publicar versão" });
    expect(notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((within(form()).getByLabelText("Nome da linha") as HTMLInputElement).value).toBe("Pessoa com diabetes");
    await user.clear(within(practice(1)).getByLabelText("Pontos"));
    await user.type(within(practice(1)).getByLabelText("Pontos"), "85");
    await user.clear(within(practice(2)).getByLabelText("Pontos"));
    await user.type(within(practice(2)).getByLabelText("Pontos"), "15");
    expect(within(form()).getByText("Soma dos pontos: 100")).not.toBeNull();
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    const vars = bodyOf(upserts()[0]).variables;
    expect([ vars.key, vars.name, vars.indicator, vars.declaredCondition ]).toEqual([ "diabetes_c4", "Pessoa com diabetes", "C4", "diabetes" ]);
    expect("version" in vars).toBe(false);
    expect((vars.practices as SentPractice[]).map((p) => [ p.key, p.points ])).toEqual([ [ "c4_a", 85 ], [ "c4_e", 15 ] ]);
    expect(await screen.findByText("Versão nova publicada. As cidades adotam quando quiserem.")).not.toBeNull();
    await waitFor(() => expect(lists().length).toBe(2));
  });

  it("o indicador é só leitura (derivado da chave) e a condição declarada só oferece as da elegibilidade", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    const indicator = within(form()).getByLabelText("Indicador") as HTMLInputElement;
    expect(indicator.value).toBe("C4");
    expect(indicator.readOnly).toBe(true);
    expect(indicator.disabled).toBe(true);
    const condition = within(form()).getByLabelText("Condição declarada que sugere a linha") as HTMLSelectElement;
    expect(condition.value).toBe("diabetes");
    expect(Array.from(condition.options).map((o) => o.value)).toEqual([ "", "diabetes" ]);
    expect(within(form()).getByText(/uma das condições de entrada \(eligibility\.declared\)/)).not.toBeNull();
  });

  it("exame pede o SIGTAP e manda exam:<código>; CBO só na consulta; avançados voltam iguais", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    expect(within(practice(1)).getByLabelText("CBO que conta (prefixos)")).not.toBeNull();
    expect(within(practice(2)).queryByLabelText("CBO que conta (prefixos)")).toBeNull();
    await user.click(within(form()).getByRole("button", { name: "incluir boa prática" }));
    const third = practice(3);
    await user.type(within(third).getByLabelText("Chave"), "c4_g");
    await user.type(within(third).getByLabelText("O que conta"), "Creatinina em 12 meses");
    await user.selectOptions(within(third).getByLabelText("Fonte"), "exam");
    await user.type(within(third).getByLabelText("Código"), "0202010317");
    await user.type(within(third).getByLabelText("Pontos"), "0");
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect((bodyOf(upserts()[0]).variables.practices as SentPractice[])[2].source).toBe("exam:0202010317");
    await user.click(within(screen.getByRole("row", { name: /C4 — Pessoa com diabetes/ })).getByRole("button", { name: "versões" }));
    await user.click(screen.getByRole("button", { name: "nova versão" }));
    await user.selectOptions(within(practice(2)).getByLabelText("Fonte"), "acs_visit");
    expect(within(practice(2)).queryByLabelText("Código")).toBeNull();
    // Trocar a fonte da consulta limpa o CBO: nada vai no envio.
    await user.selectOptions(within(practice(1)).getByLabelText("Fonte"), "weight_height");
    expect(within(practice(1)).queryByLabelText("CBO que conta (prefixos)")).toBeNull();
    await user.selectOptions(within(practice(1)).getByLabelText("Fonte"), "consultation");
    expect((within(practice(1)).getByLabelText("CBO que conta (prefixos)") as HTMLInputElement).value).toBe("");
    await user.click(within(form()).getByRole("button", { name: "fechar" }));

    await user.click(within(screen.getByRole("row", { name: /C3 — Gestante e puérpera/ })).getByRole("button", { name: "versões" }));
    await user.click(screen.getByRole("button", { name: "nova versão" }));
    expect(within(practice(1)).getByText(/regras avançadas \(preservadas\): todas de/)).not.toBeNull();
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(2));
    const c3 = bodyOf(upserts()[1]).variables;
    expect((c3.practices as SentPractice[])[0].all_of).toEqual(C3_V1.practices[0].all_of);
    expect(c3.eligibility).toEqual(C3_V1.eligibility);
  });

  it("pontos com vírgula ou ponto são recusados e ficam no campo; nada é enviado", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    for (const bad of [ "84,5", "84.5" ]) {
      await user.clear(within(practice(1)).getByLabelText("Pontos"));
      await user.type(within(practice(1)).getByLabelText("Pontos"), bad);
      await publish(user);
      expect((await screen.findByRole("alert")).textContent).toBe("boa prática 1: pontos: número inteiro de 0 a 100");
      expect((within(practice(1)).getByLabelText("Pontos") as HTMLInputElement).value).toBe(bad);
    }
    expect(upserts()).toHaveLength(0);
  });

  it("soma diferente de 100 é recusada antes de enviar", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    await user.clear(within(practice(1)).getByLabelText("Pontos"));
    await user.type(within(practice(1)).getByLabelText("Pontos"), "80");
    expect(within(form()).getByText("Soma dos pontos: 95 (precisa ser 100)")).not.toBeNull();
    await publish(user);
    expect((await screen.findByRole("alert")).textContent).toBe("a soma dos pontos precisa ser 100 (está em 95)");
    expect(upserts()).toHaveLength(0);
  });

  it("primeira versão de uma chave sem versão usa o nome e o indicador do contrato", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C2 — Cuidado da criança até 2 anos/ })).findByRole("button", { name: "primeira versão" }));
    expect(within(form()).getByText("Primeira versão de C2 — Cuidado da criança até 2 anos")).not.toBeNull();
    expect((within(form()).getByLabelText("Nome da linha") as HTMLInputElement).value).toBe("Cuidado da criança até 2 anos");
    expect((within(form()).getByLabelText("Indicador") as HTMLInputElement).value).toBe("C2");
    expect(within(form()).getAllByRole("group").filter((g) => /Boa prática/.test(g.getAttribute("aria-label") ?? ""))).toHaveLength(1);
    expect(within(form()).getByText(/só vale para a cidade que a adotar/)).not.toBeNull();
  });

  it("primeira versão publicada: manda a chave e o indicador do contrato, sem versão", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C2 — Cuidado da criança até 2 anos/ })).findByRole("button", { name: "primeira versão" }));
    await user.type(within(form()).getByLabelText("Idade máxima (dias de vida)"), "730");
    const first = practice(1);
    await user.type(within(first).getByLabelText("Chave"), "c2_a");
    await user.type(within(first).getByLabelText("O que conta"), "Consulta no primeiro mês");
    await user.clear(within(first).getByLabelText("Fim da janela (dias)"));
    await user.type(within(first).getByLabelText("Fim da janela (dias)"), "30");
    await user.type(within(first).getByLabelText("Pontos"), "100");
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    const vars = bodyOf(upserts()[0]).variables;
    expect([ vars.key, vars.indicator, vars.declaredCondition ]).toEqual([ "child_c2", "C2", null ]);
    expect(vars.eligibility).toEqual({ age_max_days: 730 });
    expect("version" in vars).toBe(false);
  });

  it("recusa do api vira frase com a boa prática; código novo cru; o formulário fica", async () => {
    const user = userEvent.setup();
    upsertReply = () => reply(200, { data: { upsertCareLineTemplate: { ok: false, errors: [
      { path: "practices[1].source", message: "invalid_practices" }, { path: null, message: "brand_new" } ] } } });
    await openNewVersion(user);
    await publish(user);
    expect((await screen.findByRole("alert")).textContent).toBe("boas práticas inválidas — confira a boa prática 2 (source); brand_new");
    expect(form()).not.toBeNull();
    expect(lists()).toHaveLength(1);
  });

  it("C2 (só idade, sem problemas) abre e publica sem quebrar", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Body;
      if (body.query.includes("mutation UpsertCareLineTemplate")) return Promise.resolve(upsertReply());
      return Promise.resolve(reply(200, { data: { careLineTemplates: [ C2_V1 ] } }));
    });
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C2 — Cuidado da criança/ })).findByRole("button", { name: "versões" }));
    await user.click(screen.getByRole("button", { name: "nova versão" }));
    expect((within(form()).getByLabelText("Idade máxima (dias de vida)") as HTMLInputElement).value).toBe("730");
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect(bodyOf(upserts()[0]).variables.eligibility).toEqual({ age_max_days: 730 });
  });

  it("visita do ACS: o envio sai sem código (source: acs_visit), mesmo se a prática tinha um exame", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    await user.selectOptions(within(practice(2)).getByLabelText("Fonte"), "acs_visit");
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    expect((bodyOf(upserts()[0]).variables.practices as SentPractice[])[1].source).toBe("acs_visit");
  });

  it("C3 completo (início de janela, filtro por código, all_of e applies_to) faz a ida e volta pelo formulário sem perder nada", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Body;
      if (body.query.includes("mutation UpsertCareLineTemplate")) return Promise.resolve(upsertReply());
      return Promise.resolve(reply(200, { data: { careLineTemplates: [ C3_FULL_V1 ] } }));
    });
    renderScreen();
    await user.click(await within(await screen.findByRole("row", { name: /C3 — Gestante e puérpera/ })).findByRole("button", { name: "versões" }));
    await user.click(screen.getByRole("button", { name: "nova versão" }));
    await publish(user);
    await waitFor(() => expect(upserts()).toHaveLength(1));
    const vars = bodyOf(upserts()[0]).variables;
    expect(vars.eligibility).toEqual(C3_FULL_ELIGIBILITY);
    expect(vars.practices).toEqual(C3_FULL_PRACTICES);
    expect([ vars.key, vars.name, vars.indicator, vars.declaredCondition ]).toEqual([ "pregnancy_c3", "Gestante e puérpera", "C3", "pregnancy" ]);
  });

  it("resposta sem o payload: frase fixa, sem o código cru do api; o aviso fica no formulário, acima dos botões", async () => {
    const user = userEvent.setup();
    upsertReply = () => reply(200, { data: { upsertCareLineTemplate: null },
      errors: [ { message: "Internal error", path: [ "upsertCareLineTemplate" ], extensions: { code: "internal_server_error" } } ] });
    await openNewVersion(user);
    await publish(user);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("o api recusou o pedido — confira os campos e tente de novo");
    expect(form().contains(alert)).toBe(true);
    const publishButton = within(form()).getByRole("button", { name: "publicar versão" });
    expect(alert.compareDocumentPosition(publishButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("recusa antes de enviar também aparece no formulário, acima dos botões", async () => {
    const user = userEvent.setup();
    await openNewVersion(user);
    await user.clear(within(practice(1)).getByLabelText("Pontos"));
    await user.type(within(practice(1)).getByLabelText("Pontos"), "80");
    await publish(user);
    const alert = await screen.findByRole("alert");
    expect(form().contains(alert)).toBe(true);
    expect(alert.compareDocumentPosition(within(form()).getByRole("button", { name: "publicar versão" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
