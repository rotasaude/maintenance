// src/screens/FieldMaps.tsx
// Mapas de campo (módulo 24c, F-24.20; contrato §5.4 e §9). O app de campo
// trabalha offline com um arquivo de mapa por município, recortado de uma base
// do Brasil. É dado de PLATAFORMA (tabela field_maps e arquivos no serviço de
// arquivos): esta tela não abre banco de cidade nem baixa o arquivo.
//
// "Gerar de novo" enfileira o recorte da cidade; "Atualizar base" enfileira a
// cópia da base. Os dois rodam em segundo plano no api: a tela não se atualiza
// sozinha — relê ao abrir, depois de cada pedido e no "atualizar".
//
// Consulta PRÓPRIA, como o catálogo de medicamentos: contra um api sem o 24c
// a validação recusa o documento inteiro, e só esta tela cai.
import { useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import { fmtWhen } from "../lib/analytics";
import {
  baseAgeText, baseAgeWarning, canBuild, fieldMapErrorText, fieldMapStateLabel, fieldMapStateTone, fmtMapDate, formatMapSize,
  joinFieldMaps, type FieldMapRow
} from "../lib/fieldMaps";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

const FieldMapsQuery = graphql(`
  query FieldMaps {
    cities { slug name uf }
    fieldMaps { citySlug state version sizeBytes builtAt errorCode }
    fieldMapBase { version ageDays }
  }
`);

const BuildFieldMapMutation = graphql(`
  mutation BuildFieldMap($citySlug: String!) {
    buildFieldMap(citySlug: $citySlug) { ok errors { path message } }
  }
`);

const RefreshFieldMapBaseMutation = graphql(`
  mutation RefreshFieldMapBase {
    refreshFieldMapBase { ok errors { path message } }
  }
`);

const BASE_TITLE = "Base do Brasil";
const MAPS_TITLE = "Mapas por cidade";
const QUERY_KEY = [ "platform", "fieldMaps" ];
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "o api ainda não tem os mapas de campo (módulo 24c): atualize o api antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

type Outcome = { tone: "done" | "failed"; text: string };
type Payload = { ok: boolean; errors: { path?: string | null; message: string }[] } | null | undefined;

export function FieldMaps() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => gql(FieldMapsQuery), staleTime: Infinity });
  const [ outcome, setOutcome ] = useState<Outcome | null>(null);
  // Trava síncrona: dois cliques no mesmo instante chegam antes de o React
  // redesenhar o botão desabilitado, e enfileirariam dois jobs.
  const sending = useRef(false);

  function settle(payload: Payload, fieldErrors: GraphQLRefusal[], done: string) {
    if (payload?.ok) {
      setOutcome({ tone: "done", text: done });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      return;
    }
    // Recusa do envelope (FORBIDDEN, …): o payload vem nulo e o motivo em `errors`.
    const refusal = fieldErrors[0];
    const text = payload
      ? payload.errors.map((e) => e.message).join("; ") || "não foi possível concluir — tente de novo"
      : refusal ? `${refusal.code} — ${refusal.message}` : "não foi possível concluir — tente de novo";
    setOutcome({ tone: "failed", text });
  }

  // Rede/timeout: o api pode ter aceitado o pedido; relê mesmo assim.
  function failed(err: unknown) {
    setOutcome({ tone: "failed", text: requestErrorText(err) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  const build = useMutation({
    mutationFn: (citySlug: string) => gql(BuildFieldMapMutation, { citySlug }),
    onMutate: () => setOutcome(null),
    onSuccess: ({ data, fieldErrors }) =>
      settle(data?.buildFieldMap, fieldErrors, "pedido enviado — o job gera o arquivo em segundo plano"),
    onError: failed,
    onSettled: () => { sending.current = false; }
  });

  const refresh = useMutation({
    mutationFn: () => gql(RefreshFieldMapBaseMutation),
    onMutate: () => setOutcome(null),
    onSuccess: ({ data, fieldErrors }) =>
      settle(data?.refreshFieldMapBase, fieldErrors, "pedido enviado — o job copia a base em segundo plano"),
    onError: failed,
    onSettled: () => { sending.current = false; }
  });

  function once(run: () => void) {
    if (sending.current) return;
    sending.current = true;
    run();
  }

  const running = build.isPending || refresh.isPending;
  const data = query.data?.data ?? null;
  const fieldError = query.data?.fieldErrors[0];
  const base = data?.fieldMapBase ?? null;
  const rows = data ? joinFieldMaps(data.cities, data.fieldMaps) : [];
  const warning = data ? baseAgeWarning(base ? base.ageDays : null) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section aria-label={BASE_TITLE}>
        <Panel title={BASE_TITLE} actions={<Button onClick={() => { setOutcome(null); void query.refetch(); }} busy={query.isFetching}>atualizar</Button>}>
          <p style={muted}>
            O app de campo trabalha offline com um arquivo de mapa por município, recortado desta base (o mapa do Brasil, do
            Protomaps). Gere o mapa da cidade antes de cadastrar aparelhos. A cópia da base é um download grande e roda no
            servidor; os pedidos rodam em segundo plano — use "atualizar" para ver o andamento.
          </p>
          {query.isPending && <p>carregando…</p>}
          {query.isError && <ErrorState message={requestErrorText(query.error)} />}
          {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
          {base && <p style={{ margin: 0, fontSize: 12.5 }}>{`versão ${fmtMapDate(base.version)} · ${baseAgeText(base.ageDays)}`}</p>}
          {warning && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--warn)" }}>{warning}</p>}
          {data && (
            <div style={row}>
              <ConfirmButton
                label="Atualizar base"
                confirmLabel="confirmar: copiar a base de novo"
                busy={refresh.isPending}
                disabled={running}
                onConfirm={() => once(() => refresh.mutate())}
              />
            </div>
          )}
          {outcome?.tone === "done" && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{outcome.text}</p>}
          {outcome?.tone === "failed" && <ErrorState message={outcome.text} />}
        </Panel>
      </section>

      {data && (
        <section aria-label={MAPS_TITLE}>
          <Panel title={MAPS_TITLE}>
            {rows.length === 0 ? <EmptyState message="nenhuma cidade" /> : (
              <DataTable<FieldMapRow>
                columns={[
                  { key: "name", label: "Cidade", render: (r) => r.uf ? `${r.name} / ${r.uf}` : r.name },
                  { key: "state", label: "Situação", render: (r) => <Tag tone={fieldMapStateTone(r.state)}>{fieldMapStateLabel(r.state)}</Tag> },
                  { key: "version", label: "Versão", render: (r) => fmtMapDate(r.version) },
                  { key: "sizeBytes", label: "Tamanho", render: (r) => formatMapSize(r.sizeBytes) },
                  { key: "builtAt", label: "Gerado em", render: (r) => fmtWhen(r.builtAt) },
                  { key: "errorCode", label: "Motivo", render: (r) => fieldMapErrorText(r.errorCode) ?? "—" },
                  {
                    key: "action", label: "",
                    render: (r) => (
                      <Button
                        variant="secondary"
                        label={`Gerar de novo ${r.name}`}
                        busy={build.isPending && build.variables === r.slug}
                        disabled={running || !canBuild(r, base)}
                        onClick={() => once(() => build.mutate(r.slug))}
                      >
                        Gerar de novo
                      </Button>
                    )
                  }
                ]}
                rows={rows}
                rowKey={(r) => r.slug}
              />
            )}
          </Panel>
        </section>
      )}
    </div>
  );
}

const muted: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--ink3)" };
const row: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
