// Interruptores do módulo 29 no maintenance (ADR 0047). O liga/desliga e os
// pré-requisitos são o mecanismo genérico (features.ts); aqui só o aviso da
// RNDS simulada. Nenhum certificado, dose ou CPF passa pelo maintenance.
export const RNDS_MOCK_KEY = "rnds_mock";
export const RNDS_MOCK_NOTICE =
  "Esta cidade envia as vacinas à RNDS SIMULADA — as doses recebem aceite ou recusa de exemplo e não chegam ao Ministério da Saúde nem ao Meu SUS Digital (fora de produção).";

// Pelo estado LIGADO (não pelo "utilizável"). Sem o interruptor no catálogo
// (produção) é o mesmo que desligado.
export function rndsMockOn(features: { key: string; enabled: boolean }[]): boolean {
  return features.some((f) => f.key === RNDS_MOCK_KEY && f.enabled);
}
