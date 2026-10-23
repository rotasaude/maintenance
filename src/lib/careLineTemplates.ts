// Regras do catálogo-base de linhas de cuidado da plataforma (módulo 23,
// F-23.1; spec §4 "Plataforma"; contrato §1 e §8; Rules do api). Elegibilidade
// e boas práticas são JSON (snake_case). A tela edita os campos simples e
// PRESERVA os avançados (all_of, code_filter, applies_to; identidades de gênero
// e `declared`) da versão de partida. Quem valida é o api; aqui se recusa o que
// ele recusaria por formato — nunca cortar. Valor desconhecido (api mais novo)
// aparece cru e continua selecionado. A forma enviada é a enxuta do
// catalog-base.yml: nenhuma lista vazia, nenhum objeto vazio, nenhum nulo.

type Codes = { ciap2?: string[]; cid10?: string[] };
export type EligibilityJson = {
  problems?: Codes; exclude_problems?: Codes; age_min_days?: number | null; age_max_days?: number | null;
  age_min_years?: number | null; age_max_years?: number | null; sex?: string | null;
  gender_identities_included?: string[]; gender_identities_excluded?: string[]; declared?: string[]; requires_anchor?: string | null;
};
export type PracticeJson = {
  key: string; label: string; citizen_label?: string | null; source: string; anchor: string; window_start_days?: number | null;
  window_days: number; min_count: number; schedule: string; cbo_filter?: string[] | null; points?: number | null;
  code_filter?: { ciap2?: string[]; cid10?: string[] } | null;
  applies_to?: { age_min_years?: number; age_max_years?: number; sex?: string } | null;
  all_of?: { source: string; window_days?: number }[][] | null;
};
export type TemplateView = {
  key: string; version: number; current: boolean; name: string; indicator: string; declaredCondition?: string | null;
  eligibility: EligibilityJson; practices: PracticeJson[]; createdAt: string; createdBy?: string | null;
};

export const KEYS = [ "child_c2", "pregnancy_c3", "diabetes_c4", "hypertension_c5", "elderly_c6", "women_c7" ] as const;
const KEY_INFO: Record<string, { indicator: string; name: string }> = {
  child_c2: { indicator: "C2", name: "Cuidado da criança até 2 anos" },
  pregnancy_c3: { indicator: "C3", name: "Gestante e puérpera" },
  diabetes_c4: { indicator: "C4", name: "Pessoa com diabetes" },
  hypertension_c5: { indicator: "C5", name: "Pessoa com hipertensão" },
  elderly_c6: { indicator: "C6", name: "Pessoa idosa" },
  women_c7: { indicator: "C7", name: "Mulher e prevenção do câncer" }
};
export function keyText(key: string): string {
  const info = KEY_INFO[key];
  return info ? `${info.indicator} — ${info.name}` : key;
}
// O api exige indicator == o da chave: a tela não o pergunta, deriva (chave desconhecida: "").
export function indicatorOf(key: string): string { return KEY_INFO[key]?.indicator ?? ""; }

export const CONDITIONS = [ "", "diabetes", "hypertension", "pregnancy", "mental_health" ] as const;

export const SOURCE_KINDS = [ "consultation", "blood_pressure", "weight_height", "exam", "procedure", "acs_visit", "vaccine", "oral_health" ] as const;
const SOURCE_KIND_LABELS: Record<string, string> = {
  consultation: "consulta finalizada", blood_pressure: "pressão arterial (escuta ou consulta)", weight_height: "peso e altura (escuta ou consulta)",
  exam: "exame (SIGTAP)", procedure: "procedimento (SIGTAP)", acs_visit: "visita do ACS (não acompanhada pelo sistema)",
  vaccine: "vacina (não acompanhada pelo sistema)", oral_health: "saúde bucal (não acompanhada pelo sistema)"
};
export function sourceKindText(kind: string): string { return SOURCE_KIND_LABELS[kind] ?? kind; }
// Fontes que levam código depois dos dois pontos.
export const CODED: ReadonlySet<string> = new Set([ "exam", "procedure", "vaccine" ]);

function splitSource(source: string): [ string, string | undefined ] {
  const i = source.indexOf(":");
  return i < 0 ? [ source, undefined ] : [ source.slice(0, i), source.slice(i + 1) ];
}

