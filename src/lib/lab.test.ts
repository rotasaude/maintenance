import { describe, expect, it } from "vitest";
import { FAKE_MIDDLEWARE_KEY, FAKE_MIDDLEWARE_NOTICE, fakeMiddlewareOn } from "./lab";
import { FAKE_LAB_NOTICE } from "./exams";

describe("fakeMiddlewareOn", () => {
  it("só pelo estado ligado de fake_middleware; ausente (produção) é desligado", () => {
    expect(fakeMiddlewareOn([ { key: FAKE_MIDDLEWARE_KEY, enabled: true } ])).toBe(true);
    expect(fakeMiddlewareOn([ { key: FAKE_MIDDLEWARE_KEY, enabled: false } ])).toBe(false);
    expect(fakeMiddlewareOn([ { key: "lab_hl7_inbound", enabled: true }, { key: "fake_lab", enabled: true } ])).toBe(false);
    expect(fakeMiddlewareOn([])).toBe(false);
  });

  it("o aviso diz simulado, sem validade e que nada sai sem o liberador; e não é o do laboratório do 21a", () => {
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/MIDDLEWARE SIMULADO/);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/sem validade clínica/);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/liberador/);
    expect(FAKE_MIDDLEWARE_NOTICE).not.toBe(FAKE_LAB_NOTICE);
  });

  it("o aviso do middleware menciona as corridas de controle (21c) e o bloqueio, sem perder o que já dizia", () => {
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/corridas de controle de exemplo/);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/reprovada de exemplo, enviada só sob demanda, abre bloqueio de liberação/);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/^Esta cidade recebe resultados do MIDDLEWARE SIMULADO — /);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/sem validade clínica \(fora de produção\)/);
    expect(FAKE_MIDDLEWARE_NOTICE).toMatch(/nenhum valor sai do laboratório sem o liberador\.$/);
  });
});
