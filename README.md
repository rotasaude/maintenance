# Rota Saúde — Manutenção

Frontend do **mantenedor**, o superusuário técnico do Rota Saúde. Consulta e
altera configuração e dados operacionais de **todas as cidades** de um ambiente
sem entrar em cada uma. Fala com a API de manutenção do `api` (GraphQL mais
sessão REST).

Vite + React + TypeScript + React Query + GraphQL Codegen, no mesmo molde dos
outros frontends do monorepo. Spec em `rotasaude/docs`:
`superpowers/specs/2026-09-17-maintenance-graphql-api-design.md` e
`2026-09-18-maintenance-frontend-design.md`.

## Papel no ecossistema

| App | Quem usa | Alcance |
|---|---|---|
| **maintenance** (este) | Mantenedor (superusuário) | Todas as cidades, só em development/staging |
| `admin` | Operador da plataforma | Catálogo de cidades, provisionamento, entrada nas cidades via grant |
| `dashboard` | Equipe da prefeitura | Uma cidade (`<cidade>.rotasaude.app/dashboard/`) |
| `wpda` | Cidadão | Uma cidade (`<cidade>.rotasaude.app/wpda/`) |

É irmã da tela `/maintenance` do Rails, que só existe em development e não
autentica. Esta app foi feita para rodar num staging exposto à internet, então
a autenticação é obrigatória e carrega todo o risco.

**Produção fica de fora** até ter decisão própria.

### O que o superusuário pode e não pode

- Tem um papel único e total: **pula a autorização** (papéis e memberships),
  **mas não as regras de domínio** dos commands. A regra dos quatro olhos
  continua valendo.
- **Nunca assina protocolo** e nunca concede nem convida `protocol_reviewer` ou
  `municipal_admin` (ADR 0016). Não cria quem aprova nem quem concede.
- **Não vê conteúdo de cidadão** enquanto não houver mascaramento.
- Identidade própria (`Maintainer`), separada de `Operator` e de `User`, com
  TOTP obrigatório e uso único por passo de 30 s. Rate limit, bloqueio de conta
  e limites de query no servidor.

## Telas

| Tela | O que faz |
|---|---|
| **Cidades** | Catálogo; o detalhe de cada cidade tem as abas Perfil, Protocolos, Destinatários, Contas, Contagens e Operação. Cada aba é uma consulta própria, disparada só quando é aberta |
| **Mantenedores** | Lista, convite e desativação. O convite só é registrado aqui; o link sai do `rake maintainer:invite` no servidor |
| **Tokens** | Tokens de serviço para automação: criação com step-up, lista e revogação. O segredo aparece **uma única vez** e sai do cache do React Query logo depois |
| **Auditoria** | Trilha de auditoria da plataforma, filtrável por mantenedor e período. Só leitura |

Login e matrícula por convite (`/invitations`) ficam fora da casca logada.

### Protocolos

A aba **Protocolos** do detalhe de cidade lista todas as versões com o estado
das assinaturas (publicação e ativação, N/2) e os revisores elegíveis da
cidade. Ela oferece só as ações que o status permite: enviar para revisão,
publicar, ativar, aposentar e reverter. Publicar, ativar, aposentar e reverter
pedem o código do autenticador; reverter pede também um motivo.

A lista mostra até 100 versões: as não aposentadas primeiro (nome asc, versão
desc) e as aposentadas por último, para que uma aposentada nunca empurre uma
versão viva para fora do teto.

Publicar e ativar só passam quando dois revisores da cidade, que não editaram a
versão, já assinaram pelo dashboard. Sem isso o botão aparece desabilitado com
o motivo. Não há editor de rascunho aqui; a autoria é do editor do dashboard.

A reversão mostra antes a versão-alvo (`revertTargetVersion`, uma previsão sem
lock) e confirma depois qual versão **de fato** passou a valer. Se as duas
divergirem, a mensagem diz as duas.

> **Ordem de deploy:** o `api` sobe **antes** do maintenance. Um build novo
> contra um api sem os campos novos quebra a consulta por validação e derruba
> a aba Protocolos inteira.

## Subir em dev

O app roda como o serviço `maintenance` no `docker-compose.yml` da raiz do
monorepo (ao lado de `admin`, `dashboard` e `wpda`):

```bash
docker compose up -d api maintenance
docker compose exec api bin/rails db:seed
```

Abre em **http://maintenance.localhost:5177**. Em desenvolvimento, o Vite
propaga `/graphql`, `/session`, `/invitations/enroll` e `/invitations/accept`
para o `api` (porta 3030) e troca o `Host` para `maintenance-api.localhost`,
que é o único rótulo de host que a rota de manutenção do Rails reconhece. Os
comentários de `vite.config.ts` explicam por que o `Host` é trocado e por que o
`Origin` só é injetado quando a requisição chega sem ele (GET same-origin não
manda `Origin` no navegador).

Abrir em `http://localhost:5177` **não funciona**. O navegador manda esse
`Origin`, o api compara com `MAINTENANCE_FRONTEND_ORIGIN` e recusa tudo com
403, e a tela de login mostra só a mensagem genérica, sem pista do motivo. Use
o host `maintenance.localhost`.

