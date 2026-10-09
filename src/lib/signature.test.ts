import { describe, expect, it } from "vitest";
import {
  CRL_STALE_MS, PSC_MOCK_NOTICE, PSC_REAL_NOTICE, lastCheckText, providerName, providerStatus, pscModeNotice,
  signerDetail, signerStatus
} from "./signature";

const NOW = Date.parse("2026-10-08T13:00:00Z");

describe("prestadores", () => {
  it("nome com a chave; prestador desconhecido aparece cru", () => {
    expect(providerName("vidaas")).toBe("VIDaaS (vidaas)");
    expect(providerName("remoteid")).toBe("RemoteID (remoteid)");
    expect(providerName("pscnovo")).toBe("pscnovo");
  });

  it("estado: sem credencial, nunca checado, checagem ok e checagem falha", () => {
    expect(providerStatus({ key: "safeid", configured: false, lastCheckAt: null, lastCheckOk: null }))
      .toEqual({ label: "sem credencial — não habilitado", tone: "neutral" });
    expect(providerStatus({ key: "birdid", configured: true, lastCheckAt: null, lastCheckOk: null }))
      .toEqual({ label: "habilitado, nunca checado", tone: "info" });
    expect(providerStatus({ key: "vidaas", configured: true, lastCheckAt: "2026-10-08T12:00:00Z", lastCheckOk: true }))
      .toEqual({ label: "habilitado, última checagem ok", tone: "ok" });
    expect(providerStatus({ key: "neoid", configured: true, lastCheckAt: "2026-10-08T12:00:00Z", lastCheckOk: false }))
      .toEqual({ label: "habilitado, última checagem falhou", tone: "down" });
  });

  it("nulos viram 'nunca' e '—'", () => {
    expect(lastCheckText({ key: "birdid", configured: true, lastCheckAt: null })).toBe("nunca");
    expect(lastCheckText({ key: "vidaas", configured: true, lastCheckAt: "2026-10-08T12:00:00Z" })).toBe("08/10/2026, 09:00");
    expect(signerDetail({ reachable: true, version: null, crlUpdatedAt: null })).toBe("versão — · LCRs atualizadas em —");
  });
});

describe("signer", () => {
  it("signer: inalcançável, LCR nunca atualizada, velha e em dia", () => {
    expect(signerStatus({ reachable: false }, NOW)).toEqual({ label: "inalcançável", tone: "down" });
    expect(signerStatus({ reachable: true, version: "1.0.0", crlUpdatedAt: null }, NOW))
      .toEqual({ label: "no ar, LCRs nunca atualizadas", tone: "warn" });
    expect(signerStatus({ reachable: true, version: "1.0.0", crlUpdatedAt: new Date(NOW - CRL_STALE_MS - 60_000).toISOString() }, NOW))
      .toEqual({ label: "no ar, LCRs com mais de 24 h", tone: "warn" });
    expect(signerStatus({ reachable: true, version: "1.0.0", crlUpdatedAt: "2026-10-08T09:00:00Z" }, NOW))
      .toEqual({ label: "no ar", tone: "ok" });
  });

  it("detalhe: versão e hora das LCRs; inalcançável diz o efeito", () => {
    expect(signerDetail({ reachable: true, version: "1.2.0", crlUpdatedAt: "2026-10-08T09:00:00Z" }))
      .toBe("versão 1.2.0 · LCRs atualizadas em 08/10/2026, 06:00");
    expect(signerDetail({ reachable: false, version: null, crlUpdatedAt: null }))
      .toBe("o api não alcançou o serviço signer — as assinaturas ficam pendentes até ele voltar");
  });
});

describe("modo do PSC da cidade", () => {
  const simulated = { text: PSC_MOCK_NOTICE, tone: "warn", simulated: true };
  const real = { text: PSC_REAL_NOTICE, tone: "neutral", simulated: false };

  it("interruptor ligado → simulado", () => {
    expect(pscModeNotice([ { key: "ledi_export", enabled: false }, { key: "signature_psc_mock", enabled: true } ])).toEqual(simulated);
  });
  it("presente e desligado → real", () => {
    expect(pscModeNotice([ { key: "signature_psc_mock", enabled: false } ])).toEqual(real);
  });
  it("catálogo sem o interruptor (produção) → real", () => {
    expect(pscModeNotice([ { key: "ledi_export", enabled: true } ])).toEqual(real);
  });
  it("lista vazia → real", () => {
    expect(pscModeNotice([])).toEqual(real);
  });
});
