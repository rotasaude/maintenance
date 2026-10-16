import type { Tone } from "../theme/tokens";

// Regras de exibição da aba Funcionalidades (módulo 16, ADR 0028; contratos
// §2 e §3). Quem decide o que está ligado e o que falta é o api: aqui só se
// traduz o que ele devolveu. Valor desconhecido (api mais novo que a tela)
// aparece cru — nunca "undefined", nunca some.

const RECORD_MODE_LABELS: Record<string, string> = {
  off: "desligado (off)",
  integrated: "integrado ao PEC da cidade (integrated)",
  record: "prontuário no Rota Saúde (record)"
};

export function recordModeText(mode: string | null | undefined): string {
  if (!mode) return "—";
  return RECORD_MODE_LABELS[mode] ?? mode;
}

export function ibgeCodeText(code: string | null | undefined): string {
  return code ? code : "não preenchido";
}

// Pré-requisitos do catálogo (contratos §2).
const MISSING_LABELS: Record<string, string> = {
  record_mode_off: "modo de prontuário desligado",
  pec_url_missing: "endereço do PEC não preenchido",
  ibge_code_missing: "código IBGE não preenchido",
  "credential_missing:ledi": "credencial LEDI não cadastrada",
  "credential_unauthorized:ledi": "credencial LEDI recusada no último teste",
  "credential_missing:cadsus": "credencial CADSUS não cadastrada",
  "credential_unauthorized:cadsus": "credencial CADSUS recusada no último teste",
  // Módulo 19 (19a): clinical_record só é utilizável no modo record.
  record_mode_not_record: "modo de prontuário diferente de record",
  // Módulo 19b: digital_signature exige clinical_record ligado e utilizável.
  clinical_record_disabled: "prontuário da atenção primária (clinical_record) desligado",
  // Módulo 19b: signature_psc_mock exige digital_signature ligada.
  digital_signature_disabled: "assinatura digital (digital_signature) desligada",
  // Módulo 19d: controlled_prescriptions exige clinical_documents ligado;
  // sncr_mock exige controlled_prescriptions ligado.
  clinical_documents_disabled: "documentos clínicos (clinical_documents) desligados",
  controlled_prescriptions_disabled: "receita de controlado (controlled_prescriptions) desligada",
  // Módulo 20: pec_external_view exige patient_timeline ligado e o modo
  // integrated; com a Divergência M3, também a origem e a chave do PEC.
  patient_timeline_disabled: "linha do tempo (patient_timeline) desligada",
  record_mode_not_integrated: "modo de prontuário diferente de integrated",
  pec_origin_missing: "endereço de origem do PEC não preenchido",
  pec_hmac_key_missing: "chave HMAC do PEC não gravada",
  // Módulo 21a: exam_fhir_inbound e exam_pec_bridge exigem exam_tracking;
  // exam_pec_bridge também pec_external_view; fake_lab exige exam_fhir_inbound.
  // exam_tracking exige record_mode (record_mode_off, já traduzido acima).
  exam_tracking_disabled: "rastreamento de exames (exam_tracking) desligado",
  exam_fhir_inbound_disabled: "entrada de resultados por FHIR (exam_fhir_inbound) desligada",
  pec_external_view_disabled: "página para os sistemas externos do PEC (pec_external_view) desligada",
  // Módulo 21b: municipal_lab exige exam_tracking (frase acima);
  // lab_hl7_inbound exige municipal_lab; fake_middleware exige lab_hl7_inbound.
  municipal_lab_disabled: "laboratório municipal (municipal_lab) desligado",
  lab_hl7_inbound_disabled: "entrada de resultados por HL7 (lab_hl7_inbound) desligada",
  // O api não conseguiu ler o banco da cidade: usable vem false sem que se
  // saiba o que de fato falta (contratos §3). O liga/desliga continua.
  city_unreachable: "banco da cidade inalcançável — não deu para conferir"
};

// Nome em português de algumas chaves do catálogo (a chave crua continua na tela).
const FEATURE_LABELS: Record<string, string> = {
  signature_psc_mock: "PSC simulado (desenvolvimento)",
  // Módulo 19c: exige clinical_record (missing: clinical_record_disabled, já traduzido acima).
  clinical_documents: "Documentos clínicos (atestado, declaração, receita, requisição)",
  controlled_prescriptions: "Receita de controle especial e de antimicrobiano (SNCR)",
  sncr_mock: "SNCR simulado (desenvolvimento)",
  patient_timeline: "Linha do tempo do paciente",
  pec_external_view: "Página para os sistemas externos do PEC",
  // Módulo 21a (ADR 0036): fake_lab só existe fora de produção.
  exam_tracking: "Rastreamento de exames (pedido, regulação, prazos e resultado)",
  exam_fhir_inbound: "Entrada de resultados por FHIR (laboratórios)",
  exam_pec_bridge: "Solicitar exames pela tela de sistemas externos do PEC",
  fake_lab: "Laboratório simulado (desenvolvimento)",
  // Módulo 21b (ADR 0037): fake_middleware só existe fora de produção.
  municipal_lab: "Laboratório municipal (requisição, amostra, análise e laudo)",
  lab_hl7_inbound: "Entrada de resultados de aparelhos por HL7 (middleware)",
  fake_middleware: "Middleware simulado (desenvolvimento)"
};

export function featureLabel(key: string): string | null {
  return FEATURE_LABELS[key] ?? null;
}

export function missingText(code: string): string {
  return MISSING_LABELS[code] ?? code;
}

export type FeatureView = { enabled: boolean; usable: boolean; missing: string[] };

// Três estados, nunca dois: "ligada" não quer dizer "utilizável" (contratos §1).
export function featureStatus(feature: FeatureView): { label: string; tone: Tone } {
  if (!feature.enabled) return { label: "desligada", tone: "neutral" };
  if (feature.usable) return { label: "ligada e utilizável", tone: "ok" };
  return { label: "ligada, falta pré-requisito", tone: "warn" };
}

export function missingSummary(missing: string[]): string {
  return missing.length === 0 ? "nada" : missing.map(missingText).join("; ");
}

// Erros de regra de setCityFeature (contratos §3): UserError { path, message },
// como as outras mutations. Se a mensagem vier como o código do contrato
// (unknown_city, unknown_feature), traduz; senão mostra a mensagem do api.
const SET_ERROR_LABELS: Record<string, string> = {
  unknown_city: "cidade inexistente",
  unknown_feature: "funcionalidade desconhecida pelo api"
};

export type UserErrorView = { path?: string | null; message: string };

export function setFeatureErrorText(errors: UserErrorView[]): string {
  if (errors.length === 0) return "não foi possível concluir — tente de novo";
  return errors.map((e) => SET_ERROR_LABELS[e.message] ?? e.message).join("; ");
}

// Frase depois do ato: diz o estado que o api devolveu, não o pedido.
export function doneText(feature: { key: string } & FeatureView): string {
  if (!feature.enabled) return `${feature.key} desligada.`;
  if (feature.usable) return `${feature.key} ligada e utilizável.`;
  return `${feature.key} ligada, mas ainda não utilizável — falta: ${missingSummary(feature.missing)}.`;
}
