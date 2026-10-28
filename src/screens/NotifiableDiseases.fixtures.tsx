// src/screens/NotifiableDiseases.fixtures.tsx
// Dados e harness comuns aos testes da lista nacional de doenças de notificação
// (módulo 25). Arquivo sem testes: os arquivos de teste importam daqui
// (importar um .test registraria os testes dele duas vezes). As formas são as
// que o api devolve (sem `__typename`), as mesmas dos testes de regras.
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NotifiableDiseases } from "./NotifiableDiseases";
import type { DiseaseView, ListView } from "../lib/notifiableDiseases";

export function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const DENGUE: DiseaseView = { code: "dengue", name: "Dengue", deadline: "weekly", cid10: [ "A90", "A91" ], ciap2: [], repeatAfterDays: 30,
  sinanForm: "dengue", notes: "óbito por dengue: imediata, notificar à mão",
  sources: { deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de dengue", repeat_after_days: "proposta do plano 25" } };
export const MEASLES: DiseaseView = { code: "sarampo", name: "Sarampo", deadline: "immediate", cid10: [ "B059" ], ciap2: [ "A71" ], repeatAfterDays: 30,
  sinanForm: null, notes: null, sources: { deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de sarampo" } };
export const V1: ListView = { version: 1, ordinance: "Portaria GM/MS nº 11.211/2026", effectiveFrom: "2026-03-01", current: false,
  createdAt: "2026-10-27T12:00:00Z", publishedBy: null, notes: null, sources: { ordinance: "Portaria GM/MS nº 11.211/2026" }, diseases: [ DENGUE ] };
export const V2: ListView = { ...V1, version: 2, effectiveFrom: "2026-10-01", current: true, publishedBy: "mantenedor@rotasaude.app", notes: "inclui sarampo",
  sources: null, diseases: [ DENGUE, MEASLES ] };
export const V3: ListView = { ...V2, version: 3, effectiveFrom: "2026-12-01", current: false };

export function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<NotifiableDiseases />, { wrapper });
}
