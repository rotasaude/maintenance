import { test as base, expect, type Page } from "@playwright/test";
import { inviteMaintainer, freshCode } from "./support";

// e2e contra o stack de dev de verdade (Task 10, plano
// 2026-09-18-maintenance-frontend-01): convite, matrícula, entrada em duas
// etapas, uma cidade, um token de serviço e saída — tudo pelo proxy real,
// pelo cookie real e por códigos TOTP de uso único de verdade (o que um
// mock não pegaria).
//
// Os cinco testes abaixo rodam em SÉRIE (test.describe.serial +
// workers: 1) e compartilham UMA página/contexto de navegador (fixture
// `sharedPage`, escopo "worker"): é o mesmo mantenedor, a mesma sessão e o
// mesmo mantenedor autenticador do início ao fim — como um operador faria
// abrindo o app uma vez e navegando pelas telas, não uma sessão nova por
// passo. Um `page` novo por teste (o padrão do Playwright) derrubaria o
// cookie de sessão (host-only, SameSite=Strict) entre os testes 2 e 5.
// A mesma URL padrão de playwright.config.ts — um fixture de worker não
// enxerga `baseURL` (é uma opção de teste), então lê direto do ambiente.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://maintenance.localhost:5177";

const test = base.extend<object, { sharedPage: Page }>({
  sharedPage: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ baseURL: BASE_URL });
      const page = await context.newPage();
      await use(page);
      await context.close();
    },
    { scope: "worker" }
  ]
});

const EMAIL = `e2e-${Date.now()}@rotasaude.app`;
const PASSWORD = "E2e-Passw0rd!!!1"; // 16 caracteres — acima do mínimo de 12.
const TOKEN_NAME = `e2e-token-${Date.now()}`;

// Preenchido pelo teste 1 (a chave só existe depois do convite) e lido
// pelos testes seguintes — os cinco rodam em série, nunca em paralelo.
let secret = "";
let tokenSecretOnce = "";

async function signInWithCode(page: Page, email: string, password: string, otpSecret: string) {
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  const codeField = page.getByLabel("Código", { exact: true });
  await expect(codeField).toBeVisible();
  await codeField.fill(await freshCode(otpSecret));
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();

  await expect(page.getByRole("button", { name: "Cidades", exact: true })).toBeVisible();
}

// Depois do reload (teste 4), a sessão sobrevive via cookie — mas o teste
// não deve supor isso: se a Shell não aparecer, entra de novo antes de
// seguir, exatamente como a brief pede ("depois de entrar de novo se
// preciso").
async function ensureSignedIn(page: Page, email: string, password: string, otpSecret: string) {
  const shellNav = page.getByRole("button", { name: "Cidades", exact: true });
  const loginHeading = page.getByRole("heading", { name: "Entrar" });
  await expect(shellNav.or(loginHeading)).toBeVisible({ timeout: 15_000 });

  if (await loginHeading.isVisible()) {
    await signInWithCode(page, email, password, otpSecret);
  } else {
    await expect(shellNav).toBeVisible();
  }
}

