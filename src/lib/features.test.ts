import { describe, expect, it } from "vitest";
import {
  doneText, featureLabel, featureStatus, ibgeCodeText, missingSummary, missingText, recordModeText, setFeatureErrorText
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
  it("pré-requisitos do prontuário e da assinatura têm frase", () => {
    expect(missingText("record_mode_not_record")).toBe("modo de prontuário diferente de record");
    expect(missingText("clinical_record_disabled")).toBe("prontuário da atenção primária (clinical_record) desligado");
    expect(missingText("digital_signature_disabled")).toBe("assinatura digital (digital_signature) desligada");
    expect(missingSummary([ "clinical_record_disabled" ])).toBe("prontuário da atenção primária (clinical_record) desligado");
  });

  it("pré-requisitos do 19d têm frase", () => {
    expect(missingText("clinical_documents_disabled")).toBe("documentos clínicos (clinical_documents) desligados");
    expect(missingText("controlled_prescriptions_disabled")).toBe("receita de controlado (controlled_prescriptions) desligada");
    expect(missingSummary([ "controlled_prescriptions_disabled" ])).toBe("receita de controlado (controlled_prescriptions) desligada");
  });

  it("pré-requisitos do módulo 20 têm frase", () => {
    expect(missingText("patient_timeline_disabled")).toBe("linha do tempo (patient_timeline) desligada");
    expect(missingText("record_mode_not_integrated")).toBe("modo de prontuário diferente de integrated");
    expect(missingText("pec_origin_missing")).toBe("endereço de origem do PEC não preenchido");
    expect(missingText("pec_hmac_key_missing")).toBe("chave HMAC do PEC não gravada");
    expect(missingSummary([ "patient_timeline_disabled", "record_mode_not_integrated" ]))
      .toBe("linha do tempo (patient_timeline) desligada; modo de prontuário diferente de integrated");
  });

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

describe("featureLabel", () => {
  it("nomeia o PSC simulado; chave desconhecida é null", () => {
    expect(featureLabel("signature_psc_mock")).toBe("PSC simulado (desenvolvimento)");
    expect(featureLabel("ledi_export")).toBeNull();
    expect(featureLabel("pscnovo")).toBeNull();
  });

  it("as chaves do 19d têm nome em português", () => {
    expect(featureLabel("controlled_prescriptions")).toBe("Receita de controle especial e de antimicrobiano (SNCR)");
    expect(featureLabel("sncr_mock")).toBe("SNCR simulado (desenvolvimento)");
  });

  it("as chaves do módulo 20 têm nome em português", () => {
    expect(featureLabel("patient_timeline")).toBe("Linha do tempo do paciente");
    expect(featureLabel("pec_external_view")).toBe("Página para os sistemas externos do PEC");
  });
});

describe("featureLabel do 19c", () => {
  it("documentos clínicos têm nome em português; o pré-requisito já tem frase", () => {
    expect(featureLabel("clinical_documents")).toBe("Documentos clínicos (atestado, declaração, receita, requisição)");
    expect(missingText("clinical_record_disabled")).toBe("prontuário da atenção primária (clinical_record) desligado");
  });
});

describe("módulo 21a", () => {
  it("as quatro chaves do 21a têm nome em português", () => {
    expect(featureLabel("exam_tracking")).toBe("Rastreamento de exames (pedido, regulação, prazos e resultado)");
    expect(featureLabel("exam_fhir_inbound")).toBe("Entrada de resultados por FHIR (laboratórios)");
    expect(featureLabel("exam_pec_bridge")).toBe("Solicitar exames pela tela de sistemas externos do PEC");
    expect(featureLabel("fake_lab")).toBe("Laboratório simulado (desenvolvimento)");
  });

  it("pré-requisitos do 21a têm frase", () => {
    expect(missingText("exam_tracking_disabled")).toBe("rastreamento de exames (exam_tracking) desligado");
    expect(missingText("exam_fhir_inbound_disabled")).toBe("entrada de resultados por FHIR (exam_fhir_inbound) desligada");
    expect(missingText("pec_external_view_disabled")).toBe("página para os sistemas externos do PEC (pec_external_view) desligada");
    expect(missingSummary([ "exam_tracking_disabled", "pec_external_view_disabled" ]))
      .toBe("rastreamento de exames (exam_tracking) desligado; página para os sistemas externos do PEC (pec_external_view) desligada");
    // exam_tracking exige record_mode (contrato A1): a frase já existe.
    expect(missingText("record_mode_off")).toBe("modo de prontuário desligado");
  });
});

describe("módulo 21b", () => {
  it("as três chaves do 21b têm nome em português", () => {
    expect(featureLabel("municipal_lab")).toBe("Laboratório municipal (requisição, amostra, análise e laudo)");
    expect(featureLabel("lab_hl7_inbound")).toBe("Entrada de resultados de aparelhos por HL7 (middleware)");
    expect(featureLabel("fake_middleware")).toBe("Middleware simulado (desenvolvimento)");
  });

  it("pré-requisitos do 21b têm frase", () => {
    expect(missingText("municipal_lab_disabled")).toBe("laboratório municipal (municipal_lab) desligado");
    expect(missingText("lab_hl7_inbound_disabled")).toBe("entrada de resultados por HL7 (lab_hl7_inbound) desligada");
    // municipal_lab exige exam_tracking: a frase do 21a já existe.
    expect(missingText("exam_tracking_disabled")).toBe("rastreamento de exames (exam_tracking) desligado");
    expect(missingSummary([ "municipal_lab_disabled", "lab_hl7_inbound_disabled" ]))
      .toBe("laboratório municipal (municipal_lab) desligado; entrada de resultados por HL7 (lab_hl7_inbound) desligada");
  });
});

describe("módulo 21c", () => {
  it("as duas chaves do 21c têm nome em português", () => {
    expect(featureLabel("lab_quality_control")).toBe("Controle de qualidade do laboratório (CIQ e CEQ)");
    expect(featureLabel("lab_inventory")).toBe("Estoque do laboratório");
  });

  it("o pré-requisito das duas é a frase do 21b, sem redefinir", () => {
    expect(missingText("municipal_lab_disabled")).toBe("laboratório municipal (municipal_lab) desligado");
    expect(missingSummary([ "municipal_lab_disabled" ])).toBe("laboratório municipal (municipal_lab) desligado");
  });

  it("nenhuma das duas é pré-requisito da outra: não existe frase para elas como missing", () => {
    expect(missingText("lab_quality_control_disabled")).toBe("lab_quality_control_disabled");
    expect(missingText("lab_inventory_disabled")).toBe("lab_inventory_disabled");
  });
});

describe("módulo 22", () => {
  it("procedure_billing tem nome em português, o mesmo do dashboard", () => {
    expect(featureLabel("procedure_billing")).toBe("Faturamento de procedimentos (BPA)");
  });

  it("o api exige o IBGE da cidade (M1): a frase é a do módulo 16, sem redefinir", () => {
    expect(missingText("ibge_code_missing")).toBe("código IBGE não preenchido");
    expect(missingSummary([ "ibge_code_missing" ])).toBe("código IBGE não preenchido");
  });

  it("não há frase de pré-requisito de modo para o faturamento: código assim apareceria cru", () => {
    // spec §3: sem pré-requisito de modo de prontuário.
    expect(missingText("procedure_billing_disabled")).toBe("procedure_billing_disabled");
    expect(missingText("billing_settings_missing")).toBe("billing_settings_missing");
  });
});

describe("módulo 23", () => {
  it("care_lines tem nome em português, o mesmo do dashboard", () => {
    expect(featureLabel("care_lines")).toBe("Linhas de cuidado");
  });

  it("fixa o pré-requisito: o prontuário, com a frase do módulo 19, sem redefinir", () => {
    expect(missingText("clinical_record_disabled")).toBe("prontuário da atenção primária (clinical_record) desligado");
    expect(missingSummary([ "clinical_record_disabled" ])).toBe("prontuário da atenção primária (clinical_record) desligado");
  });
});
