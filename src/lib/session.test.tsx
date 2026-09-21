import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SessionProvider, useSession } from "./session";
import { rest } from "./api";

// `globals: false` em vitest.config.ts: sem afterEach global, o cleanup
// automático do Testing Library não roda sozinho entre os testes.
afterEach(cleanup);

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("SessionProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    queryClient = new QueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  }

  it("GET /session 200 vai para signedIn com me convertido de snake_case para camelCase", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { id: "m1", email_address: "a@b.com", expires_at: "2026-01-01T00:00:00Z" })
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    expect(result.current.state).toBe("loading");
    await waitFor(() => expect(result.current.state).toBe("signedIn"));
    expect(result.current.me).toEqual({ id: "m1", emailAddress: "a@b.com", expiresAt: "2026-01-01T00:00:00Z" });
    expect(result.current.notice).toBeNull();
  });

  it("GET /session 401 vai para signedOut sem notice — abrir deslogado não é sessão expirada", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { error: "unauthenticated" }));

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.state).toBe("signedOut"));
    expect(result.current.notice).toBeNull();
    expect(result.current.me).toBeNull();
  });

  it("um AuthRequired disparado depois de signedIn esvazia o cache e mostra a notice", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { id: "m1", email_address: "a@b.com", expires_at: "2026-01-01T00:00:00Z" })
    );

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("signedIn"));

    queryClient.setQueryData([ "seed" ], { ok: true });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1);

    fetchMock.mockResolvedValueOnce(reply(401, { error: "unauthenticated" }));
    await act(async () => {
      await rest("GET", "/some-query").catch(() => {});
    });

    await waitFor(() => expect(result.current.state).toBe("signedOut"));
    expect(result.current.notice).toBe("sessão expirada");
    expect(result.current.me).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("signOut() chama DELETE /session, esvazia o cache e vai para signedOut mesmo se a rede falhar", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { id: "m1", email_address: "a@b.com", expires_at: "2026-01-01T00:00:00Z" })
    );

    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe("signedIn"));

    queryClient.setQueryData([ "seed" ], { ok: true });

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => {
      await result.current.signOut();
    });

    const lastCall = fetchMock.mock.calls.at(-1)!;
    expect(String(lastCall[0])).toBe("/session");
    expect((lastCall[1] as RequestInit).method).toBe("DELETE");

    expect(result.current.state).toBe("signedOut");
    expect(result.current.notice).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
