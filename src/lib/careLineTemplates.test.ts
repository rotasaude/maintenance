import { describe, expect, it } from "vitest";
import {
  CODED, KEYS, GENDER_IDENTITIES, conditionText, genderIdentityText, advancedText, anchorText, changeSource, currentTemplates, draftProblem, draftToVariables, eligibilityText, emptyPractice,
  firstDraft, indicatorOf, keyText, pointsTotal, ruleText, scheduleText, sexText, sourceKindText, sourceText, toDraft, upsertErrorText,
  versionsOf, type EligibilityJson, type PracticeJson, type TemplateDraft, type TemplateView
} from "./careLineTemplates";

// Formas REAIS do catalog-base.yml do api (sem chave nula, sem lista vazia) — copiado de catalog-base.yml @454e502.
const MD_NURSE = [ "2231", "2251", "2252", "2253", "2235" ];
const P = (key: string, label: string, source: string, anchor: string, window_days: number, min_count: number, schedule: string,
  points: number, extra: Partial<PracticeJson> = {}): PracticeJson => ({ key, label, source, anchor, window_days, min_count, schedule, points, ...extra });

const C2_ELIG: EligibilityJson = { age_max_days: 730 };
const C2: PracticeJson[] = [
  P("c2_a", "1ª consulta até o 30º dia de vida", "consultation", "birth", 30, 1, "end_of_window", 20, { citizen_label: "Primeira consulta do bebê", cbo_filter: MD_NURSE }),
  P("c2_b", "9 consultas até os 2 anos", "consultation", "birth", 730, 9, "proportional", 20, { citizen_label: "Consultas de acompanhamento da criança", cbo_filter: MD_NURSE }),
  P("c2_c", "9 registros de peso e altura até os 2 anos", "weight_height", "birth", 730, 9, "proportional", 20, { citizen_label: "Medir peso e altura da criança" }),
  P("c2_d", "2 visitas do ACS", "acs_visit", "birth", 180, 2, "end_of_window", 20),
  P("c2_e", "Vacinas com todas as doses", "vaccine:c2_schedule", "birth", 730, 1, "end_of_window", 20)
];

const C3_ELIG: EligibilityJson = {
  problems: { ciap2: [ "W03", "W78", "W79" ], cid10: [ "O10", "O752", "Z321", "Z640" ] },
  exclude_problems: { ciap2: [ "W82", "W83" ], cid10: [ "O02", "Z303" ] },
  declared: [ "pregnancy" ], requires_anchor: "lmp"
};
const SYPHILIS = [ { source: "procedure:0214010074" }, { source: "exam:0202031098" } ];
const HIV = [ { source: "procedure:0214010040" }, { source: "exam:0213010780" } ];
const C3: PracticeJson[] = [
  P("c3_a", "1ª consulta de pré-natal", "consultation", "lmp", 84, 1, "end_of_window", 10, { cbo_filter: MD_NURSE }),
  P("c3_b", "7 consultas de pré-natal", "consultation", "lmp", 294, 7, "proportional", 9, { cbo_filter: MD_NURSE }),
  P("c3_c", "7 aferições de pressão", "blood_pressure", "lmp", 294, 7, "proportional", 9),
  P("c3_d", "7 registros de peso e altura", "weight_height", "lmp", 294, 7, "proportional", 9),
  P("c3_e", "3 visitas do ACS", "acs_visit", "lmp", 294, 3, "end_of_window", 9),
  P("c3_f", "Vacina dTpa", "vaccine:57", "lmp", 294, 1, "end_of_window", 9, { window_start_days: 140 }),
  P("c3_g", "Testes do 1º trimestre", "procedure:0214010074", "lmp", 97, 1, "end_of_window", 9, { all_of: [ SYPHILIS, HIV ] }),
  P("c3_h", "Testes do 3º trimestre", "procedure:0214010074", "lmp", 294, 1, "end_of_window", 9, { window_start_days: 196, all_of: [ SYPHILIS, HIV ] }),
  P("c3_i", "Consulta no puerpério", "consultation", "lmp", 336, 1, "end_of_window", 9, {
    window_start_days: 154, cbo_filter: MD_NURSE, code_filter: { ciap2: [ "P29", "W18" ], cid10: [ "F53", "O85" ] },
    all_of: [ [ { source: "consultation" }, { source: "procedure:0301010129" } ] ]
  }),
  P("c3_j", "Visita do ACS no puerpério", "acs_visit", "lmp", 336, 1, "end_of_window", 9, { window_start_days: 294 }),
  P("c3_k", "Saúde bucal na gestação", "oral_health", "lmp", 294, 1, "end_of_window", 9)
];

const C4_ELIG: EligibilityJson = { problems: { ciap2: [ "T89", "T90" ], cid10: [ "E10", "E11", "E14" ] }, declared: [ "diabetes" ] };
const C4_A = P("c4_a", "Consulta com médico ou enfermeiro em 6 meses", "consultation", "rolling", 183, 1, "end_of_window", 20,
  { citizen_label: "Consulta de acompanhamento", cbo_filter: MD_NURSE });
