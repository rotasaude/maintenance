import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeaturesTab } from "./FeaturesTab";
import { PSC_MOCK_NOTICE, PSC_REAL_NOTICE } from "../lib/signature";
import { SNCR_MOCK_NOTICE, SNCR_REAL_NOTICE } from "../lib/sncr";
import { FAKE_LAB_NOTICE } from "../lib/exams";
import { FAKE_MIDDLEWARE_NOTICE } from "../lib/lab";

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

  it("digital_signature pelo mecanismo genérico: falta o modo de prontuário e liga com dois cliques", async () => {
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

  it("clinical_documents pelo mecanismo genérico: nome em português, falta o modo de prontuário e liga com dois cliques", async () => {
    const user = userEvent.setup();
    const DOCS_OFF: Feature = {
      key: "clinical_documents", description: "Documentos clínicos da consulta", enabled: false, usable: false,
      missing: [ "clinical_record_disabled" ], changedAt: null, changedBy: null
    };
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.query.includes("mutation SetCityFeature")) {
        return Promise.resolve(reply(200, { data: { setCityFeature: {
          ok: true, errors: [],
          feature: { ...DOCS_OFF, enabled: true, changedAt: "2026-10-09T12:00:00Z", changedBy: "dev@local" }
        } } }));
      }
      return Promise.resolve(featuresReply([ DOCS_OFF ]));
    });
    renderTab();

    expect(await screen.findByText("clinical_documents")).not.toBeNull();
    expect(screen.getByText("Documentos clínicos (atestado, declaração, receita, requisição)")).not.toBeNull();
    expect(screen.getByText("prontuário da atenção primária (clinical_record) desligado")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar clinical_documents" }));

    expect(await screen.findByText(
      "clinical_documents ligada, mas ainda não utilizável — falta: prontuário da atenção primária (clinical_record) desligado."
    )).not.toBeNull();
    const sent = calls(fetchMock, "mutation SetCityFeature");
    expect(sent).toHaveLength(1);
    expect(bodyOf(sent[0]).variables).toEqual({ citySlug: "sp", key: "clinical_documents", enabled: true });
  });
});

