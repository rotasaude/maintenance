// Que ações de ciclo de vida cabem numa versão, e por que uma estaria
// desabilitada (Plano 2, Decisões 2-4). Espelha as pré-condições dos
// commands em apps/api/app/commands/protocols/ — mas é só uma PREVISÃO a
// partir do estado lido: a API continua decidindo (trava a linha e
// reconfere), e a recusa dela aparece na tela.
export type ProtocolVersionState = {
  name: string; version: number; status: string;
  publicationMissing: number; activationMissing: number;
  eligibleReviewers: number; revertible: boolean;
};

export type ProtocolActionKind = "submit" | "publish" | "activate" | "retire" | "revert";

export type ProtocolAction = {
  kind: ProtocolActionKind;
  label: string;
  stepUp: boolean;
  needsReason: boolean;
  disabledReason: string | null;
};

// Protocols::Signatures::REQUIRED na API.
export const REQUIRED_SIGNATURES = 2;

// Reproduz só o núcleo "falta/faltam" de Protocols::Signatures.shortfall_message
// na API — a frase de lá é mais longa ("falta 1 assinatura de publicação;
// revisores elegíveis na cidade: N"); aqui o "de quê" e "quantos revisores"
// já aparecem como texto próprio ao redor desta mensagem.
export function shortfallMessage(missing: number): string {
  return missing === 1 ? "falta 1 assinatura" : `faltam ${missing} assinaturas`;
}

function signatureBlock(eligibleReviewers: number, missing: number): string | null {
  if (eligibleReviewers < REQUIRED_SIGNATURES) {
    return `a cidade tem ${eligibleReviewers} revisor(es) elegível(is); são necessários ${REQUIRED_SIGNATURES}`;
  }
  return missing > 0 ? shortfallMessage(missing) : null;
}

const RETIRE: ProtocolAction = {
  kind: "retire", label: "Aposentar", stepUp: true, needsReason: false, disabledReason: null
};

export function actionsFor(v: ProtocolVersionState): ProtocolAction[] {
  switch (v.status) {
    case "draft":
      return [ { kind: "submit", label: "Enviar para revisão", stepUp: false, needsReason: false, disabledReason: null }, RETIRE ];
    case "in_review":
      return [ {
        kind: "publish", label: "Publicar", stepUp: true, needsReason: false,
        disabledReason: signatureBlock(v.eligibleReviewers, v.publicationMissing)
      }, RETIRE ];
    case "published":
      return [ {
        kind: "activate", label: "Ativar", stepUp: true, needsReason: false,
        disabledReason: signatureBlock(v.eligibleReviewers, v.activationMissing)
      }, RETIRE ];
    case "active":
      // R4: a versão ativa nunca é aposentada; só a reversão de emergência.
      return v.revertible
        ? [ { kind: "revert", label: "Reverter", stepUp: true, needsReason: true, disabledReason: null } ]
        : [];
    default:
      return [];
  }
}
