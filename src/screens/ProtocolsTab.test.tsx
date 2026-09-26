import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProtocolsTab } from "./ProtocolsTab";

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

function v(overrides: Record<string, unknown>) {
  return {
    name: "dengue", version: 1, status: "draft",
    publicationSignatures: 0, publicationMissing: 2, activationSignatures: 0, activationMissing: 2,
    eligibleReviewers: 3, revertible: false, revertTargetVersion: null, ...overrides
  };
}
function versionsReply(rows: unknown[]) {
  return reply(200, { data: { city: { slug: "sp", protocolVersions: rows } } });
}
function mutationReply(field: string, ok: boolean, errors: unknown[] = [], extra: object = {}) {
  return reply(200, { data: { [field]: { ok, errors, ...extra } } });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<ProtocolsTab slug="sp" />, { wrapper });
}

describe("ProtocolsTab", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  // `route` responde a consulta de versões com `rows` e cada mutation pelo
  // mapa `mutations` (nome do campo → Response).
  function route(rows: unknown[], mutations: Record<string, () => Response> = {}) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityProtocolVersions")) return Promise.resolve(versionsReply(rows));
      const hit = Object.keys(mutations).find((field) => body.query.includes(field));
      return Promise.resolve(hit ? mutations[hit]() : reply(500, {}));
    });
  }

  it("mostra status, assinaturas N/2 e revisores; só as ações do status", async () => {
    route([ v({ status: "in_review", version: 2, publicationSignatures: 1, publicationMissing: 1 }) ]);
    renderTab();

    const table = within(await screen.findByRole("table"));
    expect(table.getByText("em revisão")).not.toBeNull();
    expect(table.getByText("1/2")).not.toBeNull();
    expect(table.getByRole("button", { name: "Publicar" })).not.toBeNull();
    expect(table.getByRole("button", { name: "Aposentar" })).not.toBeNull();
    expect(table.queryByRole("button", { name: "Ativar" })).toBeNull();
  });

  it("publicar fica desabilitado com o motivo quando falta assinatura", async () => {
    route([ v({ status: "in_review", publicationMissing: 1 }) ]);
    renderTab();

    const publish = await screen.findByRole("button", { name: "Publicar" });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("falta 1 assinatura")).not.toBeNull();
  });

  it("enviar para revisão não pede código e manda name/version/citySlug", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ], { submitProtocolForReview: () => mutationReply("submitProtocolForReview", true) });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    expect(screen.queryByLabelText("Código do autenticador")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls(fetchMock, "submitProtocolForReview")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "submitProtocolForReview")[0]).variables)
      .toEqual({ citySlug: "sp", name: "dengue", version: 1 });
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Enviar para revisão concluído: dengue v1");
  });

  it("sucesso invalida a lista (nova consulta de versões)", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ], { submitProtocolForReview: () => mutationReply("submitProtocolForReview", true) });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls(fetchMock, "query CityProtocolVersions")).toHaveLength(2));
  });

  it("aposentar pede código, envia e limpa o código mesmo na recusa", async () => {
    const user = userEvent.setup();
    route([ v({ status: "published", activationMissing: 0 }) ], {
      retireProtocol: () => mutationReply("retireProtocol", false, [ { path: "code", message: "código inválido" } ])
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Aposentar" }));
    await user.type(screen.getByLabelText("Código do autenticador"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls(fetchMock, "retireProtocol")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "retireProtocol")[0]).variables)
      .toEqual({ citySlug: "sp", name: "dengue", version: 1, code: "123456" });
    expect(await screen.findByText("código inválido")).not.toBeNull();
    expect(screen.getByText("Tentativas erradas contam para o bloqueio da conta.")).not.toBeNull();
    expect((screen.getByLabelText("Código do autenticador") as HTMLInputElement).value).toBe("");
  });

  it("recusa de domínio fora de code/reason aparece no painel, que continua aberto", async () => {
    const user = userEvent.setup();
    route([ v({ status: "in_review", publicationMissing: 0 }) ], {
      publishProtocol: () => mutationReply("publishProtocol", false, [ { path: "version", message: "falta 1 assinatura" } ])
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Publicar" }));
    await user.type(screen.getByLabelText("Código do autenticador"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("falta 1 assinatura")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Confirmar" })).not.toBeNull();
  });

  // "sem version" continua valendo e continua sendo o ponto: a reversão não
  // leva a versão A REVERTER (a API acha a ativa pelo nome). O expectedVersion
  // é outra coisa — o token do que a tela via, que o servidor compara.
  it("reverter pede motivo e código e manda name/reason/code (sem version a reverter)", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", true)
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    expect(screen.getByText(/deve voltar para a versão 2/)).not.toBeNull();
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls(fetchMock, "revertProtocolActivation")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "revertProtocolActivation")[0]).variables)
      .toEqual({ citySlug: "sp", name: "dengue", reason: "regra errada em produção", code: "654321",
                 expectedVersion: 3 });
  });

  it("o painel de reverter nomeia a versão que deve voltar", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ]);
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));

    expect(screen.getByText(/deve voltar para a versão 2/)).not.toBeNull();
  });

  it("sem alvo, mantém o aviso sem número", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: null }) ]);
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));

    expect(screen.getByText(/versão ativada antes desta/)).not.toBeNull();
  });

  // Guarda a base da revertNotice: se a seleção perder o campo, o aviso
  // degrada para "versão undefined" sem nenhum exemplo pegar isso.
  it("a consulta CityProtocolVersions seleciona revertTargetVersion", async () => {
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ]);
    renderTab();

    await screen.findByRole("table");

    await waitFor(() => expect(calls(fetchMock, "query CityProtocolVersions")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "query CityProtocolVersions")[0]).query).toContain("revertTargetVersion");
  });

  it("recusa de CityMutation (data com o campo nulo) aparece com código e a lista é recarregada", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ], {
      submitProtocolForReview: () => reply(200, {
        data: { submitProtocolForReview: null },
        errors: [ {
          message: "cidade não respondeu; resultado desconhecido (correlation abc)",
          path: [ "submitProtocolForReview" ],
          extensions: { code: "CITY_UNREACHABLE" }
        } ]
      })
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("CITY_UNREACHABLE — cidade não respondeu; resultado desconhecido (correlation abc)")).not.toBeNull();
    await waitFor(() => expect(calls(fetchMock, "query CityProtocolVersions")).toHaveLength(2));
  });

  it("erro lançado (HTTP 500) ainda aparece como recusa", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ], { submitProtocolForReview: () => reply(500, {}) });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("a API recusou a requisição")).not.toBeNull();
  });

  it("desabilita Cancelar e as ações da tabela enquanto a mutation está pendente", async () => {
    const user = userEvent.setup();
    let resolveMutation: () => void = () => {};
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityProtocolVersions")) {
        return Promise.resolve(versionsReply([ v({ status: "draft" }) ]));
      }
      if (body.query.includes("submitProtocolForReview")) {
        return new Promise<Response>((resolve) => {
          resolveMutation = () => resolve(mutationReply("submitProtocolForReview", true));
        });
      }
      return Promise.resolve(reply(500, {}));
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Aposentar" }) as HTMLButtonElement).disabled).toBe(true);

    resolveMutation();
    await waitFor(() => expect(screen.getByRole("status")).toHaveProperty("textContent", "Enviar para revisão concluído: dengue v1"));
  });

  it("clicar em atualizar limpa a mensagem de status", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ], { submitProtocolForReview: () => mutationReply("submitProtocolForReview", true) });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Enviar para revisão concluído: dengue v1");

    await user.click(screen.getByRole("button", { name: "atualizar" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("bloqueia localmente sem código de step-up e não chama a mutation", async () => {
    const user = userEvent.setup();
    route([ v({ status: "published", activationMissing: 0 }) ]);
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Aposentar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("informe o código do autenticador")).not.toBeNull();
    expect(calls(fetchMock, "retireProtocol")).toHaveLength(0);
  });

  it("bloqueia localmente sem motivo na reversão e não chama a mutation", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true }) ]);
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Código do autenticador"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("informe o motivo")).not.toBeNull();
    expect(calls(fetchMock, "revertProtocolActivation")).toHaveLength(0);
  });

  it("cancelar fecha o painel sem chamar mutation", async () => {
    const user = userEvent.setup();
    route([ v({ status: "draft" }) ]);
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Enviar para revisão" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(calls(fetchMock, "submitProtocolForReview")).toHaveLength(0);
  });

  it("cidade inalcançável na leitura mostra o erro do campo", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      // protocolVersions é não nulo: o erro do campo nulifica `city` inteira.
      data: { city: null },
      errors: [ { message: "cidade indisponível", path: [ "city", "protocolVersions" ], extensions: { code: "CITY_UNREACHABLE" } } ]
    })));
    renderTab();

    expect(await screen.findByText("CITY_UNREACHABLE — cidade indisponível")).not.toBeNull();
  });

  it("sem versão nenhuma, estado vazio", async () => {
    route([]);
    renderTab();
    expect(await screen.findByText("nenhum protocolo")).not.toBeNull();
  });

  it("a frase de sucesso nomeia a versão que passou a valer, não a que saiu de uso", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", true, [], { revertedToVersion: 2 })
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("a cidade está com dengue v2");
    expect(status.textContent).not.toContain("v3");
  });

  // Previsão e resultado vêm de fontes DIFERENTES do arranjo — a previsão do
  // revertTargetVersion da linha, o resultado do payload da mutation. Com o
  // mesmo número nos dois, o exemplo passaria sem provar nada.
  it("quando a versão efetivada difere da prevista, a frase diz as duas", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", true, [], { revertedToVersion: 5 })
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("estava previsto v2");
    expect(status.textContent).toContain("a cidade está com dengue v5");
  });

  it("sem número no payload, a frase sai sem número e nunca com undefined", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", true)
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("concluído");
    expect(status.textContent).not.toContain("undefined");
    // Sem isto, a mensagem ANTIGA e errada ("Reverter concluído: dengue v3")
    // satisfaria as duas asserções acima e o ramo nulo ficaria descoberto.
    expect(status.textContent).not.toContain("v3");
  });

  it("publicar continua nomeando a versão sobre a qual se agiu", async () => {
    const user = userEvent.setup();
    route([ v({ status: "in_review", version: 4, publicationSignatures: 2, publicationMissing: 0 }) ], {
      publishProtocol: () => mutationReply("publishProtocol", true)
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Publicar" }));
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("v4");
  });

  it("manda a versão vigente da linha como expectedVersion", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", true, [], { revertedToVersion: 2 })
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls(fetchMock, "revertProtocolActivation")).toHaveLength(1));
    expect(bodyOf(calls(fetchMock, "revertProtocolActivation")[0]).variables.expectedVersion).toBe(3);
  });

  // Recusa por divergência: a mensagem do servidor nomeia a versão em uso
  // agora, e é ela que a tela precisa mostrar inteira.
  it("recusa por versão mudada: mostra o estado novo em vez da frase genérica", async () => {
    const user = userEvent.setup();
    route([ v({ status: "active", version: 3, revertible: true, revertTargetVersion: 2 }) ], {
      revertProtocolActivation: () => mutationReply("revertProtocolActivation", false, [
        { path: "expectedVersion", message: "a versão em uso agora é a 5" }
      ])
    });
    renderTab();

    await user.click(await screen.findByRole("button", { name: "Reverter" }));
    await user.type(screen.getByLabelText("Motivo"), "regra errada em produção");
    await user.type(screen.getByLabelText("Código do autenticador"), "654321");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    const erro = await screen.findByText(/a versão em uso agora é a 5/);
    expect(erro.textContent).not.toContain("undefined");
  });
});
