// Guardas do maintenance: cor só por papel do tema (exceto a faixa no
// global.css), foco nunca zerado, desabilitado sem opacidade.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) return [ "vendor", "gql", "test" ].includes(n) ? [] : files(f);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [f] : [];
  });
}
const all = files(src).map((f) => ({ f: relative(src, f), code: readFileSync(f, "utf8") }));
const offenders = (re: RegExp) => all.filter(({ code }) => re.test(code)).map(({ f }) => f);

describe("guardas do maintenance", () => {
  it("nenhuma cor fixa (oklch, rgba, hex em string, white)", () =>
    expect(offenders(/oklch\(|rgba?\(|"#[0-9a-fA-F]{3,6}"|"white"/)).toEqual([]));
  it("nenhum var(--x, reserva)", () => expect(offenders(/var\(--[\w-]+\s*,/)).toEqual([]));
  it("nenhum outline zerado", () => expect(offenders(/outline:\s*"none"/)).toEqual([]));
  it("desabilitado não depende de opacidade", () => expect(offenders(/opacity:\s*[^,}]*(disabled|busy)/)).toEqual([]));
});

describe("tabelas do maintenance", () => {
  it("a tabela da Auditoria fica dentro de TableScroll", () => {
    const code = readFileSync(join(src, "screens/Audit.tsx"), "utf8");
    expect(code).toMatch(/<TableScroll>\s*<table/);
  });
});
