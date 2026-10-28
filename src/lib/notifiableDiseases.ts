// Regras da lista nacional de doenças e agravos de notificação compulsória
// (módulo 25, F-25.1; spec §2 decisão 1; contrato §2, §3, §11 e §15 K17; plano
// do api, Tasks 0, 3 e 4). Versionada e imutável: publicar é criar a versão
// seguinte inteira, a partir da MAIS RECENTE (vigente ou agendada). Quem valida
// é o api (Surveillance::DiseaseList.validate e Publish); aqui se recusa o que
// ele recusaria por formato — nunca cortar —, porque cada recusa do servidor
// queima um TOTP. Valor desconhecido aparece cru; fonte de outro campo que a
// tela não edita volta como veio. Datas só-dia (AAAA-MM-DD) são texto, nunca
// `Date` (deslocaria um dia em BRT).

export type DiseaseView = {
  code: string; name: string; deadline: string; cid10: string[]; ciap2: string[]; repeatAfterDays: number;
  sinanForm: string | null; notes: string | null; sources: Record<string, string>;
};
export type ListView = {
  version: number; ordinance: string; effectiveFrom: string; current: boolean; createdAt: string; publishedBy: string | null;
  notes: string | null; sources: Record<string, unknown> | null; diseases: DiseaseView[];
};

// Campos de texto do formulário. `deadlineSource`/`cid10Source` são `sources.deadline`/`sources.cid10`;
// `otherSources` é o resto de `sources`, intocado.
export type DiseaseDraft = {
  code: string; name: string; deadline: string; cid10: string; ciap2: string; repeatAfterDays: string; sinanForm: string; notes: string;
  deadlineSource: string; cid10Source: string; otherSources: Record<string, string>;
};
export type ListDraft = { ordinance: string; effectiveFrom: string; notes: string; diseases: DiseaseDraft[] };

export type DiseaseInput = {
  code: string; name: string; deadline: string; cid10: string[]; ciap2: string[]; repeatAfterDays: number;
  sinanForm: string | null; notes: string | null; sources: Record<string, string>;
};
export type PublishVariables = {
  code: string; expectedVersion: number; ordinance: string; effectiveFrom: string; notes: string | null; diseases: DiseaseInput[];
};

export const NOTIFIABLE_QUERY_KEY = [ "platform", "notifiableDiseases" ] as const;
export const STALE_LIST_TEXT = "outra pessoa publicou uma versão enquanto você editava — recarregue";

export const DEADLINES = [ "immediate", "weekly" ] as const;
const DEADLINE_LABELS: Record<string, string> = { immediate: "imediata (24 h)", weekly: "semanal (7 dias)" };
export function deadlineText(code: string): string { return Object.hasOwn(DEADLINE_LABELS, code) ? DEADLINE_LABELS[code] : code; }

// Os do api (DiseaseList, Catalog). Fonte não tem máximo (a de tuberculose passa de 300).
export const LIMITS = { code: [ 2, 48 ], ordinance: 200, name: 120, listNotes: 500, notes: 300, sinanForm: 60, repeat: [ 1, 36500 ] } as const;
const PLATFORM_CODE = /^[a-z][a-z0-9_]{1,47}$/;
const CID_RE = /^[A-Z]\d{2}[0-9X]?$/;
const CIAP_RE = /^[A-Z]\d{2}$/;
const charCount = (text: string) => [ ...text ].length;

// ---- versões ----

export function currentList(all: ListView[]): ListView | null { return all.find((l) => l.current) ?? null; }

export function latestList(all: ListView[]): ListView | null {
  return all.reduce<ListView | null>((best, l) => (!best || l.version > best.version ? l : best), null);
}

// A próxima a entrar em vigor: a de menor versão acima da vigente (sem vigente, a menor de todas).
export function scheduledList(all: ListView[]): ListView | null {
  const current = currentList(all)?.version ?? 0;
  return all.reduce<ListView | null>((next, l) => (l.version > current && (!next || l.version < next.version) ? l : next), null);
}

export function historyOf(all: ListView[]): ListView[] { return [ ...all ].sort((a, b) => b.version - a.version); }

