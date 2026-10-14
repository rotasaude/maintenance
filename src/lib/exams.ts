// Interruptores do módulo 21a no maintenance (ADR 0036; contrato §11). O
// liga/desliga e os pré-requisitos são o mecanismo genérico (features.ts);
// aqui só o aviso do laboratório simulado. Nenhum token FHIR, CPF, CNS ou
// valor de resultado passa pelo maintenance.
export const FAKE_LAB_KEY = "fake_lab";
export const FAKE_LAB_NOTICE =
  "Esta cidade recebe laudos do LABORATÓRIO SIMULADO — as guias agendadas do prestador simulado ganham resultado de exemplo, sem validade clínica (fora de produção).";

// Pelo estado LIGADO (não pelo "utilizável"): ligado, o fake-lab passa a
// enviar assim que a entrada FHIR estiver utilizável. Sem o interruptor no
// catálogo (produção) é o mesmo que desligado.
export function fakeLabOn(features: { key: string; enabled: boolean }[]): boolean {
  return features.some((f) => f.key === FAKE_LAB_KEY && f.enabled);
}
