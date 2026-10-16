// Regras de exibição e de entrada do catálogo-base de laboratório da
// plataforma (módulo 21b, F-21.14; spec §4 "Plataforma"; contrato §10).
// Quem valida de verdade é o api; aqui só se traduz o que ele devolveu e se
// converte o que a pessoa digitou. Valor desconhecido (api mais novo) aparece
// cru e continua selecionado; nulo vira "—".
export type RangeView = {
  sex: string; ageMinDays: number; ageMaxDays: number; low?: number | null; high?: number | null; text?: string | null;
};
export type AnalyteView = {
  id: string; key: string; name: string; loinc?: string | null; unit?: string | null; valueType: string;
  choices: string[]; decimals: number; position: number; referenceRanges: RangeView[];
};
export type TemplateView = {
  id: string; sigtapCode: string; name: string; sector: string; material: string; container: string;
  suggestedMethod?: string | null; preparation?: string | null; active: boolean; analytes: AnalyteView[];
};
export type RangeInput = { sex: string; ageMinDays: number; ageMaxDays: number; low: number | null; high: number | null; text: string | null };
export type RangeDraft = { sex: string; ageMinDays: string; ageMaxDays: string; low: string; high: string; text: string };

// Divergência M3: códigos de setor do contrato.
export const SECTORS = [ "biochemistry", "hematology", "immunology", "urinalysis", "parasitology", "microbiology" ] as const;
const SECTOR_LABELS: Record<string, string> = {
  biochemistry: "Bioquímica", hematology: "Hematologia", immunology: "Imunologia",
  urinalysis: "Urinálise", parasitology: "Parasitologia", microbiology: "Microbiologia"
};
export function sectorText(sector: string): string {
  return SECTOR_LABELS[sector] ?? sector;
}

export const VALUE_TYPES = [ "numeric", "text", "choice" ] as const;
const VALUE_TYPE_LABELS: Record<string, string> = { numeric: "numérico", text: "texto", choice: "lista de opções" };
export function valueTypeText(valueType: string): string {
  return VALUE_TYPE_LABELS[valueType] ?? valueType;
}

export const SEXES = [ "any", "female", "male" ] as const;
const SEX_LABELS: Record<string, string> = { any: "qualquer", female: "feminino", male: "masculino" };
export function sexText(sex: string): string {
  return SEX_LABELS[sex] ?? sex;
}

// Opções de um <select>: as conhecidas e, se o valor atual for desconhecido,
// ele também — sem isso o <select> mostraria a primeira opção e salvar
// trocaria o valor em silêncio.
export function optionsWith(known: readonly string[], current: string): string[] {
  return known.includes(current) ? [ ...known ] : [ ...known, current ];
}

export function orNull(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

// Divergência M5: idade em dias; 43800 (120 anos) é o "sem limite".
export const UNBOUNDED_AGE_DAYS = 43800;
export const EMPTY_RANGE: RangeDraft = {
  sex: "any", ageMinDays: "0", ageMaxDays: String(UNBOUNDED_AGE_DAYS), low: "", high: "", text: ""
};

// Sem separador de milhar, de propósito: é o mesmo formato que a entrada aceita.
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6, useGrouping: false });
export function decimalText(n: number | null | undefined): string {
  return typeof n === "number" ? decimal.format(n) : "—";
}

// pt-BR: a vírgula é o separador decimal. "13,5" → 13.5; "" → null; inválido
// → undefined. Ponto é recusado em qualquer posição: "150.000" é milhar para
// quem digita no costume brasileiro e lido como 150 a faixa das plaquetas
// sairia errada para toda cidade.
export const DOT_IN_NUMBER = "use vírgula para decimais e não use ponto de milhar";
export function parseDecimal(raw: string): number | null | undefined {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^-?\d+(,\d+)?$/.test(t)) return undefined;
  return Number(t.replace(",", "."));
}

// Limites do api (Lab::Templates::SaveExam/SaveAnalyte, Ranges, Choices). O
// api passa a recusar texto longo em vez de cortar; aqui se confere antes de
// enviar para salvar nunca trocar o digitado em silêncio.
export const LIMITS = {
  name: 120, material: 60, container: 60, method: 160, unit: 30, rangeText: 120, ranges: 20, choices: 20, choice: 60
} as const;

export function textProblem(label: string, value: string, max: number): string | null {
  return value.trim().length > max ? `${label}: no máximo ${max} caracteres` : null;
}

export const DECIMALS_PHRASE = "casas decimais de 0 a 4";
export function decimalsProblem(raw: string): string | null {
  return /^[0-4]$/.test(raw.trim()) ? null : DECIMALS_PHRASE;
}

// B29: 1 a 20 opções, cada uma de 1 a 60 caracteres (sem espaços nas pontas),
// sem repetir (a caixa conta, como no api).
export const CHOICES_PHRASE = `a lista precisa de 1 a ${LIMITS.choices} opções distintas, cada uma com até ${LIMITS.choice} caracteres`;
export function choicesProblem(choices: string[]): string | null {
  const list = choices.map((c) => c.trim());
  const ok = list.length >= 1 && list.length <= LIMITS.choices && new Set(list).size === list.length
    && list.every((c) => c.length >= 1 && c.length <= LIMITS.choice);
  return ok ? null : CHOICES_PHRASE;
}

export function ageText(days: number): string {
  if (days === 0) return "0";
  return days % 365 === 0 ? `${days / 365} a` : `${days} d`;
}

