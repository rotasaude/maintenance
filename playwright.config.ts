import { defineConfig, devices } from "@playwright/test";

// e2e contra o stack de dev de verdade (Task 10): sem webServer — o
// docker-compose da raiz já sobe api, worker e maintenance. Um projeto só
// (chromium), sem paralelismo: os testes compartilham UM mantenedor e o
// segredo TOTP é consumido uma vez por passo de 30 s (ver e2e/support.ts),
// então rodar mais de um worker ou fora de ordem quebraria a suíte.
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [ [ "list" ] ],
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://maintenance.localhost:5177",
    // Fix round 1 (achado Important da revisão): esta suíte mostra DOIS
    // segredos reais na tela em algum momento — a chave TOTP da matrícula
    // (Invitation, em texto) e o secretOnce do token de serviço (Tokens).
    // trace/screenshot/video "on failure" gravariam esses segredos em
    // claro dentro de test-results/*/trace.zip (que carrega DOM
    // snapshots e capturas de tela). Sem artefato nenhum, de propósito —
    // quem for depurar uma falha roda local com `--headed` ou `--debug`
    // (README, seção E2E), nunca a partir de um trace salvo em disco.
    trace: "off",
    screenshot: "off",
    video: "off"
    // O Chrome resolve *.localhost nativamente para 127.0.0.1 — confirmado
    // contra este stack (task-10-report.md). Se algum dia isso não valer
    // mais no host de quem roda a suíte, descomente:
    // launchOptions: { args: [ "--host-resolver-rules=MAP *.localhost 127.0.0.1" ] }
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