const C4_E = P("c4_e", "Hemoglobina glicada em 12 meses", "exam:0202010503", "rolling", 365, 1, "end_of_window", 15, { citizen_label: "Exame de hemoglobina glicada" });
const C4: PracticeJson[] = [
  C4_A,
  P("c4_b", "Pressão arterial em 6 meses", "blood_pressure", "rolling", 183, 1, "end_of_window", 15),
  P("c4_c", "Peso e altura em 12 meses", "weight_height", "rolling", 365, 1, "end_of_window", 15),
  P("c4_d", "2 visitas do ACS em 12 meses", "acs_visit", "rolling", 365, 2, "end_of_window", 20),
  C4_E,
  P("c4_f", "Avaliação dos pés em 12 meses", "procedure:0301040095", "rolling", 365, 1, "end_of_window", 15)
];

const C5_ELIG: EligibilityJson = { problems: { ciap2: [ "K86", "K87" ], cid10: [ "I10", "I11", "I12", "I13", "I15", "O10", "O11" ] }, declared: [ "hypertension" ] };
const C5: PracticeJson[] = [
  P("c5_a", "Consulta com médico(a) ou enfermeiro(a) nos últimos 6 meses", "consultation", "rolling", 183, 1, "end_of_window", 25,
    { citizen_label: "Consulta de acompanhamento", cbo_filter: MD_NURSE }),
  P("c5_b", "Pressão arterial aferida nos últimos 6 meses", "blood_pressure", "rolling", 183, 1, "end_of_window", 25, { citizen_label: "Medir a pressão" }),
  P("c5_c", "Peso e altura nos últimos 12 meses", "weight_height", "rolling", 365, 1, "end_of_window", 25, { citizen_label: "Medir peso e altura" }),
  P("c5_d", "2 visitas do ACS nos últimos 12 meses", "acs_visit", "rolling", 365, 2, "end_of_window", 25)
];

const C6_ELIG: EligibilityJson = { age_min_years: 60 };
const C6: PracticeJson[] = [
  P("c6_a", "Consulta em 12 meses", "consultation", "rolling", 365, 1, "end_of_window", 25, { cbo_filter: MD_NURSE }),
  P("c6_b", "Peso e altura em 12 meses", "weight_height", "rolling", 365, 1, "end_of_window", 25),
  P("c6_c", "2 visitas do ACS", "acs_visit", "rolling", 365, 2, "end_of_window", 25),
  P("c6_d", "Vacina de influenza", "vaccine:33", "rolling", 365, 1, "end_of_window", 25)
];

const C7_ELIG: EligibilityJson = {
  age_min_years: 9, age_max_years: 69, sex: "female", gender_identities_included: [ "trans_man" ], gender_identities_excluded: [ "trans_woman" ]
};
const C7: PracticeJson[] = [
  P("c7_a", "Rastreamento do colo do útero", "exam:0203010086", "rolling", 1095, 1, "end_of_window", 20, {
    applies_to: { age_min_years: 25, age_max_years: 64 },
    all_of: [ [ { source: "exam:0203010086" }, { source: "procedure:0201020033" }, { source: "exam:0202100251", window_days: 1826 } ] ]
  }),
  P("c7_b", "1 dose da vacina HPV", "vaccine:67", "birth", 5478, 1, "end_of_window", 30, {
    window_start_days: 3287, applies_to: { age_min_years: 9, age_max_years: 14, sex: "female" }
  }),
  P("c7_c", "Saúde sexual e reprodutiva", "consultation", "rolling", 365, 1, "end_of_window", 30, {
    cbo_filter: [ ...MD_NURSE, "251605", "223445", "3222" ], code_filter: { ciap2: [ "B25", "W02" ], cid10: [ "N80", "Z30" ] },
    applies_to: { age_min_years: 14, age_max_years: 69 }
  }),
  P("c7_d", "Mamografia em 24 meses", "exam:0204030030", "rolling", 730, 1, "end_of_window", 20, {
    applies_to: { age_min_years: 50, age_max_years: 69 }, all_of: [ [ { source: "exam:0204030030" }, { source: "exam:0204030188" } ] ]
  })
];

type Real = { key: string; indicator: string; name: string; declaredCondition: string | null; eligibility: EligibilityJson; practices: PracticeJson[] };
const REAL: Real[] = [
  { key: "child_c2", indicator: "C2", name: "Criança até 2 anos", declaredCondition: null, eligibility: C2_ELIG, practices: C2 },
  { key: "pregnancy_c3", indicator: "C3", name: "Gestante e puérpera", declaredCondition: "pregnancy", eligibility: C3_ELIG, practices: C3 },
  { key: "diabetes_c4", indicator: "C4", name: "Pessoa com diabetes", declaredCondition: "diabetes", eligibility: C4_ELIG, practices: C4 },
  { key: "hypertension_c5", indicator: "C5", name: "Pessoa com hipertensão", declaredCondition: "hypertension", eligibility: C5_ELIG, practices: C5 },
  { key: "elderly_c6", indicator: "C6", name: "Pessoa idosa", declaredCondition: null, eligibility: C6_ELIG, practices: C6 },
  { key: "women_c7", indicator: "C7", name: "Mulher e prevenção do câncer", declaredCondition: null, eligibility: C7_ELIG, practices: C7 }
];