describe("FeaturesTab — receita de controlado e SNCR (módulo 19d)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const CONTROLLED_OFF: Feature = {
    key: "controlled_prescriptions", description: "Receita de controle especial e de antimicrobiano com número SNCR",
    enabled: false, usable: false, missing: [ "clinical_documents_disabled" ], changedAt: null, changedBy: null
  };
  const SNCR_MOCK_OFF: Feature = {
    key: "sncr_mock", description: "SNCR simulado para desenvolvimento", enabled: false, usable: false,
    missing: [ "controlled_prescriptions_disabled" ], changedAt: null, changedBy: null
  };
  const SNCR_MOCK_ON: Feature = { ...SNCR_MOCK_OFF, enabled: true, changedAt: "2026-10-10T13:00:00Z", changedBy: "dev@local" };
  const sncrPlatform = () => reply(200, { data: {
    sncrStatus: { configured: false, reachable: false, lastCheckAt: null, simulatedAvailable: true }
  } });
  function withCatalog(features: Feature[]) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SncrPlatform")) return Promise.resolve(sncrPlatform());
      return Promise.resolve(featuresReply(features));
    });
  }

  it("controlled_prescriptions pelo mecanismo genérico: falta documentos clínicos e liga com dois cliques", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...CONTROLLED_OFF, enabled: true, changedAt: "2026-10-10T13:00:00Z", changedBy: "dev@local" };
    let listed = [ CONTROLLED_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SncrPlatform")) return Promise.resolve(sncrPlatform());
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "record" }));
    });
    renderTab();

    expect(await screen.findByText("controlled_prescriptions")).not.toBeNull();
    expect(screen.getByText("Receita de controle especial e de antimicrobiano (SNCR)")).not.toBeNull();
    expect(screen.getByText("documentos clínicos (clinical_documents) desligados")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar controlled_prescriptions" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "controlled_prescriptions", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      "controlled_prescriptions ligada, mas ainda não utilizável — falta: documentos clínicos (clinical_documents) desligados."
    );
  });

  it("com controlled_prescriptions no catálogo mostra o quadro do SNCR; sem ela, nem consulta", async () => {
    withCatalog([ CONTROLLED_OFF ]);
    renderTab();
    expect(await screen.findByRole("region", { name: "SNCR da Anvisa — numeração de receitas (todas as cidades do ambiente)" }))
      .not.toBeNull();
    expect(await screen.findByText("sem credencial — SNCR real não configurado")).not.toBeNull();
    cleanup();

    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LEDI_OFF ])));
    renderTab();
    await screen.findByText("ledi_export");
    expect(calls(fetchMock, "query SncrPlatform")).toHaveLength(0);
  });

  it("api sem o 19d: o quadro explica a ordem de deploy e a aba segue", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SncrPlatform")) {
        return Promise.resolve(reply(200, { errors: [ {
          message: "Field 'sncrStatus' doesn't exist on type 'Query'",
          extensions: { code: "undefinedField", typeName: "Query", fieldName: "sncrStatus" }
        } ] }));
      }
      return Promise.resolve(featuresReply([ CONTROLLED_OFF ]));
    });
    renderTab();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 19d precisa subir antes do maintenance/);
    expect(screen.getByText("controlled_prescriptions")).not.toBeNull();
    expect(screen.getByRole("button", { name: "ligar" })).not.toBeNull();
  });

  it("sncr_mock tem rótulo e diz o pré-requisito", async () => {
    withCatalog([ CONTROLLED_OFF, SNCR_MOCK_OFF ]);
    renderTab();
    expect(await screen.findByText("sncr_mock")).not.toBeNull();
    expect(screen.getByText("SNCR simulado (desenvolvimento)")).not.toBeNull();
    expect(screen.getByText("receita de controlado (controlled_prescriptions) desligada")).not.toBeNull();
  });

  it("SNCR simulado ligado: aviso na aba e no quadro", async () => {
    withCatalog([ CONTROLLED_OFF, SNCR_MOCK_ON ]);
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do SNCR" })).textContent).toBe(SNCR_MOCK_NOTICE);
    expect(screen.getByRole("note", { name: "modo do SNCR desta cidade" }).textContent).toBe(SNCR_MOCK_NOTICE);
  });

  it("ligar sncr_mock por dois cliques: após o refetch a aba avisa", async () => {
    const user = userEvent.setup();
    let listed = [ CONTROLLED_OFF, SNCR_MOCK_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SncrPlatform")) return Promise.resolve(sncrPlatform());
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ CONTROLLED_OFF, SNCR_MOCK_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: SNCR_MOCK_ON } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("sncr_mock")).not.toBeNull();
    expect(screen.queryByRole("note", { name: "modo do SNCR" })).toBeNull();
    // Duas linhas desligadas (controlled_prescriptions, sncr_mock): a do SNCR simulado é a segunda.
    await user.click(screen.getAllByRole("button", { name: "ligar" })[1]);
    await user.click(await screen.findByRole("button", { name: "confirmar: ligar sncr_mock" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "sncr_mock", enabled: true });
    expect((await screen.findByRole("note", { name: "modo do SNCR" })).textContent).toBe(SNCR_MOCK_NOTICE);
  });

  it("SNCR simulado desligado: sem aviso na aba; o quadro diz SNCR real", async () => {
    withCatalog([ CONTROLLED_OFF, SNCR_MOCK_OFF ]);
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do SNCR desta cidade" })).textContent).toBe(SNCR_REAL_NOTICE);
    expect(screen.queryByRole("note", { name: "modo do SNCR" })).toBeNull();
  });

  it("catálogo sem sncr_mock (produção): nada quebra e nada diz simulado", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query SncrPlatform")) {
        return Promise.resolve(reply(200, { data: {
          sncrStatus: { configured: true, reachable: true, lastCheckAt: "2026-10-10T12:00:00Z", simulatedAvailable: false }
        } }));
      }
      return Promise.resolve(featuresReply([ { ...CONTROLLED_OFF, enabled: true, usable: true, missing: [] } ]));
    });
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do SNCR desta cidade" })).textContent).toBe(SNCR_REAL_NOTICE);
    await screen.findByText("SNCR simulado indisponível neste ambiente (produção)");
    expect(screen.queryByText("sncr_mock")).toBeNull();
    expect(screen.queryByRole("note", { name: "modo do SNCR" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });
});

