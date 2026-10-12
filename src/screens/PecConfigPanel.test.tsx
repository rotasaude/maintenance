import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { PecConfigPanel } from "./PecConfigPanel";
import { PEC_KEY_ROTATE_WARNING } from "../lib/pec";
import { STEP_UP_CODE_HELP_TEXT, STEP_UP_CODE_LOCK_WARNING } from "../components/StepUpCode";

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

const KEY = "9f2c4e7a1b3d5f60a8c2e4f6b1d3a5c7";
const CODE = "123456";
const CONFIGURED = { pecOrigin: "https://pec.curitiba.pr.gov.br", hmacKeyConfigured: true, hmacKeyUpdatedAt: "2026-10-11T12:00:00Z" };
const EMPTY = { pecOrigin: null, hmacKeyConfigured: false, hmacKeyUpdatedAt: null };
type Config = { pecOrigin: string | null; hmacKeyConfigured: boolean; hmacKeyUpdatedAt: string | null };

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, ...render(<PecConfigPanel slug="curitiba" />, { wrapper }) };
}

async function fillKeyAndCode(user: ReturnType<typeof userEvent.setup>, key = KEY, code = CODE) {
  await user.type(screen.getByLabelText("Chave de assinatura do PEC"), key);
  await user.type(screen.getByLabelText("Código do autenticador"), code);
}

