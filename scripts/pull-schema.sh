#!/bin/sh
# Extrai o SDL da API de manutenção do próprio api (spec §4, Decisão 3 do
# plano): o endpoint GraphQL exige credencial até para introspecção, e o
# dump do schema é o mesmo SDL sem sessão. Roda a partir de apps/maintenance,
# com o stack de dev de pé. Quando o Plano 6 publicar o SDL em contracts,
# este script passa a copiar de lá.
set -eu
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
docker compose exec -T api bin/rails runner 'puts Maintenance::Schema.to_definition' > apps/maintenance/schema.graphql
echo "schema.graphql atualizado ($(wc -l < apps/maintenance/schema.graphql) linhas)"
