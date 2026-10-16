import { describe, expect, it } from "vitest";
import {
  EMPTY_RANGE, LIMITS, SECTORS, ageText, choicesProblem, decimalText, decimalsProblem, draftsToRanges, optionsWith, orNull,
  parseDecimal, rangeText, rangeToDraft, rangesSummary, sectorText, sexText, textProblem, upsertErrorText, valueTypeText
} from "./labTemplates";

describe("rótulos", () => {
  it("setor, tipo de valor e sexo em português; desconhecido aparece cru", () => {
    expect(SECTORS.map(sectorText)).toEqual([ "Bioquímica", "Hematologia", "Imunologia", "Urinálise", "Parasitologia", "Microbiologia" ]);
    expect(sectorText("cytology")).toBe("cytology");
    expect(valueTypeText("numeric")).toBe("numérico");
    expect(valueTypeText("text")).toBe("texto");
    expect(valueTypeText("choice")).toBe("lista de opções");
    expect(valueTypeText("ratio")).toBe("ratio");
    expect(sexText("any")).toBe("qualquer");
    expect(sexText("female")).toBe("feminino");
    expect(sexText("male")).toBe("masculino");
    expect(sexText("intersex")).toBe("intersex");
  });

  it("optionsWith mantém o valor desconhecido (salvar não o troca)", () => {
    expect(optionsWith([ "a", "b" ], "b")).toEqual([ "a", "b" ]);
    expect(optionsWith([ "a", "b" ], "z")).toEqual([ "a", "b", "z" ]);
  });

  it("orNull apara e transforma vazio em null", () => {
    expect(orNull("  g/dL ")).toBe("g/dL");
    expect(orNull("   ")).toBeNull();
  });
});

describe("números", () => {
  it("vírgula decimal vira número; vazio é null", () => {
    expect(parseDecimal("13,5")).toBe(13.5);
    expect(parseDecimal(" 0,6 ")).toBe(0.6);
    expect(parseDecimal("150000")).toBe(150000);
    expect(parseDecimal("-2,25")).toBe(-2.25);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("  ")).toBeNull();
  });

  it("ponto em número digitado é recusado (milhar ambíguo; 150.000 nunca vira 150)", () => {
    expect(parseDecimal("13.5")).toBeUndefined();
    expect(parseDecimal("0.125")).toBeUndefined();
    expect(parseDecimal("150.0")).toBeUndefined();
    expect(parseDecimal("150.000")).toBeUndefined();
    expect(parseDecimal("1.000")).toBeUndefined();
    expect(parseDecimal("150.000,5")).toBeUndefined();
    expect(parseDecimal("abc")).toBeUndefined();
    expect(parseDecimal("13,5 g/dL")).toBeUndefined();
    expect(parseDecimal("13,")).toBeUndefined();
    expect(parseDecimal("1,2,3")).toBeUndefined();
  });

  it("decimalText com vírgula e sem separador de milhar; nulo vira —", () => {
    expect(decimalText(13.5)).toBe("13,5");
    expect(decimalText(150000)).toBe("150000");
    expect(decimalText(12)).toBe("12");
    expect(decimalText(null)).toBe("—");
    expect(decimalText(undefined)).toBe("—");
  });

  it("idade em anos quando exata, senão em dias", () => {
    expect(ageText(0)).toBe("0");
    expect(ageText(6570)).toBe("18 a");
    expect(ageText(43800)).toBe("120 a");
    expect(ageText(28)).toBe("28 d");
    expect(ageText(400)).toBe("400 d");
  });
});