// Pelo número da versão contra a vigente; sem vigente, todas ainda vão entrar em vigor.
export function listState(l: ListView, all: ListView[]): "vigente" | "agendada" | "anterior" {
  const current = currentList(all)?.version ?? 0;
  if (l.version === current) return "vigente";
  return l.version > current ? "agendada" : "anterior";
}

export function dateText(day: string): string {
  const [ y, m, d ] = day.split("-");
  return `${d}/${m}/${y}`;
}

// Hoje (AAAA-MM-DD) no fuso do api.
export function todaySP(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// ---- rascunho ----

function diseaseDraft(d: DiseaseView): DiseaseDraft {
  const { deadline = "", cid10 = "", ...otherSources } = d.sources ?? {};
  return {
    code: d.code, name: d.name, deadline: d.deadline, cid10: d.cid10.join(", "), ciap2: d.ciap2.join(", "), repeatAfterDays: String(d.repeatAfterDays),
    sinanForm: d.sinanForm ?? "", notes: d.notes ?? "", deadlineSource: deadline, cid10Source: cid10, otherSources
  };
}

// Parte da versão mais recente (vigente ou agendada); a vigência e a nota da versão começam vazias.
export function toDraft(base: ListView | null): ListDraft {
  return { ordinance: base?.ordinance ?? "", effectiveFrom: "", notes: "", diseases: (base?.diseases ?? []).map(diseaseDraft) };
}

export function emptyDisease(): DiseaseDraft {
  return { code: "", name: "", deadline: "weekly", cid10: "", ciap2: "", repeatAfterDays: "30", sinanForm: "", notes: "",
    deadlineSource: "", cid10Source: "", otherSources: {} };
}

const rawCodes = (text: string) => text.toUpperCase().replace(/\./g, "").split(/[\s,;]+/).filter(Boolean);
// Deduplicar aqui e recusar repetidos em diseaseProblem é intencional: a recusa protege entrada que não passa por codesOf.
export function codesOf(text: string): string[] { return [ ...new Set(rawCodes(text)) ]; }

// ---- formato ----

// Recusa repetidos de propósito, embora codesOf deduplique (ver codesOf): o api recusa os dois em field_error.
function codesProblem(text: string, re: RegExp, label: string): string | null {
  const seen = new Set<string>();
  for (const c of rawCodes(text)) {
    if (!re.test(c)) return `${label} inválido: ${c}`;
    if (seen.has(c)) return `${label} repetido: ${c}`;
    seen.add(c);
  }
  return null;
}

export function diseaseProblem(d: DiseaseDraft): string | null {
  const code = d.code.trim();
  if (code.startsWith("local_")) return "código local_ é das doenças da cidade, não da lista nacional";
  if (!PLATFORM_CODE.test(code)) return `código de ${LIMITS.code[0]} a ${LIMITS.code[1]} caracteres: minúscula no início, depois minúsculas, números ou _`;
  const name = charCount(d.name.trim());
  if (name < 1 || name > LIMITS.name) return `nome de 1 a ${LIMITS.name} caracteres`;
  if (!(DEADLINES as readonly string[]).includes(d.deadline)) return "escolha o prazo";
  const codes = codesProblem(d.cid10, CID_RE, "CID-10") ?? codesProblem(d.ciap2, CIAP_RE, "CIAP-2");
  if (codes) return codes;
  const repeat = d.repeatAfterDays.trim();
  if (!/^\d+$/.test(repeat) || Number(repeat) < LIMITS.repeat[0] || Number(repeat) > LIMITS.repeat[1])
    return `janela de repetição: inteiro de ${LIMITS.repeat[0]} a ${LIMITS.repeat[1]} dias`;
  if (charCount(d.sinanForm.trim()) > LIMITS.sinanForm) return `ficha do Sinan com mais de ${LIMITS.sinanForm} caracteres`;
  if (charCount(d.notes.trim()) > LIMITS.notes) return `nota com mais de ${LIMITS.notes} caracteres`;
  if (!d.deadlineSource.trim()) return "informe a fonte do prazo";
  if (!d.cid10Source.trim()) return "informe a fonte dos códigos";
  return null;
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const diseaseLabel = (i: number, code: string | undefined) => (code?.trim() ? `doença ${i + 1} (${code.trim()})` : `doença ${i + 1}`);

// `latest` = a versão mais recente (vigente ou agendada); `today` em America/Sao_Paulo (todaySP).
// Na ordem do api: doença a doença, o formato, o código repetido, o CID-10 sobreposto e o CIAP-2 repetido.
export function draftProblem(d: ListDraft, latest: ListView | null, today: string): string | null {
  const ordinance = charCount(d.ordinance.trim());
  if (ordinance < 1 || ordinance > LIMITS.ordinance) return `portaria de 1 a ${LIMITS.ordinance} caracteres`;
  if (charCount(d.notes.trim()) > LIMITS.listNotes) return `nota da versão com mais de ${LIMITS.listNotes} caracteres`;
  if (!d.effectiveFrom) return "informe o início da vigência";
  if (!isDay(d.effectiveFrom)) return "início da vigência inválido";
  if (d.effectiveFrom < today) return "a vigência não pode começar antes de hoje";
  if (latest && d.effectiveFrom < latest.effectiveFrom)
    return `a vigência não pode começar antes da última versão publicada (${dateText(latest.effectiveFrom)})`;
  if (d.diseases.length === 0) return "a lista precisa de ao menos uma doença";

  const codes = new Set<string>();
  const cidOwners: { cid: string; i: number }[] = [];
  const ciapOwners = new Map<string, number>();
  for (const [ i, disease ] of d.diseases.entries()) {
    const code = disease.code.trim();
    const where = diseaseLabel(i, code);
    const problem = diseaseProblem(disease);
    if (problem) return `${where}: ${problem}`;
    if (codes.has(code)) return `código repetido na lista: ${code}`;
    codes.add(code);
    const cids = codesOf(disease.cid10);
    for (const c of cids) {
      const owner = cidOwners.find((o) => o.i !== i && (c.startsWith(o.cid) || o.cid.startsWith(c)));
      if (!owner) continue;
      const other = d.diseases[owner.i].code.trim();
      return c.startsWith(owner.cid) ? `${where}: CID-10 ${c} já coberto por ${other} (${owner.cid})` : `${where}: CID-10 ${c} cobre ${owner.cid} de ${other}`;
    }
    for (const c of cids) cidOwners.push({ cid: c, i });
    for (const c of codesOf(disease.ciap2)) {
      const owner = ciapOwners.get(c);
      if (owner !== undefined) return `${where}: CIAP-2 ${c} já está em ${d.diseases[owner].code.trim()}`;
      ciapOwners.set(c, i);
    }
  }
  return null;
}

// ---- envio ----

const blankToNull = (text: string) => (text.trim() === "" ? null : text.trim());

function diseaseInput(d: DiseaseDraft): DiseaseInput {
  return {
    code: d.code.trim(), name: d.name.trim(), deadline: d.deadline, cid10: codesOf(d.cid10), ciap2: codesOf(d.ciap2),
    repeatAfterDays: Number(d.repeatAfterDays.trim()), sinanForm: blankToNull(d.sinanForm), notes: blankToNull(d.notes),
    sources: { ...d.otherSources, deadline: d.deadlineSource.trim(), cid10: d.cid10Source.trim() }
  };
}

// Só depois de draftProblem(d) === null. `expectedVersion` = latestList(all)?.version ?? 0 — nunca nulo (K17).
export function draftToVariables(d: ListDraft, code: string, expectedVersion: number): PublishVariables {
  return { code, expectedVersion, ordinance: d.ordinance.trim(), effectiveFrom: d.effectiveFrom, notes: blankToNull(d.notes),
    diseases: d.diseases.map(diseaseInput) };
}

// ---- diferença ----

const sameSet = (a: string[], b: string[]) => [ ...new Set(a) ].sort().join(",") === [ ...new Set(b) ].sort().join(",");
function sameSources(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k]);
}
function sameDisease(base: DiseaseView, next: DiseaseInput): boolean {
  return base.name === next.name && base.deadline === next.deadline && sameSet(base.cid10, next.cid10) && sameSet(base.ciap2, next.ciap2)
    && base.repeatAfterDays === next.repeatAfterDays && (base.sinanForm ?? null) === next.sinanForm && (base.notes ?? null) === next.notes
    && sameSources(base.sources ?? {}, next.sources);
}

