import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toneColor } from "./tokens";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), "utf8");

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("tema do maintenance", () => {
  it("index.html abre no tema rota", () => {
    expect(read("../../index.html")).toMatch(/<html lang="pt-BR" data-theme="rota">/);
  });

  it("toneColor lê papéis do tema", () => {
    expect(toneColor("ok")).toEqual({ fg: "var(--ok)", bg: "var(--ok-bg)" });
    expect(toneColor("down")).toEqual({ fg: "var(--down)", bg: "var(--down-bg)" });
    expect(toneColor("urgent")).toEqual({ fg: "var(--down)", bg: "var(--down-bg)" });
    expect(toneColor(undefined)).toEqual({ fg: "var(--ink2)", bg: "var(--sunken)" });
  });

  it("faixa de development é roxa (7:1) e nenhuma cor da faixa coincide com o tema rota", () => {
    const css = read("global.css");
    const v = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toLowerCase();
    expect(v("env-dev-bg")).toBe("#6b2fa3");
    expect(ratio(v("env-dev-bg")!, v("env-dev-ink")!)).toBeGreaterThanOrEqual(7);
    expect(ratio(v("env-stg-bg")!, v("env-stg-ink")!)).toBeGreaterThanOrEqual(4.5);
    const tokens = read("vendor/tokens.css");
    const rota = /:root\[data-theme="rota"\]\s*\{([^}]*)\}/.exec(tokens)![1].toLowerCase();
    for (const name of [ "env-dev-bg", "env-stg-bg" ]) expect(rota).not.toContain(v(name)!);
  });
});
