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
| **Cidades** | Catálogo; o detalhe de cada cidade tem as abas Perfil, Protocolos, Destinatários, Contas, Contagens, Operação, Analytics e Funcionalidades. Cada aba é uma consulta própria, disparada só quando é aberta |
| **Medicamentos** | Catálogo de medicamentos da plataforma (módulo 19c): versão atual do CATMAT (classe 6505), "importar o CATMAT" (Compras.gov; diz o que entrou, mudou e saiu), "importar as listas da Anvisa" (antimicrobianos e controlados) e os itens ocultos para revisão. Vale para todas as cidades do ambiente; uma importação por vez |
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

### Analytics

A aba **Analytics** do detalhe de cidade (módulo 14, ADR 0025) mostra o
estado do pipeline de consolidação da cidade (`analyticsStatus`: última
execução, quando consolidou e publicou com sucesso, último erro) e os seis
indicadores semanais que ela publicou na plataforma nas últimas 12 semanas
fechadas (`analyticsIndicators`). "Dados desatualizados" aparece quando a
última consolidação bem-sucedida tem mais de 36 h, ou nunca houve. Contagem
de 1 a 4 aparece como "oculto" (nas taxas, numerador ou denominador de 1 a 4); semana sem publicação, "sem dado".

A aba faz duas consultas próprias, nenhuma junto do topo da ficha: o estado
lê o banco da cidade, e os indicadores, a plataforma. Uma cidade
inalcançável derruba só o quadro do estado.

> **Ordem de deploy:** o `api` sobe **antes** do maintenance. Contra um api
> sem os campos do módulo 14, a validação recusa as consultas da aba
> Analytics, e só ela mostra o aviso; o topo e as outras abas seguem.

### Funcionalidades

A aba **Funcionalidades** do detalhe de cidade (módulo 16, ADR 0028) lista os
interruptores de funcionalidade da cidade (`features`): chave, descrição,
estado (desligada; ligada e utilizável; ligada, falta pré-requisito), o que
falta e a última mudança (quando e por qual mantenedor). Ligar e desligar
(`setCityFeature`) pede dois cliques: o primeiro só troca o rótulo do botão
para "confirmar: …". Ligar não exige os pré-requisitos: a funcionalidade fica
ligada, e a cidade só a usa quando o que falta for resolvido (credencial no
dashboard; modo, código IBGE e endereço do PEC no console admin). Depois do
ato, a tela diz o estado que o api devolveu.

O modo de prontuário (`recordMode`) e o código IBGE (`profile.ibgeCode`, o
mesmo da aba Perfil) aparecem só para leitura: quem os muda é o operador, no
admin. Com o banco da cidade inalcançável, a aba continua: o que falta aparece
como "banco da cidade inalcançável", o IBGE como "indisponível", e o
liga/desliga segue funcionando.

