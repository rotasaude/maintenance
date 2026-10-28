// src/screens/NotifiableDiseaseListForm.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { V2, V3, renderScreen, reply } from "./NotifiableDiseases.fixtures";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
type Body = { query: string; variables: Record<string, unknown> };
const bodyOf = (call: unknown[]): Body => JSON.parse((call[1] as RequestInit).body as string);

describe("NotifiableDiseaseListForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let publishReply: unknown;
  let listReply: unknown[];
  let publishFails: boolean;
  beforeEach(() => {
    publishReply = { data: { publishNotifiableDiseaseList: { ok: true, version: 3, errors: [] } } };
    listReply = [ V2 ];
    publishFails = false;
    fetchMock = vi.fn((_: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Body;
      if (body.query.includes("mutation PublishNotifiableDiseaseList")) {
        return publishFails ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(reply(200, publishReply));
      }
      return Promise.resolve(reply(200, { data: { notifiableDiseases: listReply } }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  const publishes = () => fetchMock.mock.calls.filter((c) => bodyOf(c).query.includes("mutation PublishNotifiableDiseaseList"));
  const lists = () => fetchMock.mock.calls.filter((c) => bodyOf(c).query.includes("query NotifiableDiseases"));

  // A tabela da vigente continua na tela durante a edição: as linhas são procuradas só no formulário (R11).
  const form = () => screen.getByRole("region", { name: "Versão nova" });
  const formRow = (name: RegExp) => within(form()).getByRole("row", { name });

  // Data longe no futuro: o teste não depende do dia em que roda.
  const setValidFrom = (value: string) => fireEvent.change(screen.getByLabelText("Início da vigência"), { target: { value } });
  async function openForm(user: ReturnType<typeof userEvent.setup>, label = "editar e publicar versão nova") {
    renderScreen();
    await user.click(await screen.findByRole("button", { name: label }));
  }

  it("publica a versão 3 a partir da vigente: muda o prazo, acrescenta uma doença, com a vigência e o TOTP", async () => {
    const user = userEvent.setup();
    await openForm(user);
    setValidFrom("2099-11-01");
    await user.click(within(formRow(/Dengue/)).getByRole("button", { name: "editar" }));
    await user.selectOptions(screen.getByLabelText("Prazo"), "immediate");
    await user.click(screen.getByRole("button", { name: "aplicar" }));
    await user.click(screen.getByRole("button", { name: "acrescentar doença" }));
    await user.type(screen.getByLabelText("Código da doença"), "mpox");
    await user.type(screen.getByLabelText("Nome"), "Mpox");
    await user.type(screen.getByLabelText("CID-10"), "B04");
    await user.type(screen.getByLabelText("Fonte do prazo"), "Portaria GM/MS 11.211/2026, anexo 1");
    await user.type(screen.getByLabelText("Fonte dos códigos"), "ficha de notificação de mpox");
    await user.click(screen.getByRole("button", { name: "aplicar" }));
    expect(screen.getByText("1 nova, 0 retiradas, 1 alterada")).not.toBeNull();
    expect(screen.getByText(/Vale para todas as cidades a partir da vigência/)).not.toBeNull();
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    await waitFor(() => expect(publishes()).toHaveLength(1));
    const v = bodyOf(publishes()[0]).variables;
    expect(v).toMatchObject({ code: "123456", expectedVersion: 2, effectiveFrom: "2099-11-01", ordinance: "Portaria GM/MS nº 11.211/2026", notes: null });
    expect((v.diseases as { code: string; deadline: string }[]).map((d) => [ d.code, d.deadline ]))
      .toEqual([ [ "dengue", "immediate" ], [ "sarampo", "immediate" ], [ "mpox", "weekly" ] ]);
    // A fonte que a tela não edita volta como veio.
    expect((v.diseases as { sources: Record<string, string> }[])[0].sources)
      .toEqual({ deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de dengue", repeat_after_days: "proposta do plano 25" });
    expect(await screen.findByText("Versão 3 publicada.")).not.toBeNull();
    await waitFor(() => expect(lists().length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByRole("region", { name: "Versão nova" })).toBeNull();
  });

  it("CID inválido é recusado e fica no campo; nada é enviado", async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(within(formRow(/Sarampo/)).getByRole("button", { name: "editar" }));
    await user.clear(screen.getByLabelText("CID-10"));
    await user.type(screen.getByLabelText("CID-10"), "B0");
    await user.click(screen.getByRole("button", { name: "aplicar" }));
    expect(screen.getByText("CID-10 inválido: B0")).not.toBeNull();
    expect((screen.getByLabelText("CID-10") as HTMLInputElement).value).toBe("B0");
    expect(publishes()).toHaveLength(0);
  });

  it("vigência antes de hoje é recusada antes de enviar", async () => {
    const user = userEvent.setup();
    await openForm(user);
    setValidFrom("2020-01-01");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    expect(screen.getByText("a vigência não pode começar antes de hoje")).not.toBeNull();
    expect(publishes()).toHaveLength(0);
  });

  it("TOTP recusado: no campo, com o aviso de bloqueio; o rascunho fica", async () => {
    const user = userEvent.setup();
    publishReply = { data: { publishNotifiableDiseaseList: { ok: false, version: null, errors: [ { path: "code", message: "código inválido" } ] } } };
    await openForm(user);
    setValidFrom("2099-11-01");
    expect(screen.getByText("Se acabou de entrar, espere o próximo código.")).not.toBeNull();
    await user.type(screen.getByLabelText("Código"), "000000");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    expect(await screen.findByText("código inválido")).not.toBeNull();
    expect(screen.getByText("Tentativas erradas contam para o bloqueio da conta.")).not.toBeNull();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Início da vigência") as HTMLInputElement).value).toBe("2099-11-01");
  });

  it("versão de partida desatualizada: frase, o rascunho fica", async () => {
    const user = userEvent.setup();
    publishReply = { data: { publishNotifiableDiseaseList: { ok: false, version: null, errors: [ { path: "expectedVersion", message: "stale" } ] } } };
    await openForm(user);
    setValidFrom("2099-11-01");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    expect(await screen.findByText("outra pessoa publicou uma versão enquanto você editava — recarregue")).not.toBeNull();
    expect(screen.getByRole("button", { name: "publicar versão 3" })).not.toBeNull();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Início da vigência") as HTMLInputElement).value).toBe("2099-11-01");
    expect(publishes()).toHaveLength(1);
  });

  it("outra recusa: a frase pelo caminho, com a doença; o rascunho e o formulário ficam", async () => {
    const user = userEvent.setup();
    publishReply = { data: { publishNotifiableDiseaseList: { ok: false, version: null, errors: [ { path: "diseases.1.cid10.0", message: "invalid_list" } ] } } };
    await openForm(user);
    setValidFrom("2099-11-01");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    expect(await screen.findByText("doença 2 (sarampo): CID-10 nº 1 recusado")).not.toBeNull();
    expect(screen.queryByText(/invalid_list/)).toBeNull();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("");
    expect(form()).not.toBeNull();
  });

  it("rede caída: o código é limpo, o formulário fica e a lista é relida (o api pode ter gravado)", async () => {
    const user = userEvent.setup();
    publishFails = true;
    await openForm(user);
    setValidFrom("2099-11-01");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    await waitFor(() => expect(publishes()).toHaveLength(1));
    expect(await within(form()).findByRole("alert")).not.toBeNull();
    expect((screen.getByLabelText("Código") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Início da vigência") as HTMLInputElement).value).toBe("2099-11-01");
    await waitFor(() => expect(lists().length).toBeGreaterThanOrEqual(2));
    expect(publishes()).toHaveLength(1);
  });

  it("parte da mais recente: com uma agendada (v3), o rascunho é dela e publica a 4 com expectedVersion 3", async () => {
    const user = userEvent.setup();
    listReply = [ V3, V2 ];
    publishReply = { data: { publishNotifiableDiseaseList: { ok: true, version: 4, errors: [] } } };
    await openForm(user);
    expect(screen.getByText("nenhuma mudança nas doenças")).not.toBeNull();
    setValidFrom("2099-11-01");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 4" }));
    await waitFor(() => expect(publishes()).toHaveLength(1));
    expect(bodyOf(publishes()[0]).variables).toMatchObject({ expectedVersion: 3 });
    expect(await screen.findByText("Versão 4 publicada.")).not.toBeNull();
  });

  it("vigência antes da agendada é recusada antes de enviar", async () => {
    const user = userEvent.setup();
    listReply = [ V3, V2 ];
    await openForm(user);
    setValidFrom("2026-11-30");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 4" }));
    // 30/11/2026 pode já ter passado no dia em que o teste roda: qualquer das duas recusas de vigência serve, e nada sai.
    expect(screen.getByText(/a vigência não pode começar antes (da última versão publicada \(01\/12\/2026\)|de hoje)/)).not.toBeNull();
    expect(publishes()).toHaveLength(0);
  });

  it("retirar pede confirmação na linha; a nota da versão vai junto", async () => {
    const user = userEvent.setup();
    await openForm(user);
    setValidFrom("2099-11-01");
    await user.click(within(formRow(/Sarampo/)).getByRole("button", { name: "retirar" }));
    expect(within(formRow(/Sarampo/)).getByText("retirar Sarampo da versão nova?")).not.toBeNull();
    await user.click(within(formRow(/Sarampo/)).getByRole("button", { name: "manter" }));
    expect(screen.getByText("nenhuma mudança nas doenças")).not.toBeNull();
    await user.click(within(formRow(/Sarampo/)).getByRole("button", { name: "retirar" }));
    await user.click(within(formRow(/Sarampo/)).getByRole("button", { name: "sim, retirar" }));
    expect(within(form()).queryByRole("row", { name: /Sarampo/ })).toBeNull();
    expect(screen.getByText("0 novas, 1 retirada, 0 alteradas")).not.toBeNull();
    await user.type(screen.getByLabelText("Nota da versão"), "retira sarampo");
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 3" }));
    await waitFor(() => expect(publishes()).toHaveLength(1));
    const v = bodyOf(publishes()[0]).variables;
    expect(v.notes).toBe("retira sarampo");
    expect((v.diseases as { code: string }[]).map((d) => d.code)).toEqual([ "dengue" ]);
  });

  it("sem nenhuma versão: primeira versão parte do vazio, publica a 1 com expectedVersion 0", async () => {
    const user = userEvent.setup();
    listReply = [];
    publishReply = { data: { publishNotifiableDiseaseList: { ok: true, version: 1, errors: [] } } };
    await openForm(user, "primeira versão");
    expect((screen.getByLabelText("Portaria") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Portaria"), { target: { value: "Portaria GM/MS nº 11.211/2026" } });
    setValidFrom("2099-11-01");
    await user.click(screen.getByRole("button", { name: "acrescentar doença" }));
    await user.type(screen.getByLabelText("Código da doença"), "dengue");
    await user.type(screen.getByLabelText("Nome"), "Dengue");
    await user.type(screen.getByLabelText("CID-10"), "A90");
    await user.type(screen.getByLabelText("Fonte do prazo"), "anexo 1");
    await user.type(screen.getByLabelText("Fonte dos códigos"), "ficha de dengue");
    await user.click(screen.getByRole("button", { name: "aplicar" }));
    await user.type(screen.getByLabelText("Código"), "123456");
    await user.click(screen.getByRole("button", { name: "publicar versão 1" }));
    await waitFor(() => expect(publishes()).toHaveLength(1));
    expect(bodyOf(publishes()[0]).variables).toMatchObject({ expectedVersion: 0, ordinance: "Portaria GM/MS nº 11.211/2026" });
    expect(await screen.findByText("Versão 1 publicada.")).not.toBeNull();
  });
});