const t = (over: Partial<TemplateView> = {}): TemplateView => ({
  key: "diabetes_c4", version: 1, current: false, name: "Pessoa com diabetes", indicator: "C4", declaredCondition: "diabetes",
  eligibility: C4_ELIG, practices: [ { ...C4_A, points: 85 }, { ...C4_E, points: 15 } ], createdAt: "2026-01-10T12:00:00Z", createdBy: null, ...over
});

describe("rótulos", () => {
  it("chaves, fontes, regra, avançados e elegibilidade; desconhecido cru", () => {
    expect(KEYS).toEqual([ "child_c2", "pregnancy_c3", "diabetes_c4", "hypertension_c5", "elderly_c6", "women_c7" ]);
    expect(keyText("diabetes_c4")).toBe("C4 — Pessoa com diabetes");
    expect(keyText("saude_mental")).toBe("saude_mental");
    expect(indicatorOf("women_c7")).toBe("C7");
    expect(indicatorOf("saude_mental")).toBe("");
    expect(sourceText("exam:0202010503")).toBe("exame SIGTAP 0202010503 (pedido ou resultado)");
    expect(sourceText("procedure:0301040095")).toBe("procedimento SIGTAP 0301040095");
    expect(sourceText("vaccine:57")).toBe("vacina 57 (não acompanhada pelo sistema)");
    expect(sourceText("acs_visit")).toBe("visita do ACS (não acompanhada pelo sistema)");
    expect(sourceText("oral_health")).toBe("saúde bucal (não acompanhada pelo sistema)");
    expect(sourceText("teleconsulta")).toBe("teleconsulta");
    expect(sourceText("teleconsulta:9")).toBe("teleconsulta:9");
    expect([ ...CODED ].sort()).toEqual([ "exam", "procedure", "vaccine" ]);
    expect(sourceKindText("exam")).toBe("exame (SIGTAP)");
    expect(sourceKindText("novo")).toBe("novo");
    expect(scheduleText("proportional")).toBe("proporcional ao tempo");
    expect(scheduleText("novo")).toBe("novo");
    expect(anchorText("lmp")).toBe("desde a DUM");
    expect(anchorText("novo")).toBe("novo");
    expect(sexText("female")).toBe("feminino");
    expect(sexText(null)).toBe("qualquer");
    expect(sexText("outro")).toBe("outro");
    expect(ruleText({ ...C4_A, points: 85 })).toBe("consulta finalizada · 1× em 183 dias, até o fim da janela · janela móvel · CBO 2231, 2251, 2252, 2253, 2235 · 85 pontos");
    expect(ruleText({ ...C4_E, window_start_days: 196, window_days: 294, anchor: "lmp", min_count: 7, schedule: "proportional", points: 9 }))
      .toBe("exame SIGTAP 0202010503 (pedido ou resultado) · 7× do dia 196 ao 294, proporcional ao tempo · desde a DUM · 9 pontos");
    expect(ruleText(C2[3])).toBe("visita do ACS (não acompanhada pelo sistema) · 2× em 180 dias, até o fim da janela · desde o nascimento · 20 pontos");
    expect(advancedText(C3[6])).toBe("todas de: procedimento SIGTAP 0214010074 ou exame SIGTAP 0202031098 (pedido ou resultado) | procedimento SIGTAP 0214010040 ou exame SIGTAP 0213010780 (pedido ou resultado)");
    expect(advancedText(C7[0])).toBe("todas de: exame SIGTAP 0203010086 (pedido ou resultado) ou procedimento SIGTAP 0201020033 ou exame SIGTAP 0202100251 (pedido ou resultado) em 1826 dias · vale de 25 a 64 anos");
    // alternativa de fonte desconhecida (api mais novo) continua crua
    expect(advancedText({ ...C4_A, all_of: [ [ { source: "teleconsulta:9" }, { source: "vaccine:57" } ] ] }))
      .toBe("todas de: teleconsulta:9 ou vacina 57 (não acompanhada pelo sistema)");
    expect(advancedText({ ...C4_A, code_filter: { cid10: [ "Z32" ] }, applies_to: { age_min_years: 14, age_max_years: 69 } }))
      .toBe("só com código: Z32 · vale de 14 a 69 anos");
    expect(advancedText(C7[1])).toBe("vale de 9 a 14 anos · só sexo feminino");
    expect(advancedText(C4_A)).toBeNull();
    expect(advancedText({ ...C4_A, all_of: null, code_filter: null, applies_to: null })).toBeNull();
  });

  it("condições e identidades de gênero: termos em português; código desconhecido cru", () => {
    expect([ "", "diabetes", "hypertension", "pregnancy", "mental_health" ].map(conditionText))
      .toEqual([ "nenhuma", "diabetes", "hipertensão", "gestação", "saúde mental" ]);
    expect(conditionText("futura")).toBe("futura");
    // os 7 códigos de Citizen::GENDER_IDENTITIES do api (citizen.rb)
    expect([ ...GENDER_IDENTITIES ]).toEqual([ "cis_woman", "cis_man", "trans_woman", "trans_man", "travesti", "non_binary", "other" ]);
    expect(GENDER_IDENTITIES.map(genderIdentityText)).toEqual([
      "mulher cis", "homem cis", "mulher trans", "homem trans", "travesti", "pessoa não binária", "outra identidade" ]);
    expect(genderIdentityText("futura_id")).toBe("futura_id");
  });

  it("elegibilidade: formas reais do catálogo, sem lista vazia nem chave obrigatória", () => {
    expect(eligibilityText(C4_ELIG)).toBe("CIAP-2 T89, T90 · CID-10 E10, E11, E14 · condição declarada: diabetes");
    expect(eligibilityText(C2_ELIG)).toBe("até 730 dias de vida");
    expect(eligibilityText(C6_ELIG)).toBe("a partir de 60 anos");
    expect(eligibilityText({ age_min_days: 30, age_max_days: 90 })).toBe("de 30 a 90 dias de vida");
    expect(eligibilityText({ problems: { ciap2: [ "W78" ] }, exclude_problems: { ciap2: [ "W82" ] }, requires_anchor: "lmp" }))
      .toBe("CIAP-2 W78 · exceto CIAP-2 W82 · pede a DUM");
    expect(eligibilityText({ problems: { cid10: [ "E10" ] }, exclude_problems: { cid10: [ "E11" ] } })).toBe("CID-10 E10 · exceto CID-10 E11");
    expect(eligibilityText(C7_ELIG)).toBe("de 9 a 69 anos · sexo feminino · inclui: homem trans · exclui: mulher trans");
    expect(eligibilityText({ declared: [ "diabetes", "hypertension" ] })).toBe("condição declarada: diabetes, hipertensão");
    expect(eligibilityText({ declared: [ "futura" ], gender_identities_included: [ "futura_id" ] })).toBe("inclui: futura_id · condição declarada: futura");
    expect(eligibilityText({ problems: { ciap2: [], cid10: [] }, age_max_days: 730 })).toBe("até 730 dias de vida");
    expect(eligibilityText({})).toBe("sem critério de entrada");
  });

  it("vigente por chave na ordem do contrato; histórico da mais nova para a mais antiga", () => {
    const list = [ t(), t({ version: 2, current: true }), t({ key: "pregnancy_c3", indicator: "C3", current: true }),
      t({ key: "saude_mental", indicator: "", current: true }) ];
    expect(currentTemplates(list).map((x) => `${x.key}@${x.version}`)).toEqual([ "pregnancy_c3@1", "diabetes_c4@2", "saude_mental@1" ]);
    expect(versionsOf(list, "diabetes_c4").map((x) => x.version)).toEqual([ 2, 1 ]);
    expect(currentTemplates([ t(), t({ version: 3 }) ]).map((x) => x.version)).toEqual([ 3 ]);
    expect(pointsTotal([ { points: 85 }, { points: 15 }, { points: null }, {} ])).toBe(100);
  });
});