export function sourceText(source: string): string {
  const [ kind, code ] = splitSource(source);
  if (code !== undefined) {
    if (kind === "exam" && code) return `exame SIGTAP ${code} (pedido ou resultado)`;
    if (kind === "procedure" && code) return `procedimento SIGTAP ${code}`;
    if (kind === "vaccine" && code) return `vacina ${code} (não acompanhada pelo sistema)`;
    return source;
  }
  return !CODED.has(kind) && SOURCE_KIND_LABELS[kind] ? SOURCE_KIND_LABELS[kind] : source;
}

export const SCHEDULES = [ "end_of_window", "proportional" ] as const;
const SCHEDULE_LABELS: Record<string, string> = { end_of_window: "até o fim da janela", proportional: "proporcional ao tempo" };
export function scheduleText(code: string): string { return SCHEDULE_LABELS[code] ?? code; }

export const ANCHORS = [ "rolling", "enrollment", "birth", "lmp" ] as const;
const ANCHOR_LABELS: Record<string, string> = { rolling: "janela móvel", enrollment: "desde a inscrição", birth: "desde o nascimento", lmp: "desde a DUM" };
export function anchorText(code: string): string { return ANCHOR_LABELS[code] ?? code; }

export const SEXES = [ "", "female", "male" ] as const;
const SEX_LABELS: Record<string, string> = { "": "qualquer", female: "feminino", male: "masculino" };
export function sexText(code: string | null | undefined): string { return SEX_LABELS[code ?? ""] ?? String(code); }

export function ruleText(p: PracticeJson): string {
  const span = p.window_start_days ? `do dia ${p.window_start_days} ao ${p.window_days}` : `em ${p.window_days} dias`;
  const parts = [ sourceText(p.source), `${p.min_count}× ${span}, ${scheduleText(p.schedule)}`, anchorText(p.anchor) ];
  if (p.cbo_filter && p.cbo_filter.length > 0) parts.push(`CBO ${p.cbo_filter.join(", ")}`);
  if (typeof p.points === "number") parts.push(`${p.points} pontos`);
  return parts.join(" · ");
}

