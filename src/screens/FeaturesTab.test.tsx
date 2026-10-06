import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeaturesTab } from "./FeaturesTab";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}
function calls(fetchMock: ReturnType<typeof vi.fn>, operation: string) {
  return fetchMock.mock.calls.filter((call) => bodyOf(call).query.includes(operation));
}

type Feature = {
  key: string; description: string; enabled: boolean; usable: boolean; missing: string[];
  changedAt: string | null; changedBy: string | null;
};
const LEDI_OFF: Feature = {
  key: "ledi_export", description: "Exportação LEDI para o PEC da cidade", enabled: false, usable: false,
  missing: [ "pec_url_missing", "credential_missing:ledi" ], changedAt: null, changedBy: null
};
const CADSUS_ON: Feature = {
  key: "cadsus_lookup", description: "Consulta ao CADSUS na validação presencial", enabled: true, usable: true,
  missing: [], changedAt: "2026-10-05T13:00:00Z", changedBy: "dev@local"
};

function featuresReply(features: Feature[], extra: Record<string, unknown> = {}) {
  return reply(200, {
    data: { city: { slug: "sp", recordMode: "integrated", profile: { ibgeCode: "3550308" }, features, ...extra } }
  });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<FeaturesTab slug="sp" />, { wrapper });
}

