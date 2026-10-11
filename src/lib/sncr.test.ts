import { describe, expect, it } from "vitest";
import {
  SNCR_MOCK_NOTICE, SNCR_REAL_NOTICE, simulatedAvailabilityText, sncrDetail, sncrLastCheckText, sncrModeNotice, sncrStatusLabel
} from "./sncr";

const base = { configured: true, reachable: true, lastCheckAt: "2026-10-10T12:00:00Z", simulatedAvailable: true };

describe("sncrModeNotice", () => {
  it("pelo estado LIGADO de sncr_mock, não pelo utilizável", () => {
    expect(sncrModeNotice([ { key: "sncr_mock", enabled: true } ])).toEqual({ text: SNCR_MOCK_NOTICE, tone: "warn", simulated: true });
    expect(sncrModeNotice([ { key: "sncr_mock", enabled: false } ])).toEqual({ text: SNCR_REAL_NOTICE, tone: "neutral", simulated: false });
  });

  it("sem a chave no catálogo (produção) é o mesmo que desligado", () => {
    expect(sncrModeNotice([ { key: "controlled_prescriptions", enabled: true } ]).simulated).toBe(false);
    expect(sncrModeNotice([]).text).toBe(SNCR_REAL_NOTICE);
  });

  it("o aviso de simulado diz SIMULADO e sem validade", () => {
    expect(SNCR_MOCK_NOTICE).toMatch(/SIMULADO/);
    expect(SNCR_MOCK_NOTICE).toMatch(/sem validade/);
    expect(SNCR_REAL_NOTICE).not.toMatch(/SIMULADO/);
  });
});

describe("estado do SNCR: sem credencial, nunca checado, alcançável, inalcançável", () => {
  it("sem credencial vem antes de tudo", () => {
    expect(sncrStatusLabel({ ...base, configured: false, reachable: false, lastCheckAt: null }))
      .toEqual({ label: "sem credencial — SNCR real não configurado", tone: "neutral" });
  });

  it("configurado e nunca checado não é verde", () => {
    expect(sncrStatusLabel({ ...base, reachable: false, lastCheckAt: null })).toEqual({ label: "configurado, nunca checado", tone: "info" });
  });

  it("alcançável e inalcançável na última checagem", () => {
    expect(sncrStatusLabel(base)).toEqual({ label: "configurado e alcançável", tone: "ok" });
    expect(sncrStatusLabel({ ...base, reachable: false })).toEqual({ label: "configurado, inalcançável na última checagem", tone: "down" });
  });

  it("última checagem: hora da cidade ou 'nunca'", () => {
    expect(sncrLastCheckText(base)).toBe("10/10/2026, 09:00");
    expect(sncrLastCheckText({ ...base, lastCheckAt: null })).toBe("nunca");
    expect(sncrLastCheckText({ ...base, lastCheckAt: undefined })).toBe("nunca");
  });

  it("detalhe do inalcançável diz o que acontece com as receitas", () => {
    expect(sncrDetail({ ...base, reachable: false }))
      .toBe("o api não alcançou o SNCR — os profissionais não conseguem obter números; com o estoque zerado, as receitas saem em papel");
    expect(sncrDetail(base)).toBe("os profissionais obtêm números em Conta → SNCR, pelo gov.br de cada um");
    expect(sncrDetail({ ...base, configured: false, reachable: false, lastCheckAt: null }))
      .toBe("sem credencial, só o SNCR simulado numera (fora de produção); em produção, as receitas de controlado saem em papel");
  });
});

describe("simulado disponível no ambiente", () => {
  it("disponível fora de produção; indisponível (produção)", () => {
    expect(simulatedAvailabilityText(base)).toBe("SNCR simulado disponível neste ambiente (fora de produção)");
    expect(simulatedAvailabilityText({ ...base, simulatedAvailable: false })).toBe("SNCR simulado indisponível neste ambiente (produção)");
  });
});
