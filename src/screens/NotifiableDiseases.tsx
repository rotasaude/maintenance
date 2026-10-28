// src/screens/NotifiableDiseases.tsx
// Lista nacional de doenças e agravos de notificação compulsória (módulo 25,
// F-25.1; spec §2 decisão 1; contrato §11; plano do maintenance, Task 3).
// Versionada e imutável; vale para TODAS as cidades do ambiente a partir da
// vigência. Mostra a vigente, a agendada (se houver) e o histórico. Consulta
// PRÓPRIA: contra um api sem o 25, só esta tela cai (como em CareLineTemplates).
// Datas só-dia (vigência) são texto (`dateText`), nunca `fmtWhen`, que desloca
// um dia em BRT.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  NOTIFIABLE_QUERY_KEY, currentList, dateText, deadlineText, historyOf, listState, scheduledList, type DiseaseView, type ListView
} from "../lib/notifiableDiseases";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { muted, row } from "./LabTemplates";

const NotifiableDiseasesQuery = graphql(`
  query NotifiableDiseases {
    notifiableDiseases {
      version ordinance effectiveFrom current createdAt publishedBy notes sources
      diseases { code name deadline cid10 ciap2 repeatAfterDays sinanForm notes sources }
    }
  }
`);

const TITLE = "Lista nacional de doenças e agravos de notificação compulsória (todas as cidades do ambiente)";
const INTRO =
  "Publicar uma versão nova vale para todas as cidades a partir da vigência: as consultas passam a sugerir pelos códigos novos. " +
  "As notificações já feitas ficam com a versão em que nasceram. As doenças locais são de cada cidade, no painel dela.";
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem a lista de doenças de notificação — o api do módulo 25 precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

const countText = (n: number) => `${n} ${n === 1 ? "doença" : "doenças"}`;
const authorText = (l: ListView) => (l.publishedBy ? `publicada por ${l.publishedBy}` : "carga inicial");

export function NotifiableDiseases() {
  const query = useQuery({ queryKey: NOTIFIABLE_QUERY_KEY, queryFn: () => gql(NotifiableDiseasesQuery), staleTime: Infinity });
  const [ showHistory, setShowHistory ] = useState(false);

  // `sources` é JSON (o codegen o tipa como `any`): a forma é a de ListView / DiseaseView.
  const all: ListView[] = (query.data?.data?.notifiableDiseases ?? []) as ListView[];
  const fieldError = query.data?.fieldErrors[0];
  const current = currentList(all);
  const scheduled = scheduledList(all);
  const history = historyOf(all);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section aria-label={TITLE}>
        <Panel title={TITLE} actions={
          <div style={row}>
            {all.length > 0 && <Button variant="secondary" onClick={() => setShowHistory(true)}>versões</Button>}
            <Button variant="secondary" onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>
          </div>
        }>
          <p style={muted}>{INTRO}</p>
          {query.isPending && <p>carregando…</p>}
          {query.isError && <ErrorState message={requestErrorText(query.error)} />}
          {fieldError && <ErrorState message={requestErrorText(fieldError)} />}
          {query.isSuccess && !fieldError && all.length === 0 && (
            <>
              <EmptyState message="nenhuma versão da lista" />
              {/* A publicação (formulário) chega na Task 4; até lá o botão fica desligado. */}
              <div style={row}><Button disabled>primeira versão</Button></div>
            </>
          )}
          {query.isSuccess && !fieldError && all.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {current
                ? <p style={{ margin: 0, fontSize: 13 }}>{`v${current.version} · ${current.ordinance} · vigente desde ${dateText(current.effectiveFrom)} · ${countText(current.diseases.length)} · ${authorText(current)}`}</p>
                : <p style={{ margin: 0, fontSize: 13 }}>nenhuma versão em vigor ainda</p>}
              {current?.notes && <p style={muted}>{`nota da versão: ${current.notes}`}</p>}
              {scheduled && (
                <div style={row}>
                  <Tag tone="warn">{`agendada para ${dateText(scheduled.effectiveFrom)}`}</Tag>
                  <span style={muted}>{`v${scheduled.version} · ${scheduled.ordinance}`}</span>
                </div>
              )}
              {current && (
                <DataTable<DiseaseView>
                  columns={[
                    {
                      key: "name", label: "Doença", render: (d) => (
                        <div>
                          <strong>{d.name}</strong>
                          {d.notes && <div style={muted}>{d.notes}</div>}
                        </div>
                      )
                    },
                    { key: "deadline", label: "Prazo", render: (d) => (d.deadline === "immediate" ? <Tag tone="urgent">{deadlineText(d.deadline)}</Tag> : deadlineText(d.deadline)) },
                    { key: "cid10", label: "CID-10", render: (d) => d.cid10.join(", ") || "—" },
                    { key: "ciap2", label: "CIAP-2", render: (d) => d.ciap2.join(", ") || "—" },
                    { key: "repeat", label: "Repetição", render: (d) => `${d.repeatAfterDays} dias` },
                    { key: "sinan", label: "Ficha do Sinan", render: (d) => d.sinanForm ?? "—" },
                    { key: "source", label: "Fonte dos códigos", render: (d) => d.sources?.cid10 ?? "—" }
                  ]}
                  rows={current.diseases}
                  rowKey={(d) => d.code}
                />
              )}
            </div>
          )}
        </Panel>
      </section>

      {showHistory && history.length > 0 && (
        <section aria-label="Versões da lista">
          <Panel title="Versões da lista" actions={<Button variant="secondary" onClick={() => setShowHistory(false)}>fechar</Button>}>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
              {history.map((l) => {
                const state = listState(l, all);
                return (
                  <li key={l.version} data-version={String(l.version)}>
                    <div style={row}>
                      <strong>{`v${l.version}`}</strong>
                      <Tag tone={state === "vigente" ? "ok" : state === "agendada" ? "warn" : undefined}>{state}</Tag>
                      <span>{l.ordinance}</span>
                    </div>
                    <p style={{ ...muted, margin: "4px 0" }}>
                      {`vigência ${dateText(l.effectiveFrom)} · ${countText(l.diseases.length)} · ${authorText(l)}`}
                    </p>
                    {l.notes && <p style={{ ...muted, margin: "4px 0" }}>{`nota: ${l.notes}`}</p>}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </section>
      )}
    </div>
  );
}
