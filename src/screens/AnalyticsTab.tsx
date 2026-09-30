import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  INDICATORS, INDICATOR_LABELS, analyticsWindow, cellText, fmtWeek, fmtWhen, indicatorGrid, runStatusView
} from "../lib/analytics";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

// Aba Analytics (módulo 14, F-14.9): estado do pipeline de consolidação da
// cidade e os indicadores que ela publicou na plataforma (ADR 0025).
//
// DUAS consultas, e nenhuma delas é a do topo (CityHeader):
//   - a validação do GraphQL recusa o documento INTEIRO quando um campo não
//     existe; contra um api sem o módulo 14, só esta aba falha, e explica;
//   - analyticsStatus é anulável e lê o banco da cidade: um CITY_UNREACHABLE
//     anula só esse campo. Mesmo assim as consultas ficam separadas, para cada
//     painel falhar sozinho (e pela ordem de deploy).
const CityAnalyticsStatusQuery = graphql(`
  query CityAnalyticsStatus($slug: String!) {
    city(slug: $slug) {
      slug
      analyticsStatus { lastRunStatus lastSucceededAt lastPublishedAt lastError stale }
    }
  }
`);

const CityAnalyticsIndicatorsQuery = graphql(`
  query CityAnalyticsIndicators($slug: String!, $from: ISO8601Date!, $to: ISO8601Date!) {
    city(slug: $slug) {
      slug
      analyticsIndicators(from: $from, to: $to) { weekStart indicator value suppressed }
    }
  }
`);

const dlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  columnGap: 12,
  rowGap: 6,
  margin: 0,
  fontSize: 12.5
};

const errorBox: CSSProperties = {
  margin: 0,
  padding: "8px 10px",
  borderRadius: 6,
  background: "var(--down-bg)",
  color: "var(--down)",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
};

// Erro que derrubou a consulta inteira. `undefinedField` é a validação do
// graphql-ruby: o api ainda não tem os campos (ordem de deploy: api antes).
function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && err.code === "undefinedField") {
    return "esta API ainda não tem os campos de Analytics — o api do módulo 14 precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

// Mesmo critério do CityDetail: o refusal do campo, ou da cidade inteira
// quando o campo não nulo anulou `city`.
function fieldError(fieldErrors: GraphQLRefusal[], field: string): GraphQLRefusal | undefined {
  return fieldErrors.find((refusal) => {
    const path = refusal.path ?? [];
    return path[0] === "city" && (path.length === 1 || path[1] === field);
  });
}

export function AnalyticsTab({ slug }: { slug: string }) {
  // A janela é fixada ao abrir a aba; "atualizar" relê os mesmos dias.
  const [ range ] = useState(() => analyticsWindow(new Date()));

  const status = useQuery({
    queryKey: [ "city", slug, "analyticsStatus" ],
    queryFn: () => gql(CityAnalyticsStatusQuery, { slug }),
    staleTime: Infinity
  });
  const indicators = useQuery({
    queryKey: [ "city", slug, "analyticsIndicators", range.from, range.to ],
    queryFn: () => gql(CityAnalyticsIndicatorsQuery, { slug, from: range.from, to: range.to }),
    staleTime: Infinity
  });

  const s = status.data?.data?.city?.analyticsStatus ?? null;
  const statusErr = status.data ? fieldError(status.data.fieldErrors, "analyticsStatus") : undefined;
  const rows = indicators.data?.data?.city?.analyticsIndicators ?? null;
  const indicatorsErr = indicators.data ? fieldError(indicators.data.fieldErrors, "analyticsIndicators") : undefined;
  const grid = indicatorGrid(rows ?? []);
  const run = runStatusView(s?.lastRunStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Button
          onClick={() => { void status.refetch(); void indicators.refetch(); }}
          busy={status.isFetching || indicators.isFetching}
        >
          atualizar
        </Button>
      </div>

      <Panel title="Pipeline de Analytics" actions={s?.stale ? <Tag tone="warn">dados desatualizados</Tag> : undefined}>
        {status.isPending && <p>carregando…</p>}
        {status.isError && <ErrorState message={requestErrorText(status.error)} />}
        {statusErr && <ErrorState message={`${statusErr.code} — ${statusErr.message}`} />}
        {status.data && !statusErr && !s && <EmptyState message="estado do pipeline indisponível" />}
        {s && (
          <>
            <dl style={dlStyle}>
              <dt>Última execução</dt><dd><Tag tone={run.tone}>{run.label}</Tag></dd>
              <dt>Consolidado com sucesso em</dt><dd>{fmtWhen(s.lastSucceededAt)}</dd>
              <dt>Publicado na plataforma em</dt>
              <dd>{s.lastPublishedAt ? fmtWhen(s.lastPublishedAt) : "nunca publicado"}</dd>
            </dl>
            {s.stale && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--warn)" }}>
                A última consolidação bem-sucedida tem mais de 36 h, ou nunca houve. O painel da cidade avisa que os dados estão desatualizados.
              </p>
            )}
            {s.lastError && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--down)" }}>Último erro</span>
                <pre style={errorBox}>{s.lastError}</pre>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title={`Indicadores publicados — ${fmtWeek(range.from)} a ${fmtWeek(range.to)}`}>
        {indicators.isPending && <p>carregando…</p>}
        {indicators.isError && <ErrorState message={requestErrorText(indicators.error)} />}
        {indicatorsErr && <ErrorState message={`${indicatorsErr.code} — ${indicatorsErr.message}`} />}
        {rows && rows.length === 0 && <EmptyState message="nenhum indicador publicado nas últimas 12 semanas" />}
        {rows && rows.length > 0 && (
          <>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink3)" }}>
              “oculto”: contagem de 1 a 4, suprimida na cidade. “sem dado”: a cidade não publicou o indicador naquela semana, ou a taxa não tinha denominador.
            </p>
            <DataTable<string>
              columns={[
                { key: "week", label: "Semana", render: (week) => fmtWeek(week) },
                ...INDICATORS.map((indicator) => ({
                  key: indicator,
                  label: INDICATOR_LABELS[indicator],
                  render: (week: string) => cellText(indicator, grid[week]?.[indicator])
                }))
              ]}
              rows={[ ...range.weeks ].reverse()}
              rowKey={(week) => week}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
