// Regras de exibição da assinatura digital no maintenance (módulo 19b, F-19.8;
// spec §3 e §9; contrato §8). Só leitura: os prestadores e o serviço `signer`
// são da plataforma (todas as cidades do ambiente). Nenhum segredo passa por
// aqui — o api só diz se a credencial existe e como foi a última checagem.
import type { Tone } from "../theme/tokens";
import { fmtWhen } from "./analytics";

const PROVIDER_NAMES: Record<string, string> = {
  vidaas: "VIDaaS", birdid: "BirdID", safeid: "SafeID", neoid: "NeoID", remoteid: "RemoteID"
};

export function providerName(key: string): string {
  const name = PROVIDER_NAMES[key];
  return name ? `${name} (${key})` : key;
}

export type ProviderView = { key: string; configured: boolean; lastCheckAt?: string | null; lastCheckOk?: boolean | null };

export function providerStatus(provider: ProviderView): { label: string; tone: Tone } {
  if (!provider.configured) return { label: "sem credencial — não habilitado", tone: "neutral" };
  if (provider.lastCheckOk === true) return { label: "habilitado, última checagem ok", tone: "ok" };
  if (provider.lastCheckOk === false) return { label: "habilitado, última checagem falhou", tone: "down" };
  return { label: "habilitado, nunca checado", tone: "info" };
}

export function lastCheckText(provider: ProviderView): string {
  return provider.lastCheckAt ? fmtWhen(provider.lastCheckAt) : "nunca";
}

export type SignerView = { reachable: boolean; version?: string | null; crlUpdatedAt?: string | null };

// LCR com mais de um dia: a verificação de revogação perde força (spec §5
// "Validação"). É aviso de tela, não regra do api.
export const CRL_STALE_MS = 24 * 60 * 60 * 1000;

export function signerStatus(signer: SignerView, nowMs: number): { label: string; tone: Tone } {
  if (!signer.reachable) return { label: "inalcançável", tone: "down" };
  if (!signer.crlUpdatedAt) return { label: "no ar, LCRs nunca atualizadas", tone: "warn" };
  const at = Date.parse(signer.crlUpdatedAt);
  if (Number.isNaN(at) || nowMs - at > CRL_STALE_MS) return { label: "no ar, LCRs com mais de 24 h", tone: "warn" };
  return { label: "no ar", tone: "ok" };
}

export function signerDetail(signer: SignerView): string {
  if (!signer.reachable) return "o api não alcançou o serviço signer — as assinaturas ficam pendentes até ele voltar";
  return `versão ${signer.version ?? "—"} · LCRs atualizadas em ${fmtWhen(signer.crlUpdatedAt)}`;
}

export const PSC_MOCK_KEY = "signature_psc_mock";
export const PSC_MOCK_NOTICE =
  "Esta cidade assina com o PSC SIMULADO — assinaturas sem validade jurídica (ambiente de desenvolvimento).";
export const PSC_REAL_NOTICE =
  "Esta cidade assina com os prestadores reais configurados no ambiente.";

// Aviso pelo estado LIGADO do interruptor (não pelo "utilizável"): ligado, a
// cidade passa a usar só o simulado. Sem o interruptor no catálogo (produção)
// é o mesmo que desligado.
export function pscModeNotice(features: { key: string; enabled: boolean }[]): { text: string; tone: Tone; simulated: boolean } {
  const simulated = features.some((f) => f.key === PSC_MOCK_KEY && f.enabled);
  return simulated
    ? { text: PSC_MOCK_NOTICE, tone: "warn", simulated: true }
    : { text: PSC_REAL_NOTICE, tone: "neutral", simulated: false };
}
