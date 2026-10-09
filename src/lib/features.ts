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
  // O api não conseguiu ler o banco da cidade: usable vem false sem que se
  // saiba o que de fato falta (contratos §3). O liga/desliga continua.
  city_unreachable: "banco da cidade inalcançável — não deu para conferir"
};

// Nome em português de algumas chaves do catálogo (a chave crua continua na tela).
const FEATURE_LABELS: Record<string, string> = {
  signature_psc_mock: "PSC simulado (desenvolvimento)"
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