// Por código da doença, contra a versão de partida (a mais recente).
export function listDiff(base: ListView | null, d: ListDraft): { added: string[]; removed: string[]; changed: string[] } {
  const before = new Map((base?.diseases ?? []).map((x) => [ x.code, x ]));
  const next = d.diseases.map(diseaseInput);
  const nextCodes = new Set(next.map((x) => x.code));
  return {
    added: next.filter((x) => !before.has(x.code)).map((x) => x.code),
    removed: (base?.diseases ?? []).filter((x) => !nextCodes.has(x.code)).map((x) => x.code),
    changed: next.filter((x) => { const b = before.get(x.code); return b !== undefined && !sameDisease(b, x); }).map((x) => x.code)
  };
}

export function diffText(diff: { added: string[]; removed: string[]; changed: string[] }): string {
  const { added, removed, changed } = diff;
  if (added.length + removed.length + changed.length === 0) return "nenhuma mudança nas doenças";
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [ count(added.length, "nova", "novas"), count(removed.length, "retirada", "retiradas"), count(changed.length, "alterada", "alteradas") ].join(", ");
}

// ---- recusas ----

// O api devolve `message` = código de máquina (`invalid_list`) e `path` em camelCase
// (`diseases.1.cid10.0`, contado de 0). A frase sai do caminho; o código nunca aparece (errors.ts, I3).
const LIST_PATHS: Record<string, string> = {
  ordinance: `portaria recusada: de 1 a ${LIMITS.ordinance} caracteres`,
  notes: `nota da versão recusada: até ${LIMITS.listNotes} caracteres`,
  effectiveFrom: "vigência recusada: não pode começar antes de hoje nem antes da última versão publicada",
  diseases: "a lista precisa de ao menos uma doença"
};
const DISEASE_FIELDS: Record<string, string> = {
  code: "código recusado", name: "nome recusado", deadline: "prazo recusado", cid10: "CID-10 recusado", ciap2: "CIAP-2 recusado",
  repeatAfterDays: "janela de repetição recusada", sinanForm: "ficha do Sinan recusada", notes: "nota recusada", sources: "fontes recusadas"
};
const CODE_LISTS: Record<string, string> = { cid10: "CID-10", ciap2: "CIAP-2" };
const isMachineWord = (message: string) => /^[a-z0-9_]+$/.test(message);

