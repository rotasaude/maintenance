// src/screens/LabTemplates.tsx
// Catálogo-base de exames de laboratório da plataforma (módulo 21b, F-21.14;
// spec §4 "Plataforma" e §7; contrato §10). Vale para TODAS as cidades do
// ambiente: é o ponto de partida que o laboratório municipal adota e ajusta
// ao seu método. Adotar copia, e cada ajuste da cidade vira versão imutável:
// mudar aqui não mexe em exame adotado nem em laudo. Sem step-up (Divergência
// M4): nada aqui emite credencial nem muda o que uma cidade usa hoje.
//
// Consulta PRÓPRIA, como Medicamentos: contra um api sem o 21b a validação
// recusa o documento inteiro, e só esta tela cai.
import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  LIMITS, SECTORS, optionsWith, orNull, rangesSummary, sectorText, textProblem, upsertErrorText, valueTypeText,
  type AnalyteView, type TemplateView
} from "../lib/labTemplates";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

const LabExamTemplatesQuery = graphql(`
  query LabExamTemplates {
    labExamTemplates {
      id sigtapCode name sector material container suggestedMethod preparation active
      analytes {
        id key name loinc unit valueType choices decimals position
        referenceRanges { sex ageMinDays ageMaxDays low high text }
      }
    }
  }
`);

const UpsertLabExamTemplateMutation = graphql(`
  mutation UpsertLabExamTemplate(
    $id: ID, $sigtapCode: String!, $name: String!, $sector: String!, $material: String!, $container: String!,
    $suggestedMethod: String, $preparation: String, $active: Boolean!
  ) {
    upsertLabExamTemplate(
      id: $id, sigtapCode: $sigtapCode, name: $name, sector: $sector, material: $material, container: $container,
      suggestedMethod: $suggestedMethod, preparation: $preparation, active: $active
    ) { ok errors { path message } }
  }
`);

const TITLE = "Catálogo-base de exames de laboratório (todas as cidades do ambiente)";
const INTRO =
  "Ponto de partida que o laboratório municipal adota e ajusta ao seu método. Mudar aqui vale para as próximas " +
  "adoções: os exames já adotados pelas cidades e os laudos não mudam. Para tirar um exame de uso, desmarque \"ativo\".";
export const LAB_TEMPLATES_QUERY_KEY = [ "platform", "labExamTemplates" ];
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem o catálogo de laboratório — o api do módulo 21b precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

export function refused(fieldErrors: GraphQLRefusal[]): string {
  const refusal = fieldErrors[0];
  return refusal ? `${refusal.code} — ${refusal.message}` : upsertErrorText([]);
}

// Mesmos limites do api: o texto não é cortado em silêncio, é recusado aqui.
function draftProblem(d: TemplateDraft): string | null {
  return [
    textProblem("Nome", d.name, LIMITS.name), textProblem("Material", d.material, LIMITS.material),
    textProblem("Recipiente", d.container, LIMITS.container), textProblem("Método sugerido", d.suggestedMethod, LIMITS.method)
  ].find((problem) => problem !== null) ?? null;
}

type Selection = { kind: "new" } | { kind: "edit"; id: string } | null;
type Outcome = { tone: "done" | "failed"; text: string };
type TemplateDraft = {
  sigtapCode: string; name: string; sector: string; material: string; container: string;
  suggestedMethod: string; preparation: string; active: boolean;
};

function toDraft(t: TemplateView | null): TemplateDraft {
  return t
    ? {
      sigtapCode: t.sigtapCode, name: t.name, sector: t.sector, material: t.material, container: t.container,
      suggestedMethod: t.suggestedMethod ?? "", preparation: t.preparation ?? "", active: t.active
    }
    : { sigtapCode: "", name: "", sector: SECTORS[0], material: "", container: "", suggestedMethod: "", preparation: "", active: true };
}