describe("PecConfigPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let config: Config;

  beforeEach(() => {
    config = CONFIGURED;
    fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityPecOrigin")) {
        config = { ...config, pecOrigin: body.variables.pecOrigin as string | null };
        return Promise.resolve(reply(200, { data: { setCityPecOrigin: { ok: true, errors: [] } } }));
      }
      if (body.query.includes("mutation RotateCityPecHmacKey")) {
        config = { ...config, hmacKeyConfigured: true, hmacKeyUpdatedAt: "2026-10-11T13:00:00Z" };
        return Promise.resolve(reply(200, { data: { rotateCityPecHmacKey: { ok: true, errors: [] } } }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: config } }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("mostra a origem e o estado da chave, sem null", async () => {
    renderPanel();
    const group = await screen.findByRole("group", { name: "configuração do PEC" });
    expect(within(group).getByText("https://pec.curitiba.pr.gov.br")).not.toBeNull();
    expect(within(group).getByText("chave configurada")).not.toBeNull();
    expect(within(group).getByText("trocada em 11/10/2026, 09:00")).not.toBeNull();
    expect(screen.getByRole("button", { name: "trocar a chave" })).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
    expect(bodyOf(fetchMock.mock.calls[0]).variables).toEqual({ slug: "curitiba" });
  });

  it("a consulta nunca pede a chave", async () => {
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    const query = bodyOf(calls(fetchMock, "query CityPecConfig")[0]).query;
    expect(query).toMatch(/hmacKeyConfigured/);
    expect(query.replace(/hmacKeyConfigured|hmacKeyUpdatedAt/g, "")).not.toMatch(/hmacKey|secret|\bkey\b/i);
  });

  it("nada gravado: diz que o PEC não abre e oferece 'gravar a chave'", async () => {
    config = EMPTY;
    renderPanel();
    const group = await screen.findByRole("group", { name: "configuração do PEC" });
    expect(within(group).getByText("não preenchido")).not.toBeNull();
    expect(within(group).getByText("chave não gravada — o PEC não consegue abrir a página")).not.toBeNull();
    expect(within(group).getByText("nunca gravada")).not.toBeNull();
    expect(screen.getByRole("button", { name: "gravar a chave" })).not.toBeNull();
  });

  it("endereço com caminho é recusado na tela; com barra final vai normalizado", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    const field = screen.getByLabelText("Endereço de origem do PEC") as HTMLInputElement;
    expect(field.value).toBe("https://pec.curitiba.pr.gov.br");

    await user.clear(field);
    await user.type(field, "https://pec.curitiba.pr.gov.br/esus");
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/sem caminho/);
    expect(calls(fetchMock, "mutation SetCityPecOrigin")).toHaveLength(0);

    await user.clear(field);
    await user.type(field, "  https://pec2.curitiba.pr.gov.br/  ");
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityPecOrigin")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityPecOrigin")[0]).variables)
      .toEqual({ citySlug: "curitiba", pecOrigin: "https://pec2.curitiba.pr.gov.br" });
    expect((await screen.findByRole("status")).textContent).toBe("Endereço de origem do PEC salvo.");
    const group = await screen.findByRole("group", { name: "configuração do PEC" });
    await within(group).findByText("https://pec2.curitiba.pr.gov.br");
  });

  it("campo vazio apaga a origem: o argumento vai como null, nunca omitido", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await user.clear(screen.getByLabelText("Endereço de origem do PEC"));
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityPecOrigin")).toHaveLength(1));
    const variables = bodyOf(calls(fetchMock, "mutation SetCityPecOrigin")[0]).variables;
    expect(variables).toEqual({ citySlug: "curitiba", pecOrigin: null });
    expect(Object.keys(variables)).toContain("pecOrigin");
    expect((await screen.findByRole("status")).textContent).toBe("Endereço de origem do PEC apagado.");
    const group = await screen.findByRole("group", { name: "configuração do PEC" });
    await within(group).findByText("não preenchido");
  });

  it("recusa do api ao salvar o endereço aparece traduzida", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityPecOrigin")) {
        return Promise.resolve(reply(200, { data: { setCityPecOrigin: { ok: false, errors: [ { path: "pecOrigin", message: "invalid_origin" } ] } } }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: CONFIGURED } }));
    });
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    expect((await screen.findByRole("alert")).textContent)
      .toBe("o api recusou o endereço — use só a origem do PEC, como https://pec.cidade.gov.br");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("cidade inexistente na escrita: a frase do api, crua", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityPecOrigin")) {
        return Promise.resolve(reply(200, { data: { setCityPecOrigin: { ok: false, errors: [ { path: "citySlug", message: "cidade inexistente" } ] } } }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: CONFIGURED } }));
    });
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    expect((await screen.findByRole("alert")).textContent).toBe("cidade inexistente");
  });

  it("cidade inalcançável na escrita: o código do envelope", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityPecOrigin")) {
        return Promise.resolve(reply(200, {
          data: { setCityPecOrigin: null },
          errors: [ { message: "city database unreachable", path: [ "setCityPecOrigin" ], extensions: { code: "CITY_UNREACHABLE" } } ]
        }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: CONFIGURED } }));
    });
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await user.click(screen.getByRole("button", { name: "salvar endereço" }));
    expect((await screen.findByRole("alert")).textContent).toBe("CITY_UNREACHABLE — city database unreachable");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("chave curta: botão desligado e o motivo", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    expect((screen.getByRole("button", { name: "trocar a chave" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Código do autenticador"), CODE);
    await user.type(screen.getByLabelText("Chave de assinatura do PEC"), "curta");
    expect(screen.getByText("a chave tem de ter ao menos 16 caracteres")).not.toBeNull();
    expect((screen.getByRole("button", { name: "trocar a chave" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem código de 6 dígitos o botão fica desligado; o campo traz o aviso do step-up", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    const code = screen.getByLabelText("Código do autenticador") as HTMLInputElement;
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(screen.getByText(STEP_UP_CODE_HELP_TEXT)).not.toBeNull();

    await user.type(screen.getByLabelText("Chave de assinatura do PEC"), KEY);
    const button = () => screen.getByRole("button", { name: "trocar a chave" }) as HTMLButtonElement;
    expect(button().disabled).toBe(true);
    await user.type(code, "12345");
    expect(button().disabled).toBe(true);
    await user.type(code, "x");
    expect(button().disabled).toBe(true);
    await user.clear(code);
    await user.type(code, CODE);
    expect(button().disabled).toBe(false);
  });

  it("um clique não troca; o aviso fala do PEC", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    expect(screen.getByRole("note", { name: "aviso da troca da chave" }).textContent).toBe(PEC_KEY_ROTATE_WARNING);
    await fillKeyAndCode(user);
    await user.click(screen.getByRole("button", { name: "trocar a chave" }));
    expect(calls(fetchMock, "mutation RotateCityPecHmacKey")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "confirmar: trocar a chave HMAC" })).not.toBeNull();
  });

  it("gravar a chave: dois cliques, key e code só na mutation, campos vazios e nada no cache", async () => {
    const user = userEvent.setup();
    const { client } = renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    const field = screen.getByLabelText("Chave de assinatura do PEC") as HTMLInputElement;
    expect(field.type).toBe("password");
    expect(field.getAttribute("autocomplete")).toBe("off");

    await fillKeyAndCode(user, `  ${KEY}  `);
    await user.click(screen.getByRole("button", { name: "trocar a chave" }));
    await user.click(screen.getByRole("button", { name: "confirmar: trocar a chave HMAC" }));

    await waitFor(() => expect(calls(fetchMock, "mutation RotateCityPecHmacKey")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation RotateCityPecHmacKey")[0]).variables)
      .toEqual({ citySlug: "curitiba", key: KEY, code: CODE });
    expect((await screen.findByRole("status")).textContent)
      .toBe("Chave gravada. Configure a mesma chave no PEC da cidade, se ainda não estiver lá.");
    expect((screen.getByLabelText("Chave de assinatura do PEC") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Código do autenticador") as HTMLInputElement).value).toBe("");
    await screen.findByText("trocada em 11/10/2026, 10:00");

    // A chave só viajou no corpo da mutation: nenhuma leitura, nenhum cache, nenhum texto da tela.
    for (const call of fetchMock.mock.calls) {
      const body = bodyOf(call);
      if (!body.query.includes("mutation RotateCityPecHmacKey")) expect(JSON.stringify(body)).not.toContain(KEY);
      expect(String(call[0])).not.toContain(KEY);
    }
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    expect(JSON.stringify(client.getQueryCache().getAll().map((q) => q.state.data))).not.toContain(KEY);
    expect(document.body.innerHTML).not.toContain(KEY);
  });

  it("código errado: não diz 'gravada', mostra o aviso de bloqueio, esvazia o código e mantém a chave", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation RotateCityPecHmacKey")) {
        return Promise.resolve(reply(200, { data: { rotateCityPecHmacKey: { ok: false, errors: [ { path: "code", message: "código inválido" } ] } } }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: CONFIGURED } }));
    });
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await fillKeyAndCode(user);
    await user.click(screen.getByRole("button", { name: "trocar a chave" }));
    await user.click(screen.getByRole("button", { name: "confirmar: trocar a chave HMAC" }));

    expect((await screen.findByRole("alert")).textContent).toBe("código inválido");
    expect(screen.getByText(STEP_UP_CODE_LOCK_WARNING)).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.body.textContent).not.toMatch(/gravada/);
    expect((screen.getByLabelText("Código do autenticador") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Chave de assinatura do PEC") as HTMLInputElement).value).toBe(KEY);
  });

  it("recusa do api ao gravar a chave: diz o motivo, mantém a chave e esvazia o código", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation RotateCityPecHmacKey")) {
        return Promise.resolve(reply(200, { data: { rotateCityPecHmacKey: { ok: false, errors: [ { path: "key", message: "invalid_key" } ] } } }));
      }
      return Promise.resolve(reply(200, { data: { cityPecConfig: CONFIGURED } }));
    });
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await fillKeyAndCode(user);
    await user.click(screen.getByRole("button", { name: "trocar a chave" }));
    await user.click(screen.getByRole("button", { name: "confirmar: trocar a chave HMAC" }));
    expect((await screen.findByRole("alert")).textContent).toBe("o api recusou a chave — confira o que foi colado");
    expect((screen.getByLabelText("Chave de assinatura do PEC") as HTMLInputElement).value).toBe(KEY);
    expect((screen.getByLabelText("Código do autenticador") as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("api sem o módulo 20: explica a ordem de deploy", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      errors: [ { message: "Field 'cityPecConfig' doesn't exist on type 'Query'",
        extensions: { code: "undefinedField", typeName: "Query", fieldName: "cityPecConfig" } } ]
    })));
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 20 precisa subir antes do maintenance/);
    expect(screen.queryByLabelText("Chave de assinatura do PEC")).toBeNull();
  });

  it("cidade inalcançável: o código no quadro", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      data: { cityPecConfig: null },
      errors: [ { message: "city database unreachable", path: [ "cityPecConfig" ], extensions: { code: "CITY_UNREACHABLE" } } ]
    })));
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toBe("CITY_UNREACHABLE — city database unreachable");
    expect(document.body.textContent).not.toMatch(/undefined|null/);
    expect(screen.queryByText("cidade não encontrada")).toBeNull();
  });

  it("cidade inexistente na leitura (null sem erro): diz que não achou", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, { data: { cityPecConfig: null } })));
    renderPanel();
    expect(await screen.findByText("cidade não encontrada")).not.toBeNull();
    expect(screen.queryByLabelText("Chave de assinatura do PEC")).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("atualizar relê", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole("group", { name: "configuração do PEC" });
    await user.click(screen.getByRole("button", { name: "atualizar" }));
    await waitFor(() => expect(calls(fetchMock, "query CityPecConfig")).toHaveLength(2));
  });
});