describe("FeaturesTab", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lista chave, descrição, estado, o que falta e quem mudou; modo e IBGE só leitura", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LEDI_OFF, CADSUS_ON ])));
    renderTab();

    expect(await screen.findByText("ledi_export")).not.toBeNull();
    expect(screen.getByText("Exportação LEDI para o PEC da cidade")).not.toBeNull();
    expect(screen.getByText("desligada")).not.toBeNull();
    expect(screen.getByText("endereço do PEC não preenchido; credencial LEDI não cadastrada")).not.toBeNull();
    expect(screen.getByText("nunca alterada")).not.toBeNull();

    expect(screen.getByText("cadsus_lookup")).not.toBeNull();
    expect(screen.getByText("ligada e utilizável")).not.toBeNull();
    expect(screen.getByText("nada")).not.toBeNull();
    expect(screen.getByText(/05\/10\/2026, 10:00 — dev@local/)).not.toBeNull();

    expect(screen.getByText("integrado ao PEC da cidade (integrated)")).not.toBeNull();
    expect(screen.getByText("3550308")).not.toBeNull();
    // Modo e IBGE não têm controle de edição aqui.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("cidade sem IBGE e em modo off: diz o que falta, sem 'null'", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(
      featuresReply([ LEDI_OFF ], { recordMode: "off", profile: { ibgeCode: null } })
    ));
    renderTab();

    expect(await screen.findByText("desligado (off)")).not.toBeNull();
    expect(screen.getByText("não preenchido")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("um clique só não muda nada; o segundo liga, e a tela diz o que o api devolveu", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = {
      ...LEDI_OFF, enabled: true, changedAt: "2026-10-05T18:00:00Z", changedBy: "dev@local"
    };
    let listed = [ LEDI_OFF, CADSUS_ON ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn, CADSUS_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();
    await screen.findByText("ledi_export");

    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "confirmar: ligar ledi_export" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "ledi_export", enabled: true });

    // Ligar sem os pré-requisitos é permitido; a tela não esconde o que falta.
    expect((await screen.findByRole("status")).textContent).toBe(
      "ledi_export ligada, mas ainda não utilizável — falta: endereço do PEC não preenchido; credencial LEDI não cadastrada."
    );
    // A lista foi relida: o estado novo aparece na tabela.
    expect(await screen.findByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(calls(fetchMock, "query CityFeatures")).toHaveLength(2);
  });

  it("desligar manda enabled=false", async () => {
    const user = userEvent.setup();
    const turnedOff: Feature = { ...CADSUS_ON, enabled: false, usable: false };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOff } } }));
      }
      return Promise.resolve(featuresReply([ CADSUS_ON ]));
    });
    renderTab();
    await screen.findByText("cadsus_lookup");

    await user.click(screen.getByRole("button", { name: "desligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: desligar cadsus_lookup" }));

    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables.enabled).toBe(false);
    expect((await screen.findByRole("status")).textContent).toBe("cadsus_lookup desligada.");
  });

  it("erro de regra (unknown_feature) aparece traduzido e não relê a lista", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, {
          data: { setCityFeature: { ok: false, errors: [ { path: "key", message: "unknown_feature" } ], feature: null } }
        }));
      }
      return Promise.resolve(featuresReply([ LEDI_OFF ]));
    });
    renderTab();
    await screen.findByText("ledi_export");

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar ledi_export" }));

    expect((await screen.findByRole("alert")).textContent).toBe("funcionalidade desconhecida pelo api");
    expect(screen.queryByRole("status")).toBeNull();
    expect(calls(fetchMock, "query CityFeatures")).toHaveLength(1);
  });

  it("recusa do envelope (payload nulo) mostra código e motivo", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, {
          data: { setCityFeature: null },
          errors: [ {
            message: "cidade fora do escopo do token", path: [ "setCityFeature" ],
            extensions: { code: "CITY_OUT_OF_SCOPE" }
          } ]
        }));
      }
      return Promise.resolve(featuresReply([ LEDI_OFF ]));
    });
    renderTab();
    await screen.findByText("ledi_export");

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar ledi_export" }));

    expect((await screen.findByRole("alert")).textContent).toBe("CITY_OUT_OF_SCOPE — cidade fora do escopo do token");
  });

  it("cidade inalcançável: features degrada, o IBGE diz indisponível e o liga/desliga continua", async () => {
    const user = userEvent.setup();
    const unreachable: Feature = { ...LEDI_OFF, usable: false, missing: [ "city_unreachable" ] };
    const turnedOn: Feature = { ...unreachable, enabled: true, changedAt: "2026-10-05T18:00:00Z", changedBy: "dev@local" };
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(reply(200, {
        data: { city: { slug: "sp", recordMode: "record", profile: null, features: [ unreachable ] } },
        errors: [ {
          message: "banco da cidade inacessível", path: [ "city", "profile" ],
          extensions: { code: "CITY_UNREACHABLE" }
        } ]
      }));
    });
    renderTab();

    expect(await screen.findByText("banco da cidade inalcançável — não deu para conferir")).not.toBeNull();
    expect(screen.getByText("indisponível (CITY_UNREACHABLE)")).not.toBeNull();
    expect(screen.getByText("prontuário no Rota Saúde (record)")).not.toBeNull();
    // "não preenchido" afirmaria que a cidade não tem IBGE — e não se sabe.
    expect(screen.queryByText("não preenchido")).toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar ledi_export" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect((await screen.findByRole("status")).textContent).toBe(
      "ledi_export ligada, mas ainda não utilizável — falta: banco da cidade inalcançável — não deu para conferir."
    );
  });

  it("erro de campo em features (cidade arquivada) mostra código e mensagem, sem botões", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      data: { city: null },
      errors: [ {
        message: "cidade arquivada", path: [ "city", "features" ],
        extensions: { code: "CITY_ARCHIVED" }
      } ]
    })));
    renderTab();

    expect((await screen.findByRole("alert")).textContent).toBe("CITY_ARCHIVED — cidade arquivada");
    expect(screen.queryByRole("button", { name: "ligar" })).toBeNull();
  });

  it("api antiga sem os campos: a aba explica a ordem de deploy", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      errors: [ {
        message: "Field 'recordMode' doesn't exist on type 'City'",
        extensions: { code: "undefinedField", typeName: "City", fieldName: "recordMode" }
      } ]
    })));
    renderTab();

    expect((await screen.findByRole("alert")).textContent)
      .toMatch(/o api do módulo 16 precisa subir antes do maintenance/);
  });

  it("ato aceito sem feature devolvida: diz que foi feito e relê a lista", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: null } } }));
      }
      return Promise.resolve(featuresReply([ LEDI_OFF ]));
    });
    renderTab();
    await screen.findByText("ledi_export");

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar ledi_export" }));

    expect((await screen.findByRole("status")).textContent).toBe("feito — confira o estado na lista.");
    await waitFor(() => expect(calls(fetchMock, "query CityFeatures")).toHaveLength(2));
  });

  it("erro de campo em recordMode com city nula mostra código e mensagem", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      data: { city: null },
      errors: [ {
        message: "falha ao ler", path: [ "city", "recordMode" ],
        extensions: { code: "CITY_READ_FAILED" }
      } ]
    })));
    renderTab();

    expect((await screen.findByRole("alert")).textContent).toBe("CITY_READ_FAILED — falha ao ler");
    expect(screen.queryByRole("button", { name: "ligar" })).toBeNull();
  });
});
