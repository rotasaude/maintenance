import { describe, expect, it } from "vitest";
import { apiBase, maintenanceEnv } from "./env";

describe("maintenanceEnv", () => {
  it("é development por padrão quando o valor não está definido", () => {
    expect(maintenanceEnv(undefined)).toBe("development");
  });

  it("é development quando o valor é uma string vazia", () => {
    expect(maintenanceEnv("")).toBe("development");
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