// Os campos que a tela preserva sem editar, em texto (null se não há).
export function advancedText(p: PracticeJson): string | null {
  const parts: string[] = [];
  if (p.all_of && p.all_of.length > 0) {
    const alt = (a: { source: string; window_days?: number }) => (a.window_days ? `${a.source} (${a.window_days} dias)` : a.source);
    parts.push(`todas de: ${p.all_of.map((g) => g.map(alt).join(" ou ")).join(" | ")}`);
  }
  const codes = [ ...(p.code_filter?.ciap2 ?? []), ...(p.code_filter?.cid10 ?? []) ];
  if (codes.length > 0) parts.push(`só com código: ${codes.join(", ")}`);
  const a = p.applies_to;
  if (a && (a.age_min_years != null || a.age_max_years != null)) parts.push(`vale de ${a.age_min_years ?? 0} a ${a.age_max_years ?? "—"} anos`);
  if (a?.sex) parts.push(`só sexo ${sexText(a.sex)}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const range = (min: number | null | undefined, max: number | null | undefined, unit: string, maxOnly: string) =>
  min != null && max != null ? `de ${min} a ${max} ${unit}` : min != null ? `a partir de ${min} ${unit}` : max != null ? maxOnly : null;

export function eligibilityText(e: EligibilityJson): string {
  const parts: string[] = [];
  if (e.problems?.ciap2?.length) parts.push(`CIAP-2 ${e.problems.ciap2.join(", ")}`);
  if (e.problems?.cid10?.length) parts.push(`CID-10 ${e.problems.cid10.join(", ")}`);
  if (e.exclude_problems?.ciap2?.length) parts.push(`exceto CIAP-2 ${e.exclude_problems.ciap2.join(", ")}`);
  if (e.exclude_problems?.cid10?.length) parts.push(`exceto CID-10 ${e.exclude_problems.cid10.join(", ")}`);
  const days = range(e.age_min_days, e.age_max_days, "dias de vida", `até ${e.age_max_days} dias de vida`);
  if (days) parts.push(days);
  const years = range(e.age_min_years, e.age_max_years, "anos", `até ${e.age_max_years} anos`);
  if (years) parts.push(years);
  if (e.sex) parts.push(`sexo ${sexText(e.sex)}`);
  if (e.gender_identities_included?.length) parts.push(`inclui: ${e.gender_identities_included.join(", ")}`);
  if (e.gender_identities_excluded?.length) parts.push(`exclui: ${e.gender_identities_excluded.join(", ")}`);
  if (e.declared?.length) parts.push(`condição declarada: ${e.declared.join(", ")}`);
  if (e.requires_anchor === "lmp") parts.push("pede a DUM");
  return parts.length > 0 ? parts.join(" · ") : "sem critério de entrada";
}

export function keyOrder(key: string): number {
  const i = (KEYS as readonly string[]).indexOf(key);
  return i === -1 ? KEYS.length : i;
}

// Vigente de cada chave: a marcada `current`, ou a de maior versão; chaves do
// contrato na ordem dele, depois as desconhecidas.
export function currentTemplates(all: TemplateView[]): TemplateView[] {
  const byKey = new Map<string, TemplateView>();
  for (const t of all) {
    const seen = byKey.get(t.key);
    if (!seen || (t.current && !seen.current) || (t.current === seen.current && t.version > seen.version)) byKey.set(t.key, t);
  }
  return [ ...byKey.values() ].sort((a, b) => keyOrder(a.key) - keyOrder(b.key) || a.key.localeCompare(b.key));
}

export function versionsOf(all: TemplateView[], key: string): TemplateView[] {
  return all.filter((t) => t.key === key).sort((a, b) => b.version - a.version);
}

export function pointsTotal(practices: { points?: number | null }[]): number {
  return practices.reduce((sum, p) => sum + (typeof p.points === "number" ? p.points : 0), 0);
}

// ─── Rascunho da versão nova ─────────────────────────────────────────────
type Advanced = Pick<PracticeJson, "code_filter" | "applies_to" | "all_of">;
export type PracticeDraft = {
  key: string; label: string; citizenLabel: string; sourceKind: string; code: string; windowStartDays: string; windowDays: string;
  minCount: string; schedule: string; anchor: string; cboFilter: string; points: string; advanced: Advanced;
};
export type TemplateDraft = {
  key: string; name: string; indicator: string; declaredCondition: string; ciap: string; cid10: string; excludeCiap: string;
  excludeCid10: string; ageMinYears: string; ageMaxYears: string; ageMinDays: string; ageMaxDays: string; sex: string;
  requiresAnchor: string; preserved: Pick<EligibilityJson, "gender_identities_included" | "gender_identities_excluded" | "declared">;
  practices: PracticeDraft[];
};
export type TemplateVariables = {
  key: string; name: string; indicator: string; declaredCondition: string | null; eligibility: EligibilityJson; practices: PracticeJson[];
};

export const LIMITS = {
  name: 120, label: 120, citizenLabel: 80, practices: 20, windowDays: 7300, minCount: 50, ageYears: 130, ageDays: 47450,
  points: 100, cbo: 30, codes: 300
} as const;

export function emptyPractice(): PracticeDraft {
  return { key: "", label: "", citizenLabel: "", sourceKind: "consultation", code: "", windowStartDays: "", windowDays: "183", minCount: "1",
    schedule: "end_of_window", anchor: "rolling", cboFilter: "", points: "", advanced: {} };
}

// CBO só vale na fonte consulta: trocar a fonte para outra limpa o campo.
export function changeSource(p: PracticeDraft, sourceKind: string): PracticeDraft {
  return { ...p, sourceKind, cboFilter: sourceKind === "consultation" ? p.cboFilter : "" };
}

const numText = (n: number | null | undefined) => (n == null ? "" : String(n));

function practiceDraft(p: PracticeJson): PracticeDraft {
  const [ kind, code ] = splitSource(p.source);
  const advanced: Advanced = {};
  if (p.code_filter) advanced.code_filter = p.code_filter;
  if (p.applies_to) advanced.applies_to = p.applies_to;
  if (p.all_of) advanced.all_of = p.all_of;
  return {
    key: p.key, label: p.label, citizenLabel: p.citizen_label ?? "", sourceKind: kind, code: code ?? "",
    windowStartDays: p.window_start_days ? String(p.window_start_days) : "", windowDays: String(p.window_days), minCount: String(p.min_count),
    schedule: p.schedule, anchor: p.anchor, cboFilter: (p.cbo_filter ?? []).join(", "),
    points: typeof p.points === "number" ? String(p.points) : "", advanced
  };
}

export function toDraft(t: TemplateView): TemplateDraft {
  const e = t.eligibility;
  const preserved: TemplateDraft["preserved"] = {};
  if (e.gender_identities_included?.length) preserved.gender_identities_included = e.gender_identities_included;
  if (e.gender_identities_excluded?.length) preserved.gender_identities_excluded = e.gender_identities_excluded;
  if (e.declared?.length) preserved.declared = e.declared;
  return {
    key: t.key, name: t.name, indicator: indicatorOf(t.key) || t.indicator, declaredCondition: t.declaredCondition ?? "",
    ciap: (e.problems?.ciap2 ?? []).join(", "), cid10: (e.problems?.cid10 ?? []).join(", "),
    excludeCiap: (e.exclude_problems?.ciap2 ?? []).join(", "), excludeCid10: (e.exclude_problems?.cid10 ?? []).join(", "),
    ageMinYears: numText(e.age_min_years), ageMaxYears: numText(e.age_max_years), ageMinDays: numText(e.age_min_days),
    ageMaxDays: numText(e.age_max_days), sex: e.sex ?? "", requiresAnchor: e.requires_anchor ?? "", preserved,
    practices: t.practices.map(practiceDraft)
  };
}

export function firstDraft(key: string): TemplateDraft {
  const info = KEY_INFO[key] ?? { indicator: "", name: "" };
  return { key, name: info.name, indicator: info.indicator, declaredCondition: "", ciap: "", cid10: "", excludeCiap: "", excludeCid10: "",
    ageMinYears: "", ageMaxYears: "", ageMinDays: "", ageMaxDays: "", sex: "", requiresAnchor: "", preserved: {},
    practices: [ emptyPractice() ] };
}

const codesOf = (text: string) => [ ...new Set(text.toUpperCase().replace(/\./g, "").split(/[\s,;]+/).filter(Boolean)) ];
const wordsOf = (text: string) => [ ...new Set(text.split(/[\s,;]+/).filter(Boolean)) ];
const CIAP_RE = /^[A-Z]\d{2}$/;
const CID_RE = /^[A-Z]\d{2}[0-9X]?$/;
const EXAM_RE = /^02\d{8}$/;
const PROCEDURE_RE = /^\d{10}$/;
const VACCINE_RE = /^[a-z0-9_]{1,30}$/;
const CBO_RE = /^\d{4,6}$/;
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

function intOf(raw: string): number | null {
  const t = raw.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}
// "" = sem limite; inválido = undefined.
function boundOf(raw: string, max: number): number | null | undefined {
  if (raw.trim() === "") return null;
  const n = intOf(raw);
  return n === null || n > max ? undefined : n;
}

function codesProblem(text: string, re: RegExp, label: string): string | null {
  const all = codesOf(text);
  const bad = all.find((c) => !re.test(c));
  if (bad) return `código ${label} inválido: ${bad}`;
  return all.length > LIMITS.codes ? `no máximo ${LIMITS.codes} códigos por lista` : null;
}

// Frases dos códigos de UserError que a tela também antecipa (as mesmas do api).
const INVALID_ELIGIBILITY = "elegibilidade inválida — confira os códigos e as idades";
const INVALID_DECLARED = "condição declarada precisa estar entre as condições de entrada (eligibility.declared)";

function practiceProblem(p: PracticeDraft, n: string): string | null {
  const label = p.label.trim();
  if (!KEY_RE.test(p.key.trim())) return `${n}: chave começa com letra; minúsculas, números e _ (até 40)`;
  if (!label) return `${n}: escreva o que conta`;
  if (label.length > LIMITS.label) return `${n}: até ${LIMITS.label} caracteres`;
  if (p.citizenLabel.trim().length > LIMITS.citizenLabel) return `${n}: texto para o cidadão até ${LIMITS.citizenLabel} caracteres`;
  const code = p.code.trim();
  if (p.sourceKind === "exam" && !EXAM_RE.test(code)) return `${n}: exame com SIGTAP do grupo 02 (10 dígitos)`;
  if (p.sourceKind === "procedure" && !PROCEDURE_RE.test(code)) return `${n}: procedimento com SIGTAP de 10 dígitos`;
  if (p.sourceKind === "vaccine" && !VACCINE_RE.test(code)) return `${n}: código da vacina (minúsculas, números e _, até 30)`;
  const w = intOf(p.windowDays);
  if (w === null || w < 1 || w > LIMITS.windowDays) return `${n}: janela de 1 a ${LIMITS.windowDays} dias`;
  const start = p.windowStartDays.trim() === "" ? 0 : intOf(p.windowStartDays);
  if (start === null) return `${n}: início da janela em dias inteiros`;
  if (start >= w) return `${n}: o início da janela passa do fim`;
  if (start > 0 && p.anchor === "rolling") return `${n}: início da janela só com âncora fixa`;
  const c = intOf(p.minCount);
  if (c === null || c < 1 || c > LIMITS.minCount) return `${n}: quantidade mínima de 1 a ${LIMITS.minCount}`;
  if (p.schedule === "proportional" && p.anchor === "rolling") return `${n}: cronograma proporcional só com âncora fixa`;

  // Avançados preservados: a edição simples (âncora, fonte, quantidade) pode quebrar o que o api confere.
  const groups = p.advanced.all_of ?? [];
  if (groups.length > 1 && c !== 1) return `${n}: com mais de um grupo de alternativas a quantidade mínima é 1`;
  if (groups.length > 1 && p.schedule === "proportional") return `${n}: cronograma proporcional não vale com mais de um grupo de alternativas`;
  if (groups.some((g) => g.some((a) => a.window_days != null)) && p.anchor !== "rolling") return `${n}: janela própria numa alternativa só com âncora móvel`;
  const filter = p.advanced.code_filter;
  if (filter && (filter.ciap2?.length || filter.cid10?.length) && p.sourceKind !== "consultation") return `${n}: filtro por código só vale na fonte consulta`;

  const cbo = wordsOf(p.cboFilter);
  const badCbo = cbo.find((x) => !CBO_RE.test(x));
  if (badCbo) return `${n}: CBO de 4 a 6 dígitos (${badCbo})`;
  if (cbo.length > LIMITS.cbo) return `${n}: no máximo ${LIMITS.cbo} CBO`;
  if (cbo.length > 0 && p.sourceKind !== "consultation") return `${n}: CBO só vale na fonte consulta`;
  if (p.points.trim() === "") return `${n}: informe os pontos (Quadro 01 da nota metodológica)`;
  const points = intOf(p.points);
  if (points === null || points > LIMITS.points) return `${n}: pontos: número inteiro de 0 a ${LIMITS.points}`;
  return null;
}

export function draftProblem(d: TemplateDraft): string | null {
  const name = d.name.trim();
  if (!name) return "Nome: obrigatório";
  if (name.length > LIMITS.name) return `Nome: no máximo ${LIMITS.name} caracteres`;
  const codeProblem = codesProblem(d.ciap, CIAP_RE, "CIAP-2") ?? codesProblem(d.cid10, CID_RE, "CID-10")
    ?? codesProblem(d.excludeCiap, CIAP_RE, "CIAP-2") ?? codesProblem(d.excludeCid10, CID_RE, "CID-10");
  if (codeProblem) return codeProblem;
  const minY = boundOf(d.ageMinYears, LIMITS.ageYears);
  const maxY = boundOf(d.ageMaxYears, LIMITS.ageYears);
  if (minY === undefined || maxY === undefined) return `idade em anos inteiros, de 0 a ${LIMITS.ageYears}`;
  if (minY !== null && maxY !== null && minY > maxY) return "a idade mínima passa da máxima";
  const minD = boundOf(d.ageMinDays, LIMITS.ageDays);
  const maxD = boundOf(d.ageMaxDays, LIMITS.ageDays);
  if (minD === undefined || maxD === undefined) return `idade em dias inteiros, de 0 a ${LIMITS.ageDays}`;
  if (minD !== null && maxD !== null && minD > maxD) return "a idade mínima passa da máxima";
  // Critério de entrada: problema, idade, sexo ou condição declarada (exclusão, DUM e identidades não contam).
  const hasCriterion = codesOf(d.ciap).length > 0 || codesOf(d.cid10).length > 0 || [ minY, maxY, minD, maxD ].some((v) => v !== null)
    || d.sex !== "" || (d.preserved.declared?.length ?? 0) > 0;
  if (!hasCriterion) return INVALID_ELIGIBILITY;
  if (d.declaredCondition && !(d.preserved.declared ?? []).includes(d.declaredCondition)) return INVALID_DECLARED;
  if (d.practices.length === 0) return "inclua pelo menos uma boa prática";
  if (d.practices.length > LIMITS.practices) return `no máximo ${LIMITS.practices} boas práticas`;
  const keys = new Set<string>();
  for (const [ i, p ] of d.practices.entries()) {
    const n = `boa prática ${i + 1}`;
    const key = p.key.trim();
    if (KEY_RE.test(key) && keys.has(key)) return `${n}: chave repetida (${key})`;
    keys.add(key);
    const problem = practiceProblem(p, n);
    if (problem) return problem;
  }
  const total = d.practices.reduce((sum, p) => sum + (intOf(p.points) ?? 0), 0);
  if (total !== LIMITS.points) return `a soma dos pontos precisa ser ${LIMITS.points} (está em ${total})`;
  return null;
}

function codesJson(ciap: string, cid: string): Codes | undefined {
  const out: Codes = {};
  const ciap2 = codesOf(ciap);
  const cid10 = codesOf(cid);
  if (ciap2.length > 0) out.ciap2 = ciap2;
  if (cid10.length > 0) out.cid10 = cid10;
  return ciap2.length > 0 || cid10.length > 0 ? out : undefined;
}

const numberOrUndefined = (raw: string) => (raw.trim() === "" ? undefined : Number(raw.trim()));

// Só depois de draftProblem(d) === null. Campo vazio não vai; os avançados voltam iguais.
export function draftToVariables(d: TemplateDraft): TemplateVariables {
  const eligibility: EligibilityJson = {};
  const problems = codesJson(d.ciap, d.cid10);
  if (problems) eligibility.problems = problems;
  const excluded = codesJson(d.excludeCiap, d.excludeCid10);
  if (excluded) eligibility.exclude_problems = excluded;
  const bounds = {
    age_min_days: numberOrUndefined(d.ageMinDays), age_max_days: numberOrUndefined(d.ageMaxDays),
    age_min_years: numberOrUndefined(d.ageMinYears), age_max_years: numberOrUndefined(d.ageMaxYears)
  };
  for (const [ field, value ] of Object.entries(bounds) as [ "age_min_days" | "age_max_days" | "age_min_years" | "age_max_years", number | undefined ][])
    if (value !== undefined) eligibility[field] = value;
  if (d.sex) eligibility.sex = d.sex;
  Object.assign(eligibility, d.preserved);
  if (d.requiresAnchor) eligibility.requires_anchor = d.requiresAnchor;
  return {
    key: d.key, name: d.name.trim(), indicator: indicatorOf(d.key) || d.indicator, declaredCondition: d.declaredCondition || null, eligibility,
    practices: d.practices.map((p) => {
      const start = numberOrUndefined(p.windowStartDays);
      const cbo = wordsOf(p.cboFilter);
      const code = p.code.trim();
      const coded = CODED.has(p.sourceKind) || (!(SOURCE_KINDS as readonly string[]).includes(p.sourceKind) && code !== "");
      const out: PracticeJson = {
        key: p.key.trim(), label: p.label.trim(),
        ...(p.citizenLabel.trim() ? { citizen_label: p.citizenLabel.trim() } : {}),
        source: coded ? `${p.sourceKind}:${code}` : p.sourceKind, anchor: p.anchor,
        ...(start !== undefined && start > 0 ? { window_start_days: start } : {}),
        window_days: Number(p.windowDays.trim()), min_count: Number(p.minCount.trim()), schedule: p.schedule,
        ...(cbo.length > 0 ? { cbo_filter: cbo } : {}),
        points: Number(p.points.trim()),
        ...p.advanced
      };
      return out;
    })
  };
}

// Códigos de UserError da mutation (`message` = código, `path` = campo); desconhecido cru.
const UPSERT_ERRORS: Record<string, string> = {
  invalid_key: "linha desconhecida — atualize a tela",
  invalid_indicator: "indicador desconhecido — use C2 a C7",
  invalid_name: "nome inválido — de 1 a 120 caracteres",
  invalid_declared_condition: INVALID_DECLARED,
  invalid_practices: "boas práticas inválidas — confira os campos",
  invalid_eligibility: INVALID_ELIGIBILITY
};
const NAMED_PATHS = new Set([ "key", "indicator", "name", "declaredCondition" ]);

export function upsertErrorText(errors: { path?: string | null; message: string }[]): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors.map((e) => {
    const phrase = UPSERT_ERRORS[e.message] ?? e.message;
    return e.path && UPSERT_ERRORS[e.message] && !NAMED_PATHS.has(e.path) ? `${phrase} (${e.path})` : phrase;
  }).join("; ");
}
