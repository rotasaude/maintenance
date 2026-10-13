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

describe("guardas mais estritas (A-25) e CSS global (A-22, A-23, A-28)", () => {
  const css = readFileSync(join(src, "theme/global.css"), "utf8");
  const outsideEnv = css.replace(/:root\s*\{[^}]*--env-[^}]*\}/, "");
  it("global.css sem cor fixa nem outline zerado fora das variáveis da faixa", () => {
    expect(outsideEnv).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(/);
    expect(outsideEnv).not.toMatch(/outline(-width)?:\s*(none|0)\b/);
  });
  it("hex com aspas simples, crase ou 8 dígitos, e outline 0, também são pegos", () => {
    expect(offenders(/["'`]#[0-9a-fA-F]{3,8}["'`]/)).toEqual([]);
    expect(offenders(/outline(Width)?:\s*["']?(none|0)["']?[,\s}]/)).toEqual([]);
  });
  it("dica de rolagem no topo e no fim, sem leitura pelo leitor de tela", () => {
    expect(css).toMatch(/\.table-scroll\.is-overflowing::before,\s*\.table-scroll\.is-overflowing::after\s*\{[^}]*content:\s*"⇆ role para o lado"\s*\/\s*""/);
  });
  it("a página não sobra rolagem: #root em coluna e o Shell ocupa o resto", () => {
    expect(css).toMatch(/#root\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
    const shell = readFileSync(join(src, "screens/Shell.tsx"), "utf8");
    expect(shell).not.toMatch(/minHeight:\s*"100%"/);
    // Cresce com o conteúdo (o trilho acompanha páginas longas) e não encolhe.
    expect(shell).toMatch(/flex:\s*"1 0 auto"/);
  });
});

