# Rota Saúde — Manutenção

Frontend da API de manutenção (superusuário, GraphQL + sessão REST). Vite +
React + React Query, no mesmo molde dos outros frontends do monorepo
(`apps/dashboard`, `apps/admin`, `apps/wpda`).

## Subir em dev

O app roda como o serviço `maintenance` no `docker-compose.yml` da raiz do
monorepo (ao lado de `admin`, `dashboard` e `wpda`):

```bash
docker compose up -d maintenance
```

Abre em **http://maintenance.localhost:5177**. Em desenvolvimento, o Vite
propaga `/graphql`, `/session`, `/invitations/enroll` e
`/invitations/accept` para o `api` (porta 3030), trocando o `Host` para
`maintenance-api.localhost` — é o único rótulo de host que a rota de
manutenção do Rails reconhece. Veja os comentários de `vite.config.ts` para
o porquê do `Host` trocado e do `Origin` só injetado quando a requisição
chega sem ele (GET same-origin não manda `Origin` no navegador).

Abrir em `http://localhost:5177` **não funciona**: o navegador manda esse
`Origin`, o api compara com `MAINTENANCE_FRONTEND_ORIGIN` e recusa tudo com
403 — que a tela de login mostra como a mensagem genérica, sem pista do
motivo. Use o host `maintenance.localhost`.

### Credencial de desenvolvimento

`bin/rails db:seed` no `api` semeia o mantenedor **dev@local /
dev-password**, com TOTP de segredo fixo, e imprime o `otpauth://` para
escanear no autenticador (`lib/dev_maintainer.rb`). É conta de outra tabela
que o operador do console de plataforma — o mesmo e-mail e a mesma senha,
mas segredo de TOTP próprio. O segredo fixo sobrevive a resets do banco, e a
semente também destrava a conta bloqueada por senha errada.

O caminho de verdade para criar mantenedor continua sendo o convite
(`rails 'maintainer:invite[email]'`); a semente existe só para não depender
dele em dev.

### As duas variáveis de ambiente que o api precisa

O app só funciona se o `api` estiver com:

```
MAINTENANCE_API_ENABLED=true
MAINTENANCE_FRONTEND_ORIGIN=http://maintenance.localhost:5177
```

Essas duas linhas já estão como default no `docker-compose.yml` da raiz
(fora do git). Se você mudar qualquer uma delas, **recrie o container do
api** (`docker compose up -d --force-recreate api`) — variável nova no
compose não chega a um container já rodando — e confira com:

```bash
docker exec api-dev printenv | grep MAINTENANCE
```

## Convidar o primeiro mantenedor

Conta de acesso em dev: **`maintainer@rota-saude.com`**. Não há senha semeada:
o mantenedor nasce por convite e define a própria senha e o TOTP na matrícula.
Rode na raiz do monorepo (onde fica o `docker-compose.yml`):

```bash
docker compose exec api bin/rails "maintainer:invite[maintainer@rota-saude.com]"
```

O comando imprime `[maintainer:invite] <MAINTENANCE_FRONTEND_ORIGIN>/invitations#<token>`.
Abra esse link no navegador para completar o cadastro: escaneie o QR no app
autenticador, defina a senha (mínimo de 12 caracteres) e informe o código.
Abra o link numa aba só — cada abertura gera um segredo TOTP novo. Rodar o
comando de novo para uma conta já matriculada zera senha, TOTP e sessões
(é o caminho de recuperação).

## Protocolos

A aba **Protocolos** do detalhe de cidade lista todas as versões com o estado
das assinaturas (publicação e ativação, N/2) e os revisores elegíveis da
cidade, e oferece só as ações que o status permite: enviar para revisão,
publicar, ativar, aposentar e reverter. Publicar, ativar, aposentar e
reverter pedem o código do autenticador; reverter pede também um motivo. A
lista mostra até 100 versões — as não aposentadas primeiro (nome asc,
versão desc), aposentadas por último, para uma aposentada nunca empurrar uma
versão viva para fora do teto.

O mantenedor **nunca assina** (ADR-0016): publicar e ativar só passam quando
dois revisores da cidade — que não editaram a versão — já assinaram pelo
dashboard. Sem isso o botão aparece desabilitado com o motivo. Não há editor
de rascunho aqui; a autoria é do editor do dashboard.

## Schema e codegen

```bash
npm run schema:pull   # roda a partir da raiz do monorepo
npm run codegen
```

## Testes

```bash
npm run typecheck
npm test
npm run build
```

### E2E

Pré-requisitos: o stack de dev de pé (`api`, `worker` e `maintenance` —
`docker compose up -d api worker maintenance`) e, uma vez só por máquina,
os binários do Chromium do Playwright:

```bash
npx playwright install chromium
```

Depois disso:

```bash
npm run e2e
```

Roda no host (Playwright), contra o stack de dev, não no container — sem
`webServer` no `playwright.config.ts`, porque quem sobe o app é o
`docker-compose.yml`. Cada código TOTP só é aceito uma vez (`last_otp_step`):
login, matrícula e a criação de um token dentro do mesmo passo de 30s
seriam recusados, então a suíte espera o próximo passo entre usos — leva
cerca de meio minuto a um minuto na prática (o plano previa ~2 min), mas é
o comportamento real que o usuário vai ter.

A suíte cria o próprio mantenedor (`rake maintainer:invite`, e-mail único
por execução) e um token de serviço, e revoga o token ao final — mas
**deixa um mantenedor e linhas de auditoria imutáveis no banco de dev a
cada execução**: é o custo aceito (a auditoria recusa `DELETE` por
trigger), não tente apagá-los. Cada execução também deixa **um protocolo
`e2e-…` em curitiba, aposentado ao final** (rascunho → em revisão →
aposentado, pelo mesmo teste "protocolos") — junto com os eventos de
domínio da cidade que cada transição emite (`protocol.draft_saved`,
`protocol.submitted_for_review`, `protocol.retired`) e as linhas de
auditoria da plataforma correspondentes.

`playwright.config.ts` roda com trace, screenshot e vídeo **desligados** de
propósito: a suíte mostra dois segredos reais na tela (a chave TOTP da
matrícula e o segredo do token de serviço), e um trace ou uma captura de
tela guardados em `test-results/` os gravariam em claro. Para depurar uma
falha, rode local com `npx playwright test --headed` ou `--debug` — nunca
a partir de um artefato salvo em disco.

## Staging

```
VITE_MAINTENANCE_ENV=staging
VITE_MAINTENANCE_API_URL=https://<host-da-api-de-manutenção>
```

Em staging a origem é diferente da API (CORS, não proxy), então o navegador
manda `Origin` normalmente — nada de host trocado.
