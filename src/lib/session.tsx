import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { onAuthRequired, rest } from "./api";

// Sessão do mantenedor (spec §5). O cookie é da API; aqui só se sabe SE há
// sessão. Qualquer 401 no meio do uso (30 min parado, 8 h no total) apaga
// o cache inteiro: nada do que estava na tela sobrevive à expiração.
export type Me = { id: string; emailAddress: string; expiresAt: string };
export type SessionPayload = { id: string; email_address: string; expires_at: string };
type State = "loading" | "signedOut" | "signedIn";

type SessionContext = {
  state: State;
  me: Me | null;
  notice: string | null;
  signIn(me: Me): void;
  signOut(): Promise<void>;
};

const Context = createContext<SessionContext | null>(null);

export function toMe(payload: SessionPayload): Me {
  return { id: payload.id, emailAddress: payload.email_address, expiresAt: payload.expires_at };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [ state, setState ] = useState<State>("loading");
  const [ me, setMe ] = useState<Me | null>(null);
  const [ notice, setNotice ] = useState<string | null>(null);

  // Fix round 1: uma assinatura reinscrita a cada troca de `state` (via
  // `state` nas deps do efeito) tem uma janela — efeitos passivos rodam
  // DEPOIS do commit, então um 401 que chega entre `signIn()` comitar
  // `signedIn` e o efeito reinscrever ainda vê a closure velha e é
  // silenciosamente ignorado (sem drop, sem notice: exatamente o invariante
  // que esta tela existe para garantir). A correção: UMA assinatura estável
  // (deps só `[drop]`, nunca `[state, drop]`) e o listener lê o estado de um
  // ref atualizado SINCRONAMENTE em cada transição — no mesmo instante do
  // setState, não durante a renderização — nunca dentro de um atualizador
  // de setState (isso continua proibido, é o problema original da brief).
  const stateRef = useRef<State>("loading");

  const setTrackedState = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const drop = useCallback((message: string | null) => {
    queryClient.clear();
    setMe(null);
    setNotice(message);
    setTrackedState("signedOut");
  }, [ queryClient, setTrackedState ]);

  useEffect(() => {
    let alive = true;
    rest<SessionPayload>("GET", "/session")
      .then((payload) => { if (alive) { setMe(toMe(payload)); setTrackedState("signedIn"); } })
      .catch(() => { if (alive) drop(null); });
    return () => { alive = false; };
  }, [ drop, setTrackedState ]);

  useEffect(() => {
    return onAuthRequired(() => {
      if (stateRef.current === "signedIn") drop("sessão expirada");
    });
  }, [ drop ]);

  const signIn = useCallback((next: Me) => {
    setNotice(null);
    setMe(next);
    setTrackedState("signedIn");
  }, [ setTrackedState ]);
  const signOut = useCallback(async () => {
    try { await rest("DELETE", "/session"); } catch { /* segue mesmo se a rede falhar */ }
    drop(null);
  }, [ drop ]);

  return <Context.Provider value={{ state, me, notice, signIn, signOut }}>{children}</Context.Provider>;
}

export function useSession(): SessionContext {
  const value = useContext(Context);
  if (!value) throw new Error("useSession fora do SessionProvider");
  return value;
}