describe("rascunho e ida e volta", () => {
  const ok = (): TemplateDraft => toDraft(t({ version: 2, current: true }));

  it("rascunho a partir da vigente; primeira versão usa o nome e o indicador da chave", () => {
    const d = ok();
    expect([ d.key, d.indicator, d.declaredCondition, d.ciap, d.cid10, d.ageMinYears, d.requiresAnchor ])
      .toEqual([ "diabetes_c4", "C4", "diabetes", "T89, T90", "E10, E11, E14", "", "" ]);
    expect(d.practices[1]).toMatchObject({ key: "c4_e", citizenLabel: "Exame de hemoglobina glicada", sourceKind: "exam", code: "0202010503",
      windowStartDays: "", windowDays: "365", minCount: "1", cboFilter: "", points: "15" });
    expect(d.practices[0].cboFilter).toBe("2231, 2251, 2252, 2253, 2235");
    const first = firstDraft("child_c2");
    expect([ first.name, first.indicator, first.practices.length ]).toEqual([ "Cuidado da criança até 2 anos", "C2", 1 ]);
    expect(firstDraft("saude_mental")).toMatchObject({ name: "", indicator: "" });
  });

  it("indicador é derivado da chave: o da vista não o sobrescreve; chave desconhecida mantém o que veio", () => {
    expect(toDraft(t({ indicator: "C9" })).indicator).toBe("C4");
    expect(toDraft(t({ key: "saude_mental", indicator: "S1" })).indicator).toBe("S1");
    expect(draftToVariables(toDraft(t({ indicator: "C9" }))).indicator).toBe("C4");
  });

  it.each(REAL)("ida e volta com a forma real: $key volta igual ao original", (real) => {
    const view: TemplateView = { ...real, version: 1, current: true, createdAt: "2026-10-22T00:00:00Z", createdBy: null };
    const draft = toDraft(view);
    expect(draftProblem(draft)).toBeNull();
    expect(draftToVariables(draft)).toEqual({
      key: real.key, name: real.name, indicator: real.indicator, declaredCondition: real.declaredCondition,
      eligibility: real.eligibility, practices: real.practices
    });
  });

  it("ida e volta do que o api devolve (nulos e zeros) sai na forma enxuta, sem lista nem objeto vazio", () => {
    const apiShaped = t({
      practices: [
        { ...C4_A, points: 85, window_start_days: 0, code_filter: null, applies_to: null, all_of: null },
        { ...C4_E, points: 15, citizen_label: null, cbo_filter: null, window_start_days: 0 }
      ],
      eligibility: { ...C4_ELIG, exclude_problems: { ciap2: [], cid10: [] }, gender_identities_included: [], declared: [ "diabetes" ] }
    });
    const out = draftToVariables(toDraft(apiShaped));
    const { citizen_label: _gone, ...c4eBare } = C4_E; // null vira ausente
    expect(out.practices).toEqual([ { ...C4_A, points: 85 }, { ...c4eBare, points: 15 } ]);
    expect(out.eligibility).toEqual(C4_ELIG);
    expect(JSON.stringify(out)).not.toMatch(/\[\]|\{\}|null/);
  });

  it("só a terminologia preenchida vai; vazios fora; preservados voltam iguais", () => {
    const d = ok();
    expect(draftToVariables({ ...d, ciap: "", cid10: "e10" }).eligibility).toEqual({ problems: { cid10: [ "E10" ] }, declared: [ "diabetes" ] });
    expect(draftToVariables({ ...d, excludeCiap: "w82" }).eligibility.exclude_problems).toEqual({ ciap2: [ "W82" ] });
    expect(draftToVariables({ ...d, excludeCiap: "", excludeCid10: "" }).eligibility).not.toHaveProperty("exclude_problems");
    expect(draftToVariables({ ...d, requiresAnchor: "lmp" }).eligibility.requires_anchor).toBe("lmp");
    expect(draftToVariables({ ...d, requiresAnchor: "" }).eligibility).not.toHaveProperty("requires_anchor");
    expect(draftToVariables({ ...d, ageMinYears: "18", ageMaxDays: "30", sex: "male" }).eligibility)
      .toMatchObject({ age_min_years: 18, age_max_days: 30, sex: "male" });
    const c7 = toDraft({ ...t(), key: "women_c7", eligibility: C7_ELIG, practices: [ { ...C7[0], points: 100 } ] });
    expect(draftToVariables(c7).eligibility).toEqual(C7_ELIG);
    expect(draftToVariables(c7).practices[0]).toEqual({ ...C7[0], points: 100 });
  });

  it("fonte: monta e desmonta o código; desconhecida continua", () => {
    const d = { ...ok(), practices: [ { ...ok().practices[1], points: "100" } ] };
    const withSource = (sourceKind: string, code: string) => draftToVariables({ ...d, practices: [ { ...d.practices[0], sourceKind, code } ] }).practices[0].source;
    expect(withSource("acs_visit", "0202010503")).toBe("acs_visit");
    expect(withSource("vaccine", "57")).toBe("vaccine:57");
    expect(withSource("procedure", " 0301040095 ")).toBe("procedure:0301040095");
    const unknown = toDraft(t({ practices: [ { ...C4_A, source: "teleconsulta", points: 100 } ] }));
    expect(unknown.practices[0].sourceKind).toBe("teleconsulta");
    expect(draftToVariables(unknown).practices[0].source).toBe("teleconsulta");
    const unknownCoded = toDraft(t({ practices: [ { ...C4_A, source: "teleconsulta:9", points: 100 } ] }));
    expect(draftToVariables(unknownCoded).practices[0].source).toBe("teleconsulta:9");
  });

  it("trocar a fonte para fora de consulta limpa o CBO; para dentro de consulta mantém", () => {
    const p = ok().practices[0];
    expect(p.cboFilter).not.toBe("");
    expect(changeSource(p, "blood_pressure")).toMatchObject({ sourceKind: "blood_pressure", cboFilter: "" });
    expect(changeSource({ ...p, sourceKind: "exam" }, "consultation").cboFilter).toBe(p.cboFilter);
    expect(changeSource(p, "consultation")).toEqual(p);
  });
});

