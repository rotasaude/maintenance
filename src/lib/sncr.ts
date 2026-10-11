// Regras de exibição do SNCR no maintenance (módulo 19d, F-19.24; spec §3 e
// §7; contrato §8). Só leitura e de PLATAFORMA: as credenciais do SNCR ficam
// nas credenciais cifradas do api, por ambiente; aqui só aparece se existem,
// se o api alcançou o SNCR e quando foi a última checagem. Nenhum segredo,
// nenhum número SNCR, nenhum dado de profissional ou paciente.
import type { Tone } from "../theme/tokens";
import { fmtWhen } from "./analytics";

export const SNCR_MOCK_KEY = "sncr_mock";
export const CONTROLLED_KEY = "controlled_prescriptions";
export const SNCR_MOCK_NOTICE =
  "Esta cidade numera as receitas de controlado com o SNCR SIMULADO — numeração sem validade (fora de produção).";
export const SNCR_REAL_NOTICE =
  "Sem o SNCR simulado: os números vêm do SNCR da Anvisa configurado no ambiente.";

// Aviso pelo estado LIGADO do interruptor (não pelo "utilizável"): ligado, a
// cidade passa a numerar com o simulado. Sem o interruptor no catálogo
// (produção) é o mesmo que desligado.
export function sncrModeNotice(features: { key: string; enabled: boolean }[]): { text: string; tone: Tone; simulated: boolean } {
  const simulated = features.some((f) => f.key === SNCR_MOCK_KEY && f.enabled);
  return simulated
    ? { text: SNCR_MOCK_NOTICE, tone: "warn", simulated: true }
    : { text: SNCR_REAL_NOTICE, tone: "neutral", simulated: false };
}

export type SncrStatusView = { configured: boolean; reachable: boolean; lastCheckAt?: string | null; simulatedAvailable: boolean };

// "Configurado" não é "alcançável": sem checagem ainda, nunca verde.
export function sncrStatusLabel(s: SncrStatusView): { label: string; tone: Tone } {
  if (!s.configured) return { label: "sem credencial — SNCR real não configurado", tone: "neutral" };
  if (!s.lastCheckAt) return { label: "configurado, nunca checado", tone: "info" };
  if (s.reachable) return { label: "configurado e alcançável", tone: "ok" };
  return { label: "configurado, inalcançável na última checagem", tone: "down" };
}

export function sncrLastCheckText(s: SncrStatusView): string {
  return s.lastCheckAt ? fmtWhen(s.lastCheckAt) : "nunca";
}

export function sncrDetail(s: SncrStatusView): string {
  if (!s.configured) {
    return "sem credencial, só o SNCR simulado numera (fora de produção); em produção, as receitas de controlado saem em papel";
  }
  if (s.lastCheckAt && !s.reachable) {
    return "o api não alcançou o SNCR — os profissionais não conseguem obter números; com o estoque zerado, as receitas saem em papel";
  }
  return "os profissionais obtêm números em Conta → SNCR, pelo gov.br de cada um";
}

export function simulatedAvailabilityText(s: SncrStatusView): string {
  return s.simulatedAvailable
    ? "SNCR simulado disponível neste ambiente (fora de produção)"
    : "SNCR simulado indisponível neste ambiente (produção)";
}