describe("faixas de referência", () => {
  const MALE = { sex: "male", ageMinDays: 6570, ageMaxDays: 43800, low: 13.5, high: 17.5, text: null };

  it("rangeText: sexo, idades e valores; só um limite; só texto; valor e texto", () => {
    expect(rangeText(MALE)).toBe("masculino, 18 a–120 a: 13,5–17,5");
    expect(rangeText({ ...MALE, sex: "any", ageMinDays: 0, low: null, high: 200 })).toBe("qualquer, 0–120 a: ≤ 200");
    expect(rangeText({ ...MALE, high: null })).toBe("masculino, 18 a–120 a: ≥ 13,5");
    expect(rangeText({ ...MALE, low: null, high: null, text: "negativo" })).toBe("masculino, 18 a–120 a: negativo");
    expect(rangeText({ ...MALE, text: "jejum" })).toBe("masculino, 18 a–120 a: 13,5–17,5 (jejum)");
    expect(rangeText({ ...MALE, low: null, high: null, text: null })).toBe("masculino, 18 a–120 a: —");
  });

  it("rangesSummary junta com ponto e vírgula; lista vazia diz sem faixa", () => {
    expect(rangesSummary([ MALE, { ...MALE, sex: "female", low: 12, high: 15.5 } ]))
      .toBe("masculino, 18 a–120 a: 13,5–17,5; feminino, 18 a–120 a: 12–15,5");
    expect(rangesSummary([])).toBe("sem faixa");
  });

  it("rangeToDraft escreve com vírgula; draftsToRanges volta ao mesmo número", () => {
    const draft = rangeToDraft(MALE);
    expect(draft).toEqual({ sex: "male", ageMinDays: "6570", ageMaxDays: "43800", low: "13,5", high: "17,5", text: "" });
    expect(draftsToRanges([ draft ])).toEqual({ ranges: [ MALE ] });
  });

  it("faixa nova vazia: qualquer sexo, 0 a 120 anos; texto aparado", () => {
    expect(EMPTY_RANGE).toEqual({ sex: "any", ageMinDays: "0", ageMaxDays: "43800", low: "", high: "", text: "" });
    expect(draftsToRanges([ { ...EMPTY_RANGE, text: "  negativo " } ])).toEqual({
      ranges: [ { sex: "any", ageMinDays: 0, ageMaxDays: 43800, low: null, high: null, text: "negativo" } ]
    });
  });

  it("número inválido ou idade não inteira: erro que diz a faixa e o campo, sem enviar nada", () => {
    expect(draftsToRanges([ rangeToDraft(MALE), { ...EMPTY_RANGE, low: "150.000" } ])).toEqual({
      error: "faixa 2: \"baixo\" não é um número — use vírgula para decimais e não use ponto de milhar"
    });
    expect(draftsToRanges([ { ...EMPTY_RANGE, high: "alto" } ])).toEqual({
      error: "faixa 1: \"alto\" não é um número — use vírgula para decimais e não use ponto de milhar"
    });
    expect(draftsToRanges([ { ...EMPTY_RANGE, ageMaxDays: "1,5" } ])).toEqual({
      error: "faixa 1: idade em dias deve ser um número inteiro"
    });
  });

  it("limites da faixa dos dois lados: idade 43800 passa, 43801 não; mín = máx passa, mín > máx não; baixo = alto passa", () => {
    const ok = (over: object) => "ranges" in draftsToRanges([ { ...EMPTY_RANGE, text: "x", ...over } ]);
    const err = (over: object) => (draftsToRanges([ { ...EMPTY_RANGE, text: "x", ...over } ]) as { error: string }).error;
    expect(ok({ ageMaxDays: "43800" })).toBe(true);
    expect(err({ ageMaxDays: "43801" })).toBe("faixa 1: a idade passa de 43800 dias (120 anos)");
    expect(err({ ageMinDays: "43801", ageMaxDays: "43801" })).toBe("faixa 1: a idade passa de 43800 dias (120 anos)");
    expect(ok({ ageMinDays: "100", ageMaxDays: "100" })).toBe(true);
    expect(err({ ageMinDays: "101", ageMaxDays: "100" })).toBe("faixa 1: a idade mínima passa da máxima");
    expect(ok({ low: "5", high: "5" })).toBe(true);
    expect(err({ low: "5,1", high: "5" })).toBe("faixa 1: \"baixo\" passa de \"alto\"");
    expect(ok({ low: "-3", high: "5" })).toBe(true);
  });

  it("texto da faixa: 120 passa, 121 não (contado sem espaços nas pontas)", () => {
    expect("ranges" in draftsToRanges([ { ...EMPTY_RANGE, text: "a".repeat(120) } ])).toBe(true);
    expect("ranges" in draftsToRanges([ { ...EMPTY_RANGE, text: ` ${"a".repeat(120)} ` } ])).toBe(true);
    expect(draftsToRanges([ { ...EMPTY_RANGE, text: "a".repeat(121) } ])).toEqual({ error: "faixa 1: o texto tem no máximo 120 caracteres" });
  });

  it("faixa sem baixo, alto nem texto é recusada; texto só de espaços conta como vazio", () => {
    expect(draftsToRanges([ EMPTY_RANGE ])).toEqual({ error: "faixa 1: informe baixo, alto ou um texto" });
    expect(draftsToRanges([ { ...EMPTY_RANGE, text: "   " } ])).toEqual({ error: "faixa 1: informe baixo, alto ou um texto" });
    expect("ranges" in draftsToRanges([ { ...EMPTY_RANGE, low: "0" } ])).toBe(true);
    expect("ranges" in draftsToRanges([ { ...EMPTY_RANGE, high: "0" } ])).toBe(true);
  });

  it("no máximo 20 faixas: 20 passam, 21 não", () => {
    const one = { ...EMPTY_RANGE, low: "1" };
    expect("ranges" in draftsToRanges(Array.from({ length: 20 }, () => one))).toBe(true);
    expect(draftsToRanges(Array.from({ length: 21 }, () => one))).toEqual({ error: "no máximo 20 faixas por componente" });
    expect(draftsToRanges([])).toEqual({ ranges: [] });
  });
});