describe("pontos: inteiros de 0 a 100, somando 100", () => {
  const ok = (): TemplateDraft => toDraft(t({ version: 2, current: true }));
  const withPoints = (points: string) => { const d = ok(); d.practices[0] = { ...d.practices[0], points }; return d; };
  const WRONG = "boa prática 1: pontos: número inteiro de 0 a 100";

  it("recusa decimal (ponto ou vírgula), negativo, acima de 100 e texto", () => {
    for (const bad of [ "12.5", "12,5", "-5", "150", "101", "1e2", "abc", "8 5", "85%" ]) expect(draftProblem(withPoints(bad))).toBe(WRONG);
    expect(draftProblem(withPoints(""))).toBe("boa prática 1: informe os pontos (Quadro 01 da nota metodológica)");
    expect(draftProblem(withPoints("80"))).toBe("a soma dos pontos precisa ser 100 (está em 95)");
  });

  it("aceita inteiro de 0 a 100 que soma 100", () => {
    const split = ok();
    split.practices = [ { ...split.practices[0], points: "85" }, { ...split.practices[1], points: "15" } ];
    expect(draftProblem(split)).toBeNull();
    expect(draftToVariables(split).practices.map((p) => p.points)).toEqual([ 85, 15 ]);
    const edges = ok();
    edges.practices = [ { ...edges.practices[0], points: "100" }, { ...edges.practices[1], points: "0" } ];
    expect(draftProblem(edges)).toBeNull();
    expect(draftProblem(withPoints(" 85 "))).toBeNull();
  });
});

