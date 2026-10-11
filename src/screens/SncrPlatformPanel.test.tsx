import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SncrPlatformPanel } from "./SncrPlatformPanel";
import { SNCR_MOCK_NOTICE, SNCR_REAL_NOTICE } from "../lib/sncr";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bodyOf(call: unknown[]): { query: string } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

const STATUS = { configured: true, reachable: true, lastCheckAt: "2026-10-10T12:00:00Z", simulatedAvailable: true };

function statusReply(status: unknown = STATUS) {
  return reply(200, { data: { sncrStatus: status } });
}

function renderPanel(sncrMock = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<SncrPlatformPanel sncrMock={sncrMock} />, { wrapper });
}

describe("SncrPlatformPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("lista o estado sem segredo e sem undefined/null", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(statusReply()));
    renderPanel();

    const group = await screen.findByRole("group", { name: "estado do SNCR" });
    expect(within(group).getByText("configurado e alcançável")).not.toBeNull();
    expect(within(group).getByText("última checagem: 10/10/2026, 09:00")).not.toBeNull();
    expect(within(group).getByText("os profissionais obtêm números em Conta → SNCR, pelo gov.br de cada um")).not.toBeNull();
    expect(within(group).getByText("SNCR simulado disponível neste ambiente (fora de produção)")).not.toBeNull();

    expect(bodyOf(fetchMock.mock.calls[0]).query).toMatch(/query SncrPlatform/);
    expect(bodyOf(fetchMock.mock.calls[0]).query).not.toMatch(/secret|client_?id|cnpj|token|base_?url|auth_?url/i);
    expect(document.body.textContent).not.toMatch(/undefined|null|secret|client_id|base_url|auth_url|cnpj|token/i);
  });

  it("SNCR configurado e inalcançável aparece em destaque", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(statusReply({ ...STATUS, reachable: false })));
    renderPanel();
    const group = await screen.findByRole("group", { name: "estado do SNCR" });
    expect(within(group).getByText("configurado, inalcançável na última checagem")).not.toBeNull();
    expect(within(group).getByText(/o api não alcançou o SNCR/)).not.toBeNull();
  });

  it("sem credencial e nunca checado: diz 'nunca', sem null", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(statusReply({ configured: false, reachable: false, lastCheckAt: null, simulatedAvailable: false })));
    renderPanel();
    const group = await screen.findByRole("group", { name: "estado do SNCR" });
    expect(within(group).getByText("sem credencial — SNCR real não configurado")).not.toBeNull();
    expect(within(group).getByText("última checagem: nunca")).not.toBeNull();
    expect(within(group).getByText("SNCR simulado indisponível neste ambiente (produção)")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|null/);
  });

  it("api sem o 19d: explica a ordem de deploy", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      errors: [ {
        message: "Field 'sncrStatus' doesn't exist on type 'Query'",
        extensions: { code: "undefinedField", typeName: "Query", fieldName: "sncrStatus" }
      } ]
    })));
    renderPanel();
    expect((await screen.findByRole("alert")).textContent).toMatch(/o api do módulo 19d precisa subir antes do maintenance/);
    expect(screen.getByRole("note", { name: "modo do SNCR desta cidade" }).textContent).toBe(SNCR_REAL_NOTICE);
  });

  it("atualizar relê", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(statusReply()));
    renderPanel();
    await screen.findByRole("group", { name: "estado do SNCR" });
    await user.click(screen.getByRole("button", { name: "atualizar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("SNCR simulado ligado: aviso em destaque, mesmo enquanto carrega", async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    renderPanel(true);
    expect(screen.getByRole("note", { name: "modo do SNCR desta cidade" }).textContent).toBe(SNCR_MOCK_NOTICE);
  });

  it("desligado: diz que usa o SNCR real", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(statusReply()));
    renderPanel(false);
    expect(screen.getByRole("note", { name: "modo do SNCR desta cidade" }).textContent).toBe(SNCR_REAL_NOTICE);
    await screen.findByRole("group", { name: "estado do SNCR" });
    expect(document.body.textContent).not.toMatch(/SIMULADO/);
  });
});
