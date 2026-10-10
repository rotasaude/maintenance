// Regras de exibição do catálogo de medicamentos da plataforma (módulo 19c,
// F-19.16; spec §3; contrato §8). O catálogo vem do CATMAT (classe 6505,
// Compras.gov) e as marcas de antimicrobiano e controlado das listas da
// Anvisa; quem importa, compara e decide o que fica oculto é o api. Aqui só
// se traduz o que ele devolveu. Valor desconhecido aparece cru; nulo vira "—".
import type { Tone } from "../theme/tokens";
import { fmtWhen } from "./analytics";

export const REVIEW_PAGE = 50;

export type ReleaseView = { id: string; importedAt: string; itemsCount: number; hiddenCount: number };
export type ReviewItemView = { catmatCode: number; sourceDescription: string; parseStatus: string };
export type ImportErrorView = { path?: string | null; message: string };
export type CatalogImportView = {
  ok: boolean; releaseId?: string | null; added?: number | null; changed?: number | null; removed?: number | null;
  errors: ImportErrorView[];
};
export type AnvisaImportView = { ok: boolean; antimicrobials?: number | null; controlled?: number | null; errors: ImportErrorView[] };

export const IMPORT_RUNNING = "importando… pode levar alguns minutos — não feche esta aba";

const counter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function countText(n: number | null | undefined): string {
  return typeof n === "number" ? counter.format(n) : "—";
}

export function releaseText(r: ReleaseView | null | undefined): string {
  if (!r) return "nenhuma importação ainda — até a primeira, a receita só aceita texto livre";
  return `importado em ${fmtWhen(r.importedAt)} · ${countText(r.itemsCount)} itens · ${countText(r.hiddenCount)} ocultos para revisão`;
}

const PARSE_STATUS: Record<string, { label: string; tone: Tone }> = {
  ok: { label: "entendido", tone: "ok" },
  review: { label: "para revisar", tone: "warn" }
};

export function parseStatusView(status: string): { label: string; tone: Tone } {
  return PARSE_STATUS[status] ?? { label: status, tone: "neutral" };
}

export function reviewNote(shown: number, hidden: number): string | null {
  return hidden > shown ? `mostrando ${countText(shown)} de ${countText(hidden)} itens ocultos` : null;
}

// Códigos do api (Medications::CatalogImport / AnvisaImport; path catalog|lists); desconhecido aparece cru.
const IMPORT_ERRORS: Record<string, string> = {
  source_unavailable: "o Compras.gov não respondeu — nada mudou; tente de novo mais tarde",
  incomplete_source: "o Compras.gov devolveu menos itens do que anunciou — nada mudou; tente de novo mais tarde",
  suspicious_drop: "o CATMAT veio com menos da metade dos itens ativos — nada mudou; confira a fonte antes de importar de novo",
  invalid_file: "um arquivo das listas da Anvisa está inválido — nada mudou",
  import_failed: "a importação falhou — nada mudou",
  import_in_progress: "já há uma importação em andamento — espere ela terminar"
};

export function importErrorText(errors: ImportErrorView[]): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors.map((e) => IMPORT_ERRORS[e.message] ?? e.message).join("; ");
}

export function catalogImportText(r: CatalogImportView): string {
  if (!r.ok) return importErrorText(r.errors);
  const base = `Catálogo importado: ${countText(r.added)} entraram, ${countText(r.changed)} mudaram, ${countText(r.removed)} saíram.`;
  return (r.removed ?? 0) > 0
    ? `${base} Os que saíram deixam de aparecer na busca da receita; receitas já emitidas não mudam.`
    : base;
}

export function anvisaImportText(r: AnvisaImportView): string {
  if (!r.ok) return importErrorText(r.errors);
  return `Listas da Anvisa importadas: ${countText(r.antimicrobials)} antimicrobianos (IN 360/2025) e ` +
    `${countText(r.controlled)} controlados (Portaria 344) marcados no catálogo.`;
}
