import { describe, expect, it } from "vitest";
import {
  NOTIFIABLE_QUERY_KEY, STALE_LIST_TEXT, codesOf, currentList, dateText, deadlineText, diffText, diseaseProblem, draftProblem, draftToVariables, emptyDisease,
  historyOf, latestList, listDiff, listState, publishErrorText, scheduledList, toDraft, todaySP, type DiseaseView, type ListView
} from "./notifiableDiseases";

const DENGUE: DiseaseView = { code: "dengue", name: "Dengue", deadline: "weekly", cid10: [ "A90", "A91" ], ciap2: [], repeatAfterDays: 30,
  sinanForm: "dengue", notes: "óbito por dengue: imediata, notificar à mão",
  sources: { deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de dengue", repeat_after_days: "proposta do plano 25" } };
const MEASLES: DiseaseView = { code: "sarampo", name: "Sarampo", deadline: "immediate", cid10: [ "B059" ], ciap2: [ "A71" ], repeatAfterDays: 30,
  sinanForm: null, notes: null, sources: { deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de sarampo" } };
const V1: ListView = { version: 1, ordinance: "Portaria GM/MS nº 11.211/2026", effectiveFrom: "2026-03-01", current: false,
  createdAt: "2026-10-27T12:00:00Z", publishedBy: null, notes: null, sources: { ordinance: "Portaria GM/MS nº 11.211/2026" }, diseases: [ DENGUE ] };
const V2: ListView = { ...V1, version: 2, effectiveFrom: "2026-10-01", current: true, publishedBy: "mantenedor@rotasaude.app", notes: "inclui sarampo",
  sources: null, diseases: [ DENGUE, MEASLES ] };
const V3: ListView = { ...V2, version: 3, effectiveFrom: "2026-12-01", current: false };
const TODAY = "2026-10-27";

describe("rótulos e versões", () => {
  it("prazo com rótulo; desconhecido cru", () => {
    expect(deadlineText("immediate")).toBe("imediata (24 h)");
    expect(deadlineText("weekly")).toBe("semanal (7 dias)");
    expect(deadlineText("monthly")).toBe("monthly");
  });
  it("vigente, mais recente, agendada e histórico do mais novo para o mais antigo", () => {
    expect(currentList([ V1, V3, V2 ])?.version).toBe(2);
    expect(latestList([ V1, V3, V2 ])?.version).toBe(3);
    expect(latestList([])).toBeNull();
    expect(scheduledList([ V1, V3, V2 ])?.version).toBe(3);
    expect(scheduledList([ V1, V2 ])).toBeNull();
    // Duas agendadas: a próxima a entrar em vigor (a menor acima da vigente), não a mais recente.
    const V4 = { ...V3, version: 4, effectiveFrom: "2027-01-01" };
    expect(scheduledList([ V4, V1, V3, V2 ])?.version).toBe(3);
    expect(latestList([ V4, V1, V3, V2 ])?.version).toBe(4);
    expect(historyOf([ V1, V3, V2 ]).map((l) => l.version)).toEqual([ 3, 2, 1 ]);
    expect([ V1, V2, V3 ].map((l) => listState(l, [ V1, V2, V3 ]))).toEqual([ "anterior", "vigente", "agendada" ]);
  });
  it("estado pelo número da versão; há versões mas nenhuma em vigor: todas agendadas", () => {
    const S1 = { ...V1, effectiveFrom: "2027-01-01", current: false };
    const S2 = { ...V2, effectiveFrom: "2027-02-01", current: false };
    expect(currentList([ S1, S2 ])).toBeNull();
    expect(scheduledList([ S2, S1 ])?.version).toBe(1);
    expect([ S1, S2 ].map((l) => listState(l, [ S1, S2 ]))).toEqual([ "agendada", "agendada" ]);
  });
  it("data só-dia como texto, sem fuso; hoje em America/Sao_Paulo", () => {
    expect(dateText("2026-03-01")).toBe("01/03/2026");
    expect(todaySP(new Date("2026-10-28T02:30:00Z"))).toBe("2026-10-27");
    expect(todaySP(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
    expect(NOTIFIABLE_QUERY_KEY).toEqual([ "platform", "notifiableDiseases" ]);
  });
});

describe("rascunho", () => {
  it("parte da versão dada, sem vigência nem nota; códigos em texto; as fontes de prazo e códigos editáveis, as outras guardadas", () => {
    const d = toDraft(V3);
    expect(d.ordinance).toBe("Portaria GM/MS nº 11.211/2026");
    expect(d.effectiveFrom).toBe("");
    expect(d.notes).toBe("");
    expect(d.diseases[0]).toEqual({ code: "dengue", name: "Dengue", deadline: "weekly", cid10: "A90, A91", ciap2: "", repeatAfterDays: "30",
      sinanForm: "dengue", notes: "óbito por dengue: imediata, notificar à mão", deadlineSource: "Portaria GM/MS 11.211/2026, anexo 1",
      cid10Source: "ficha de investigação de dengue", otherSources: { repeat_after_days: "proposta do plano 25" } });
    expect(toDraft(null)).toEqual({ ordinance: "", effectiveFrom: "", notes: "", diseases: [] });
    expect(emptyDisease()).toEqual({ code: "", name: "", deadline: "weekly", cid10: "", ciap2: "", repeatAfterDays: "30", sinanForm: "", notes: "",
      deadlineSource: "", cid10Source: "", otherSources: {} });
  });
  it("códigos: maiúsculas, sem ponto, sem repetir", () => {
    expect(codesOf(" a90.0, A91;a90.0  b05 ")).toEqual([ "A900", "A91", "B05" ]);
  });
});

describe("formato: recusar, nunca cortar", () => {
  const ok = toDraft(V2).diseases[0];
  it("doença: formato, recusar sem cortar", () => {
    expect(diseaseProblem(ok)).toBeNull();
    expect(diseaseProblem({ ...ok, code: "Dengue" })).toBe("código de 2 a 48 caracteres: minúscula no início, depois minúsculas, números ou _");
    expect(diseaseProblem({ ...ok, code: "d" })).toBe("código de 2 a 48 caracteres: minúscula no início, depois minúsculas, números ou _");
    expect(diseaseProblem({ ...ok, code: "a".repeat(49) })).toBe("código de 2 a 48 caracteres: minúscula no início, depois minúsculas, números ou _");
    expect(diseaseProblem({ ...ok, code: "local_dengue" })).toBe("código local_ é das doenças da cidade, não da lista nacional");
    expect(diseaseProblem({ ...ok, name: "  " })).toBe("nome de 1 a 120 caracteres");
    expect(diseaseProblem({ ...ok, name: "x".repeat(121) })).toBe("nome de 1 a 120 caracteres");
    expect(diseaseProblem({ ...ok, name: "Ç".repeat(120) })).toBeNull();
    expect(diseaseProblem({ ...ok, deadline: "" })).toBe("escolha o prazo");
    expect(diseaseProblem({ ...ok, deadline: "monthly" })).toBe("escolha o prazo");
    expect(diseaseProblem({ ...ok, cid10: "A9" })).toBe("CID-10 inválido: A9");
    expect(diseaseProblem({ ...ok, cid10: "" })).toBeNull();
    expect(diseaseProblem({ ...ok, cid10: "A90, a90" })).toBe("CID-10 repetido: A90");
    expect(diseaseProblem({ ...ok, ciap2: "A770" })).toBe("CIAP-2 inválido: A770");
    expect(diseaseProblem({ ...ok, ciap2: "A77 A77" })).toBe("CIAP-2 repetido: A77");
    expect(diseaseProblem({ ...ok, repeatAfterDays: "30,5" })).toBe("janela de repetição: inteiro de 1 a 36500 dias");
    expect(diseaseProblem({ ...ok, repeatAfterDays: "0" })).toBe("janela de repetição: inteiro de 1 a 36500 dias");
    expect(diseaseProblem({ ...ok, repeatAfterDays: "36501" })).toBe("janela de repetição: inteiro de 1 a 36500 dias");
    expect(diseaseProblem({ ...ok, repeatAfterDays: "36500" })).toBeNull();
    expect(diseaseProblem({ ...ok, sinanForm: "x".repeat(61) })).toBe("ficha do Sinan com mais de 60 caracteres");
    expect(diseaseProblem({ ...ok, sinanForm: "x".repeat(60) })).toBeNull();
    expect(diseaseProblem({ ...ok, notes: "x".repeat(301) })).toBe("nota com mais de 300 caracteres");
    expect(diseaseProblem({ ...ok, notes: "x".repeat(300) })).toBeNull();
    expect(diseaseProblem({ ...ok, deadlineSource: " " })).toBe("informe a fonte do prazo");
    expect(diseaseProblem({ ...ok, cid10Source: "" })).toBe("informe a fonte dos códigos");
    // Fonte sem limite de tamanho (a de tuberculose tem 366) e sem regra de "pendente".
    expect(diseaseProblem({ ...ok, cid10Source: "x".repeat(366) })).toBeNull();
    expect(diseaseProblem({ ...ok, cid10Source: "pendente" })).toBeNull();
  });
  it("lista: portaria, nota, vigência, códigos únicos", () => {
    const d = { ...toDraft(V2), effectiveFrom: "2026-11-01" };
    expect(draftProblem(d, V2, TODAY)).toBeNull();
    expect(draftProblem({ ...d, ordinance: "P" }, V2, TODAY)).toBeNull();
    expect(draftProblem({ ...d, ordinance: "   " }, V2, TODAY)).toBe("portaria de 1 a 200 caracteres");
    expect(draftProblem({ ...d, ordinance: "x".repeat(201) }, V2, TODAY)).toBe("portaria de 1 a 200 caracteres");
    expect(draftProblem({ ...d, notes: "x".repeat(501) }, V2, TODAY)).toBe("nota da versão com mais de 500 caracteres");
    expect(draftProblem({ ...d, notes: "x".repeat(500) }, V2, TODAY)).toBeNull();
    expect(draftProblem({ ...d, effectiveFrom: "" }, V2, TODAY)).toBe("informe o início da vigência");
    expect(draftProblem({ ...d, effectiveFrom: "2026-02-30" }, V2, TODAY)).toBe("início da vigência inválido");
    expect(draftProblem({ ...d, effectiveFrom: "2026-10-26" }, V2, TODAY)).toBe("a vigência não pode começar antes de hoje");
    expect(draftProblem({ ...d, effectiveFrom: TODAY }, V2, TODAY)).toBeNull();
    expect(draftProblem({ ...d, effectiveFrom: TODAY }, null, TODAY)).toBeNull();
    // A base é a mais recente (agendada): antes dela, recusa; no mesmo dia, vale.
    expect(draftProblem({ ...d, effectiveFrom: "2026-11-30" }, V3, TODAY)).toBe("a vigência não pode começar antes da última versão publicada (01/12/2026)");
    expect(draftProblem({ ...d, effectiveFrom: "2026-12-01" }, V3, TODAY)).toBeNull();
    expect(draftProblem({ ...d, diseases: [] }, V2, TODAY)).toBe("a lista precisa de ao menos uma doença");
    expect(draftProblem({ ...d, diseases: [ ...d.diseases, { ...d.diseases[0], name: "Dengue de novo" } ] }, V2, TODAY)).toBe("código repetido na lista: dengue");
    expect(draftProblem({ ...d, diseases: [ d.diseases[0], { ...d.diseases[1], cid10: "B0" } ] }, V2, TODAY)).toBe("doença 2 (sarampo): CID-10 inválido: B0");
  });
  it("lista: CID-10 sobreposto e CIAP-2 repetido entre doenças, antes de queimar um TOTP", () => {
    const d = { ...toDraft(V2), effectiveFrom: "2026-11-01" };
    expect(draftProblem({ ...d, diseases: [ d.diseases[0], { ...d.diseases[1], cid10: "B059, A900" } ] }, V2, TODAY))
      .toBe("doença 2 (sarampo): CID-10 A900 já coberto por dengue (A90)");
    expect(draftProblem({ ...d, diseases: [ { ...d.diseases[0], cid10: "A900" }, { ...d.diseases[1], cid10: "A90" } ] }, V2, TODAY))
      .toBe("doença 2 (sarampo): CID-10 A90 cobre A900 de dengue");
    expect(draftProblem({ ...d, diseases: [ { ...d.diseases[0], cid10: "A90, A900" }, d.diseases[1] ] }, V2, TODAY)).toBeNull();
    expect(draftProblem({ ...d, diseases: [ { ...d.diseases[0], ciap2: "A71" }, d.diseases[1] ] }, V2, TODAY))
      .toBe("doença 2 (sarampo): CIAP-2 A71 já está em dengue");
  });
});

describe("envio e diferença", () => {
  it("variáveis: códigos normalizados, números, nulos, fontes juntas; o TOTP e a versão de partida", () => {
    const d = { ...toDraft(V2), effectiveFrom: "2026-11-01", ordinance: " Portaria GM/MS nº 11.211/2026 " };
    d.diseases[1] = { ...d.diseases[1], cid10: "b05.9", sinanForm: " ", notes: "", name: " Sarampo ", cid10Source: " ficha de investigação de sarampo " };
    expect(draftToVariables(d, "123456", 2)).toEqual({
      code: "123456", expectedVersion: 2, ordinance: "Portaria GM/MS nº 11.211/2026", effectiveFrom: "2026-11-01", notes: null,
      diseases: [
        { code: "dengue", name: "Dengue", deadline: "weekly", cid10: [ "A90", "A91" ], ciap2: [], repeatAfterDays: 30, sinanForm: "dengue",
          notes: "óbito por dengue: imediata, notificar à mão",
          sources: { repeat_after_days: "proposta do plano 25", deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de dengue" } },
        { code: "sarampo", name: "Sarampo", deadline: "immediate", cid10: [ "B059" ], ciap2: [ "A71" ], repeatAfterDays: 30, sinanForm: null, notes: null,
          sources: { deadline: "Portaria GM/MS 11.211/2026, anexo 1", cid10: "ficha de investigação de sarampo" } } ] });
    expect(draftToVariables({ ...d, notes: " revisão anual " }, "123456", 0)).toMatchObject({ expectedVersion: 0, notes: "revisão anual" });
  });
  it("diferença entre a base e o rascunho", () => {
    const d = toDraft(V2);
    d.diseases = [ { ...d.diseases[0], deadline: "immediate" },
      { ...emptyDisease(), code: "mpox", name: "Mpox", cid10: "B04", deadlineSource: "Portaria", cid10Source: "ficha de mpox" } ];
    expect(listDiff(V2, d)).toEqual({ added: [ "mpox" ], removed: [ "sarampo" ], changed: [ "dengue" ] });
    expect(listDiff(V2, toDraft(V2))).toEqual({ added: [], removed: [], changed: [] });
    const reordered = toDraft(V2);
    reordered.diseases[0] = { ...reordered.diseases[0], cid10: "a91, A90" };
    expect(listDiff(V2, reordered).changed).toEqual([]);
    const source = toDraft(V2);
    source.diseases[0] = { ...source.diseases[0], otherSources: {}, cid10Source: "outra ficha" };
    expect(listDiff(V2, source).changed).toEqual([ "dengue" ]);
    expect(listDiff(null, d)).toEqual({ added: [ "dengue", "mpox" ], removed: [], changed: [] });
    expect(diffText(listDiff(V2, d))).toBe("1 nova, 1 retirada, 1 alterada");
    expect(diffText({ added: [ "a", "b" ], removed: [], changed: [] })).toBe("2 novas, 0 retiradas, 0 alteradas");
    expect(diffText({ added: [], removed: [], changed: [] })).toBe("nenhuma mudança nas doenças");
  });
  it("recusas do api viram frase pelo caminho, nunca o código de máquina; versão de partida velha", () => {
    const d = toDraft(V2);
    expect(publishErrorText([ { path: "expectedVersion", message: "a lista mudou desde a versão 2" } ], d)).toBe(STALE_LIST_TEXT);
    expect(publishErrorText([ { path: "expectedVersion", message: "versão de partida ausente" } ], d)).toBe(STALE_LIST_TEXT);
    expect(publishErrorText([ { path: "diseases.1.cid10.0", message: "invalid_list" } ], d)).toBe("doença 2 (sarampo): CID-10 nº 1 recusado");
    expect(publishErrorText([ { path: "diseases.0.ciap2.2", message: "invalid_list" } ], d)).toBe("doença 1 (dengue): CIAP-2 nº 3 recusado");
    expect(publishErrorText([ { path: "diseases.0.repeatAfterDays", message: "invalid_list" } ], d)).toBe("doença 1 (dengue): janela de repetição recusada");
    expect(publishErrorText([ { path: "diseases.0.sources", message: "invalid_list" } ], d)).toBe("doença 1 (dengue): fontes recusadas");
    expect(publishErrorText([ { path: "diseases.0", message: "invalid_list" } ], d)).toBe("doença 1 (dengue) recusada");
    expect(publishErrorText([ { path: "diseases.7.name", message: "invalid_list" } ], d)).toBe("doença 8: nome recusado");
    expect(publishErrorText([ { path: "diseases.0.colour", message: "invalid_list" } ], d)).toBe("doença 1 (dengue) recusada");
    expect(publishErrorText([ { path: "diseases", message: "invalid_list" } ], d)).toBe("a lista precisa de ao menos uma doença");
    expect(publishErrorText([ { path: "effectiveFrom", message: "invalid_list" } ], d))
      .toBe("vigência recusada: não pode começar antes de hoje nem antes da última versão publicada");
    expect(publishErrorText([ { path: "ordinance", message: "invalid_list" } ], d)).toBe("portaria recusada: de 1 a 200 caracteres");
    expect(publishErrorText([ { path: "notes", message: "invalid_list" } ], d)).toBe("nota da versão recusada: até 500 caracteres");
    expect(publishErrorText([ { path: "code", message: "código inválido" } ], d)).toBe("código inválido");
    expect(publishErrorText([ { path: null, message: "algo novo" } ], d)).toBe("algo novo");
    expect(publishErrorText([ { path: "outraCoisa", message: "invalid_list" } ], d)).toBe("a API recusou a lista (outraCoisa)");
    expect(publishErrorText([ { path: null, message: "invalid_list" } ], d)).toBe("a API recusou a lista — confira os campos");
    expect(publishErrorText([], d)).toBe("não foi possível concluir — tente de novo");
    expect(publishErrorText([ { path: "ordinance", message: "invalid_list" }, { path: "notes", message: "invalid_list" } ], d))
      .toBe("portaria recusada: de 1 a 200 caracteres; nota da versão recusada: até 500 caracteres");
  });
});