function refusalText(path: string | null | undefined, message: string, d: ListDraft): string {
  if (!path) return isMachineWord(message) ? "a API recusou a lista — confira os campos" : message;
  if (path === "expectedVersion") return STALE_LIST_TEXT;
  if (path === "code") return message; // o TOTP: o formulário mostra no campo; aqui só por garantia (frase do api)
  if (Object.hasOwn(LIST_PATHS, path)) return LIST_PATHS[path];
  const m = /^diseases\.(\d+)(?:\.(\w+)(?:\.(\d+))?)?$/.exec(path);
  if (!m) return isMachineWord(message) ? `a API recusou a lista (${path})` : message;
  const i = Number(m[1]);
  const where = diseaseLabel(i, d.diseases[i]?.code);
  const [ , , field, j ] = m;
  if (field && j !== undefined && Object.hasOwn(CODE_LISTS, field)) return `${where}: ${CODE_LISTS[field]} nº ${Number(j) + 1} recusado`;
  if (field && j === undefined && Object.hasOwn(DISEASE_FIELDS, field)) return `${where}: ${DISEASE_FIELDS[field]}`;
  return `${where} recusada`;
}

export function publishErrorText(errors: { path?: string | null; message: string }[], d: ListDraft): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors.map((e) => refusalText(e.path, e.message, d)).join("; ");
}