**Assinatura digital (módulo 19b).** O interruptor `digital_signature` aparece
na mesma lista e liga como os outros; ele precisa do `clinical_record` ligado
e utilizável (falta: "prontuário da atenção primária (clinical_record)
desligado"). Quando o catálogo da cidade traz `digital_signature`, a aba
mostra também o quadro **Assinatura digital — prestadores e signer**, só
leitura e da plataforma (vale para todas as cidades do ambiente): cada
prestador de certificado em nuvem (VIDaaS, BirdID, SafeID, NeoID, RemoteID),
se a credencial existe no api e como foi a última checagem; e o serviço
`signer` (no ar, versão, última atualização das LCRs — aviso com mais de
24 h). Credenciais e token nunca aparecem aqui. O interruptor
`signature_psc_mock` ("PSC simulado (desenvolvimento)") só existe fora de
produção e exige `digital_signature`; ligado, a aba e o quadro avisam que a
cidade assina com o PSC simulado, sem validade jurídica. Em produção o api
nem o oferece. Ordem de deploy: api → dashboard → maintenance; contra um api
sem o 19b o catálogo não traz `digital_signature` e o quadro nem aparece; se o
catálogo trouxer a chave mas o schema não tiver os campos (api desencontrado),
só o quadro mostra o aviso da ordem de deploy e a aba segue.

**Receita de controlado e SNCR (módulo 19d).** O interruptor
`controlled_prescriptions` ("Receita de controle especial e de antimicrobiano
(SNCR)") aparece na mesma lista e liga como os outros; ele precisa de
`clinical_documents` ligado (falta: "documentos clínicos (clinical_documents)
desligados"). Quando o catálogo da cidade traz `controlled_prescriptions`, a
aba mostra também o quadro **SNCR da Anvisa — numeração de receitas**, só
leitura e da plataforma: se a credencial do SNCR existe no api, se o api o
alcançou na última checagem (e quando) e se o SNCR simulado existe neste
ambiente. Credenciais, CNPJ da mantenedora, token e números SNCR nunca aparecem
aqui. O interruptor `sncr_mock` ("SNCR simulado (desenvolvimento)") só existe
fora de produção e exige `controlled_prescriptions`; ligado, a aba e o quadro
avisam que a cidade numera com o SNCR simulado, sem validade. Em produção o api
nem o oferece. Ordem de deploy: contracts → api → dashboard → maintenance;
contra um api sem o 19d o catálogo não traz `controlled_prescriptions` e o
quadro nem aparece; se o catálogo trouxer a chave mas o schema não tiver
`sncrStatus`, só o quadro mostra o aviso da ordem de deploy e a aba segue.

**Linha do tempo e página do PEC (módulo 20).** Os interruptores
`patient_timeline` ("Linha do tempo do paciente", sem pré-requisito) e
`pec_external_view` ("Página para os sistemas externos do PEC", exige
`patient_timeline` ligado, o modo `integrated`, a origem do PEC e a chave HMAC
gravadas) aparecem na mesma lista e ligam como os outros. Quando o catálogo da
cidade traz `pec_external_view`, a aba mostra o quadro **Página do PEC
(sistemas externos)**: a origem do PEC (`https://pec.cidade.gov.br`, sem
caminho — vai no `frame-ancestors` da página; não é o endereço do LEDI, que é
do operador no console admin; campo vazio apaga) e a chave de assinatura HMAC
que o próprio PEC gera. A chave só se grava ou troca, com o código do
autenticador do momento e confirmação de dois cliques; ela nunca volta do api
nem aparece aqui, e os campos da chave e do código ficam vazios depois. Trocar
a chave faz a página recusar as aberturas até o PEC ter a chave nova. Ordem de
deploy: api → dashboard e wpda → maintenance; contra um api sem o módulo 20 o
quadro nem aparece, e se o catálogo trouxer a chave mas o schema não tiver
`cityPecConfig`, só o quadro mostra o aviso da ordem de deploy.

**Rastreamento de exames (módulo 21a).** Os interruptores `exam_tracking`
("Rastreamento de exames", exige o modo de prontuário ligado: `record` ou `integrated`), `exam_fhir_inbound`
("Entrada de resultados por FHIR", exige `exam_tracking`), `exam_pec_bridge`
("Solicitar exames pela tela de sistemas externos do PEC", exige
`exam_tracking` e `pec_external_view`) e `fake_lab` ("Laboratório simulado",
exige `exam_fhir_inbound`) aparecem na mesma lista e ligam como os outros, com
o que falta em português. `fake_lab` só existe fora de produção; ligado, a aba
avisa que as guias do prestador simulado ganham laudo de exemplo, sem validade
clínica. Tokens FHIR dos prestadores, catálogo de exames e prestadores são do
admin municipal, no dashboard; nada disso passa por aqui. Ordem de deploy:
api → dashboard e wpda → maintenance; contra um api sem o 21a as chaves só
não aparecem.

**Laboratório municipal (módulo 21b).** Os interruptores `municipal_lab`
("Laboratório municipal", exige `exam_tracking`), `lab_hl7_inbound` ("Entrada
de resultados de aparelhos por HL7", exige `municipal_lab`) e
`fake_middleware` ("Middleware simulado", exige `lab_hl7_inbound`) aparecem na
mesma lista e ligam como os outros, com o que falta em português.
`fake_middleware` só existe fora de produção; ligado, a aba avisa que as
amostras recebidas ganham valores de exemplo pela HL7, sem validade clínica.
Tokens de middleware, exames adotados, liberadores e motivos de rejeição são
do admin municipal, no dashboard; nada disso passa por aqui. Ordem de deploy:
api → dashboard → maintenance; contra um api sem o 21b as chaves só não
aparecem.

A tela **Laboratório** do trilho mantém o catálogo-base de exames de
laboratório da plataforma (vale para todas as cidades do ambiente): exames
(SIGTAP, setor, material, recipiente, preparo), componentes (chave, LOINC,
unidade, tipo) e faixas de referência por sexo e idade em dias. Decimal com
vírgula e sem ponto de milhar. É o ponto de partida que cada laboratório adota
e ajusta: mudar aqui não altera exame já adotado nem laudo. O SDL vem do api
(`npm run schema:pull`, depois `npm run codegen`).

**Qualidade e estoque do laboratório (módulo 21c).** Os interruptores
`lab_quality_control` ("Controle de qualidade do laboratório", CIQ e CEQ) e
`lab_inventory` ("Estoque do laboratório") exigem `municipal_lab` e são
independentes entre si; aparecem na mesma lista, em todos os ambientes, e
ligam como os outros, com o que falta em português. Aparelhos, materiais e
lotes de controle, corridas, bloqueios, exceções, CEQ e estoque são do
laboratório da cidade, no dashboard; nenhum valor de controle ou de resultado
passa por aqui. Com `fake_middleware` ligado (só em development), o aviso diz
que o simulado também manda corridas de controle de exemplo e que uma corrida
reprovada de exemplo abre bloqueio de liberação. Ordem de deploy: api →
dashboard → maintenance; contra um api sem o 21c as chaves só não aparecem.

**Documentos clínicos (módulo 19c).** O interruptor `clinical_documents`
("Documentos clínicos (atestado, declaração, receita, requisição)") aparece na
mesma lista e liga como os outros; ele precisa do `clinical_record` ligado e
utilizável. O catálogo de medicamentos que a receita usa é da plataforma e fica
na tela **Medicamentos**. Ordem de deploy: api → dashboard → maintenance;
contra um api sem o 19c, só a tela Medicamentos mostra o aviso.

> **Ordem de deploy:** o `api` sobe **antes** do maintenance. Contra um api
> sem os campos do módulo 16, a validação recusa a consulta da aba
> Funcionalidades, e só ela mostra o aviso; o topo e as outras abas seguem.

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
