import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button no tema rota", () => {
  afterEach(cleanup);
  it("texto sobre o accent usa --on-accent", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" }).style.color).toBe("var(--on-accent)");
  });

  it("desabilitado e ocupado: sem opacidade, borda tracejada, segue disabled", () => {
    const { rerender } = render(<Button disabled>Salvar</Button>);
    let b = screen.getByRole("button", { name: "Salvar" });
    expect(b).toHaveProperty("disabled", true);
    expect(b.style.opacity).toBe("");
    expect(b.style.border).toContain("dashed");
    rerender(<Button busy>Salvar</Button>);
    b = screen.getByRole("button", { name: "…" });
    expect(b).toHaveProperty("disabled", true);
    expect(b.style.border).toContain("dashed");
  });
});
