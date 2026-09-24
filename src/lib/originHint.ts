// O 403 de Origin é a única recusa da API que é configuração local, não
// credencial: o navegador está num host que ela não reconhece (ela compara
// com MAINTENANCE_FRONTEND_ORIGIN), e daí NENHUMA credencial passa. A tela
// de login mostra a frase genérica para todo o resto de propósito — não
// contar a um atacante qual camada recusou. Este caso é a exceção estreita:
// com usuário legítimo em produção ele não acontece, e em dev é justamente
// o que ninguém adivinha (abrir em localhost:5177 em vez de
// maintenance.localhost:5177 recusa tudo, sem pista).
//
// A dica nomeia os DOIS hosts porque só o par explica o problema: qual host
// o navegador está usando e qual a API reconhece. O host esperado varia por
// ambiente e por instalação, então nada aqui é literal.
//
// Ela só nasce onde o host esperado é CONHECIDO, e quem o injeta é o
// servidor de dev do Vite (ver `expectedOrigin` em src/env.ts e o `define`
// em vite.config.ts). Num build publicado o valor não existe, a função
// devolve null e a mensagem volta a ser a genérica — sem depender de ler o
// rótulo do ambiente.
export function originMismatchHint(current: string, expected: string | null | undefined): string | null {
  if (!expected) return null;
  if (current === expected) return null;

  return `este host (${current}) não é o que a API reconhece — abra em ${expected}`;
}
