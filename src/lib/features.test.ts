import { describe, expect, it } from "vitest";
import {
  doneText, featureStatus, ibgeCodeText, missingSummary, missingText, recordModeText, setFeatureErrorText
} from "./features";

describe("recordModeText", () => {
  it("traduz os três modos", () => {
    expect(recordModeText("off")).toBe("desligado (off)");
    expect(recordModeText("integrated")).toBe("integrado ao PEC da cidade (integrated)");
    expect(recordModeText("record")).toBe("prontuário no Rota Saúde (record)");
  });

  it("modo desconhecido aparece cru, e ausente vira travessão", () => {
    expect(recordModeText("hybrid")).toBe("hybrid");
    expect(recordModeText(null)).toBe("—");
    expect(recordModeText(undefined)).toBe("—");
  });
});

describe("ibgeCodeText", () => {
  it("mostra o código ou diz que falta", () => {
    expect(ibgeCodeText("4106902")).toBe("4106902");
    expect(ibgeCodeText(null)).toBe("não preenchido");
    expect(ibgeCodeText(undefined)).toBe("não preenchido");
  });
});

describe("missingText e missingSummary", () => {
  it("traduz cada pré-requisito do catálogo", () => {
    expect(missingText("record_mode_off")).toBe("modo de prontuário desligado");
    expect(missingText("pec_url_missing")).toBe("endereço do PEC não preenchido");
    expect(missingText("ibge_code_missing")).toBe("código IBGE não preenchido");
    expect(missingText("credential_missing:ledi")).toBe("credencial LEDI não cadastrada");
    expect(missingText("credential_unauthorized:ledi")).toBe("credencial LEDI recusada no último teste");
    expect(missingText("credential_missing:cadsus")).toBe("credencial CADSUS não cadastrada");
    expect(missingText("credential_unauthorized:cadsus")).toBe("credencial CADSUS recusada no último teste");
  });

  it("cidade inalcançável vira frase própria, não 'falta credencial'", () => {
    expect(missingText("city_unreachable")).toBe("banco da cidade inalcançável — não deu para conferir");
  });

  it("pré-requisito desconhecido (api mais novo) aparece cru", () => {
    expect(missingText("terminology_missing:sigtap")).toBe("terminology_missing:sigtap");
  });

  it("junta a lista; vazia é 'nada'", () => {
    expect(missingSummary([])).toBe("nada");
    expect(missingSummary([ "pec_url_missing", "credential_missing:ledi" ]))
      .toBe("endereço do PEC não preenchido; credencial LEDI não cadastrada");
  });
});

describe("featureStatus", () => {
  it("desligada, ligada e utilizável, ligada sem pré-requisito", () => {
    expect(featureStatus({ enabled: false, usable: false, missing: [ "pec_url_missing" ] }))
      .toEqual({ label: "desligada", tone: "neutral" });
    expect(featureStatus({ enabled: true, usable: true, missing: [] }))
      .toEqual({ label: "ligada e utilizável", tone: "ok" });
    expect(featureStatus({ enabled: true, usable: false, missing: [ "pec_url_missing" ] }))
      .toEqual({ label: "ligada, falta pré-requisito", tone: "warn" });
  });
});

describe("setFeatureErrorText", () => {
  it("traduz os erros do contrato e deixa cru o desconhecido", () => {
    expect(setFeatureErrorText([ { path: "key", message: "unknown_feature" } ])).toBe("funcionalidade desconhecida pelo api");
    expect(setFeatureErrorText([ { path: "citySlug", message: "unknown_city" } ])).toBe("cidade inexistente");
    expect(setFeatureErrorText([ { path: null, message: "rate_limited" } ])).toBe("rate_limited");
  });

  it("mensagem já em português passa como veio, e várias se juntam", () => {
    expect(setFeatureErrorText([
      { path: "citySlug", message: "cidade inexistente" }, { path: "key", message: "funcionalidade desconhecida" }
    ])).toBe("cidade inexistente; funcionalidade desconhecida");
  });

  it("lista vazia com ok=false vira a frase genérica", () => {
    expect(setFeatureErrorText([])).toBe("não foi possível concluir — tente de novo");
  });
});

describe("doneText", () => {
  it("diz o estado devolvido pelo api, inclusive ligada sem poder usar", () => {
    expect(doneText({ key: "ledi_export", enabled: false, usable: false, missing: [] }))
      .toBe("ledi_export desligada.");
    expect(doneText({ key: "cadsus_lookup", enabled: true, usable: true, missing: [] }))
      .toBe("cadsus_lookup ligada e utilizável.");
    expect(doneText({ key: "ledi_export", enabled: true, usable: false, missing: [ "credential_missing:ledi" ] }))
      .toBe("ledi_export ligada, mas ainda não utilizável — falta: credencial LEDI não cadastrada.");
  });
});
