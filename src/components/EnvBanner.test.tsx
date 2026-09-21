import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EnvBanner } from "./EnvBanner";

// `globals: false` em vitest.config.ts: sem afterEach global, o cleanup
// automático do Testing Library não roda sozinho entre os testes.
afterEach(cleanup);

describe("EnvBanner", () => {
  it("mostra DEVELOPMENT com data-env=development", () => {
    render(<EnvBanner env="development" />);
    const banner = screen.getByRole("status");
    expect(banner.textContent).toBe("DEVELOPMENT");
    expect(banner.getAttribute("data-env")).toBe("development");
  });

  it("mostra STAGING com data-env=staging", () => {
    render(<EnvBanner env="staging" />);
    const banner = screen.getByRole("status");
    expect(banner.textContent).toBe("STAGING");
    expect(banner.getAttribute("data-env")).toBe("staging");
  });
});