describe("erros das mutations", () => {
  it("códigos conhecidos em português; blank com o campo; desconhecido cru; vazio genérico", () => {
    expect(upsertErrorText([ { path: "sigtapCode", message: "duplicate_sigtap" } ]))
      .toBe("já existe um exame do catálogo-base com este código SIGTAP");
    expect(upsertErrorText([ { path: "sigtapCode", message: "sigtap_unknown" } ]))
      .toBe("código SIGTAP fora da competência vigente da plataforma");
    expect(upsertErrorText([ { path: "referenceRanges", message: "invalid_reference_ranges" } ]))
      .toBe("faixas de referência inválidas — confira sexo, idade de 0 a 43800 dias (mínima ≤ máxima), baixo ≤ alto, texto de até 120 caracteres e até 20 faixas");
    expect(upsertErrorText([ { path: "name", message: "blank" }, { path: "key", message: "duplicate_analyte_key" } ]))
      .toBe("campo obrigatório vazio: Nome; já existe um componente com esta chave neste exame");
    expect(upsertErrorText([ { path: null, message: "lab_template_locked" } ])).toBe("lab_template_locked");
    expect(upsertErrorText([])).toBe("não foi possível concluir — tente de novo");
  });

  it("blank mostra o rótulo em português, nunca o caminho do campo", () => {
    const blank = (path: string | null, ctx?: "exam" | "analyte") => upsertErrorText([ { path, message: "blank" } ], ctx);
    expect(blank("name")).toBe("campo obrigatório vazio: Nome");
    expect(blank("material")).toBe("campo obrigatório vazio: Material");
    expect(blank("container")).toBe("campo obrigatório vazio: Recipiente");
    expect(blank("name", "analyte")).toBe("campo obrigatório vazio: Nome do componente");
    expect(blank("somethingNew")).toBe("campo obrigatório vazio");
    expect(blank(null)).toBe("campo obrigatório vazio");
    expect(upsertErrorText([ { path: "name", message: "blank" } ])).not.toContain("name");
  });

  it("casas decimais, opções e chave: frases com a regra", () => {
    expect(upsertErrorText([ { path: "decimals", message: "invalid_decimals" } ])).toBe("casas decimais de 0 a 4");
    expect(upsertErrorText([ { path: "choices", message: "choices_required" } ]))
      .toBe("a lista precisa de 1 a 20 opções distintas, cada uma com até 60 caracteres");
    expect(upsertErrorText([ { path: "key", message: "invalid_analyte_key" } ]))
      .toBe("chave inválida — começa com letra, até 40 caracteres; minúsculas, números e _ (ex.: hemoglobina)");
  });
});

describe("limites de texto (iguais aos do api)", () => {
  it("números exatos", () => {
    expect(LIMITS).toMatchObject({ name: 120, material: 60, container: 60, method: 160, unit: 30, rangeText: 120, ranges: 20, choices: 20, choice: 60 });
  });

  it("textProblem: no limite passa, um a mais não; espaços nas pontas não contam", () => {
    expect(textProblem("Nome", "a".repeat(120), 120)).toBeNull();
    expect(textProblem("Nome", `  ${"a".repeat(120)} `, 120)).toBeNull();
    expect(textProblem("Nome", "a".repeat(121), 120)).toBe("Nome: no máximo 120 caracteres");
    expect(textProblem("Unidade", "a".repeat(31), LIMITS.unit)).toBe("Unidade: no máximo 30 caracteres");
    expect(textProblem("Material", "a".repeat(60), LIMITS.material)).toBeNull();
    expect(textProblem("Recipiente", "a".repeat(61), LIMITS.container)).toBe("Recipiente: no máximo 60 caracteres");
    expect(textProblem("Método", "a".repeat(160), LIMITS.method)).toBeNull();
    expect(textProblem("Método", "a".repeat(161), LIMITS.method)).toBe("Método: no máximo 160 caracteres");
  });

  it("decimalsProblem: 0 a 4 inteiro", () => {
    for (const ok of [ "0", "1", "4", " 2 " ]) expect(decimalsProblem(ok)).toBeNull();
    for (const bad of [ "5", "-1", "1,5", "1.5", "", "a", "00" ]) expect(decimalsProblem(bad)).toBe("casas decimais de 0 a 4");
  });

  it("choicesProblem: 1 a 20, cada uma até 60, sem vazia, sem repetir (caixa conta)", () => {
    const phrase = "a lista precisa de 1 a 20 opções distintas, cada uma com até 60 caracteres";
    const list = (n: number) => Array.from({ length: n }, (_, i) => `op${i}`);
    expect(choicesProblem([ "a" ])).toBeNull();
    expect(choicesProblem(list(20))).toBeNull();
    expect(choicesProblem(list(21))).toBe(phrase);
    expect(choicesProblem([])).toBe(phrase);
    expect(choicesProblem([ "a".repeat(60) ])).toBeNull();
    expect(choicesProblem([ "a".repeat(61) ])).toBe(phrase);
    expect(choicesProblem([ "a", "  " ])).toBe(phrase);
    expect(choicesProblem([ "a", "a" ])).toBe(phrase);
    expect(choicesProblem([ "a", " a " ])).toBe(phrase);
    expect(choicesProblem([ "a", "A" ])).toBeNull();
  });
});
