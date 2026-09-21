import { describe, expect, it, vi } from "vitest";
import { readInvitationToken } from "./invitation";

// O fragmento do link de convite (/invitations#<token>) nunca vai ao
// servidor, mas fica no histórico do navegador — por isso é lido UMA vez e a
// URL é limpa na hora (spec §5, brief da Task 5).
function location(pathname: string, hash: string): Location {
  return { pathname, hash } as unknown as Location;
}

function history(): { replaceState: ReturnType<typeof vi.fn> } & History {
  return { replaceState: vi.fn() } as unknown as { replaceState: ReturnType<typeof vi.fn> } & History;
}

describe("readInvitationToken", () => {
  it("em /invitations com fragmento, devolve o token e limpa a URL", () => {
    const hist = history();
    const token = readInvitationToken(location("/invitations", "#abc"), hist);

    expect(token).toBe("abc");
    expect(hist.replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("em /invitations sem fragmento, devolve null e não mexe na URL", () => {
    const hist = history();
    const token = readInvitationToken(location("/invitations", ""), hist);

    expect(token).toBeNull();
    expect(hist.replaceState).not.toHaveBeenCalled();
  });

  it("em / com fragmento, devolve null — o fragmento só é convite em /invitations", () => {
    const hist = history();
    const token = readInvitationToken(location("/", "#abc"), hist);

    expect(token).toBeNull();
    expect(hist.replaceState).not.toHaveBeenCalled();
  });

  it("decodifica caracteres codificados no token", () => {
    const hist = history();
    const token = readInvitationToken(location("/invitations", "#tok%20com%2Fbarra"), hist);

    expect(token).toBe("tok com/barra");
  });
});