describe("FeaturesTab — linha do tempo e página do PEC (módulo 20)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const TIMELINE_OFF: Feature = {
    key: "patient_timeline", description: "Linha do tempo do paciente (profissional e cidadão)",
    enabled: false, usable: false, missing: [], changedAt: null, changedBy: null
  };
  // M3 aceita: sem origem ou sem chave, o catálogo também diz o que falta.
  const PEC_OFF: Feature = {
    key: "pec_external_view", description: "Página para a tela de sistemas externos do e-SUS PEC",
    enabled: false, usable: false,
    missing: [ "patient_timeline_disabled", "record_mode_not_integrated", "pec_origin_missing", "pec_hmac_key_missing" ],
    changedAt: null, changedBy: null
  };
  const PEC_MISSING_TEXT =
    "linha do tempo (patient_timeline) desligada; modo de prontuário diferente de integrated; " +
    "endereço de origem do PEC não preenchido; chave HMAC do PEC não gravada";
  const pecConfig = () => reply(200, { data: {
    cityPecConfig: { pecOrigin: null, hmacKeyConfigured: false, hmacKeyUpdatedAt: null }
  } });

  it("patient_timeline tem rótulo e liga com dois cliques, sem pré-requisito", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...TIMELINE_OFF, enabled: true, usable: true, changedAt: "2026-10-11T13:00:00Z", changedBy: "dev@local" };
    let listed = [ TIMELINE_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();
    expect(await screen.findByText("patient_timeline")).not.toBeNull();
    expect(screen.getByText("Linha do tempo do paciente")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar patient_timeline" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "patient_timeline", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe("patient_timeline ligada e utilizável.");
    expect(calls(fetchMock, "query CityPecConfig")).toHaveLength(0);
  });

  it("pec_external_view pelo mecanismo genérico: falta linha do tempo, modo integrado, origem e chave", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...PEC_OFF, enabled: true, changedAt: "2026-10-11T13:00:00Z", changedBy: "dev@local" };
    let listed = [ PEC_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityPecConfig")) return Promise.resolve(pecConfig());
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "record" }));
    });
    renderTab();
    expect(await screen.findByText("pec_external_view")).not.toBeNull();
    expect(screen.getByText("Página para os sistemas externos do PEC")).not.toBeNull();
    expect(screen.getByText(PEC_MISSING_TEXT)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar pec_external_view" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      `pec_external_view ligada, mas ainda não utilizável — falta: ${PEC_MISSING_TEXT}.`
    );
  });

  it("com pec_external_view no catálogo mostra o quadro do PEC; sem ela, nem consulta", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityPecConfig")) return Promise.resolve(pecConfig());
      return Promise.resolve(featuresReply([ TIMELINE_OFF, PEC_OFF ]));
    });
    renderTab();
    expect(await screen.findByRole("region", { name: "Página do PEC (sistemas externos)" })).not.toBeNull();
    expect(await screen.findByText("chave não gravada — o PEC não consegue abrir a página")).not.toBeNull();
    expect(bodyOf(calls(fetchMock, "query CityPecConfig")[0]).variables).toEqual({ slug: "sp" });
    cleanup();

    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LEDI_OFF ])));
    renderTab();
    await screen.findByText("ledi_export");
    expect(calls(fetchMock, "query CityPecConfig")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: "Página do PEC (sistemas externos)" })).toBeNull();
  });

  it("api sem o módulo 20: o quadro explica a ordem de deploy e a aba segue", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityPecConfig")) {
        return Promise.resolve(reply(200, { errors: [ {
          message: "Field 'cityPecConfig' doesn't exist on type 'Query'",
          extensions: { code: "undefinedField", typeName: "Query", fieldName: "cityPecConfig" }
        } ] }));
      }
      return Promise.resolve(featuresReply([ PEC_OFF ]));
    });
    renderTab();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 20 precisa subir antes do maintenance/);
    expect(screen.getByText("pec_external_view")).not.toBeNull();
    expect(screen.getByRole("button", { name: "ligar" })).not.toBeNull();
  });

  it("gravar a chave relê a lista: o 'falta' de pec_external_view acompanha o quadro", async () => {
    const user = userEvent.setup();
    const before: Feature = { ...PEC_OFF, enabled: true, missing: [ "pec_hmac_key_missing" ] };
    const after: Feature = { ...before, missing: [] };
    let keyWritten = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation RotateCityPecHmacKey")) {
        keyWritten = true;
        return Promise.resolve(reply(200, { data: { rotateCityPecHmacKey: { ok: true, errors: [] } } }));
      }
      if (body.query.includes("query CityPecConfig")) {
        return Promise.resolve(reply(200, { data: { cityPecConfig: {
          pecOrigin: "https://pec.sp.gov.br", hmacKeyConfigured: keyWritten, hmacKeyUpdatedAt: keyWritten ? "2026-10-11T13:00:00Z" : null
        } } }));
      }
      return Promise.resolve(featuresReply([ keyWritten ? after : before ]));
    });
    renderTab();
    expect(await screen.findByText("chave HMAC do PEC não gravada")).not.toBeNull();
    await user.type(await screen.findByLabelText("Chave de assinatura do PEC"), "9f2c4e7a1b3d5f60a8c2e4f6b1d3a5c7");
    await user.type(screen.getByLabelText("Código do autenticador"), "123456");
    await user.click(screen.getByRole("button", { name: "gravar a chave" }));
    await user.click(screen.getByRole("button", { name: "confirmar: gravar a chave HMAC" }));
    await waitFor(() => expect(calls(fetchMock, "query CityFeatures")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText("chave HMAC do PEC não gravada")).toBeNull());
  });

  it("trocar de cidade remonta o quadro do PEC: o texto digitado de uma cidade não vai para a outra", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityPecConfig")) return Promise.resolve(pecConfig());
      return Promise.resolve(featuresReply([ PEC_OFF ]));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Cache já quente da outra cidade: a aba não passa por "carregando" e só a key remonta o quadro.
    client.setQueryData([ "city", "rio", "features" ], {
      data: { city: { slug: "rio", recordMode: "integrated", profile: { ibgeCode: "3304557" }, features: [ PEC_OFF ] } },
      fieldErrors: []
    });
    const tree = (slug: string) => <QueryClientProvider client={client}><FeaturesTab slug={slug} /></QueryClientProvider>;
    const { rerender } = render(tree("sp"));
    const field = (await screen.findByLabelText("Endereço de origem do PEC")) as HTMLInputElement;
    await user.type(field, "https://rascunho.sp.gov.br");
    expect(field.value).toBe("https://rascunho.sp.gov.br");
    rerender(tree("rio"));
    await waitFor(() => expect(calls(fetchMock, "query CityPecConfig").some((c) => bodyOf(c).variables.slug === "rio")).toBe(true));
    expect((await screen.findByLabelText("Endereço de origem do PEC") as HTMLInputElement).value).toBe("");
  });
});

