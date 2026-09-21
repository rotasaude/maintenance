import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./theme/global.css";
import { App } from "./App";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>
);
