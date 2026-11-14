// Regras de exibição dos mapas de campo (módulo 24c, F-24.20; contrato §5.1,
// §5.4 e §9). O mapa é dado de PLATAFORMA: um arquivo por município, recortado
// de uma base do Brasil. Quem gera, guarda e decide o estado é o api; aqui só
// se traduz o que ele devolveu. Valor desconhecido aparece cru; nulo vira "—".
import type { Tone } from "../theme/tokens";

export type FieldMapView = {
  citySlug: string; state: string; version?: string | null; sizeBytes?: string | number | null; builtAt?: string | null;
  errorCode?: string | null;
};
export type FieldMapBaseView = { version: string; ageDays: number };
export type CityView = { slug: string; name: string; uf?: string | null };

export type FieldMapRow = {
  slug: string; name: string; uf: string | null; state: string | null; version: string | null;
  sizeBytes: string | number | null; builtAt: string | null; errorCode: string | null;
};

export const BASE_STALE_DAYS = 90;
export const BASE_MISSING = "a base do Brasil ainda não foi copiada";

const STATES: Record<string, { label: string; tone: Tone }> = {
  building: { label: "gerando…", tone: "info" },
  ready: { label: "pronto", tone: "ok" },
  failed: { label: "falhou", tone: "down" }
};

export function fieldMapStateLabel(state: string | null): string {
  if (state === null) return "sem mapa";
  return STATES[state]?.label ?? state;
}

export function fieldMapStateTone(state: string | null): Tone {
  return (state !== null && STATES[state]?.tone) || "neutral";
}

// Motivos do api (FieldMaps::BuildJob, contrato §5.1); desconhecido aparece cru.
const ERRORS: Record<string, string> = {
  base_missing: BASE_MISSING,
  extract_failed: "o recorte falhou — gere de novo",
  boundary_missing: "a cidade não tem a caixa do município (código IBGE)"
};

export function fieldMapErrorText(code: string | null): string | null {
  if (code === null) return null;
  return ERRORS[code] ?? code;
}

const sizeFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// `sizeBytes` é BigInt no SDL e chega como texto (graphql-ruby); MB na base 1024².
export function formatMapSize(bytes: number | string | null): string {
  if (bytes === null || bytes === "") return "—";
  const n = Number(bytes);
  return Number.isFinite(n) ? `${sizeFmt.format(n / (1024 * 1024))} MB` : "—";
}

// A versão é a data da base (dia do calendário, sem hora): formatada sem
// passar por Date, para o fuso de quem lê não trocar o dia.
export function fmtMapDate(date: string | null): string {
  const m = date ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

export function baseAgeWarning(ageDays: number | null): string | null {
  if (ageDays === null) return BASE_MISSING;
  return ageDays > BASE_STALE_DAYS ? "base com mais de 90 dias — atualize antes de gerar" : null;
}

export function baseAgeText(ageDays: number): string {
  if (ageDays <= 0) return "hoje";
  return ageDays === 1 ? "há 1 dia" : `há ${ageDays} dias`;
}

// "Gerar de novo" não se oferece com o mapa em geração nem sem a base (Q24).
export function canBuild(row: { state: string | null }, base: { version: string } | null): boolean {
  return base !== null && row.state !== "building";
}

// Todas as cidades do catálogo, na ordem dele — a que não tem linha em
// field_maps aparece "sem mapa", que é justamente a que precisa de "Gerar".
// Mapa de cidade fora do catálogo entra no fim, com o slug no lugar do nome.
export function joinFieldMaps(cities: CityView[], maps: FieldMapView[]): FieldMapRow[] {
  const bySlug = new Map(maps.map((m) => [ m.citySlug, m ]));
  const row = (slug: string, name: string, uf: string | null, m: FieldMapView | undefined): FieldMapRow => ({
    slug, name, uf, state: m?.state ?? null, version: m?.version ?? null, sizeBytes: m?.sizeBytes ?? null,
    builtAt: m?.builtAt ?? null, errorCode: m?.errorCode ?? null
  });
  const known = new Set(cities.map((c) => c.slug));
  return [
    ...cities.map((c) => row(c.slug, c.name, c.uf ?? null, bySlug.get(c.slug))),
    ...maps.filter((m) => !known.has(m.citySlug)).map((m) => row(m.citySlug, m.citySlug, null, m))
  ];
}
