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

// C3 completo do catalog-base.yml: início de janela, filtro por código, grupos de alternativas (all_of) e applies_to.
// O applies_to é o único acréscimo ao YAML (é a forma válida do api, usada no C7), para o teste de ida e volta cobrir os quatro avançados.
const SYPHILIS = [ { source: "procedure:0214010074" }, { source: "exam:0202031098" } ];
const HIV = [ { source: "procedure:0214010040" }, { source: "exam:0213010780" } ];
const C3_P = (key: string, label: string, source: string, window_days: number, min_count: number, schedule: string, points: number, extra: object = {}) =>
  ({ key, label, source, anchor: "lmp", window_days, min_count, schedule, points, ...extra });
export const C3_FULL_PRACTICES = [
  C3_P("c3_a", "1ª consulta de pré-natal", "consultation", 84, 1, "end_of_window", 10, { cbo_filter: MD_NURSE }),
  C3_P("c3_b", "7 consultas de pré-natal", "consultation", 294, 7, "proportional", 9, { cbo_filter: MD_NURSE }),
  C3_P("c3_c", "7 aferições de pressão", "blood_pressure", 294, 7, "proportional", 9),
  C3_P("c3_d", "7 registros de peso e altura", "weight_height", 294, 7, "proportional", 9),
  C3_P("c3_e", "3 visitas do ACS", "acs_visit", 294, 3, "end_of_window", 9),
  C3_P("c3_f", "Vacina dTpa", "vaccine:57", 294, 1, "end_of_window", 9, { window_start_days: 140 }),
  C3_P("c3_g", "Testes do 1º trimestre", "procedure:0214010074", 97, 1, "end_of_window", 9, { all_of: [ SYPHILIS, HIV ] }),
  C3_P("c3_h", "Testes do 3º trimestre", "procedure:0214010074", 294, 1, "end_of_window", 9, {
    window_start_days: 196, all_of: [ SYPHILIS, HIV ], applies_to: { age_min_years: 10, age_max_years: 60 } }),
  C3_P("c3_i", "Consulta no puerpério", "consultation", 336, 1, "end_of_window", 9, {
    window_start_days: 154, cbo_filter: MD_NURSE, code_filter: { ciap2: [ "P29", "W18" ], cid10: [ "F53", "O85" ] },
    all_of: [ [ { source: "consultation" }, { source: "procedure:0301010129" } ] ] }),
  C3_P("c3_j", "Visita do ACS no puerpério", "acs_visit", 336, 1, "end_of_window", 9, { window_start_days: 294 }),
  C3_P("c3_k", "Saúde bucal na gestação", "oral_health", 294, 1, "end_of_window", 9)
];
export const C3_FULL_ELIGIBILITY = {
  problems: { ciap2: [ "W03", "W78", "W79" ], cid10: [ "O10", "O752", "Z321", "Z640" ] },
  exclude_problems: { ciap2: [ "W82", "W83" ], cid10: [ "O02", "Z303" ] }, declared: [ "pregnancy" ], requires_anchor: "lmp"
};
export const C3_FULL_V1 = { key: "pregnancy_c3", version: 1, current: true, name: "Gestante e puérpera", indicator: "C3", declaredCondition: "pregnancy",
  eligibility: C3_FULL_ELIGIBILITY, practices: C3_FULL_PRACTICES, createdAt: "2026-01-10T12:00:00Z", createdBy: null };

export function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(<CareLineTemplates />, { wrapper });
}