export function LabTemplates() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: LAB_TEMPLATES_QUERY_KEY,
    queryFn: () => gql(LabExamTemplatesQuery),
    staleTime: Infinity
  });
  const [ selection, setSelection ] = useState<Selection>(null);
  const [ outcome, setOutcome ] = useState<Outcome | null>(null);

  const templates: TemplateView[] = query.data?.data?.labExamTemplates ?? [];
  const fieldError = query.data?.fieldErrors[0];
  const current = selection?.kind === "edit" ? templates.find((t) => t.id === selection.id) ?? null : null;

  function open(next: Selection) {
    setSelection(next);
    setOutcome(null);
  }

  const save = useMutation({
    mutationFn: (vars: { id: string | null } & TemplateDraft) => gql(UpsertLabExamTemplateMutation, {
      id: vars.id, sigtapCode: vars.sigtapCode.trim(), name: vars.name.trim(), sector: vars.sector,
      material: vars.material.trim(), container: vars.container.trim(),
      suggestedMethod: orNull(vars.suggestedMethod), preparation: orNull(vars.preparation), active: vars.active
    }),
    onMutate: () => setOutcome(null),
    onSuccess: async ({ data, fieldErrors }, vars) => {
      const payload = data?.upsertLabExamTemplate ?? null;
      if (!payload) { setOutcome({ tone: "failed", text: refused(fieldErrors) }); return; }
      if (!payload.ok) { setOutcome({ tone: "failed", text: upsertErrorText(payload.errors, "exam") }); return; }
      await queryClient.invalidateQueries({ queryKey: LAB_TEMPLATES_QUERY_KEY });
      // O contrato devolve só { ok, errors }: o exame criado é achado pelo SIGTAP, que é único.
      if (vars.id === null) {
        const fresh = queryClient.getQueryData<typeof query.data>(LAB_TEMPLATES_QUERY_KEY)?.data?.labExamTemplates ?? [];
        const created = fresh.find((t) => t.sigtapCode === vars.sigtapCode.trim());
        if (created) setSelection({ kind: "edit", id: created.id });
      }
      setOutcome({ tone: "done", text: "Exame salvo." });
    },
    // Rede/timeout: o api pode ter gravado; relê o catálogo e mantém o formulário.
    onError: (err) => {
      setOutcome({ tone: "failed", text: requestErrorText(err) });
      void queryClient.invalidateQueries({ queryKey: LAB_TEMPLATES_QUERY_KEY });
    }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section aria-label={TITLE}>
        <Panel
          title={TITLE}
          actions={
            <div style={row}>
              <Button variant="secondary" onClick={() => { setOutcome(null); void query.refetch(); }} busy={query.isFetching}>atualizar</Button>
              <Button onClick={() => open({ kind: "new" })}>novo exame</Button>
            </div>
          }
        >
          <p style={muted}>{INTRO}</p>
          {query.isPending && <p>carregando…</p>}
          {query.isError && <ErrorState message={requestErrorText(query.error)} />}
          {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
          {query.isSuccess && !fieldError && (templates.length === 0 ? <EmptyState message="nenhum exame no catálogo-base" /> : (
            <DataTable<TemplateView>
              columns={[
                { key: "sigtapCode", label: "SIGTAP", render: (t) => t.sigtapCode },
                { key: "name", label: "Exame", render: (t) => t.name },
                { key: "sector", label: "Setor", render: (t) => sectorText(t.sector) },
                { key: "material", label: "Material e recipiente", render: (t) => `${t.material} · ${t.container}` },
                { key: "analytes", label: "Componentes", render: (t) => String(t.analytes.length) },
                { key: "active", label: "Situação", render: (t) => <Tag tone={t.active ? "ok" : "neutral"}>{t.active ? "ativo" : "inativo"}</Tag> },
                { key: "edit", label: "", render: (t) => <Button variant="secondary" onClick={() => open({ kind: "edit", id: t.id })}>editar</Button> }
              ]}
              rows={templates}
              rowKey={(t) => t.id}
            />
          ))}
        </Panel>
      </section>

      {(selection?.kind === "new" || current) && (
        <section aria-label="Exame do catálogo-base">
          <TemplateForm
            key={current ? current.id : "new"}
            template={current}
            busy={save.isPending}
            onSave={(draft) => {
              const problem = draftProblem(draft);
              if (problem) setOutcome({ tone: "failed", text: problem });
              else save.mutate({ id: current?.id ?? null, ...draft });
            }}
            onClose={() => open(null)}
          />
        </section>
      )}

      {outcome?.tone === "done" && <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{outcome.text}</p>}
      {outcome?.tone === "failed" && <ErrorState message={outcome.text} />}

      {current && (
        <section aria-label={`Componentes de ${current.name}`}>
          <Panel title={`Componentes de ${current.name}`}>
            {current.analytes.length === 0 ? <EmptyState message="nenhum componente" /> : (
              <DataTable<AnalyteView>
                columns={[
                  { key: "position", label: "Ordem", render: (a) => String(a.position) },
                  { key: "key", label: "Chave", render: (a) => a.key },
                  { key: "name", label: "Nome", render: (a) => a.name },
                  { key: "loinc", label: "LOINC", render: (a) => a.loinc ?? "—" },
                  { key: "unit", label: "Unidade", render: (a) => a.unit ?? "—" },
                  { key: "valueType", label: "Tipo", render: (a) => valueTypeText(a.valueType) },
                  { key: "ranges", label: "Faixas de referência", render: (a) => rangesSummary(a.referenceRanges) }
                ]}
                rows={[ ...current.analytes ].sort((a, b) => a.position - b.position)}
                rowKey={(a) => a.id}
              />
            )}
          </Panel>
        </section>
      )}
    </div>
  );
}

type FormProps = { template: TemplateView | null; busy: boolean; onSave(draft: TemplateDraft): void; onClose(): void };

function TemplateForm({ template, busy, onSave, onClose }: FormProps) {
  const [ draft, setDraft ] = useState<TemplateDraft>(() => toDraft(template));
  const set = <K extends keyof TemplateDraft>(field: K) => (value: TemplateDraft[K]) => setDraft((d) => ({ ...d, [field]: value }));

  return (
    <Panel title={template ? `Editar ${template.name} (${template.sigtapCode})` : "Novo exame do catálogo-base"}>
      <div style={grid}>
        <Field label="Código SIGTAP" value={draft.sigtapCode} onChange={set("sigtapCode")} helpText="10 dígitos, da competência vigente" />
        <Field label="Nome" value={draft.name} onChange={set("name")} maxLength={LIMITS.name} />
        <label style={labelStyle}>
          <span>Setor</span>
          <select value={draft.sector} onChange={(event) => set("sector")(event.target.value)} style={inputStyle}>
            {optionsWith(SECTORS, draft.sector).map((s) => <option key={s} value={s}>{sectorText(s)}</option>)}
          </select>
        </label>
        <Field label="Material" value={draft.material} onChange={set("material")} maxLength={LIMITS.material} />
        <Field label="Recipiente" value={draft.container} onChange={set("container")} maxLength={LIMITS.container} />
        <Field label="Método sugerido" value={draft.suggestedMethod} onChange={set("suggestedMethod")} maxLength={LIMITS.method} />
        <Field label="Preparo do paciente" multiline value={draft.preparation} onChange={set("preparation")} />
        <label style={checkStyle}>
          <input type="checkbox" checked={draft.active} onChange={(event) => set("active")(event.target.checked)} />
          ativo (aparece para adoção)
        </label>
      </div>
      <div style={row}>
        <Button onClick={() => onSave(draft)} busy={busy}>salvar exame</Button>
        <Button variant="secondary" onClick={onClose}>fechar</Button>
      </div>
    </Panel>
  );
}

export const muted: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--ink3)" };
export const row: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
export const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };
export const labelStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink2)" };
export const inputStyle: CSSProperties = {
  padding: "8px 10px", border: "1px solid var(--rule2)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 13
};
export const checkStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink)" };
