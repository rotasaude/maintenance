import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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

  const drop = useCallback((message: string | null) => {
    queryClient.clear();
    setMe(null);
    setNotice(message);
    setState("signedOut");
  }, [ queryClient ]);

  useEffect(() => {
    let alive = true;
    rest<SessionPayload>("GET", "/session")
      .then((payload) => { if (alive) { setMe(toMe(payload)); setState("signedIn"); } })
      .catch(() => { if (alive) drop(null); });
    return () => { alive = false; };
  }, [ drop ]);

  // Efeito colateral fora do atualizador de setState (a brief avisa contra
  // chamar `drop` dentro de um `setState((current) => ...)`): o ouvinte fecha
  // sobre o `state` corrente por causa do `state` nas deps — o efeito
  // reinscreve a cada troca de estado, então o listener sempre vê o estado
  // atual sem precisar de ref nem de side effect dentro do setter.
  useEffect(() => {
    return onAuthRequired(() => {
      if (state === "signedIn") drop("sessão expirada");
    });
  }, [ state, drop ]);

  const signIn = useCallback((next: Me) => { setNotice(null); setMe(next); setState("signedIn"); }, []);
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
