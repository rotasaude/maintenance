import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./theme/global.css";
import { App } from "./App";
import { readInvitationToken } from "./lib/invitation";
import { SessionProvider } from "./lib/session";
import { AuthRequired } from "./lib/errors";

// Uma consulta expirada não deve insistir sozinha (spec §5): a sessão já
// caiu, então tentar de novo só demora até o SessionProvider assumir.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof AuthRequired) && count < 1
    }
  }
});

// Fix round 1 (Task 5, ruling P3): lido AQUI, fora de qualquer componente,
// antes de createRoot — de verdade uma única vez. Um
// useState(() => readInvitationToken(...)) dentro de App parecia bastar,
// mas o StrictMode do React 18 chama o inicializador do useState DUAS
// VEZES de propósito em dev, para flagar inicializadores impuros — e o
// nosso é impuro por natureza (limpa a URL como efeito colateral). A
// primeira chamada lê o token e limpa a URL; a segunda já vê a URL limpa e
// devolve null, e não há garantia de que seja o resultado da primeira
// chamada que sobrevive. Um useRef de guarda não resolve: os hooks/refs da
// chamada descartada em StrictMode também são descartados, não sobrevivem
// para a chamada "de verdade". Ler no módulo, antes de qualquer render,
// elimina o problema — o módulo só é avaliado uma vez, StrictMode ou não.
const initialInvitationToken = readInvitationToken(window.location, window.history);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App initialInvitationToken={initialInvitationToken} />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>
);
