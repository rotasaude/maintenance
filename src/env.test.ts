import { describe, expect, it } from "vitest";
import { apiBase, maintenanceEnv } from "./env";

describe("maintenanceEnv", () => {
  it("é development por padrão quando o valor não está definido (fora de um build de produção)", () => {
    expect(maintenanceEnv(undefined, false)).toBe("development");
  });

  it("é development quando o valor é uma string vazia (fora de um build de produção)", () => {
    expect(maintenanceEnv("", false)).toBe("development");
  });

  // I5: em build de PRODUÇÃO (import.meta.env.PROD), a variável ausente ou
  // vazia não pode virar "development" silenciosamente — um build de
  // staging sem VITE_MAINTENANCE_ENV definida se autorrotularia como
  // development e esconderia a faixa de aviso (spec F6). Falha alto, não
  // vira padrão. O parâmetro `isProd` é injetado — nunca lê
  // import.meta.env.PROD de verdade neste teste.
  it("recusa valor ausente em build de produção — falha alto em vez de assumir development", () => {
    expect(() => maintenanceEnv(undefined, true)).toThrow("VITE_MAINTENANCE_ENV é obrigatória em build de produção");
  });

  it("recusa string vazia em build de produção", () => {
    expect(() => maintenanceEnv("", true)).toThrow("VITE_MAINTENANCE_ENV é obrigatória em build de produção");
  });

  it("aceita staging em build de produção quando o valor está definido", () => {
    expect(maintenanceEnv("staging", true)).toBe("staging");
  });

  it("aceita staging", () => {
    expect(maintenanceEnv("staging")).toBe("staging");
  });

  it("aceita development explicitamente", () => {
    expect(maintenanceEnv("development")).toBe("development");
  });

  it("recusa production", () => {
    expect(() => maintenanceEnv("production")).toThrow("VITE_MAINTENANCE_ENV desconhecido: production");
  });

  it("recusa qualquer outro valor desconhecido", () => {
    expect(() => maintenanceEnv("staging ")).toThrow(/VITE_MAINTENANCE_ENV desconhecido/);
  });
});

describe("apiBase", () => {
  it("é vazia em development, mesmo com URL definida", () => {
    expect(apiBase("development", "https://maintenance-api.example.com")).toBe("");
  });

  it("é vazia em development quando a URL não está definida", () => {
    expect(apiBase("development", undefined)).toBe("");
  });

  it("usa a URL de staging", () => {
    expect(apiBase("staging", "https://maintenance-api.staging.rotasaude.com.br")).toBe(
      "https://maintenance-api.staging.rotasaude.com.br"
    );
  });

  it("remove a barra final da URL de staging", () => {
    expect(apiBase("staging", "https://maintenance-api.staging.rotasaude.com.br/")).toBe(
      "https://maintenance-api.staging.rotasaude.com.br"
    );
  });

  it("remove múltiplas barras finais", () => {
    expect(apiBase("staging", "https://maintenance-api.staging.rotasaude.com.br///")).toBe(
      "https://maintenance-api.staging.rotasaude.com.br"
    );
  });

  it("exige a URL em staging", () => {
    expect(() => apiBase("staging", undefined)).toThrow("VITE_MAINTENANCE_API_URL é obrigatória em staging");
  });

  it("exige a URL em staging mesmo quando é uma string vazia", () => {
    expect(() => apiBase("staging", "")).toThrow("VITE_MAINTENANCE_API_URL é obrigatória em staging");
  });
});
