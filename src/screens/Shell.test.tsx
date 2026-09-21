import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider } from "../lib/session";
import { Shell } from "./Shell";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  }
  return render(<Shell />, { wrapper });
}

describe("Shell", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("mostra o e-mail do mantenedor, a navegação com as quatro telas e 'sair' encerra a sessão", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      const path = String(url);
      if (path === "/graphql") return Promise.resolve(reply(200, { data: { cities: [] } }));
      if (path === "/session") return Promise.resolve(reply(200, { id: "m1", email_address: "mantenedor@rotasaude.app", expires_at: "2026-01-01T01:00:00Z" }));
      return Promise.resolve(reply(204, undefined));
    });

    renderShell();

    expect(await screen.findByText("mantenedor@rotasaude.app")).not.toBeNull();
    for (const label of [ "Cidades", "Mantenedores", "Tokens", "Auditoria" ]) {
      expect(screen.getByRole("button", { name: label })).not.toBeNull();
    }
    expect(screen.getByRole("button", { name: "Cidades" }).getAttribute("aria-current")).toBe("page");

    await user.click(screen.getByRole("button", { name: "sair" }));

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(([ , init ]) => (init as RequestInit | undefined)?.method === "DELETE");
      expect(deleteCall).not.toBeUndefined();
    });
  });

  it("abrir uma cidade e voltar preserva a tela Cidades", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/session") return Promise.resolve(reply(200, { id: "m1", email_address: "mantenedor@rotasaude.app", expires_at: "2026-01-01T01:00:00Z" }));
      if (path === "/graphql") {
        const body = JSON.parse((init as RequestInit).body as string);
        if (String(body.query).includes("query CityHeader")) {
          return Promise.resolve(
            reply(200, { data: { city: { slug: "sp", name: "São Paulo", uf: "SP", status: "ACTIVE", schemaVersion: "1", schemaBehind: false, createdAt: "2026-01-01T00:00:00Z", channel: null } } })
          );
        }
        return Promise.resolve(
          reply(200, { data: { cities: [ { slug: "sp", name: "São Paulo", uf: "SP", status: "ACTIVE", schemaVersion: "1", schemaBehind: false, createdAt: "2026-01-01T00:00:00Z" } ] } })
        );
      }
      return Promise.resolve(reply(204, undefined));
    });

    renderShell();
    await screen.findByText("mantenedor@rotasaude.app");

    await user.click(await screen.findByText("São Paulo"));
    expect(await screen.findByRole("button", { name: "voltar" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "voltar" }));

    expect(await screen.findByText("São Paulo")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cidades" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "voltar" })).toBeNull();
  });
});