### Credencial de desenvolvimento

`bin/rails db:seed` no `api` semeia o mantenedor **dev@local / dev-password**,
com TOTP de segredo fixo, e imprime o `otpauth://` para escanear no
autenticador (`lib/dev_maintainer.rb`). É conta de outra tabela, diferente da
do operador do console de plataforma: o e-mail e a senha são os mesmos, mas o
segredo de TOTP é próprio. O segredo fixo sobrevive a resets do banco, e a
semente também destrava a conta bloqueada por senha errada.

### As duas variáveis de ambiente que o api precisa

O app só funciona se o `api` estiver com:

```
MAINTENANCE_API_ENABLED=true
MAINTENANCE_FRONTEND_ORIGIN=http://maintenance.localhost:5177
```

Essas duas linhas já estão como default no `docker-compose.yml` da raiz (fora
do git). Se você mudar qualquer uma delas, **recrie o container do api**
(`docker compose up -d --force-recreate api`), porque variável nova no compose
não chega a um container já rodando. Confira com:

```bash
docker exec api-dev printenv | grep MAINTENANCE
```

## Convidar um mantenedor

O caminho de verdade para criar mantenedor é o convite; a semente existe só
para não depender dele em dev. O mantenedor define a própria senha e o TOTP na
matrícula. Rode na raiz do monorepo:

```bash
docker compose exec api bin/rails "maintainer:invite[maintainer@rota-saude.com]"
```

O comando imprime `[maintainer:invite] <MAINTENANCE_FRONTEND_ORIGIN>/invitations#<token>`.
Abra esse link no navegador para completar o cadastro: escaneie o QR no app
autenticador, defina a senha (mínimo de 12 caracteres) e informe o código.
Abra o link numa aba só, porque cada abertura gera um segredo TOTP novo. Rodar
o comando de novo para uma conta já matriculada zera senha, TOTP e sessões (é o
caminho de recuperação).

## Schema e codegen

```bash
npm run schema:pull   # com o stack de dev de pé; o script sobe até a raiz sozinho
npm run codegen
```

O endpoint GraphQL exige credencial até para introspecção, então o
`schema:pull` extrai o SDL direto do api (`Maintenance::Schema.to_definition`)
para `schema.graphql`. A CI roda `codegen:check`: se o schema mudar e os tipos
gerados em `src/gql/` não forem regenerados, ela falha.

## Testes

```bash
npm run typecheck
npm test
npm run codegen:check
npm run build
```

A CI (`.github/workflows/ci.yml`) roda os quatro em todo push para `main` e em
todo PR.

### E2E

Pré-requisitos: o stack de dev de pé
(`docker compose up -d api worker maintenance`) e, uma vez só por máquina, os
binários do Chromium do Playwright:

```bash
npx playwright install chromium
```

Depois disso:

```bash
npm run e2e
```

A suíte roda no host (Playwright), contra o stack de dev, e não no container.
Não há `webServer` no `playwright.config.ts`, porque quem sobe o app é o
`docker-compose.yml`.

Cada código TOTP só é aceito uma vez (`last_otp_step`). Login, matrícula e a
criação de um token dentro do mesmo passo de 30 s seriam recusados, então a
suíte espera o próximo passo entre usos. Na prática isso leva de meio minuto a
um minuto, mas é o comportamento real que o usuário vai ter.

A suíte cria o próprio mantenedor (`rake maintainer:invite`, com e-mail único
por execução) e um token de serviço, e revoga o token ao final. Mesmo assim,
**cada execução deixa no banco de dev**:

- um mantenedor e linhas de auditoria imutáveis. É o custo aceito: a auditoria
  recusa `DELETE` por trigger, então não tente apagá-los;
- **um protocolo `e2e-…` em curitiba, aposentado ao final** (rascunho → em
  revisão → aposentado, pelo teste "protocolos"), junto com os eventos de
  domínio que cada transição emite (`protocol.draft_saved`,
  `protocol.submitted_for_review`, `protocol.retired`) e as linhas de
  auditoria da plataforma correspondentes.

O `playwright.config.ts` roda com trace, screenshot e vídeo **desligados** de
propósito. A suíte mostra dois segredos reais na tela (a chave TOTP da
matrícula e o segredo do token de serviço), e um trace ou uma captura de tela
guardados em `test-results/` os gravariam em claro. Para depurar uma falha,
rode local com `npx playwright test --headed` ou `--debug`, nunca a partir de
um artefato salvo em disco.

## Staging

```
VITE_MAINTENANCE_ENV=staging
VITE_MAINTENANCE_API_URL=https://<host-da-api-de-manutenção>
```

Em staging a origem é diferente da API (CORS, não proxy), então o navegador
manda `Origin` normalmente, sem troca de host. Uma faixa de ambiente
(`EnvBanner`) fica sempre no topo: com alcance total sobre as cidades, confundir
staging com dev é o erro mais caro que a tela pode induzir.