test.describe.serial("fluxo de manutenção ponta a ponta", () => {
  test("convite e matrícula", async ({ sharedPage: page }) => {
    const link = inviteMaintainer(EMAIL);

    await page.goto(link);

    await expect(page.getByRole("heading", { name: "Matricular autenticador" })).toBeVisible();

    // O token some da URL assim que a tela lê o fragmento (src/main.tsx).
    const url = new URL(page.url());
    expect(url.pathname).toBe("/");
    expect(url.hash).toBe("");
    expect(page.url()).not.toContain(link.split("#")[1]);

    secret = (await page.locator("code").innerText()).trim();
    expect(secret.length).toBeGreaterThan(0);

    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirmar senha", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Código", { exact: true }).fill(await freshCode(secret));
    await page.getByRole("button", { name: "Concluir matrícula" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Matrícula concluída. Entre com sua senha e o código do autenticador."
    );
  });

  test("entrar", async ({ sharedPage: page }) => {
    await signInWithCode(page, EMAIL, PASSWORD, secret);

    await expect(page.locator("header").getByText(EMAIL, { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "DEVELOPMENT" })).toBeVisible();
  });

  test("cidades", async ({ sharedPage: page }) => {
    await page.getByRole("button", { name: "Cidades", exact: true }).click();

    const curitibaRow = page.locator("tr", { hasText: "curitiba" });
    await expect(curitibaRow).toBeVisible();
    await curitibaRow.click();

    // O topo: dl com o slug da cidade.
    await expect(
      page.locator("xpath=//dt[text()='Slug']/following-sibling::dd[1]")
    ).toHaveText("curitiba");

    await page.getByRole("button", { name: "Contagens", exact: true }).click();
    await expect(
      page.locator("xpath=//dt[text()='Usuários']/following-sibling::dd[1]")
    ).toHaveText(/^\d+$/);

    await page.getByRole("button", { name: "voltar" }).click();
  });

  test("token de serviço", async ({ sharedPage: page }) => {
    await page.getByRole("button", { name: "Tokens", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tokens de serviço" })).toBeVisible();

    await page.getByLabel("Nome", { exact: true }).fill(TOKEN_NAME);
    // Não é `exact: true`: o texto do <label> que envolve o <select> inclui
    // o texto da opção selecionada ("Acesso" + "leitura"), então o nome
    // exato nunca é só "Acesso" — verificado ao vivo (o teste ficava preso
    // aqui, esperando um locator que nunca resolvia).
    await page.getByLabel("Acesso").selectOption("read");
    // Sem cidades marcadas — o token alcança todas (nenhum checkbox tocado).
    const validityField = page.getByLabel("Validade (dias)", { exact: true });
    await validityField.fill("1");
    await page.getByLabel("Código", { exact: true }).fill(await freshCode(secret));
    await page.getByRole("button", { name: "criar token", exact: true }).click();

    const secretPanel = page.locator("section", {
      has: page.getByRole("heading", { name: `Segredo do token "${TOKEN_NAME}"` })
    });
    await expect(secretPanel).toBeVisible();

    tokenSecretOnce = (await secretPanel.locator("p").first().innerText()).trim();
    expect(tokenSecretOnce.length).toBeGreaterThan(0);
    await expect(secretPanel.getByRole("status")).toHaveText("Este segredo não será mostrado de novo.");

    await secretPanel.getByRole("button", { name: "copiar" }).click();
    await secretPanel.getByRole("button", { name: "fechei" }).click();
    await expect(secretPanel).not.toBeVisible();

    await page.reload();
    await ensureSignedIn(page, EMAIL, PASSWORD, secret);

    // O segredo não aparece em lugar nenhum depois do reload.
    const content = await page.content();
    expect(content).not.toContain(tokenSecretOnce);

    await page.getByRole("button", { name: "Tokens", exact: true }).click();
    const tokenRow = page.locator("tr", { hasText: TOKEN_NAME });
    await expect(tokenRow).toBeVisible();
    await expect(tokenRow.getByText("ativo", { exact: true })).toBeVisible();

    // Confirmação de dois cliques (ConfirmButton).
    await tokenRow.getByRole("button", { name: "revogar" }).click();
    await tokenRow.getByRole("button", { name: "confirmar revogação" }).click();
    await expect(page.locator("tr", { hasText: TOKEN_NAME }).getByText("revogado", { exact: true })).toBeVisible();
  });

  test("sair", async ({ sharedPage: page }) => {
    await page.getByRole("button", { name: "sair", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

    const response = await page.request.post("/graphql", {
      headers: { "X-Rota-Maintenance": "1", "Content-Type": "application/json" },
      data: { query: "{ __typename }" }
    });
    expect(response.status()).toBe(401);
  });
});
