import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Audit } from "./Audit";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bodyOf(call: unknown[]): { query: string; variables: Record<string, unknown> } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

function auditCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => bodyOf(call).query.includes("query AuditEvents"));
}

function maintainersReply(rows: unknown[] = []) {
  return reply(200, { data: { maintainers: rows } });
}

function auditReply(rows: unknown[]) {
  return reply(200, { data: { auditEvents: rows } });
}

function renderAudit() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<Audit />, { wrapper });
}

const MAINTAINERS = [
  { id: "m1", emailAddress: "eu@rotasaude.app", active: true, enrolled: true, createdAt: "2026-01-01T00:00:00Z" },
  { id: "m2", emailAddress: "outro@rotasaude.app", active: true, enrolled: true, createdAt: "2026-01-01T00:00:00Z" }
];

describe("Audit", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lista quando, evento, módulo, resultado, quem (login ou '—') e o correlationId", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query Maintainers")) return Promise.resolve(maintainersReply(MAINTAINERS));
      if (body.query.includes("query AuditEvents")) {
        return Promise.resolve(auditReply([
          {
            name: "maintenance.maintainer.invited", module: "maintainer", outcome: "ok",
            occurredAt: "2026-01-05T10:00:00Z", maintainerId: "m1", login: "eu@rotasaude.app",
            correlationId: "corr-1"
          },
          {
            name: "maintenance.session.failed", module: "session", outcome: "rejected",
            occurredAt: "2026-01-05T09:00:00Z", maintainerId: null, login: null,
            correlationId: "corr-2"
          }
        ]));
      }
      return Promise.resolve(reply(200, { data: {} }));
    });

    renderAudit();

    expect(await screen.findByText("maintenance.maintainer.invited")).not.toBeNull();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("maintenance.session.failed")).not.toBeNull();
    expect(table.getByText("maintainer")).not.toBeNull();
    expect(table.getByText("session")).not.toBeNull();
    expect(table.getByText("2026-01-05T10:00:00Z")).not.toBeNull();
    expect(table.getByText("eu@rotasaude.app")).not.toBeNull();
    expect(table.getByText("corr-1")).not.toBeNull();
    expect(table.getByText("corr-2")).not.toBeNull();

    // maintainerId nulo → "—" no lugar de quem.
    expect(table.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("filtros (período, módulo, resultado, mantenedor) viram variáveis da consulta; limite padrão 100", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query Maintainers")) return Promise.resolve(maintainersReply(MAINTAINERS));
      if (body.query.includes("query AuditEvents")) return Promise.resolve(auditReply([]));
      return Promise.resolve(reply(200, { data: {} }));
    });

    renderAudit();
    await screen.findByText("outro@rotasaude.app");

    await waitFor(() => expect(auditCalls(fetchMock)).toHaveLength(1));
    expect(auditCalls(fetchMock)[0] && bodyOf(auditCalls(fetchMock)[0]).variables).toEqual({
      since: undefined, until: undefined, module: undefined, outcome: undefined, maintainerId: undefined, limit: 100
    });

    // Campos de texto/data só viram variável da consulta ao perder o foco
    // (não a cada tecla) — daí o clique fora, no fim, para "confirmar" o
    // último campo digitado sem precisar de um botão "filtrar".
    await user.type(screen.getByLabelText("Desde"), "2026-01-01");
    await user.type(screen.getByLabelText("Até"), "2026-01-31");
    await user.type(screen.getByLabelText("Módulo"), "maintainer");
    await user.selectOptions(screen.getByLabelText("Resultado"), "ok");
    await user.selectOptions(screen.getByLabelText("Mantenedor"), "m2");
    await user.click(document.body);

    await waitFor(() => {
      const last = auditCalls(fetchMock).at(-1);
      expect(last && bodyOf(last).variables).toEqual({
        since: "2026-01-01T00:00:00.000Z",
        until: "2026-01-31T23:59:59.999Z",
        module: "maintainer",
        outcome: "ok",
        maintainerId: "m2",
        limit: 100
      });
    });
  });

  it("eventos com o mesmo correlationId ficam agrupados lado a lado", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query Maintainers")) return Promise.resolve(maintainersReply(MAINTAINERS));
      if (body.query.includes("query AuditEvents")) {
        // A API devolve em ordem intercalada de propósito: o agrupamento é
        // responsabilidade da tela, não uma coincidência da ordenação.
        return Promise.resolve(auditReply([
          { name: "a.attempted", module: "maintainer", outcome: "attempted", occurredAt: "2026-01-05T10:00:01Z", maintainerId: "m1", login: "eu@rotasaude.app", correlationId: "corr-A" },
          { name: "b.attempted", module: "maintainer", outcome: "attempted", occurredAt: "2026-01-05T10:00:02Z", maintainerId: "m1", login: "eu@rotasaude.app", correlationId: "corr-B" },
          { name: "a.ok", module: "maintainer", outcome: "ok", occurredAt: "2026-01-05T10:00:03Z", maintainerId: "m1", login: "eu@rotasaude.app", correlationId: "corr-A" },
          { name: "b.ok", module: "maintainer", outcome: "ok", occurredAt: "2026-01-05T10:00:04Z", maintainerId: "m1", login: "eu@rotasaude.app", correlationId: "corr-B" }
        ]));
      }
      return Promise.resolve(reply(200, { data: {} }));
    });

    renderAudit();
    await screen.findByText("a.attempted");

    const rows = screen.getAllByRole("row").slice(1); // pula o cabeçalho
    const names = rows.map((row) => row.textContent ?? "");

    const indexA1 = names.findIndex((t) => t.includes("a.attempted"));
    const indexA2 = names.findIndex((t) => t.includes("a.ok"));
    const indexB1 = names.findIndex((t) => t.includes("b.attempted"));
    const indexB2 = names.findIndex((t) => t.includes("b.ok"));

    expect(Math.abs(indexA1 - indexA2)).toBe(1);
    expect(Math.abs(indexB1 - indexB2)).toBe(1);

    const groupAttr = (index: number) => rows[index].getAttribute("data-correlation-id");
    expect(groupAttr(indexA1)).toBe("corr-A");
    expect(groupAttr(indexA1)).toBe(groupAttr(indexA2));
    expect(groupAttr(indexB1)).toBe("corr-B");
    expect(groupAttr(indexB1)).toBe(groupAttr(indexB2));
  });

  it("é só leitura: nenhum botão de ação", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query Maintainers")) return Promise.resolve(maintainersReply(MAINTAINERS));
      if (body.query.includes("query AuditEvents")) {
        return Promise.resolve(auditReply([
          { name: "maintenance.maintainer.invited", module: "maintainer", outcome: "ok", occurredAt: "2026-01-05T10:00:00Z", maintainerId: "m1", login: "eu@rotasaude.app", correlationId: "corr-1" }
        ]));
      }
      return Promise.resolve(reply(200, { data: {} }));
    });

    renderAudit();
    await screen.findByText("maintenance.maintainer.invited");

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // I3: um 500 na consulta de auditoria não pode devolver o código cru
  // (http_500) — a tela só mostra `.message`, e ele tem de ser genérico.
  it("erro 500 na consulta de auditoria nunca mostra o código cru na tela", async () => {
    fetchMock.mockImplementation((_url, init) => {
      const body = bodyOf([ _url, init ]);
      if (body.query.includes("query Maintainers")) return Promise.resolve(maintainersReply(MAINTAINERS));
      if (body.query.includes("query AuditEvents")) return Promise.resolve(reply(500, {}));
      return Promise.resolve(reply(200, { data: {} }));
    });

    renderAudit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toContain("http_");
    expect(document.body.textContent).not.toContain("http_500");
  });
});
