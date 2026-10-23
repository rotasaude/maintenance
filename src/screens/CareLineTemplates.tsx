// src/screens/CareLineTemplates.tsx
// Catálogo-base de linhas de cuidado da plataforma (módulo 23, F-23.1; spec
// §4 "Plataforma" e §6 "Maintenance"; contrato §8; plano do api, Task 4). As
// seis linhas das notas metodológicas do componente de qualidade da APS (C2 a
// C7), versionadas e imutáveis. Vale para TODAS as cidades do ambiente, mas
// publicar uma versão nova não muda nenhuma: cada cidade adota no dashboard, e
// as inscrições só mudam de regra quando ela adota. Sem step-up (como o
// catálogo de laboratório, 21b M4); a auditoria é
// `maintenance.care_line_template.changed` (L13). Consulta PRÓPRIA: contra um
// api sem o 23, só esta tela cai.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import { fmtWhen } from "../lib/analytics";
import {
  KEYS, advancedText, currentTemplates, draftProblem, draftToVariables, eligibilityText, firstDraft, indicatorOf, keyOrder, keyText, pointsTotal,
  ruleText, toDraft, upsertErrorText, versionsOf, type TemplateDraft, type TemplateView
} from "../lib/careLineTemplates";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { ErrorState } from "../components/ErrorState";
import { muted, row } from "./LabTemplates";
import { CareLineTemplateForm, OutcomeNote, type Outcome } from "./CareLineTemplateForm";

const CareLineTemplatesQuery = graphql(`
  query CareLineTemplates {
    careLineTemplates { key version current name indicator declaredCondition eligibility practices createdAt createdBy }
  }
`);

const UpsertCareLineTemplateMutation = graphql(`
  mutation UpsertCareLineTemplate(
    $key: String!, $name: String!, $indicator: String!, $declaredCondition: String, $eligibility: JSON!, $practices: JSON!
  ) {
    upsertCareLineTemplate(key: $key, name: $name, indicator: $indicator, declaredCondition: $declaredCondition,
      eligibility: $eligibility, practices: $practices) {
      ok errors { path message }
    }
  }
`);

type Editing = { draft: TemplateDraft; fromVersion: number | null } | null;

const TITLE = "Catálogo-base de linhas de cuidado (todas as cidades do ambiente)";
const INTRO =
  "As seis linhas das notas metodológicas do componente de qualidade da APS (C2 a C7). Publicar uma versão nova não muda nenhuma " +
  "cidade: a versão nova só vale para a cidade que a adotar, e as inscrições só passam a ser avaliadas por ela depois disso. " +
  "Confira a nota técnica vigente antes de publicar (revisão anual).";
const CARE_LINE_TEMPLATES_QUERY_KEY = [ "platform", "careLineTemplates" ];
const REFUSED = "o api recusou o pedido — confira os campos e tente de novo";
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem o catálogo de linhas de cuidado — o api do módulo 23 precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

// A condição que sugere a linha só merece linha própria quando não é a única condição de entrada (que a elegibilidade já mostra).
function suggestsLine(t: TemplateView): boolean {
  const declared = t.eligibility.declared ?? [];
  return !!t.declaredCondition && !(declared.length === 1 && declared[0] === t.declaredCondition);
}

// Linha da tabela: a vigente de cada chave, ou a chave do contrato sem versão.
type Row = { key: string; current: TemplateView | null };

