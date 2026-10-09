import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeaturesTab } from "./FeaturesTab";
import { PSC_MOCK_NOTICE, PSC_REAL_NOTICE } from "../lib/signature";

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

describe("FeaturesTab — assinatura digital (módulo 19b)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const SIGNATURE_OFF: Feature = {
    key: "digital_signature", description: "Assinatura digital ICP-Brasil da consulta", enabled: false, usable: false,
    missing: [ "clinical_record_disabled" ], changedAt: null, changedBy: null
  };
  const PSC_MOCK_OFF: Feature = {
    key: "signature_psc_mock", description: "PSC simulado para desenvolvimento", enabled: false, usable: false,
    missing: [ "digital_signature_disabled" ], changedAt: null, changedBy: null
  };
  const PSC_MOCK_ON: Feature = { ...PSC_MOCK_OFF, enabled: true, changedAt: "2026-10-08T13:00:00Z", changedBy: "dev@local" };
  const platform = () => reply(200, { data: {
    signatureProviders: [ { key: "vidaas", configured: true, lastCheckAt: null, lastCheckOk: null } ],
    signerStatus: { reachable: true, version: "1.0.0", crlUpdatedAt: new Date().toISOString() }
  } });
  function withCatalog(features: Feature[]) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SignaturePlatform")) return Promise.resolve(platform());
      return Promise.resolve(featuresReply(features));
    });
  }

  it("digital_signature pelo mecanismo genérico: falta o prontuário e liga com dois cliques", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...SIGNATURE_OFF, enabled: true, changedAt: "2026-10-08T13:00:00Z", changedBy: "dev@local" };
    let listed = [ SIGNATURE_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SignaturePlatform")) return Promise.resolve(platform());
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "record" }));
    });
    renderTab();

    expect(await screen.findByText("digital_signature")).not.toBeNull();
    expect(screen.getByText("prontuário da atenção primária (clinical_record) desligado")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar digital_signature" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "digital_signature", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      "digital_signature ligada, mas ainda não utilizável — falta: prontuário da atenção primária (clinical_record) desligado."
    );
  });

  it("com digital_signature no catálogo mostra os prestadores do ambiente; sem ela, nem consulta", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SignaturePlatform")) return Promise.resolve(platform());
      return Promise.resolve(featuresReply([ SIGNATURE_OFF ]));
    });
    renderTab();
    expect(await screen.findByRole("region", { name: "Assinatura digital — prestadores e signer (todas as cidades do ambiente)" }))
      .not.toBeNull();
    expect(await screen.findByText("VIDaaS (vidaas)")).not.toBeNull();
    cleanup();

    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LEDI_OFF ])));
    renderTab();
    await screen.findByText("ledi_export");
    expect(calls(fetchMock, "query SignaturePlatform")).toHaveLength(0);
  });

  it("api sem o 19b: o quadro explica a ordem de deploy e a aba segue", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SignaturePlatform")) {
        return Promise.resolve(reply(200, { errors: [ {
          message: "Field 'signatureProviders' doesn't exist on type 'Query'",
          extensions: { code: "undefinedField", typeName: "Query", fieldName: "signatureProviders" }
        } ] }));
      }
      return Promise.resolve(featuresReply([ SIGNATURE_OFF ]));
    });
    renderTab();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 19b precisa subir antes do maintenance/);
    expect(screen.getByText("digital_signature")).not.toBeNull();
    expect(screen.getByRole("button", { name: "ligar" })).not.toBeNull();
  });

  it("signature_psc_mock tem rótulo e diz o pré-requisito", async () => {
    withCatalog([ SIGNATURE_OFF, PSC_MOCK_OFF ]);
    renderTab();
    expect(await screen.findByText("signature_psc_mock")).not.toBeNull();
    expect(screen.getByText("PSC simulado (desenvolvimento)")).not.toBeNull();
    expect(screen.getByText("assinatura digital (digital_signature) desligada")).not.toBeNull();
  });

  it("PSC simulado ligado: aviso na aba e no quadro", async () => {
    withCatalog([ SIGNATURE_OFF, PSC_MOCK_ON ]);
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do PSC" })).textContent).toBe(PSC_MOCK_NOTICE);
    expect(screen.getByRole("note", { name: "modo do PSC desta cidade" }).textContent).toBe(PSC_MOCK_NOTICE);
  });

  it("ligar signature_psc_mock por dois cliques: após o refetch a aba avisa", async () => {
    const user = userEvent.setup();
    let listed = [ SIGNATURE_OFF, PSC_MOCK_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SignaturePlatform")) return Promise.resolve(platform());
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ SIGNATURE_OFF, PSC_MOCK_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: PSC_MOCK_ON } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("signature_psc_mock")).not.toBeNull();
    expect(screen.queryByRole("note", { name: "modo do PSC" })).toBeNull();
    // Duas linhas desligadas (digital_signature, signature_psc_mock): a do PSC é a segunda.
    await user.click(screen.getAllByRole("button", { name: "ligar" })[1]);
    await user.click(await screen.findByRole("button", { name: "confirmar: ligar signature_psc_mock" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect((await screen.findByRole("note", { name: "modo do PSC" })).textContent).toBe(PSC_MOCK_NOTICE);
  });

  it("PSC simulado desligado: sem aviso na aba; o quadro diz prestadores reais", async () => {
    withCatalog([ SIGNATURE_OFF, PSC_MOCK_OFF ]);
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do PSC desta cidade" })).textContent).toBe(PSC_REAL_NOTICE);
    expect(screen.queryByRole("note", { name: "modo do PSC" })).toBeNull();
  });

  it("catálogo sem o interruptor (produção): nada quebra", async () => {
    withCatalog([ SIGNATURE_OFF ]);
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do PSC desta cidade" })).textContent).toBe(PSC_REAL_NOTICE);
    await screen.findByText("VIDaaS (vidaas)");
    expect(screen.queryByText("signature_psc_mock")).toBeNull();
    expect(screen.queryByRole("note", { name: "modo do PSC" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });
});
