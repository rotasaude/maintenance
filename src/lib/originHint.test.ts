import { describe, expect, it } from "vitest";
import { originMismatchHint } from "./originHint";

// O 403 de Origin é o único jeito de a API recusar TUDO por configuração
// local: o navegador está num host que ela não reconhece, e nenhuma
// credencial passa. A mensagem genérica da tela de login existe para não
// contar a um atacante qual camada recusou — mas em produção esse 403 não
// acontece com usuário legítimo, e em dev é justamente o que ninguém
// adivinha. A dica só nasce onde o host esperado é conhecido, e o servidor
// de dev é o único que o injeta.
describe("originMismatchHint", () => {
  it("nomeia os DOIS hosts: o que o navegador está usando e o que a API reconhece", () => {
    const hint = originMismatchHint("http://localhost:5177", "http://maintenance.localhost:5177");

    expect(hint).not.toBeNull();
    expect(hint).toContain("http://localhost:5177");
    expect(hint).toContain("http://maintenance.localhost:5177");
  });

  it("é nula sem host esperado — é isso que mantém a mensagem genérica no build publicado", () => {
    expect(originMismatchHint("https://maintenance.rotasaude.com.br", null)).toBeNull();
    expect(originMismatchHint("https://maintenance.rotasaude.com.br", "")).toBeNull();
  });

  it("é nula quando o host já é o esperado — aí o 403 tem outra causa e a dica enganaria", () => {
    expect(originMismatchHint("http://maintenance.localhost:5177", "http://maintenance.localhost:5177")).toBeNull();
  });
});