describe("recusa o que o api recusaria (e só isso)", () => {
  const ok = (): TemplateDraft => toDraft(t({ version: 2, current: true }));
  const set = (patch: Partial<TemplateDraft>) => draftProblem({ ...ok(), ...patch });
  // Substitui a 1ª boa prática (consulta, rolling, CBO) e dá a ela os 100 pontos.
  const practice = (patch: object, base: Partial<TemplateDraft> = {}) => {
    const d = { ...ok(), ...base };
    return draftProblem({ ...d, practices: [ { ...d.practices[0], ...patch, points: "100" } ] });
  };

  it("campos gerais e elegibilidade", () => {
    expect(set({ name: "" })).toBe("Nome: obrigatório");
    expect(set({ name: "x".repeat(121) })).toBe("Nome: no máximo 120 caracteres");
    expect(set({ name: "x".repeat(120) })).toBeNull();
    expect(set({ ciap: "T90, TX" })).toBe("código CIAP-2 inválido: TX");
    expect(set({ cid10: "E1" })).toBe("código CID-10 inválido: E1");
    expect(set({ cid10: "E10.1, E11X" })).toBeNull();
    expect(set({ excludeCiap: "W8" })).toBe("código CIAP-2 inválido: W8");
    expect(set({ ageMinYears: "60", ageMaxYears: "18" })).toBe("a idade mínima passa da máxima");
    expect(set({ ageMaxYears: "131" })).toBe("idade em anos inteiros, de 0 a 130");
    expect(set({ ageMaxDays: "abc" })).toBe("idade em dias inteiros, de 0 a 47450");
    expect(set({ ageMinDays: "100", ageMaxDays: "10" })).toBe("a idade mínima passa da máxima");
    expect(set({ practices: [] })).toBe("inclua pelo menos uma boa prática");
  });

  it("elegibilidade sem nenhum critério é recusada com a frase do api; qualquer critério basta", () => {
    const NONE = "elegibilidade inválida — confira os códigos e as idades";
    const bare = { ciap: "", cid10: "", preserved: {}, declaredCondition: "" };
    expect(set(bare)).toBe(NONE);
    // exclusão, DUM e identidades de gênero não são critério de entrada
    expect(set({ ...bare, excludeCiap: "W82", requiresAnchor: "lmp", preserved: { gender_identities_included: [ "trans_man" ] } })).toBe(NONE);
    for (const patch of [ { ciap: "T89" }, { cid10: "E10" }, { ageMinYears: "60" }, { ageMaxYears: "9" }, { ageMinDays: "0" },
      { ageMaxDays: "730" }, { sex: "female" }, { preserved: { declared: [ "diabetes" ] } } ])
      expect(set({ ...bare, ...patch })).toBeNull();
  });

  it("condição declarada precisa estar entre as condições de entrada", () => {
    const PHRASE = "condição declarada precisa estar entre as condições de entrada (eligibility.declared)";
    expect(set({ declaredCondition: "hypertension" })).toBe(PHRASE);
    expect(set({ declaredCondition: "diabetes" })).toBeNull();
    expect(set({ declaredCondition: "" })).toBeNull();
  });

  it("boa prática: chave, rótulos, fonte e código", () => {
    const d = ok();
    expect(practice({ key: "Consulta" })).toBe("boa prática 1: chave com minúsculas, números e _ (de 1 a 40)");
    expect(practice({ key: "" })).toBe("boa prática 1: chave com minúsculas, números e _ (de 1 a 40)");
    expect(practice({ key: "a-b" })).toBe("boa prática 1: chave com minúsculas, números e _ (de 1 a 40)");
    // como o api: pode começar com número ou _ e pode ter 1 caractere
    for (const ok of [ "1a", "_x", "a", "9".repeat(40) ]) expect(practice({ key: ok })).toBeNull();
    expect(practice({ key: "a".repeat(41) })).toBe("boa prática 1: chave com minúsculas, números e _ (de 1 a 40)");
    expect(draftProblem({ ...d, practices: [ d.practices[0], { ...d.practices[1], key: "c4_a" } ] })).toBe("boa prática 2: chave repetida (c4_a)");
    expect(practice({ label: "" })).toBe("boa prática 1: escreva o que conta");
    expect(practice({ label: "x".repeat(121) })).toBe("boa prática 1: até 120 caracteres");
    expect(practice({ citizenLabel: "x".repeat(81) })).toBe("boa prática 1: texto para o cidadão até 80 caracteres");
    expect(practice({ citizenLabel: "x".repeat(80) })).toBeNull();
    expect(practice({ sourceKind: "exam", code: "0301040095" })).toBe("boa prática 1: exame com SIGTAP do grupo 02 (10 dígitos)");
    expect(practice({ sourceKind: "exam", code: "0202010503", cboFilter: "" })).toBeNull();
    expect(practice({ sourceKind: "procedure", code: "03010400", cboFilter: "" })).toBe("boa prática 1: procedimento com SIGTAP de 10 dígitos");
    expect(practice({ sourceKind: "vaccine", code: "", cboFilter: "" })).toBe("boa prática 1: código da vacina (minúsculas, números e _, até 30)");
    expect(practice({ sourceKind: "vaccine", code: "c2_schedule", cboFilter: "" })).toBeNull();
    expect(practice({ sourceKind: "teleconsulta", cboFilter: "" })).toBeNull();
  });

  it("boa prática: janela, quantidade e cronograma", () => {
    expect(practice({ windowDays: "0" })).toBe("boa prática 1: janela de 1 a 7300 dias");
    expect(practice({ windowDays: "7301" })).toBe("boa prática 1: janela de 1 a 7300 dias");
    expect(practice({ windowDays: "7300" })).toBeNull();
    expect(practice({ windowStartDays: "200", windowDays: "180", anchor: "birth" })).toBe("boa prática 1: o início da janela passa do fim");
    expect(practice({ windowStartDays: "180", windowDays: "180", anchor: "birth" })).toBe("boa prática 1: o início da janela passa do fim");
    expect(practice({ windowStartDays: "179", windowDays: "180", anchor: "birth" })).toBeNull();
    expect(practice({ windowStartDays: "x", anchor: "birth" })).toBe("boa prática 1: início da janela em dias inteiros");
    expect(practice({ minCount: "51" })).toBe("boa prática 1: quantidade mínima de 1 a 50");
    expect(practice({ minCount: "0" })).toBe("boa prática 1: quantidade mínima de 1 a 50");
    expect(practice({ minCount: "50" })).toBeNull();
    expect(practice({ schedule: "proportional", anchor: "rolling" })).toBe("boa prática 1: cronograma proporcional só com âncora fixa");
    expect(practice({ schedule: "proportional", anchor: "lmp" })).toBeNull();
  });

  it("início da janela: recusado com a âncora rolling (o api recusa), aceito com âncora fixa", () => {
    const MSG = "boa prática 1: início da janela só com âncora fixa";
    expect(practice({ windowStartDays: "10", windowDays: "100", anchor: "rolling" })).toBe(MSG);
    expect(practice({ windowStartDays: "0", windowDays: "100", anchor: "rolling" })).toBeNull();
    expect(practice({ windowStartDays: "", windowDays: "100", anchor: "rolling" })).toBeNull();
    for (const anchor of [ "enrollment", "birth", "lmp" ]) expect(practice({ windowStartDays: "10", windowDays: "100", anchor })).toBeNull();
  });

  it("CBO: de 4 a 6 dígitos, até 30, só em consulta", () => {
    expect(practice({ cboFilter: "225, 22A" })).toBe("boa prática 1: CBO de 4 a 6 dígitos (225)");
    expect(practice({ cboFilter: "2251, 22A5" })).toBe("boa prática 1: CBO de 4 a 6 dígitos (22A5)");
    expect(practice({ cboFilter: "1234567" })).toBe("boa prática 1: CBO de 4 a 6 dígitos (1234567)");
    expect(practice({ cboFilter: "2251, 223445, 3222" })).toBeNull();
    expect(practice({ cboFilter: "" })).toBeNull();
    const many = (n: number) => Array.from({ length: n }, (_, i) => String(1000 + i)).join(", ");
    expect(practice({ cboFilter: many(31) })).toBe("boa prática 1: no máximo 30 CBO");
    expect(practice({ cboFilter: many(30) })).toBeNull();
    expect(practice({ cboFilter: `${many(30)}, 1000` })).toBeNull(); // repetido não conta duas vezes
    for (const sourceKind of [ "blood_pressure", "weight_height", "acs_visit", "oral_health" ])
      expect(practice({ sourceKind, cboFilter: "2251" })).toBe("boa prática 1: CBO só vale na fonte consulta");
    expect(practice({ sourceKind: "exam", code: "0202010503", cboFilter: "2251" })).toBe("boa prática 1: CBO só vale na fonte consulta");
    expect(practice({ sourceKind: "blood_pressure", cboFilter: "" })).toBeNull();
  });

  it("avançados preservados: o que a edição simples quebraria o api recusa", () => {
    const grouped = (extra: Partial<PracticeJson> = {}) => toDraft(t({ practices: [ { ...C3[6], points: 100, ...extra } ] })).practices;
    const check = (patch: object, extra: Partial<PracticeJson> = {}) =>
      draftProblem({ ...ok(), practices: [ { ...grouped(extra)[0], ...patch } ] });
    expect(check({ anchor: "lmp" })).toBeNull();
    // mais de um grupo em all_of: quantidade mínima só 1, cronograma não proporcional
    expect(check({ minCount: "2" })).toBe("boa prática 1: com mais de um grupo de alternativas a quantidade mínima é 1");
    expect(check({ schedule: "proportional" })).toBe("boa prática 1: cronograma proporcional não vale com mais de um grupo de alternativas");
    // um grupo só não limita
    expect(check({ minCount: "3" }, { all_of: [ SYPHILIS ] })).toBeNull();
    expect(check({ schedule: "proportional" }, { all_of: [ SYPHILIS ] })).toBeNull();
    // code_filter só em consulta
    const filtered = toDraft(t({ practices: [ { ...C3[8], points: 100 } ] })).practices[0];
    expect(draftProblem({ ...ok(), practices: [ filtered ] })).toBeNull();
    expect(draftProblem({ ...ok(), practices: [ changeSource(filtered, "blood_pressure") ] }))
      .toBe("boa prática 1: filtro por código só vale na fonte consulta");
    // janela própria numa alternativa só com âncora móvel
    const own = toDraft(t({ key: "women_c7", practices: [ { ...C7[0], points: 100 } ] })).practices[0];
    expect(draftProblem({ ...ok(), practices: [ own ] })).toBeNull();
    expect(draftProblem({ ...ok(), practices: [ { ...own, anchor: "birth" } ] }))
      .toBe("boa prática 1: janela própria numa alternativa só com âncora móvel");
  });

  it("limites de lista e quantidade de códigos", () => {
    const d = ok();
    const twenty = Array.from({ length: 20 }, (_, i) => ({ ...d.practices[0], key: `k${i}`, points: i === 0 ? "100" : "0" }));
    expect(draftProblem({ ...d, practices: twenty })).toBeNull();
    expect(draftProblem({ ...d, practices: [ ...twenty, { ...twenty[0], key: "k20", points: "0" } ] })).toBe("no máximo 20 boas práticas");
    const codes = (n: number) => Array.from({ length: n }, (_, i) => `A${String(i % 100).padStart(2, "0")}${i < 100 ? "" : String.fromCharCode(48 + Math.floor(i / 100))}`).join(", ");
    expect(set({ cid10: codes(300) })).toBeNull();
    expect(set({ cid10: codes(301) })).toBe("no máximo 300 códigos por lista");
  });

  it("rascunho de partida está válido; prática nova começa sem pontos", () => {
    expect(draftProblem(ok())).toBeNull();
    expect(emptyPractice().points).toBe("");
  });
});

