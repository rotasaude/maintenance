import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Cities } from "./Cities";

afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderCities(onOpen: (slug: string) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<Cities onOpen={onOpen} />, { wrapper });
}

describe("Cities", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let onOpen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    onOpen = vi.fn();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("lista as cidades do catálogo, com o selo de schema atrasado, e reconsulta com o filtro de status", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      reply(200, {
        data: {
          cities: [
            { slug: "sp", name: "São Paulo", uf: "SP", status: "ACTIVE", schemaVersion: "12", schemaBehind: true, createdAt: "2026-01-01T00:00:00Z" },
            { slug: "rio", name: "Rio de Janeiro", uf: "RJ", status: "PROVISIONING", schemaVersion: null, schemaBehind: false, createdAt: "2026-01-02T00:00:00Z" }
          ]
        }
      })
    );

    renderCities(onOpen);

    expect(await screen.findByText("São Paulo")).not.toBeNull();
    expect(screen.getByText("Rio de Janeiro")).not.toBeNull();
    expect(screen.getByText("schema atrasado")).not.toBeNull();

    const [ , firstInit ] = fetchMock.mock.calls[0];
    expect(JSON.parse((firstInit as RequestInit).body as string).variables).toEqual({});

    fetchMock.mockResolvedValueOnce(
      reply(200, {
        data: {
          cities: [
            { slug: "sp", name: "São Paulo", uf: "SP", status: "ACTIVE", schemaVersion: "12", schemaBehind: true, createdAt: "2026-01-01T00:00:00Z" }
          ]
        }
      })
    );

    await user.selectOptions(screen.getByLabelText("Status"), "ACTIVE");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [ , secondInit ] = fetchMock.mock.calls[1];
    expect(JSON.parse((secondInit as RequestInit).body as string).variables).toEqual({ status: "ACTIVE" });

    await user.click(screen.getByText("São Paulo"));
    expect(onOpen).toHaveBeenCalledWith("sp");
  });

  it("catálogo vazio mostra 'nenhuma cidade'", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { data: { cities: [] } }));

    renderCities(onOpen);

    expect(await screen.findByText("nenhuma cidade")).not.toBeNull();
  });

  it("erro de rede mostra 'sem conexão com a API'", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderCities(onOpen);

    expect((await screen.findByRole("alert")).textContent).toBe("sem conexão com a API");
  });
});
