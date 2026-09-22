import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { authenticator } from "otplib";

// O teste cria o próprio mantenedor pelo caminho real (rake, como um
// operador faria) e calcula o TOTP da chave que a própria tela mostra.
// Cada código é consumido uma vez pela API: entre dois usos, espera-se o
// próximo passo de 30 s (Decisão 7 do plano).
//
// Ruling P1 (controlador, task-10): este pacote é ESM (`"type": "module"`
// no package.json), então `__dirname` não existe aqui — `import.meta.url`
// é o jeito ESM de achar o próprio arquivo. `../../..` a partir de
// `apps/maintenance/e2e/` é a raiz do monorepo (onde vive o
// docker-compose.yml); `ROTA_ROOT` sobrescreve quando o layout for outro.
const ROOT = process.env.ROTA_ROOT ?? fileURLToPath(new URL("../../..", import.meta.url));

export function inviteMaintainer(email: string): string {
  const out = execFileSync(
    "docker",
    [ "compose", "exec", "-T", "api", "bin/rails", `maintainer:invite[${email}]` ],
    { cwd: ROOT, encoding: "utf8" }
  );
  const link = out.split("\n").map((l) => l.match(/(\S+\/invitations#\S+)/)?.[1]).find(Boolean);
  if (!link) throw new Error("o rake não imprimiu o link do convite");
  return link;
}

// Rascunho de protocolo para o teste "protocolos": o conteúdo mínimo que passa
// no portão (o mesmo de apps/api/spec/support/protocol_signatures.rb), com
// nome único por execução. Criado pela mutation saveProtocolDraft na sessão
// do próprio mantenedor, dentro da página — deixa uma linha de contribuição
// append-only no banco de dev a cada execução (custo aceito, como o
// mantenedor e a auditoria; ver README).
export function draftDefinition(name: string) {
  return {
    name, version: 1, start_step_id: "s1",
    steps: [ { id: "s1", prompt: "?", answer_type: "boolean",
               branches: { true: null, false: null }, weights: { true: 1, false: 0 } } ],
    scoring: { type: "weighted", thresholds: { baixa: 0 }, priority_map: { baixa: 9 } }
  };
}

let lastStep = -1;

export async function freshCode(secret: string): Promise<string> {
  let step = Math.floor(Date.now() / 30_000);
  while (step <= lastStep) {
    await new Promise((r) => setTimeout(r, 1_000));
    step = Math.floor(Date.now() / 30_000);
  }
  lastStep = step;
  return authenticator.generate(secret);
}
