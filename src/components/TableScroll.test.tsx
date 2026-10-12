import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
