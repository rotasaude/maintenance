import { describe, expect, it } from "vitest";
import {
  baseAgeText, baseAgeWarning, canBuild, fieldMapErrorText, fieldMapStateLabel, fieldMapStateTone, fmtMapDate, formatMapSize,
  joinFieldMaps
} from "./fieldMaps";

describe("fieldMaps: rótulos", () => {
  it.each([
    [ "building", "gerando…" ], [ "ready", "pronto" ], [ "failed", "falhou" ], [ null, "sem mapa" ], [ "queued", "queued" ]
  ])("estado %s → %s", (s, label) => expect(fieldMapStateLabel(s)).toBe(label));

  it.each([
    [ "building", "info" ], [ "ready", "ok" ], [ "failed", "down" ], [ null, "neutral" ], [ "queued", "neutral" ]
  ])("tom do estado %s → %s", (s, tone) => expect(fieldMapStateTone(s)).toBe(tone));

  it("motivos conhecidos têm frase; desconhecido cru; nulo nulo", () => {
    expect(fieldMapErrorText("base_missing")).toBe("a base do Brasil ainda não foi copiada");
    expect(fieldMapErrorText("extract_failed")).toBe("o recorte falhou — gere de novo");
    expect(fieldMapErrorText("boundary_missing")).toBe("a cidade não tem a caixa do município (código IBGE)");
    expect(fieldMapErrorText("disk_full")).toBe("disk_full");
    expect(fieldMapErrorText(null)).toBeNull();
  });
});

describe("fieldMaps: tamanho, datas e idade", () => {
  it("tamanho em MB com vírgula", () => {
    expect(formatMapSize(41234567)).toBe("39,3 MB");
    expect(formatMapSize("41234567")).toBe("39,3 MB");
    expect(formatMapSize(932293)).toBe("0,9 MB");
    expect(formatMapSize(null)).toBe("—");
    expect(formatMapSize("abc")).toBe("—");
  });

  it("data da versão sem fuso (dia do calendário); nulo ou torto vira travessão", () => {
    expect(fmtMapDate("2026-11-01")).toBe("01/11/2026");
    expect(fmtMapDate(null)).toBe("—");
    expect(fmtMapDate("ontem")).toBe("—");
  });

  it("idade da base: aviso só acima de 90 dias; sem base, a frase da base", () => {
    expect(baseAgeWarning(90)).toBeNull();
    expect(baseAgeWarning(91)).toBe("base com mais de 90 dias — atualize antes de gerar");
    expect(baseAgeWarning(null)).toBe("a base do Brasil ainda não foi copiada");
  });

  it("idade por extenso, com o singular", () => {
    expect(baseAgeText(0)).toBe("hoje");
    expect(baseAgeText(1)).toBe("há 1 dia");
    expect(baseAgeText(12)).toBe("há 12 dias");
  });
});

describe("fieldMaps: gerar e juntar", () => {
  it("gerar: não em building nem sem base", () => {
    expect(canBuild({ state: "building" }, { version: "2026-11-01" })).toBe(false);
    expect(canBuild({ state: "ready" }, null)).toBe(false);
    expect(canBuild({ state: null }, { version: "2026-11-01" })).toBe(true);
    expect(canBuild({ state: "failed" }, { version: "2026-11-01" })).toBe(true);
    expect(canBuild({ state: "ready" }, { version: "2026-11-01" })).toBe(true);
  });

  it("junta todas as cidades do catálogo com os mapas pelo slug", () => {
    const rows = joinFieldMaps(
      [ { slug: "curitiba", name: "Curitiba", uf: "PR" }, { slug: "maringa", name: "Maringá", uf: "PR" } ],
      [ { citySlug: "curitiba", state: "ready", version: "2026-11-01", sizeBytes: "41234567", builtAt: "2026-11-02T03:00:00Z", errorCode: null } ]
    );
    expect(rows.map((r) => [ r.slug, r.state ])).toEqual([ [ "curitiba", "ready" ], [ "maringa", null ] ]);
    expect(rows[0]).toEqual({
      slug: "curitiba", name: "Curitiba", uf: "PR", state: "ready", version: "2026-11-01", sizeBytes: "41234567",
      builtAt: "2026-11-02T03:00:00Z", errorCode: null
    });
    expect(rows[1]).toEqual({
      slug: "maringa", name: "Maringá", uf: "PR", state: null, version: null, sizeBytes: null, builtAt: null, errorCode: null
    });
  });

  it("mapa de cidade fora do catálogo entra no fim, com o slug no lugar do nome", () => {
    const rows = joinFieldMaps(
      [ { slug: "curitiba", name: "Curitiba", uf: "PR" } ],
      [ { citySlug: "antiga", state: "failed", version: null, sizeBytes: null, builtAt: null, errorCode: "boundary_missing" } ]
    );
    expect(rows.map((r) => [ r.slug, r.name, r.uf, r.state ])).toEqual([
      [ "curitiba", "Curitiba", "PR", null ], [ "antiga", "antiga", null, "failed" ]
    ]);
  });
});