describe("frases das recusas do api, com o campo; desconhecido cru", () => {
  it("cobre os códigos do Save e do Rules, inclusive condição declarada", () => {
    expect(upsertErrorText([ { path: "practices[1].window_days", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira a boa prática 2 (fim da janela)");
    expect(upsertErrorText([ { path: "practices[0].cbo_filter", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira a boa prática 1 (CBO)");
    expect(upsertErrorText([ { path: "practices[11]", message: "invalid_practices" } ])).toBe("boas práticas inválidas — confira a boa prática 12");
    expect(upsertErrorText([ { path: "practices.points", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira os campos (pontos)");
    expect(upsertErrorText([ { path: "practices", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira os campos (boas práticas)");
    expect(upsertErrorText([ { path: "eligibility.sex", message: "invalid_eligibility" } ]))
      .toBe("elegibilidade inválida — confira os códigos e as idades (entrada: sexo)");
    expect(upsertErrorText([ { path: "eligibility.age_max_years", message: "invalid_eligibility" } ]))
      .toBe("elegibilidade inválida — confira os códigos e as idades (entrada: idade máxima em anos)");
    expect(upsertErrorText([ { path: "eligibility", message: "invalid_eligibility" } ]))
      .toBe("elegibilidade inválida — confira os códigos e as idades (entrada)");
    expect(upsertErrorText([ { path: "practices[2].key", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira a boa prática 3 (chave)");
    // caminho desconhecido (api mais novo) continua cru
    expect(upsertErrorText([ { path: "eligibility.futuro", message: "invalid_eligibility" } ]))
      .toBe("elegibilidade inválida — confira os códigos e as idades (eligibility.futuro)");
    expect(upsertErrorText([ { path: "practices[0].futuro", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira os campos (practices[0].futuro)");
    expect(upsertErrorText([ { path: "outra.coisa", message: "invalid_practices" } ]))
      .toBe("boas práticas inválidas — confira os campos (outra.coisa)");
    expect(upsertErrorText([ { path: "indicator", message: "invalid_indicator" } ])).toBe("indicador desconhecido — use C2 a C7");
    expect(upsertErrorText([ { path: "key", message: "invalid_key" } ])).toBe("linha desconhecida — atualize a tela");
    expect(upsertErrorText([ { path: "name", message: "invalid_name" } ])).toBe("nome inválido — de 1 a 120 caracteres");
    expect(upsertErrorText([ { path: "declaredCondition", message: "invalid_declared_condition" } ]))
      .toBe("condição declarada precisa estar entre as condições de entrada (eligibility.declared)");
    expect(upsertErrorText([ { path: null, message: "brand_new" } ])).toBe("brand_new");
    expect(upsertErrorText([ { path: "x", message: "brand_new" } ])).toBe("brand_new");
    // propriedades herdadas do Object não são códigos do api
    for (const inherited of [ "constructor", "toString", "__proto__", "hasOwnProperty" ])
      expect(upsertErrorText([ { path: "key", message: inherited } ])).toBe(inherited);
    expect(upsertErrorText([])).toBe("não foi possível concluir — tente de novo");
  });
});
