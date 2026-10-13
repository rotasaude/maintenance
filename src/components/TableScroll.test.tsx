import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TableScroll } from "./TableScroll";
import { DataTable } from "./DataTable";

describe("TableScroll", () => {
  afterEach(cleanup);

  it("envolve a tabela num contêiner com rolagem, sem texto extra no DOM", () => {
    const { container } = render(<TableScroll><table><tbody><tr><td>a</td></tr></tbody></table></TableScroll>);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain("table-scroll");
    expect(wrap.textContent).toBe("a");
  });

  it("DataTable fica dentro do contêiner e continua sendo uma única table", () => {
    render(<DataTable columns={[ { key: "n", label: "Nome" } ]} rows={[ { n: "x" } ]} />);
    const table = screen.getByRole("table");
    expect(table.parentElement?.className).toContain("table-scroll");
  });
});

describe("TableScroll — teclado e dica atualizada (A-21, A-26)", () => {
  afterEach(cleanup);

  it("com transbordo vira região rolável pelo teclado; observa também a tabela", () => {
    const observed: Element[] = [];
    let fire: (() => void) | null = null;
    class RO { constructor(cb: () => void) { fire = cb; } observe(el: Element) { observed.push(el); } disconnect() {} }
    const original = globalThis.ResizeObserver;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
    try {
      const { container } = render(<TableScroll><table><tbody><tr><td>a</td></tr></tbody></table></TableScroll>);
      const wrap = container.firstElementChild as HTMLElement;
      expect(observed).toHaveLength(2);
      Object.defineProperty(wrap, "scrollWidth", { configurable: true, value: 900 });
      Object.defineProperty(wrap, "clientWidth", { configurable: true, value: 600 });
      act(() => fire!());
      expect(wrap.getAttribute("tabindex")).toBe("0");
      expect(wrap.getAttribute("role")).toBe("region");
      expect(wrap.getAttribute("aria-label")).toBe("tabela com rolagem lateral");
    } finally {
      (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = original;
    }
  });
});