export function rangeText(r: RangeView): string {
  const hasLow = typeof r.low === "number";
  const hasHigh = typeof r.high === "number";
  const values = hasLow && hasHigh ? `${decimalText(r.low)}–${decimalText(r.high)}`
    : hasLow ? `≥ ${decimalText(r.low)}`
    : hasHigh ? `≤ ${decimalText(r.high)}`
    : null;
  const text = r.text?.trim() ? r.text.trim() : null;
  const shown = values && text ? `${values} (${text})` : values ?? text ?? "—";
  return `${sexText(r.sex)}, ${ageText(r.ageMinDays)}–${ageText(r.ageMaxDays)}: ${shown}`;
}

export function rangesSummary(ranges: RangeView[]): string {
  return ranges.length === 0 ? "sem faixa" : ranges.map(rangeText).join("; ");
}

const draftNumber = (n: number | null | undefined) => (typeof n === "number" ? decimalText(n) : "");

export function rangeToDraft(r: RangeView): RangeDraft {
  return {
    sex: r.sex, ageMinDays: String(r.ageMinDays), ageMaxDays: String(r.ageMaxDays),
    low: draftNumber(r.low), high: draftNumber(r.high), text: r.text ?? ""
  };
}

const RANGE_FIELD_LABELS = { low: "baixo", high: "alto" } as const;

// Converte o que foi digitado e confere as mesmas regras do api (Lab::Ranges).
// Para na primeira faixa inválida, com o número da faixa e o campo; nada é
// enviado. Faixa sem baixo, alto nem texto também é recusada (o api a aceita,
// mas ela não diz nada e a versão da cidade que a herdasse não salvaria).
export function draftsToRanges(drafts: RangeDraft[]): { ranges: RangeInput[] } | { error: string } {
  if (drafts.length > LIMITS.ranges) return { error: `no máximo ${LIMITS.ranges} faixas por componente` };
  const ranges: RangeInput[] = [];
  for (const [ index, d ] of drafts.entries()) {
    const n = `faixa ${index + 1}`;
    const min = d.ageMinDays.trim();
    const max = d.ageMaxDays.trim();
    if (!/^\d+$/.test(min) || !/^\d+$/.test(max)) return { error: `${n}: idade em dias deve ser um número inteiro` };
    const low = parseDecimal(d.low);
    const high = parseDecimal(d.high);
    for (const [ field, value ] of [ [ "low", low ], [ "high", high ] ] as const) {
      if (value === undefined) return { error: `${n}: "${RANGE_FIELD_LABELS[field]}" não é um número — ${DOT_IN_NUMBER}` };
    }
    const text = orNull(d.text);
    if (low == null && high == null && text === null) return { error: `${n}: informe baixo, alto ou um texto` };
    if (text !== null && text.length > LIMITS.rangeText) return { error: `${n}: o texto tem no máximo ${LIMITS.rangeText} caracteres` };
    if (low != null && high != null && low > high) return { error: `${n}: "baixo" passa de "alto"` };
    const [ minDays, maxDays ] = [ Number(min), Number(max) ];
    if (minDays > UNBOUNDED_AGE_DAYS || maxDays > UNBOUNDED_AGE_DAYS) {
      return { error: `${n}: a idade passa de ${UNBOUNDED_AGE_DAYS} dias (120 anos)` };
    }
    if (minDays > maxDays) return { error: `${n}: a idade mínima passa da máxima` };
    ranges.push({ sex: d.sex, ageMinDays: minDays, ageMaxDays: maxDays, low: low ?? null, high: high ?? null, text });
  }
  return { ranges };
}

// Ajuda da chave do componente (LabAnalyteTemplate::KEY) e exemplo da semente.
export const KEY_HELP = "começa com letra, até 40 caracteres; minúsculas, números e _ (ex.: hemoglobina)";
export const KEY_EXAMPLE = "hemoglobina";

// Divergência M3: códigos de UserError das duas mutations; desconhecido cru.
const UPSERT_ERRORS: Record<string, string> = {
  sigtap_unknown: "código SIGTAP fora da competência vigente da plataforma",
  duplicate_sigtap: "já existe um exame do catálogo-base com este código SIGTAP",
  invalid_sector: "setor desconhecido pelo api",
  duplicate_analyte_key: "já existe um componente com esta chave neste exame",
  invalid_analyte_key: "chave inválida — " + KEY_HELP,
  invalid_value_type: "tipo de valor desconhecido pelo api",
  choices_required: CHOICES_PHRASE,
  invalid_decimals: DECIMALS_PHRASE,
  invalid_reference_ranges:
    `faixas de referência inválidas — confira sexo, idade de 0 a ${UNBOUNDED_AGE_DAYS} dias (mínima ≤ máxima), baixo ≤ alto, texto de até ${LIMITS.rangeText} caracteres e até ${LIMITS.ranges} faixas`,
  invalid_loinc: "código LOINC inválido",
  not_found: "registro não encontrado — atualize a tela"
};

// `blank` diz o campo em português (o caminho do api é nome de máquina). O
// mesmo caminho "name" é o nome do exame ou do componente, conforme a mutation.
const BLANK_LABELS: Record<"exam" | "analyte", Record<string, string>> = {
  exam: { name: "Nome", material: "Material", container: "Recipiente" },
  analyte: { name: "Nome do componente" }
};

export function upsertErrorText(
  errors: { path?: string | null; message: string }[], context: "exam" | "analyte" = "exam"
): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors
    .map((e) => {
      if (e.message === "blank") {
        const label = e.path ? BLANK_LABELS[context][e.path] : undefined;
        return label ? `campo obrigatório vazio: ${label}` : "campo obrigatório vazio";
      }
      return UPSERT_ERRORS[e.message] ?? e.message;
    })
    .join("; ");
}