describe("FeaturesTab — rastreamento de exames (módulo 21a)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const TRACKING_OFF: Feature = {
    key: "exam_tracking", description: "Rastreamento do exame do pedido ao resultado",
    enabled: false, usable: false, missing: [ "record_mode_off" ], changedAt: null, changedBy: null
  };
  const FHIR_OFF: Feature = {
    key: "exam_fhir_inbound", description: "Entrada FHIR de resultados", enabled: false, usable: false,
    missing: [ "exam_tracking_disabled" ], changedAt: null, changedBy: null
  };
  const BRIDGE_OFF: Feature = {
    key: "exam_pec_bridge", description: "Solicitar exames pela ponte do PEC", enabled: false, usable: false,
    missing: [ "exam_tracking_disabled", "pec_external_view_disabled" ], changedAt: null, changedBy: null
  };
  const LAB_OFF: Feature = {
    key: "fake_lab", description: "Laboratório simulado do compose de dev", enabled: false, usable: false,
    missing: [ "exam_fhir_inbound_disabled" ], changedAt: null, changedBy: null
  };
  const LAB_ON: Feature = { ...LAB_OFF, enabled: true, changedAt: "2026-10-13T13:00:00Z", changedBy: "dev@local" };

  it("exam_tracking pelo mecanismo genérico: nome em português, falta o modo de prontuário e liga com dois cliques", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...TRACKING_OFF, enabled: true, changedAt: "2026-10-13T13:00:00Z", changedBy: "dev@local" };
    let listed = [ TRACKING_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "off" }));
    });
    renderTab();

    expect(await screen.findByText("exam_tracking")).not.toBeNull();
    expect(screen.getByText("Rastreamento de exames (pedido, regulação, prazos e resultado)")).not.toBeNull();
    expect(screen.getByText("modo de prontuário desligado")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar exam_tracking" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "exam_tracking", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      "exam_tracking ligada, mas ainda não utilizável — falta: modo de prontuário desligado."
    );
  });

  it("os pré-requisitos do 21a aparecem em português na lista", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ FHIR_OFF, BRIDGE_OFF, LAB_OFF ])));
    renderTab();
    expect(await screen.findByText("exam_fhir_inbound")).not.toBeNull();
    expect(screen.getByText("Entrada de resultados por FHIR (laboratórios)")).not.toBeNull();
    expect(screen.getByText("Solicitar exames pela tela de sistemas externos do PEC")).not.toBeNull();
    expect(screen.getByText("Laboratório simulado (desenvolvimento)")).not.toBeNull();
    expect(screen.getByText("rastreamento de exames (exam_tracking) desligado")).not.toBeNull();
    expect(screen.getByText(
      "rastreamento de exames (exam_tracking) desligado; página para os sistemas externos do PEC (pec_external_view) desligada"
    )).not.toBeNull();
    expect(screen.getByText("entrada de resultados por FHIR (exam_fhir_inbound) desligada")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/_disabled|undefined|null/);
    // Desligado: nenhum aviso de simulado.
    expect(screen.queryByRole("note", { name: "modo do laboratório" })).toBeNull();
  });

  it("laboratório simulado ligado: aviso na aba", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LAB_ON ])));
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do laboratório" })).textContent).toBe(FAKE_LAB_NOTICE);
  });

  it("ligar fake_lab por dois cliques: após o refetch a aba avisa", async () => {
    const user = userEvent.setup();
    let listed = [ LAB_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ LAB_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: LAB_ON } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("fake_lab")).not.toBeNull();
    expect(screen.queryByRole("note", { name: "modo do laboratório" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(await screen.findByRole("button", { name: "confirmar: ligar fake_lab" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "fake_lab", enabled: true });
    expect((await screen.findByRole("note", { name: "modo do laboratório" })).textContent).toBe(FAKE_LAB_NOTICE);
  });

  it("catálogo sem fake_lab (produção): nada quebra e nada diz simulado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([
      { ...TRACKING_OFF, enabled: true, usable: true, missing: [] },
      { ...FHIR_OFF, enabled: true, usable: true, missing: [] },
      LEDI_OFF
    ])));
    renderTab();
    expect(await screen.findByText("exam_fhir_inbound")).not.toBeNull();
    expect(screen.queryByText("fake_lab")).toBeNull();
    expect(screen.queryByRole("note", { name: "modo do laboratório" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });
});

