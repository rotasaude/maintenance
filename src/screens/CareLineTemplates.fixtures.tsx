// src/screens/CareLineTemplates.fixtures.tsx
// Dados e harness comuns aos testes do catálogo-base de linhas (módulo 23).
// Arquivo sem testes: os dois arquivos de teste importam daqui (importar um
// arquivo .test registraria os testes dele duas vezes). Elegibilidade e boas
// práticas em JSON snake_case (L1, L2 do plano do api).
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CareLineTemplates } from "./CareLineTemplates";

export function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const MD_NURSE = [ "2231", "2251", "2252", "2253", "2235" ];
export const ELIG = { problems: { ciap2: [ "T89", "T90" ], cid10: [ "E10", "E11", "E14" ] }, declared: [ "diabetes" ], requires_anchor: null };
export const C4_A = { key: "c4_a", label: "Consulta de médico ou enfermeiro em 6 meses", citizen_label: "Consulta com a equipe", source: "consultation",
  anchor: "rolling", window_days: 183, min_count: 1, schedule: "end_of_window", cbo_filter: MD_NURSE, points: 85 };
export const C4_E = { key: "c4_e", label: "Hemoglobina glicada em 12 meses", citizen_label: "Exame de hemoglobina glicada", source: "exam:0202010503",
  anchor: "rolling", window_days: 365, min_count: 1, schedule: "end_of_window", cbo_filter: null, points: 15 };
// createdBy: nulo na carga inicial do YAML (v1); o e-mail de quem gravou nas versões publicadas pela tela.
export const C4_V1 = { key: "diabetes_c4", version: 1, current: false, name: "Pessoa com diabetes", indicator: "C4", declaredCondition: "diabetes",
  eligibility: ELIG, practices: [ { ...C4_A, points: 100 } ], createdAt: "2026-01-10T12:00:00Z", createdBy: null };
export const C4_V2 = { ...C4_V1, version: 2, current: true, practices: [ C4_A, C4_E ], createdAt: "2026-10-20T13:00:00Z", createdBy: "mantenedor@rotasaude.app" };
export const C3_V1 = { key: "pregnancy_c3", version: 1, current: true, name: "Gestante e puérpera", indicator: "C3", declaredCondition: "pregnancy",
  eligibility: { problems: { ciap2: [ "W78" ], cid10: [ "Z34" ] }, exclude_problems: { ciap2: [ "W82" ] }, declared: [ "pregnancy" ], requires_anchor: "lmp" },
  practices: [ { key: "c3_g", label: "Testes do 1º trimestre", source: "procedure:0214010074", anchor: "lmp", window_days: 97, min_count: 1,
    schedule: "end_of_window", cbo_filter: null, points: 100,
    all_of: [ [ { source: "procedure:0214010074" } ], [ { source: "procedure:0214010040" } ] ] } ],
  createdAt: "2026-01-10T12:00:00Z", createdBy: null };

// Formas REAIS do catalog-base.yml (D-01): sem `problems`, só idade; C7 com sexo e identidades, exclusão só de CIAP.
export const C2_V1 = { key: "child_c2", version: 1, current: true, name: "Cuidado da criança até 2 anos", indicator: "C2", declaredCondition: null,
  eligibility: { age_max_days: 730 },
  practices: [ { key: "c2_a", label: "Consulta no primeiro mês", source: "consultation", anchor: "birth", window_days: 30, min_count: 1,
    schedule: "end_of_window", cbo_filter: null, points: 100 } ],
  createdAt: "2026-01-10T12:00:00Z", createdBy: null };
export const C6_V1 = { key: "elderly_c6", version: 1, current: true, name: "Pessoa idosa", indicator: "C6", declaredCondition: null,
  eligibility: { age_min_years: 60 },
  practices: [ { key: "c6_a", label: "Consulta em 12 meses", source: "consultation", anchor: "rolling", window_days: 365, min_count: 1,
    schedule: "end_of_window", cbo_filter: null, points: 100 } ],
  createdAt: "2026-01-10T12:00:00Z", createdBy: null };
export const C7_V1 = { key: "women_c7", version: 1, current: true, name: "Mulher e prevenção do câncer", indicator: "C7", declaredCondition: null,
  eligibility: { age_min_years: 25, age_max_years: 64, sex: "female", gender_identities_included: [ "trans_man" ],
    exclude_problems: { ciap2: [ "X37" ] } },
  practices: [ { key: "c7_a", label: "Citopatológico em 3 anos", source: "exam:0203010019", anchor: "rolling", window_days: 1095, min_count: 1,
    schedule: "end_of_window", cbo_filter: null, points: 100 } ],
  createdAt: "2026-01-10T12:00:00Z", createdBy: null };

export function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<CareLineTemplates />, { wrapper });
}
