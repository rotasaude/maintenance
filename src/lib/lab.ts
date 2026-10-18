// Interruptores do módulo 21b no maintenance (ADR 0037; contrato §10). O
// liga/desliga e os pré-requisitos são o mecanismo genérico (features.ts);
// aqui só o aviso do middleware simulado, no molde do laboratório simulado
// do 21a (exams.ts). Nenhum token de middleware, mensagem HL7 ou valor de
// resultado passa pelo maintenance.
export const FAKE_MIDDLEWARE_KEY = "fake_middleware";
// Módulo 21c (C-M2): o fake-middleware também manda corridas de controle; uma
// corrida reprovada (só sob demanda) abre bloqueio de liberação do analito.
export const FAKE_MIDDLEWARE_NOTICE =
  "Esta cidade recebe resultados do MIDDLEWARE SIMULADO — as amostras recebidas no laboratório municipal ganham valores de exemplo pela HL7, e o controle de qualidade recebe corridas de controle de exemplo (uma corrida reprovada de exemplo abre bloqueio de liberação do analito no aparelho), sem validade clínica (fora de produção); nenhum valor sai do laboratório sem o liberador.";

// Pelo estado LIGADO (não pelo "utilizável"): ligado, o fake-middleware passa
// a enviar assim que a entrada HL7 estiver utilizável. Sem o interruptor no
// catálogo (produção) é o mesmo que desligado.
export function fakeMiddlewareOn(features: { key: string; enabled: boolean }[]): boolean {
  return features.some((f) => f.key === FAKE_MIDDLEWARE_KEY && f.enabled);
}
