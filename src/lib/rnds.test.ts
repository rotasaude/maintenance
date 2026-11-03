import { describe, expect, it } from "vitest";
import { RNDS_MOCK_KEY, RNDS_MOCK_NOTICE, rndsMockOn } from "./rnds";

describe("rndsMockOn", () => {
  it("só pelo estado ligado de rnds_mock; ausente (produção) é desligado", () => {
    expect(rndsMockOn([ { key: RNDS_MOCK_KEY, enabled: true } ])).toBe(true);
    expect(rndsMockOn([ { key: RNDS_MOCK_KEY, enabled: false } ])).toBe(false);
    expect(rndsMockOn([ { key: "rnds_immunization", enabled: true } ])).toBe(false);
    expect(rndsMockOn([])).toBe(false);
  });

  it("o aviso diz simulada e que nada chega ao Ministério", () => {
    expect(RNDS_MOCK_NOTICE).toBe(
      "Esta cidade envia as vacinas à RNDS SIMULADA — as doses recebem aceite ou recusa de exemplo e não chegam ao Ministério da Saúde nem ao Meu SUS Digital (fora de produção)."
    );
  });
});
