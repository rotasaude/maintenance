// src/screens/MedicationCatalog.tsx
// Catálogo de medicamentos da plataforma (módulo 19c, F-19.16; spec §3 e §7
// "Maintenance"; contrato §8). Vale para TODAS as cidades do ambiente: o api
// traz o CATMAT (classe 6505) da API aberta do Compras.gov, compara com a
// versão atual (entrou/mudou/saiu) e esconde da busca da receita o item que o
// analisador não entendeu; as listas da Anvisa marcam antimicrobiano (RDC 471)
// e controlado (Portaria 344). Uma importação por vez.
//
// Consulta PRÓPRIA, como o quadro de assinatura do 19b: contra um api sem o
// 19c a validação recusa o documento inteiro, e só esta tela cai.
import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  IMPORT_RUNNING, REVIEW_PAGE, anvisaImportText, catalogImportText, importErrorText, parseStatusView, releaseText, reviewNote,
  type ReviewItemView
} from "../lib/medications";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { ConfirmButton } from "../components/ConfirmButton";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

const MedicationCatalogQuery = graphql(`
  query MedicationCatalog($first: Int!) {
    medicationCatalog {
      currentRelease { id importedAt itemsCount hiddenCount }
      reviewItems(first: $first) { catmatCode sourceDescription parseStatus }
    }
  }
`);

const ImportMedicationCatalogMutation = graphql(`
  mutation ImportMedicationCatalog {
    importMedicationCatalog { ok releaseId added changed removed errors { path message } }
  }
`);

const ImportAnvisaListsMutation = graphql(`
  mutation ImportAnvisaLists {
    importAnvisaLists { ok antimicrobials controlled errors { path message } }
  }
`);

const TITLE = "Catálogo de medicamentos — CATMAT, classe 6505 (todas as cidades do ambiente)";
const QUERY_KEY = [ "platform", "medicationCatalog" ];
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem o catálogo de medicamentos — o api do módulo 19c precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

type Outcome = { tone: "done" | "failed"; text: string };

export function MedicationCatalog() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => gql(MedicationCatalogQuery, { first: REVIEW_PAGE }),
    staleTime: Infinity
  });
  const [ outcome, setOutcome ] = useState<Outcome | null>(null);

  function settle(text: string, ok: boolean) {
    setOutcome({ tone: ok ? "done" : "failed", text });
    if (ok) void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  // Recusa do envelope (FORBIDDEN, …): o payload vem nulo e o motivo em `errors`.
  function refused(fieldErrors: GraphQLRefusal[]): string {
    const refusal = fieldErrors[0];
    return refusal ? `${refusal.code} — ${refusal.message}` : importErrorText([]);
  }

  const catalogImport = useMutation({
    mutationFn: () => gql(ImportMedicationCatalogMutation),
    onMutate: () => setOutcome(null),
    onSuccess: ({ data, fieldErrors }) => {
      const payload = data?.importMedicationCatalog ?? null;
      if (!payload) { settle(refused(fieldErrors), false); return; }
      settle(catalogImportText(payload), payload.ok);
    },
    onError: (err) => settle(requestErrorText(err), false)
  });

  const anvisaImport = useMutation({
    mutationFn: () => gql(ImportAnvisaListsMutation),
    onMutate: () => setOutcome(null),
    onSuccess: ({ data, fieldErrors }) => {
      const payload = data?.importAnvisaLists ?? null;
      if (!payload) { settle(refused(fieldErrors), false); return; }
      settle(anvisaImportText(payload), payload.ok);
    },
    onError: (err) => settle(requestErrorText(err), false)
  });

  const running = catalogImport.isPending || anvisaImport.isPending;
  const catalog = query.data?.data?.medicationCatalog ?? null;
  const fieldError = query.data?.fieldErrors[0];
  const review: ReviewItemView[] = catalog?.reviewItems ?? [];
  const note = catalog?.currentRelease ? reviewNote(review.length, catalog.currentRelease.hiddenCount) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section aria-label={TITLE}>
        <Panel title={TITLE} actions={<Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>}>
          <p style={muted}>
            A importação traz o CATMAT da API aberta do Compras.gov e diz o que entrou, mudou e saiu. Item que o analisador não
            entende fica oculto na busca da receita e aparece em "Itens para revisar". As listas da Anvisa marcam antimicrobianos
            (receita em papel, 2 vias) e controlados (bloqueados até o 19d).
          </p>
          {query.isPending && <p>carregando…</p>}
          {query.isError && <ErrorState message={requestErrorText(query.error)} />}
          {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
          {catalog && <p style={{ margin: 0, fontSize: 12.5 }}>{releaseText(catalog.currentRelease)}</p>}
          {catalog && (
            <div style={row}>
              <ConfirmButton
                label="importar o CATMAT"
                confirmLabel="confirmar: importar o CATMAT agora"
                busy={catalogImport.isPending}
                disabled={running}
                onConfirm={() => catalogImport.mutate()}
              />
              <ConfirmButton
                label="importar as listas da Anvisa"
                confirmLabel="confirmar: importar as listas da Anvisa agora"
                busy={anvisaImport.isPending}
                disabled={running}
                onConfirm={() => anvisaImport.mutate()}
              />
            </div>
          )}
          {running && <p role="status" style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{IMPORT_RUNNING}</p>}
          {outcome?.tone === "done" && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{outcome.text}</p>}
          {outcome?.tone === "failed" && <ErrorState message={outcome.text} />}
        </Panel>
      </section>

      {catalog && (
        <section aria-label="Itens para revisar">
          <Panel title="Itens para revisar">
            {note && <p style={muted}>{note}</p>}
            {review.length === 0 ? <EmptyState message="nenhum item para revisar" /> : (
              <DataTable<ReviewItemView>
                columns={[
                  { key: "catmatCode", label: "CATMAT", render: (i) => String(i.catmatCode) },
                  { key: "sourceDescription", label: "Descrição de origem", render: (i) => i.sourceDescription },
                  {
                    key: "parseStatus", label: "Situação",
                    render: (i) => {
                      const s = parseStatusView(i.parseStatus);
                      return <Tag tone={s.tone}>{s.label}</Tag>;
                    }
                  }
                ]}
                rows={review}
                rowKey={(i) => i.catmatCode}
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