describe("FeaturesTab — laboratório municipal (módulo 21b)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const LAB_OFF: Feature = {
    key: "municipal_lab", description: "Laboratório municipal: fluxo analítico", enabled: false, usable: false,
    missing: [ "exam_tracking_disabled" ], changedAt: null, changedBy: null
  };
  const HL7_OFF: Feature = {
    key: "lab_hl7_inbound", description: "Entrada HL7 do middleware", enabled: false, usable: false,
    missing: [ "municipal_lab_disabled" ], changedAt: null, changedBy: null
  };
  const MW_OFF: Feature = {
    key: "fake_middleware", description: "Middleware simulado do compose de dev", enabled: false, usable: false,
    missing: [ "lab_hl7_inbound_disabled" ], changedAt: null, changedBy: null
  };
  const MW_ON: Feature = { ...MW_OFF, enabled: true, changedAt: "2026-10-15T13:00:00Z", changedBy: "dev@local" };
  const FAKE_LAB_ON: Feature = {
    key: "fake_lab", description: "Laboratório simulado do compose de dev", enabled: true, usable: true,
    missing: [], changedAt: "2026-10-15T12:00:00Z", changedBy: "dev@local"
  };

  it("municipal_lab pelo mecanismo genérico: nome em português, falta o rastreamento e liga com dois cliques", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...LAB_OFF, enabled: true, changedAt: "2026-10-15T13:00:00Z", changedBy: "dev@local" };
    let listed = [ LAB_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("municipal_lab")).not.toBeNull();
    expect(screen.getByText("Laboratório municipal (requisição, amostra, análise e laudo)")).not.toBeNull();
    expect(screen.getByText("rastreamento de exames (exam_tracking) desligado")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar municipal_lab" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "municipal_lab", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      "municipal_lab ligada, mas ainda não utilizável — falta: rastreamento de exames (exam_tracking) desligado."
    );
  });

  it("os pré-requisitos do 21b aparecem em português na lista", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ HL7_OFF, MW_OFF ])));
    renderTab();
    expect(await screen.findByText("lab_hl7_inbound")).not.toBeNull();
    expect(screen.getByText("Entrada de resultados de aparelhos por HL7 (middleware)")).not.toBeNull();
    expect(screen.getByText("Middleware simulado (desenvolvimento)")).not.toBeNull();
    expect(screen.getByText("laboratório municipal (municipal_lab) desligado")).not.toBeNull();
    expect(screen.getByText("entrada de resultados por HL7 (lab_hl7_inbound) desligada")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/_disabled|undefined|null/);
    expect(screen.queryByRole("note", { name: "modo do middleware" })).toBeNull();
  });

  it("ligar fake_middleware por dois cliques: após o refetch a aba avisa", async () => {
    const user = userEvent.setup();
    let listed = [ MW_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ MW_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: MW_ON } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("fake_middleware")).not.toBeNull();
    expect(screen.queryByRole("note", { name: "modo do middleware" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(await screen.findByRole("button", { name: "confirmar: ligar fake_middleware" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "fake_middleware", enabled: true });
    expect((await screen.findByRole("note", { name: "modo do middleware" })).textContent).toBe(FAKE_MIDDLEWARE_NOTICE);
  });

  it("desligar fake_middleware: após o refetch o aviso some", async () => {
    const user = userEvent.setup();
    let listed = [ MW_ON ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ MW_OFF ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: MW_OFF } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByRole("note", { name: "modo do middleware" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "desligar" }));
    await user.click(await screen.findByRole("button", { name: "confirmar: desligar fake_middleware" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "fake_middleware", enabled: false });
    await waitFor(() => expect(screen.queryByRole("note", { name: "modo do middleware" })).toBeNull());
  });

  it("laboratório e middleware simulados ligados: dois avisos, cada um com seu nome", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ FAKE_LAB_ON, MW_ON ])));
    renderTab();
    expect((await screen.findByRole("note", { name: "modo do middleware" })).textContent).toBe(FAKE_MIDDLEWARE_NOTICE);
    expect(screen.getByRole("note", { name: "modo do laboratório" }).textContent).toBe(FAKE_LAB_NOTICE);
  });

  it("catálogo sem fake_middleware (produção): nada quebra e nada diz middleware simulado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([
      { ...LAB_OFF, enabled: true, usable: true, missing: [] },
      { ...HL7_OFF, enabled: true, usable: true, missing: [] },
      LEDI_OFF
    ])));
    renderTab();
    expect(await screen.findByText("lab_hl7_inbound")).not.toBeNull();
    expect(screen.queryByText("fake_middleware")).toBeNull();
    expect(screen.queryByRole("note", { name: "modo do middleware" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/MIDDLEWARE SIMULADO|undefined|null/);
  });
});

