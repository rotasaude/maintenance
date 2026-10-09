import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SignaturePlatformPanel } from "./SignaturePlatformPanel";
import { PSC_MOCK_NOTICE, PSC_REAL_NOTICE } from "../lib/signature";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function bodyOf(call: unknown[]): { query: string } {
  return JSON.parse((call[1] as RequestInit).body as string);
}

const PROVIDERS = [
  { key: "vidaas", configured: true, lastCheckAt: "2026-10-08T12:00:00Z", lastCheckOk: true },
  { key: "birdid", configured: true, lastCheckAt: null, lastCheckOk: null },
  { key: "safeid", configured: false, lastCheckAt: null, lastCheckOk: null },
  { key: "pscnovo", configured: true, lastCheckAt: "2026-10-08T11:00:00Z", lastCheckOk: false }
];
const SIGNER = { reachable: true, version: "1.2.0", crlUpdatedAt: "2026-10-08T09:00:00Z" };

function platformReply(providers: unknown[] = PROVIDERS, signer: unknown = SIGNER) {
  return reply(200, { data: { signatureProviders: providers, signerStatus: signer } });
}

function renderPanel(pscMock = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<SignaturePlatformPanel pscMock={pscMock} />, { wrapper });
}

describe("SignaturePlatformPanel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: [ "Date" ] });
    vi.setSystemTime(new Date("2026-10-08T13:00:00Z"));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("lista prestadores e signer sem segredo e sem undefined/null", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply()));
    renderPanel();

    expect(await screen.findByText("VIDaaS (vidaas)")).not.toBeNull();
    expect(screen.getByText("habilitado, última checagem ok")).not.toBeNull();
    expect(screen.getByText("08/10/2026, 09:00")).not.toBeNull();
    expect(screen.getByText("BirdID (birdid)")).not.toBeNull();
    expect(screen.getByText("habilitado, nunca checado")).not.toBeNull();
    expect(screen.getAllByText("nunca")).toHaveLength(2);
    expect(screen.getByText("SafeID (safeid)")).not.toBeNull();
    expect(screen.getByText("sem credencial — não habilitado")).not.toBeNull();
    expect(screen.getByText("pscnovo")).not.toBeNull();

    const signer = screen.getByRole("group", { name: "serviço signer" });
    expect(within(signer).getByText("no ar")).not.toBeNull();
    expect(within(signer).getByText("versão 1.2.0 · LCRs atualizadas em 08/10/2026, 06:00")).not.toBeNull();

    expect(bodyOf(fetchMock.mock.calls[0]).query).toMatch(/query SignaturePlatform/);
    expect(document.body.textContent).not.toMatch(/undefined|null|secret|client_id|base_url|token/i);
  });

  it("signer inalcançável e prestador com checagem falha aparecem em destaque", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply(PROVIDERS, { reachable: false, version: null, crlUpdatedAt: null })));
    renderPanel();
    const signer = await screen.findByRole("group", { name: "serviço signer" });
    expect(within(signer).getByText("inalcançável")).not.toBeNull();
    expect(within(signer).getByText("o api não alcançou o serviço signer — as assinaturas ficam pendentes até ele voltar")).not.toBeNull();
    expect(screen.getByText("habilitado, última checagem falhou")).not.toBeNull();
  });

  it("LCR com mais de 24 h vira aviso", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply(PROVIDERS, { ...SIGNER, crlUpdatedAt: "2026-10-06T09:00:00Z" })));
    renderPanel();
    expect(await screen.findByText("no ar, LCRs com mais de 24 h")).not.toBeNull();
  });

  it("nenhum prestador no catálogo: diz", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply([])));
    renderPanel();
    expect(await screen.findByText("nenhum prestador no catálogo")).not.toBeNull();
  });

  it("api sem o 19b: explica a ordem de deploy", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, {
      errors: [ {
        message: "Field 'signatureProviders' doesn't exist on type 'Query'",
        extensions: { code: "undefinedField", typeName: "Query", fieldName: "signatureProviders" }
      } ]
    })));
    renderPanel();
    expect((await screen.findByRole("alert")).textContent)
      .toMatch(/o api do módulo 19b precisa subir antes do maintenance/);
    expect(screen.getByRole("note", { name: "modo do PSC desta cidade" }).textContent).toBe(PSC_REAL_NOTICE);
  });

  it("atualizar relê", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(() => Promise.resolve(platformReply()));
    renderPanel();
    await screen.findByText("VIDaaS (vidaas)");
    await user.click(screen.getByRole("button", { name: "atualizar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("PSC simulado ligado: aviso em destaque", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply()));
    renderPanel(true);
    expect(screen.getByRole("note", { name: "modo do PSC desta cidade" }).textContent).toBe(PSC_MOCK_NOTICE);
    await screen.findByText("VIDaaS (vidaas)");
  });

  it("desligado: diz que usa os prestadores reais", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(platformReply()));
    renderPanel(false);
    expect(screen.getByRole("note", { name: "modo do PSC desta cidade" }).textContent).toBe(PSC_REAL_NOTICE);
    await screen.findByText("VIDaaS (vidaas)");
    expect(document.body.textContent).not.toMatch(/SIMULADO/);
  });
});
