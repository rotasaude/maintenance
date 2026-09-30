import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AnalyticsTab } from "./AnalyticsTab";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}
function calls(fetchMock: ReturnType<typeof vi.fn>, operation: string) {
  return fetchMock.mock.calls.filter((call) => bodyOf(call).query.includes(`query ${operation}`));
}

type Status = {
  lastRunStatus: string | null; lastSucceededAt: string | null; lastPublishedAt: string | null;
  lastError: string | null; stale: boolean;
};
const FRESH: Status = {
  lastRunStatus: "succeeded", lastSucceededAt: "2026-10-04T05:02:11Z",
  lastPublishedAt: "2026-10-04T05:03:00Z", lastError: null, stale: false
};
const ROWS = [
  { weekStart: "2026-09-21", indicator: "triages_started", value: 128, suppressed: false },
  { weekStart: "2026-09-21", indicator: "triages_completed", value: null, suppressed: true },
  { weekStart: "2026-09-21", indicator: "no_show_pct", value: 12.5, suppressed: false },
  { weekStart: "2026-09-21", indicator: "left_pct", value: 0, suppressed: false },
  { weekStart: "2026-09-14", indicator: "triages_started", value: 0, suppressed: false }
];

function statusReply(s: Status) {
  return reply(200, { data: { city: { slug: "sp", analyticsStatus: s } } });
}
function indicatorsReply(rows: unknown[]) {
  return reply(200, { data: { city: { slug: "sp", analyticsIndicators: rows } } });
}
// Resposta da validação do graphql-ruby para campo que o schema não tem:
// `errors` sem `data` — é o que um api antigo devolve.
function undefinedFieldReply(field: string) {
  return reply(200, {
    errors: [ {
      message: `Field '${field}' doesn't exist on type 'City'`,
      extensions: { code: "undefinedField", typeName: "City", fieldName: field }
    } ]
  });
}

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<AnalyticsTab slug="sp" />, { wrapper });
}