describe("FeaturesTab — qualidade e estoque do laboratório (módulo 21c)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const LAB_ON: Feature = {
    key: "municipal_lab", description: "Laboratório municipal: fluxo analítico", enabled: true, usable: true,
    missing: [], changedAt: "2026-10-18T12:00:00Z", changedBy: "dev@local"
  };
  const QC_OFF: Feature = {
    key: "lab_quality_control", description: "Controle de qualidade do laboratório: CIQ e CEQ", enabled: false, usable: false,
    missing: [ "municipal_lab_disabled" ], changedAt: null, changedBy: null
  };
  const INV_OFF: Feature = {
    key: "lab_inventory", description: "Estoque do laboratório: reagentes e insumos com lotes, lote em uso e consumo estimado", enabled: false, usable: false,
    missing: [ "municipal_lab_disabled" ], changedAt: null, changedBy: null
  };
  const QC_ON: Feature = { ...QC_OFF, enabled: true, usable: true, missing: [], changedAt: "2026-10-18T13:00:00Z", changedBy: "dev@local" };
  const INV_ON: Feature = { ...INV_OFF, enabled: true, usable: true, missing: [], changedAt: "2026-10-18T13:00:00Z", changedBy: "dev@local" };
  const MW_ON: Feature = {
    key: "fake_middleware", description: "Middleware simulado do compose de dev", enabled: true, usable: true,
    missing: [], changedAt: "2026-10-18T13:00:00Z", changedBy: "dev@local"
  };

  it("os dois aparecem com nome em português e o pré-requisito do laboratório municipal", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ QC_OFF, INV_OFF ])));
    renderTab();

    expect(await screen.findByText("lab_quality_control")).not.toBeNull();
    expect(screen.getByText("lab_inventory")).not.toBeNull();
    expect(screen.getByText("Controle de qualidade do laboratório (CIQ e CEQ)")).not.toBeNull();
    expect(screen.getByText("Estoque do laboratório")).not.toBeNull();
    expect(screen.getAllByText("laboratório municipal (municipal_lab) desligado")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/_disabled|undefined|null/);
  });

  it("lab_quality_control liga com dois cliques: sem o laboratório, ligada e com o que falta", async () => {
    const user = userEvent.setup();
    const turnedOn: Feature = { ...QC_OFF, enabled: true, changedAt: "2026-10-18T13:00:00Z", changedBy: "dev@local" };
    let listed = [ QC_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ turnedOn ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: turnedOn } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("lab_quality_control")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar lab_quality_control" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "lab_quality_control", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe(
      "lab_quality_control ligada, mas ainda não utilizável — falta: laboratório municipal (municipal_lab) desligado."
    );
    expect(await screen.findByText("ligada, falta pré-requisito")).not.toBeNull();
  });

  it("lab_inventory liga com dois cliques: com o laboratório ligado, utilizável", async () => {
    const user = userEvent.setup();
    let listed = [ LAB_ON, INV_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ LAB_ON, INV_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: INV_ON } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("lab_inventory")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar lab_inventory" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "lab_inventory", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe("lab_inventory ligada e utilizável.");
  });

  it("desligar municipal_lab: depois do refetch os dois do 21c dizem o que falta", async () => {
    const user = userEvent.setup();
    const labOff: Feature = { ...LAB_ON, enabled: false, usable: false, missing: [], changedAt: "2026-10-18T14:00:00Z" };
    let listed = [ LAB_ON, QC_ON, INV_ON ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [
          labOff,
          { ...QC_ON, usable: false, missing: [ "municipal_lab_disabled" ] },
          { ...INV_ON, usable: false, missing: [ "municipal_lab_disabled" ] }
        ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: labOff } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("lab_quality_control")).not.toBeNull();
    expect(screen.getAllByText("ligada e utilizável")).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "desligar" })[0]);
    await user.click(screen.getByRole("button", { name: "confirmar: desligar municipal_lab" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "municipal_lab", enabled: false });
    expect((await screen.findByRole("status")).textContent).toBe("municipal_lab desligada.");
    await waitFor(() => expect(screen.getAllByText("ligada, falta pré-requisito")).toHaveLength(2));
    expect(screen.queryByText("ligada e utilizável")).toBeNull();
    expect(screen.getAllByText("laboratório municipal (municipal_lab) desligado")).toHaveLength(2);
  });

  it("independentes: estoque utilizável com o controle de qualidade desligado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([
      LAB_ON, { ...QC_OFF, missing: [] }, INV_ON
    ])));
    renderTab();

    expect(await screen.findByText("lab_inventory")).not.toBeNull();
    expect(screen.getAllByText("ligada e utilizável")).toHaveLength(2);
    expect(screen.getByText("desligada")).not.toBeNull();
    // Nenhuma linha diz que falta o controle de qualidade, nem o laboratório.
    expect(screen.queryByText(/municipal_lab\) desligado/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/lab_quality_control_disabled|\(lab_quality_control\) desligad/);
  });

  it("produção: os dois do 21c aparecem e nenhum aviso de simulado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LAB_ON, QC_ON, INV_ON ])));
    renderTab();

    expect(await screen.findByText("lab_quality_control")).not.toBeNull();
    expect(screen.getByText("lab_inventory")).not.toBeNull();
    expect(screen.queryByText("fake_middleware")).toBeNull();
    expect(screen.queryAllByRole("note")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });

  it("código de missing desconhecido aparece cru ao lado do conhecido", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([
      { ...QC_OFF, enabled: true, missing: [ "municipal_lab_disabled", "lab_instrument_missing" ] }
    ])));
    renderTab();

    expect(await screen.findByText(
      "laboratório municipal (municipal_lab) desligado; lab_instrument_missing"
    )).not.toBeNull();
    expect(screen.getByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("com fake_middleware ligado, o aviso fala do controle de qualidade e do bloqueio", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ LAB_ON, QC_ON, MW_ON ])));
    renderTab();

    const note = await screen.findByRole("note", { name: "modo do middleware" });
    expect(note.textContent).toBe(FAKE_MIDDLEWARE_NOTICE);
    expect(note.textContent).toMatch(/corridas de controle de exemplo/);
    expect(note.textContent).toMatch(/abre bloqueio de liberação/);
  });
});

