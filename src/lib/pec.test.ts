// src/lib/pec.test.ts
import { describe, expect, it } from "vitest";
import {
  HMAC_KEY_MIN, PEC_KEY_ROTATE_WARNING, hmacKeyProblem, hmacKeyStatus, hmacKeyUpdatedText, normalizePecOrigin,
  pecConfigErrorText, pecOriginProblem, pecOriginText
} from "./pec";

describe("normalizePecOrigin: tabela de casos", () => {
  it.each([
    [ "https://pec.curitiba.pr.gov.br", "https://pec.curitiba.pr.gov.br" ],
    [ "https://pec.curitiba.pr.gov.br/", "https://pec.curitiba.pr.gov.br" ],
    [ "  https://pec.curitiba.pr.gov.br  ", "https://pec.curitiba.pr.gov.br" ],
    [ "http://10.0.0.5:8080", "http://10.0.0.5:8080" ],
    [ "HTTPS://PEC.Curitiba.PR.gov.br", "https://pec.curitiba.pr.gov.br" ],
    [ "https://pec.curitiba.pr.gov.br:443", "https://pec.curitiba.pr.gov.br" ]
  ])("aceita %s → %s", (input, origin) => {
    expect(normalizePecOrigin(input)).toBe(origin);
  });

  it.each([
    "", "   ", "pec.curitiba.pr.gov.br", "https://pec.curitiba.pr.gov.br/esus", "https://pec.curitiba.pr.gov.br/#/",
    "https://pec.curitiba.pr.gov.br/?a=1", "ftp://pec.curitiba.pr.gov.br", "https://user:senha@pec.curitiba.pr.gov.br",
    "javascript:alert(1)"
  ])("recusa %j", (input) => {
    expect(normalizePecOrigin(input)).toBeNull();
  });
});

describe("pecOriginProblem", () => {
  it("vazio, com caminho e válido", () => {
    expect(pecOriginProblem("")).toBe("informe o endereço de origem do PEC");
    expect(pecOriginProblem("https://pec.curitiba.pr.gov.br/esus"))
      .toBe("use só a origem do PEC, como https://pec.cidade.gov.br — sem caminho, sem # e sem ?");
    expect(pecOriginProblem("https://pec.curitiba.pr.gov.br/")).toBeNull();
  });
});

describe("hmacKeyProblem", () => {
  it("vazia, curta, com espaço no meio, com acento, longa e válida (as pontas são aparadas)", () => {
    expect(hmacKeyProblem("   ")).toBe("cole a chave de assinatura gerada pelo PEC");
    expect(hmacKeyProblem("abc")).toBe(`a chave tem de ter ao menos ${HMAC_KEY_MIN} caracteres`);
    expect(hmacKeyProblem("abcdefgh ijklmnopq")).toBe("a chave não pode ter espaço no meio — confira o que foi colado");
    expect(hmacKeyProblem("chave-de-assinatura-ç")).toBe("a chave só tem letras sem acento, números e símbolos — confira o que foi colado");
    expect(hmacKeyProblem("a".repeat(513))).toBe("a chave tem de ter no máximo 512 caracteres");
    expect(hmacKeyProblem("a".repeat(512))).toBeNull();
    expect(hmacKeyProblem("  0123456789abcdef0123  \n")).toBeNull();
  });
});

describe("estado da configuração", () => {
  it("origem: o valor ou 'não preenchido'", () => {
    expect(pecOriginText({ pecOrigin: "https://pec.curitiba.pr.gov.br", hmacKeyConfigured: false })).toBe("https://pec.curitiba.pr.gov.br");
    expect(pecOriginText({ pecOrigin: null, hmacKeyConfigured: false })).toBe("não preenchido");
    expect(pecOriginText({ hmacKeyConfigured: false })).toBe("não preenchido");
  });

  it("chave: configurada ou não, sem nunca mostrar a chave", () => {
    expect(hmacKeyStatus({ hmacKeyConfigured: true, hmacKeyUpdatedAt: "2026-10-11T12:00:00Z" }))
      .toEqual({ label: "chave configurada", tone: "ok" });
    expect(hmacKeyStatus({ hmacKeyConfigured: false })).toEqual({ label: "chave não gravada — o PEC não consegue abrir a página", tone: "warn" });
    expect(hmacKeyUpdatedText({ hmacKeyConfigured: true, hmacKeyUpdatedAt: "2026-10-11T12:00:00Z" })).toBe("trocada em 11/10/2026, 09:00");
    expect(hmacKeyUpdatedText({ hmacKeyConfigured: true, hmacKeyUpdatedAt: null })).toBe("trocada em —");
    expect(hmacKeyUpdatedText({ hmacKeyConfigured: false })).toBe("nunca gravada");
  });

  it("o aviso de troca fala do PEC e da recusa", () => {
    expect(PEC_KEY_ROTATE_WARNING).toMatch(/PEC/);
    expect(PEC_KEY_ROTATE_WARNING).toMatch(/recusa/);
  });
});

describe("pecConfigErrorText", () => {
  it("traduz os códigos do contrato e mostra o resto cru", () => {
    expect(pecConfigErrorText([ { path: "pecOrigin", message: "invalid_origin" } ]))
      .toBe("o api recusou o endereço — use só a origem do PEC, como https://pec.cidade.gov.br");
    expect(pecConfigErrorText([ { path: "key", message: "invalid_key" } ])).toBe("o api recusou a chave — confira o que foi colado");
    expect(pecConfigErrorText([ { path: "citySlug", message: "cidade inexistente" } ])).toBe("cidade inexistente");
    expect(pecConfigErrorText([ { path: null, message: "algo novo" } ])).toBe("algo novo");
    expect(pecConfigErrorText([])).toBe("não foi possível concluir — tente de novo");
  });
});