export function CareLineTemplates() {
  const query = useQuery({ queryKey: CARE_LINE_TEMPLATES_QUERY_KEY, queryFn: () => gql(CareLineTemplatesQuery), staleTime: Infinity });
  const [ historyKey, setHistoryKey ] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [ editing, setEditing ] = useState<Editing>(null);
  const [ outcome, setOutcome ] = useState<Outcome | null>(null);

  const save = useMutation({
    mutationFn: (d: TemplateDraft) => gql(UpsertCareLineTemplateMutation, draftToVariables(d)),
    onMutate: () => setOutcome(null),
    onSuccess: async ({ data, fieldErrors }) => {
      const payload = data?.upsertCareLineTemplate ?? null;
      if (!payload) {
        // Código e mensagem crus do api não vão para a tela: uma frase fixa.
        setOutcome({ tone: "failed", text: fieldErrors.length > 0 ? REFUSED : upsertErrorText([]) });
        return;
      }
      if (!payload.ok) { setOutcome({ tone: "failed", text: upsertErrorText(payload.errors) }); return; }
      setEditing(null);
      setOutcome({ tone: "done", text: "Versão nova publicada. As cidades adotam quando quiserem." });
      await queryClient.invalidateQueries({ queryKey: CARE_LINE_TEMPLATES_QUERY_KEY });
    },
    // Rede/timeout: o api pode ter gravado; relê e mantém o formulário.
    onError: (err) => {
      setOutcome({ tone: "failed", text: requestErrorText(err) });
      void queryClient.invalidateQueries({ queryKey: CARE_LINE_TEMPLATES_QUERY_KEY });
    }
  });

  // eligibility e practices são JSON (o codegen os tipa como `any`): a forma é a de TemplateView (L1, L2).
  const all: TemplateView[] = (query.data?.data?.careLineTemplates ?? []) as TemplateView[];

  // Parte da vigente; sem versão, do nome e do indicador do contrato.
  function startNew(key: string) {
    const base = currentTemplates(all).find((t) => t.key === key) ?? null;
    setOutcome(null);
    setEditing({ draft: base ? toDraft(base) : firstDraft(key), fromVersion: base ? base.version : null });
  }
  const fieldError = query.data?.fieldErrors[0];
  const current = currentTemplates(all);
  const missing = KEYS.filter((k) => !current.some((t) => t.key === k));
  const rows: Row[] = [ ...current.map((t) => ({ key: t.key, current: t })), ...missing.map((key) => ({ key, current: null })) ]
    .sort((a, b) => keyOrder(a.key) - keyOrder(b.key));
  const history = historyKey ? versionsOf(all, historyKey) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section aria-label={TITLE}>
        <Panel title={TITLE} actions={<Button variant="secondary" onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>}>
          <p style={muted}>{INTRO}</p>
          {query.isPending && <p>carregando…</p>}
          {query.isError && <ErrorState message={requestErrorText(query.error)} />}
          {fieldError && <ErrorState message={requestErrorText(fieldError)} />}
          {query.isSuccess && !fieldError && (
            <DataTable<Row>
              columns={[
                { key: "line", label: "Linha", render: (r) => keyText(r.key) },
                { key: "version", label: "Versão vigente", render: (r) => (r.current ? `v${r.current.version}` : <Tag tone="warn">sem versão</Tag>) },
                { key: "published", label: "Publicada", render: (r) => (r.current ? fmtWhen(r.current.createdAt) : "—") },
                { key: "practices", label: "Boas práticas", render: (r) => (r.current ? String(r.current.practices.length) : "—") },
                // Pontos são inteiros (D-02): o número como vem, sem casas decimais.
                { key: "points", label: "Soma dos pontos", render: (r) => (r.current ? String(pointsTotal(r.current.practices)) : "—") },
                {
                  key: "actions", label: "", render: (r) => (
                    <div style={row}>
                      {r.current && <Button variant="secondary" onClick={() => setHistoryKey(r.key)}>versões</Button>}
                      {/* Só chave do contrato pode ser a primeira versão; chave desconhecida do api nunca (D-06). */}
                      {!r.current && <Button variant="secondary" onClick={() => { setHistoryKey(null); startNew(r.key); }}>primeira versão</Button>}
                    </div>
                  )
                }
              ]}
              rows={rows}
              rowKey={(r) => r.key}
            />
          )}
        </Panel>
      </section>

      {historyKey && history.length > 0 && (
        <section aria-label={`Versões de ${keyText(historyKey)}`}>
          <Panel title={`Versões de ${keyText(historyKey)}`} actions={
            <div style={row}>
              {/* Chave desconhecida do api só se lê: o indicador dela não existe aqui (D-06). */}
              {indicatorOf(historyKey) !== "" && <Button onClick={() => startNew(historyKey)}>nova versão</Button>}
              <Button variant="secondary" onClick={() => setHistoryKey(null)}>fechar</Button>
            </div>
          }>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12, fontSize: 12.5 }}>
              {history.map((t) => (
                <li key={`${t.key}-${t.version}`} data-version={String(t.version)}>
                  <div style={row}>
                    <strong>{`v${t.version}`}</strong>
                    {t.current && <Tag tone="ok">vigente</Tag>}
                    <span style={muted}>{fmtWhen(t.createdAt)}</span>
                    <span style={muted}>{t.createdBy ? `por ${t.createdBy}` : "carga inicial"}</span>
                  </div>
                  <p style={{ ...muted, margin: "4px 0" }}>{eligibilityText(t.eligibility)}</p>
                  {suggestsLine(t) && <p style={{ ...muted, margin: "4px 0" }}>{`sugere a linha: ${t.declaredCondition}`}</p>}
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {t.practices.map((p) => {
                      const advanced = advancedText(p);
                      return (
                        <li key={p.key}>
                          {`${p.label}: ${ruleText(p)}`}
                          {advanced && <div style={muted}>{`regras avançadas (preservadas na versão nova): ${advanced}`}</div>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      )}
      {editing && (
        <CareLineTemplateForm
          key={`${editing.draft.key}-${editing.fromVersion ?? 0}`}
          draft={editing.draft}
          fromVersion={editing.fromVersion}
          busy={save.isPending}
          outcome={outcome}
          onSave={(d) => {
            const problem = draftProblem(d);
            if (problem) setOutcome({ tone: "failed", text: problem });
            else save.mutate(d);
          }}
          onClose={() => { setEditing(null); setOutcome(null); }}
        />
      )}
      {/* Com o formulário aberto o aviso fica dentro dele, acima dos botões; sem formulário (publicou e fechou) vem aqui. */}
      {!editing && outcome && <OutcomeNote outcome={outcome} />}
    </div>
  );
}