describe("FeaturesTab — faturamento de procedimentos (módulo 22)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const PB_OFF: Feature = {
    key: "procedure_billing", description: "Faturamento de procedimentos (BPA): procedimentos realizados com crítica SIGTAP e arquivo BPA-I/BPA-C", enabled: false,
    usable: false, missing: [], changedAt: null, changedBy: null
  };
  const PB_ON: Feature = { ...PB_OFF, enabled: true, usable: true, changedAt: "2026-10-21T13:00:00Z", changedBy: "dev@local" };

  async function turnOn(recordMode: string) {
    const user = userEvent.setup();
    let listed = [ PB_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ PB_ON ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: PB_ON } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode }));
    });
    renderTab();
    expect(await screen.findByText("procedure_billing")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "ligar" }));
    expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "confirmar: ligar procedure_billing" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "procedure_billing", enabled: true });
    expect((await screen.findByRole("status")).textContent).toBe("procedure_billing ligada e utilizável.");
  }

  it("aparece com o nome em português e sem pré-requisito", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ PB_OFF ])));
    renderTab();

    expect(await screen.findByText("procedure_billing")).not.toBeNull();
    expect(screen.getByText("Faturamento de procedimentos (BPA)")).not.toBeNull();
    expect(screen.getByText("desligada")).not.toBeNull();
    expect(screen.getByText("nada")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/_disabled|undefined|null/);
  });

  it("liga utilizável com o modo off e com o integrated: o modo não é pré-requisito", async () => {
    await turnOn("off");
    expect(screen.getByText("desligado (off)")).not.toBeNull();
    cleanup();
    fetchMock.mockReset();
    await turnOn("integrated");
    expect(screen.getByText("integrado ao PEC da cidade (integrated)")).not.toBeNull();
    expect(screen.queryByText("ligada, falta pré-requisito")).toBeNull();
  });

  it("sem IBGE: ligada, falta o código IBGE, com a frase do módulo 16", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply(
      [ { ...PB_ON, usable: false, missing: [ "ibge_code_missing" ] } ], { profile: { ibgeCode: null } }
    )));
    renderTab();

    expect(await screen.findByText("procedure_billing")).not.toBeNull();
    expect(screen.getByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(screen.getByText("código IBGE não preenchido")).not.toBeNull();
    expect(screen.getByText("não preenchido")).not.toBeNull();
  });

  it("desliga com dois cliques e diz o estado devolvido", async () => {
    const user = userEvent.setup();
    let listed = [ PB_ON ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ { ...PB_OFF, changedAt: "2026-10-21T14:00:00Z", changedBy: "dev@local" } ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: listed[0] } } }));
      }
      return Promise.resolve(featuresReply(listed));
    });
    renderTab();

    expect(await screen.findByText("ligada e utilizável")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "desligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: desligar procedure_billing" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables)
      .toEqual({ citySlug: "sp", key: "procedure_billing", enabled: false });
    expect((await screen.findByRole("status")).textContent).toBe("procedure_billing desligada.");
    expect(await screen.findByText("desligada")).not.toBeNull();
  });

  it("produção: o interruptor aparece e nenhum aviso de simulado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ PB_ON ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("procedure_billing")).not.toBeNull();
    expect(screen.queryAllByRole("note")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });

  it("código de missing desconhecido aparece cru ao lado do conhecido", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([
      { ...PB_ON, usable: false, missing: [ "ibge_code_missing", "billing_settings_missing" ] }
    ])));
    renderTab();

    expect(await screen.findByText("código IBGE não preenchido; billing_settings_missing")).not.toBeNull();
    expect(screen.getByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });
});

describe("FeaturesTab — linhas de cuidado (módulo 23)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const CL_OFF: Feature = {
    key: "care_lines",
    description: "Linhas de cuidado: catálogo C2–C7, inscrição confirmada, busca ativa e prévia dos indicadores",
    enabled: false, usable: false, missing: [], changedAt: null, changedBy: null
  };
  const CL_ON: Feature = { ...CL_OFF, enabled: true, usable: true, changedAt: "2026-10-22T13:00:00Z", changedBy: "dev@local" };

  it("aparece com o nome em português e a descrição do api", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ CL_OFF ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("care_lines")).not.toBeNull();
    expect(screen.getByText("Linhas de cuidado")).not.toBeNull();
    expect(screen.getByText(CL_OFF.description)).not.toBeNull();
    expect(screen.getByText("desligada")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("fixa o fluxo genérico para care_lines: sem clinical_record, ligada, falta o prontuário, com a frase do módulo 19", async () => {
    const user = userEvent.setup();
    const CL_BLOCKED: Feature = { ...CL_ON, usable: false, missing: [ "clinical_record_disabled" ] };
    let listed = [ CL_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ CL_BLOCKED ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: CL_BLOCKED } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "integrated" }));
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar care_lines" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables).toEqual({ citySlug: "sp", key: "care_lines", enabled: true });
    expect(await screen.findByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(screen.getByText("prontuário da atenção primária (clinical_record) desligado")).not.toBeNull();
  });

  it("fixa o fluxo genérico para care_lines: com o prontuário, liga utilizável e desliga com dois cliques", async () => {
    const user = userEvent.setup();
    let listed = [ CL_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        const on = body.variables.enabled === true;
        listed = [ on ? CL_ON : { ...CL_OFF, changedAt: "2026-10-22T14:00:00Z", changedBy: "dev@local" } ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: listed[0] } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "record" }));
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar care_lines" }));
    expect((await screen.findByRole("status")).textContent).toBe("care_lines ligada e utilizável.");
    await user.click(await screen.findByRole("button", { name: "desligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: desligar care_lines" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(2));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[1]).variables).toEqual({ citySlug: "sp", key: "care_lines", enabled: false });
    expect((await screen.findByRole("status")).textContent).toBe("care_lines desligada.");
  });

  it("fixa que care_lines não é simulada: ligada, não acrescenta aviso; o único é o da chave simulada", async () => {
    const MW_ON_HERE: Feature = {
      key: "fake_middleware", description: "Middleware simulado (desenvolvimento)", enabled: true, usable: true,
      missing: [], changedAt: "2026-10-22T13:00:00Z", changedBy: "dev@local"
    };
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ CL_ON, MW_ON_HERE ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("care_lines")).not.toBeNull();
    const notes = screen.getAllByRole("note");
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toBe(FAKE_MIDDLEWARE_NOTICE);
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });
});

