import { describe, expect, it } from "vitest";
import { FAKE_LAB_KEY, FAKE_LAB_NOTICE, fakeLabOn } from "./exams";

describe("fakeLabOn", () => {
  it("só pelo estado ligado de fake_lab; ausente (produção) é desligado", () => {
    expect(fakeLabOn([ { key: FAKE_LAB_KEY, enabled: true } ])).toBe(true);
    expect(fakeLabOn([ { key: FAKE_LAB_KEY, enabled: false } ])).toBe(false);
    expect(fakeLabOn([ { key: "exam_fhir_inbound", enabled: true } ])).toBe(false);
    expect(fakeLabOn([])).toBe(false);
  });

  it("o aviso diz simulado e sem validade", () => {
    expect(FAKE_LAB_NOTICE).toMatch(/LABORATÓRIO SIMULADO/);
    expect(FAKE_LAB_NOTICE).toMatch(/sem validade clínica/);
  });
});