describe("AnalyticsTab", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Domingo 04/10/2026, 23h30 em São Paulo — já segunda em UTC.
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date("2026-10-05T02:30:00Z"));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function route(status: () => Response, indicators: () => Response) {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = bodyOf([ url, init ]);
      if (body.query.includes("query CityAnalyticsStatus")) return Promise.resolve(status());
      if (body.query.includes("query CityAnalyticsIndicators")) return Promise.resolve(indicators());
      return Promise.resolve(reply(500, {}));
    });
  }

  it("mostra execução com falha, o último erro e o atraso em destaque", async () => {
    route(
      () => statusReply({
        lastRunStatus: "failed", lastSucceededAt: "2026-09-28T05:02:11Z", lastPublishedAt: "2026-09-28T05:03:00Z",
        lastError: "PG::ConnectionBad: could not connect", stale: true
      }),
      () => indicatorsReply(ROWS)
    );
    renderTab();

    expect(await screen.findByText("falhou")).not.toBeNull();
    expect(screen.getByText("dados desatualizados")).not.toBeNull();
    expect(screen.getByText("Último erro")).not.toBeNull();
    expect(screen.getByText("PG::ConnectionBad: could not connect")).not.toBeNull();
    expect(screen.getByText("28/09/2026, 02:02")).not.toBeNull();
    expect(screen.getByText("28/09/2026, 02:03")).not.toBeNull();
  });

  it("nunca rodou: sem null nem undefined na tela", async () => {
    route(
      () => statusReply({ lastRunStatus: null, lastSucceededAt: null, lastPublishedAt: null, lastError: null, stale: true }),
      () => indicatorsReply([])
    );
    renderTab();

    expect(await screen.findByText("nunca rodou")).not.toBeNull();
    expect(screen.getByText("nunca publicado")).not.toBeNull();
    expect(screen.getByText("dados desatualizados")).not.toBeNull();
    expect(await screen.findByText("nenhum indicador publicado nas últimas 12 semanas")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });

  it("execução recente: sem destaque de atraso nem erro", async () => {
    route(() => statusReply(FRESH), () => indicatorsReply(ROWS));
    renderTab();

    expect(await screen.findByText("concluída")).not.toBeNull();
    expect(screen.queryByText("dados desatualizados")).toBeNull();
    expect(screen.queryByText("Último erro")).toBeNull();
  });

  it("consolidou mas não publicou: o erro de publicação aparece", async () => {
    route(
      () => statusReply({ ...FRESH, lastPublishedAt: null, lastError: "Analytics::Publish: PG::Error" }),
      () => indicatorsReply(ROWS)
    );
    renderTab();

    expect(await screen.findByText("Analytics::Publish: PG::Error")).not.toBeNull();
    expect(screen.getByText("nunca publicado")).not.toBeNull();
  });

  it("pede as 12 semanas encerradas no domingo passado, no dia da cidade", async () => {
    route(() => statusReply(FRESH), () => indicatorsReply(ROWS));
    renderTab();

    await waitFor(() => expect(calls(fetchMock, "CityAnalyticsIndicators")).toHaveLength(1));
    const { variables } = bodyOf(calls(fetchMock, "CityAnalyticsIndicators")[0]);
    expect(variables).toEqual({ slug: "sp", from: "2026-07-06", to: "2026-09-27" });
    expect(await screen.findByText("Indicadores publicados — 06/07/2026 a 27/09/2026")).not.toBeNull();
  });

  it("células: valor, oculto, sem dado e 0,0%", async () => {
    route(() => statusReply(FRESH), () => indicatorsReply(ROWS));
    renderTab();

    expect(await screen.findByText("128")).not.toBeNull();
    expect(screen.getAllByText("oculto")).toHaveLength(1);
    expect(screen.getByText("12,5%")).not.toBeNull();
    expect(screen.getByText("0,0%")).not.toBeNull();
    expect(screen.getByText("0")).not.toBeNull();
    // 12 semanas × 6 indicadores = 72 células; 5 têm linha.
    expect(screen.getAllByText("sem dado")).toHaveLength(67);
    // Semana mais recente primeiro.
    const text = document.body.textContent ?? "";
    expect(text.indexOf("21/09/2026")).toBeLessThan(text.indexOf("14/09/2026"));
    expect(text).not.toContain("05/10/2026");
  });

  it("cidade inalcançável: o estado falha sozinho e os indicadores continuam", async () => {
    route(
      () => reply(200, {
        data: { city: null },
        errors: [ { message: "banco da cidade inacessível", path: [ "city", "analyticsStatus" ], extensions: { code: "CITY_UNREACHABLE" } } ]
      }),
      () => indicatorsReply(ROWS)
    );
    renderTab();

    expect((await screen.findByRole("alert")).textContent).toBe("CITY_UNREACHABLE — banco da cidade inacessível");
    expect(await screen.findByText("128")).not.toBeNull();
  });

  it("api antiga sem os campos: a aba explica, sem derrubar", async () => {
    route(() => undefinedFieldReply("analyticsStatus"), () => undefinedFieldReply("analyticsIndicators"));
    renderTab();

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    for (const alert of screen.getAllByRole("alert")) {
      expect(alert.textContent).toMatch(/o api do módulo 14 precisa subir antes do maintenance/);
    }
  });

  it("atualizar busca as duas consultas de novo", async () => {
    const user = userEvent.setup();
    route(() => statusReply(FRESH), () => indicatorsReply(ROWS));
    renderTab();

    await screen.findByText("128");
    await user.click(screen.getByRole("button", { name: "atualizar" }));

    await waitFor(() => expect(calls(fetchMock, "CityAnalyticsStatus")).toHaveLength(2));
    await waitFor(() => expect(calls(fetchMock, "CityAnalyticsIndicators")).toHaveLength(2));
  });

  it("cidade inalcançável (campo anulável): o estado falha sozinho e os indicadores continuam", async () => {
    route(
      () => reply(200, {
        data: { city: { slug: "sp", analyticsStatus: null } },
        errors: [ { message: "banco da cidade inacessível", path: [ "city", "analyticsStatus" ], extensions: { code: "CITY_UNREACHABLE" } } ]
      }),
      () => indicatorsReply(ROWS)
    );
    renderTab();

    expect((await screen.findByRole("alert")).textContent).toBe("CITY_UNREACHABLE — banco da cidade inacessível");
    expect(await screen.findByText("128")).not.toBeNull();
    expect(screen.queryByText("estado do pipeline indisponível")).toBeNull();
  });

  it("estado nulo sem erro: mostra indisponível", async () => {
    route(
      () => reply(200, { data: { city: { slug: "sp", analyticsStatus: null } } }),
      () => indicatorsReply(ROWS)
    );
    renderTab();

    expect(await screen.findByText("estado do pipeline indisponível")).not.toBeNull();
    await screen.findByText("128");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.textContent).not.toMatch(/null|undefined/);
  });
});
