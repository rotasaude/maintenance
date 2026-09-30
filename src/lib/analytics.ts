import type { Tone } from "../theme/tokens";

// Regras do bloco Analytics da ficha da cidade (módulo 14, F-14.9). Puras:
// nenhum React, nenhum fetch. Formatos: contratos do módulo 14, §3.
//
// Três estados por célula, que nunca se confundem:
//   - valor    → número (0 incluído);
//   - oculto   → suppressed: true (1 a 4, suprimido na cidade; o número
//                nunca sai do banco dela — ADR 0025);
//   - sem dado → nenhuma linha para a semana × indicador.

export const INDICATORS = [
  "triages_started", "triages_completed", "attendances_closed",
  "wait_within_30_pct", "no_show_pct", "left_pct"
] as const;

export const INDICATOR_LABELS: Record<string, string> = {
  triages_started: "Triagens iniciadas",
  triages_completed: "Triagens concluídas",
  attendances_closed: "Atendimentos encerrados",
  wait_within_30_pct: "Espera até 30 min",
  no_show_pct: "Faltas",
  left_pct: "Saiu sem atendimento"
};

export const WEEKS = 12;

const TZ = "America/Sao_Paulo";

const dayParts = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const whenFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});
const countFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const rateFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// O "hoje" da cidade. Às 23h30 de domingo em São Paulo já é segunda em UTC;
// a semana é a da cidade (fuso fixo, api#27).
export function cityToday(now: Date): string {
  const p = Object.fromEntries(dayParts.formatToParts(now).map((x) => [ x.type, x.value ]));
  return `${p.year}-${p.month}-${p.day}`;
}

// Aritmética em UTC sobre a data pura: meia-noite UTC não tem horário de
// verão, então somar dias nunca pula nem repete um dia.
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(iso, -((dow + 6) % 7));
}

export type AnalyticsWindow = { from: string; to: string; weeks: string[] };

// As 12 semanas fechadas que terminam no domingo anterior à semana corrente —
// o mesmo padrão do GET /city_analytics do console do operador.
export function analyticsWindow(now: Date): AnalyticsWindow {
  const thisMonday = mondayOf(cityToday(now));
  const from = addDays(thisMonday, -7 * WEEKS);
  const to = addDays(thisMonday, -1);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(from, 7 * i));
  return { from, to, weeks };
}

export type IndicatorRow = { weekStart: string; indicator: string; value?: number | null; suppressed: boolean };
export type IndicatorGrid = Record<string, Record<string, IndicatorRow>>;

export function indicatorGrid(rows: IndicatorRow[]): IndicatorGrid {
  const grid: IndicatorGrid = {};
  for (const r of rows) {
    (grid[r.weekStart] ??= {})[r.indicator] = r;
  }
  return grid;
}

export function cellText(indicator: string, row: IndicatorRow | undefined): string {
  if (!row) return "sem dado";
  if (row.suppressed) return "oculto";
  if (typeof row.value !== "number" || Number.isNaN(row.value)) return "sem dado";
  return indicator.endsWith("_pct") ? `${rateFmt.format(row.value)}%` : countFmt.format(row.value);
}

// "YYYY-MM-DD" → "DD/MM/YYYY" por texto: new Date("2026-07-06") é meia-noite
// UTC, que em São Paulo ainda é 05/07.
export function fmtWeek(weekStart: string): string {
  const [ y, m, d ] = weekStart.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : whenFmt.format(d);
}

const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  running: { label: "em execução", tone: "info" },
  succeeded: { label: "concluída", tone: "ok" },
  failed: { label: "falhou", tone: "down" }
};

export function runStatusView(status: string | null | undefined): { label: string; tone: Tone } {
  if (!status) return { label: "nunca rodou", tone: "neutral" };
  return RUN_STATUS[status] ?? { label: status, tone: "neutral" };
}