describe("FeaturesTab — cadastro individual e domiciliar (módulo 24a)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  const TR_OFF: Feature = {
    key: "territory_registry", description: "Cadastro territorial: microáreas, domicílios, famílias e cadastro individual com fichas LEDI de cadastro",
    enabled: false, usable: false, missing: [], changedAt: null, changedBy: null
  };
  const TR_ON: Feature = { ...TR_OFF, enabled: true, usable: true, changedAt: "2026-10-23T13:00:00Z", changedBy: "dev@local" };

  it("aparece com o nome em português e a descrição do api", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ TR_OFF ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("territory_registry")).not.toBeNull();
    expect(screen.getByText("Cadastro individual e domiciliar")).not.toBeNull();
    expect(screen.getByText(TR_OFF.description)).not.toBeNull();
    expect(screen.getByText("desligada")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("sem clinical_record: ligada, falta o prontuário, com a frase do módulo 19", async () => {
    const user = userEvent.setup();
    const TR_BLOCKED: Feature = { ...TR_ON, usable: false, missing: [ "clinical_record_disabled" ] };
    let listed = [ TR_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        listed = [ TR_BLOCKED ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: TR_BLOCKED } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "integrated" }));
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar territory_registry" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[0]).variables).toEqual({ citySlug: "sp", key: "territory_registry", enabled: true });
    expect(await screen.findByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(screen.getByText("prontuário da atenção primária (clinical_record) desligado")).not.toBeNull();
  });

  it("com o prontuário: liga utilizável; desliga com dois cliques; nada fala em apagar", async () => {
    const user = userEvent.setup();
    let listed = [ TR_OFF ];
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("mutation SetCityFeature")) {
        const on = body.variables.enabled === true;
        listed = [ on ? TR_ON : { ...TR_OFF, changedAt: "2026-10-23T14:00:00Z", changedBy: "dev@local" } ];
        return Promise.resolve(reply(200, { data: { setCityFeature: { ok: true, errors: [], feature: listed[0] } } }));
      }
      return Promise.resolve(featuresReply(listed, { recordMode: "record" }));
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "ligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: ligar territory_registry" }));
    expect((await screen.findByRole("status")).textContent).toBe("territory_registry ligada e utilizável.");
    await user.click(await screen.findByRole("button", { name: "desligar" }));
    await user.click(screen.getByRole("button", { name: "confirmar: desligar territory_registry" }));
    await waitFor(() => expect(calls(fetchMock, "mutation SetCityFeature")).toHaveLength(2));
    expect(bodyOf(calls(fetchMock, "mutation SetCityFeature")[1]).variables).toEqual({ citySlug: "sp", key: "territory_registry", enabled: false });
    expect((await screen.findByRole("status")).textContent).toBe("territory_registry desligada.");
    expect(document.body.textContent).not.toMatch(/apaga|exclu/i);
  });

  it("missing desconhecido aparece cru", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ { ...TR_ON, usable: false, missing: [ "team_kind_missing" ] } ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("team_kind_missing")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined/);
  });

  it("produção: aparece e nenhum aviso de simulado", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ TR_ON ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("territory_registry")).not.toBeNull();
    expect(screen.queryAllByRole("note")).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/SIMULADO|undefined|null/);
  });

  it("sem IBGE e UF: ligada, falta pré-requisito, com as duas frases", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(featuresReply([ { ...TR_ON, usable: false, missing: [ "ibge_code_missing", "uf_missing" ] } ], { recordMode: "record" })));
    renderTab();

    expect(await screen.findByText("ligada, falta pré-requisito")).not.toBeNull();
    expect(screen.getByText(/código IBGE não preenchido/)).not.toBeNull();
    expect(screen.getByText(/UF não preenchida/)).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });
});
