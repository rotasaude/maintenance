import { describe, expect, it } from "vitest";
import { actionsFor, shortfallMessage, type ProtocolVersionState } from "./protocolActions";

function version(overrides: Partial<ProtocolVersionState>): ProtocolVersionState {
  return {
    name: "dengue", version: 1, status: "draft",
    publicationMissing: 2, activationMissing: 2, eligibleReviewers: 3, revertible: false,
    ...overrides
  };
}

const kinds = (v: ProtocolVersionState) => actionsFor(v).map((a) => a.kind);

describe("actionsFor", () => {
  it("oferece por status só as transições que o domínio aceita", () => {
    expect(kinds(version({ status: "draft" }))).toEqual([ "submit", "retire" ]);
    expect(kinds(version({ status: "in_review" }))).toEqual([ "publish", "retire" ]);
    expect(kinds(version({ status: "published" }))).toEqual([ "activate", "retire" ]);
    expect(kinds(version({ status: "active", revertible: true }))).toEqual([ "revert" ]);
    expect(kinds(version({ status: "active", revertible: false }))).toEqual([]);
    expect(kinds(version({ status: "retired" }))).toEqual([]);
  });

  it("step-up em tudo menos enviar para revisão; motivo só na reversão", () => {
    const all = [
      ...actionsFor(version({ status: "draft" })),
      ...actionsFor(version({ status: "in_review" })),
      ...actionsFor(version({ status: "published" })),
      ...actionsFor(version({ status: "active", revertible: true }))
    ];
    for (const action of all) {
      expect(action.stepUp).toBe(action.kind !== "submit");
      expect(action.needsReason).toBe(action.kind === "revert");
    }
  });

  it("publicar desabilita com o que falta; habilita com as assinaturas", () => {
    const [ missingTwo ] = actionsFor(version({ status: "in_review", publicationMissing: 2 }));
    expect(missingTwo.disabledReason).toBe("faltam 2 assinaturas");

    const [ missingOne ] = actionsFor(version({ status: "in_review", publicationMissing: 1 }));
    expect(missingOne.disabledReason).toBe("falta 1 assinatura");

    const [ ready ] = actionsFor(version({ status: "in_review", publicationMissing: 0 }));
    expect(ready.disabledReason).toBeNull();
  });

  it("ativar olha as assinaturas de ativação, não as de publicação", () => {
    const [ activate ] = actionsFor(version({ status: "published", publicationMissing: 0, activationMissing: 1 }));
    expect(activate.disabledReason).toBe("falta 1 assinatura");
  });

  it("revisores insuficientes vencem o faltante — a cidade está bloqueada", () => {
    const [ publish ] = actionsFor(version({ status: "in_review", eligibleReviewers: 1, publicationMissing: 2 }));
    expect(publish.disabledReason).toBe("a cidade tem 1 revisor(es) elegível(is); são necessários 2");
  });

  it("aposentar e enviar nunca dependem de assinatura", () => {
    for (const action of actionsFor(version({ status: "draft", eligibleReviewers: 0 }))) {
      expect(action.disabledReason).toBeNull();
    }
  });
});

describe("shortfallMessage", () => {
  it("singular e plural como Protocols::Signatures.shortfall_message", () => {
    expect(shortfallMessage(1)).toBe("falta 1 assinatura");
    expect(shortfallMessage(2)).toBe("faltam 2 assinaturas");
  });
});
