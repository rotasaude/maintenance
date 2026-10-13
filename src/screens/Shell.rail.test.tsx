import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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

describe("Shell: topo e trilho", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const path = String(url);
      if (path === "/graphql") return Promise.resolve(reply(200, { data: { cities: [] } }));
      if (path === "/session") return Promise.resolve(reply(200, { id: "m1", email_address: "mantenedor@rotasaude.app", expires_at: "2026-01-01T01:00:00Z" }));
      return Promise.resolve(reply(204, undefined));
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("trilho 'Telas' com os 5 botões de nome exato, ícone escondido, Cidades ativo", async () => {
    renderShell();
    const rail = await screen.findByRole("navigation", { name: "Telas" });
    for (const label of [ "Cidades", "Medicamentos", "Mantenedores", "Tokens", "Auditoria" ]) {
      const b = within(rail).getByRole("button", { name: label });
      expect(b.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
    expect(within(rail).getByRole("button", { name: "Cidades" }).getAttribute("aria-current")).toBe("page");
  });

  it("topo: marca, selo Manutenção (sem role status), e-mail e sair dentro do header", async () => {
    renderShell();
    const header = (await screen.findByText("mantenedor@rotasaude.app")).closest("header")!;
    expect(header).not.toBeNull();
    expect(within(header).getByText("Manutenção").closest('[role="status"]')).toBeNull();
    expect(within(header).getByText("Rota Saúde")).toBeTruthy();
    expect(within(header).getByRole("button", { name: "sair" })).toBeTruthy();
  });

  it("A-27: 'sair' tem estilo secundário (contraste de forma sobre o topo escuro)", async () => {
    renderShell();
    const out = await screen.findByRole("button", { name: "sair" });
    expect(out.style.background).toBe("var(--panel)");
  });
});

