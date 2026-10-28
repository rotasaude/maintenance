// src/screens/NotifiableDiseaseListForm.tsx
// Versão nova da lista nacional de doenças de notificação compulsória (módulo
// 25, F-25.1; contrato §11 e §15 K17; plano do maintenance, Task 4). Parte da
// versão MAIS RECENTE (vigente ou agendada), ou do vazio na primeira; publicar
// cria a versão seguinte inteira e vale para todas as cidades a partir da
// vigência. Formato conferido aqui (recusar, nunca cortar) e de novo no api:
// cada recusa do servidor queima um TOTP. Fontes que a tela não edita voltam
// como vieram. O TOTP fica só no estado deste formulário e é limpo no instante
// em que sai (step_up! roda primeiro e consome o código em qualquer desfecho).
import { useState } from "react";
import { optionsWith } from "../lib/labTemplates";
import {
  DEADLINES, codesOf, deadlineText, diffText, diseaseProblem, emptyDisease, listDiff, toDraft, type DiseaseDraft, type ListDraft, type ListView
} from "../lib/notifiableDiseases";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { DataTable } from "../components/DataTable";
import { ErrorState } from "../components/ErrorState";
import { Field } from "../components/Field";
import { STEP_UP_CODE_HELP_TEXT, StepUpCodeError } from "../components/StepUpCode";
import { grid, inputStyle, labelStyle, muted, row } from "./LabTemplates";

const NOTICE = "Vale para todas as cidades a partir da vigência; as notificações já feitas não mudam.";

// `field: "code"` = recusa do TOTP, mostrada no campo do código.
export type Outcome = { tone: "done" | "failed"; text: string; field?: "code" };

export function OutcomeNote({ outcome }: { outcome: Outcome }) {
  return outcome.tone === "done"
    ? <p role="status" style={{ margin: 0, fontSize: 12.5, color: "var(--ok)" }}>{outcome.text}</p>
    : <ErrorState message={outcome.text} />;
}

// `onPublish` devolve se o pedido saiu (false: a conferência local recusou e o código não foi gasto).
type Props = {
  base: ListView | null; busy: boolean; outcome: Outcome | null;
  onPublish(draft: ListDraft, code: string): boolean; onClose(): void;
};
// `index` null = doença nova.
type DiseaseEdit = { index: number | null; draft: DiseaseDraft; problem: string | null };
type DraftRow = { disease: DiseaseDraft; index: number };

export function NotifiableDiseaseListForm({ base, busy, outcome, onPublish, onClose }: Props) {
  const [ d, setD ] = useState<ListDraft>(() => toDraft(base));
  const [ code, setCode ] = useState("");
  const [ edit, setEdit ] = useState<DiseaseEdit | null>(null);
  const [ removing, setRemoving ] = useState<number | null>(null);
  const set = (field: "ordinance" | "effectiveFrom" | "notes") => (value: string) => setD((x) => ({ ...x, [field]: value }));
  const baseCodes = new Set((base?.diseases ?? []).map((x) => x.code));
  const next = (base?.version ?? 0) + 1;
  const codeOutcome = outcome?.field === "code" ? outcome : null;
  const formOutcome = outcome && outcome.field !== "code" ? outcome : null;

  function publish() {
    if (onPublish(d, code)) setCode("");
  }

  function apply() {
    if (!edit) return;
    const problem = diseaseProblem(edit.draft)
      ?? (d.diseases.some((x, i) => i !== edit.index && x.code.trim() === edit.draft.code.trim()) ? `código repetido na lista: ${edit.draft.code.trim()}` : null);
    if (problem) { setEdit({ ...edit, problem }); return; }
    const disease = edit.draft;
    setD((x) => ({ ...x, diseases: edit.index === null ? [ ...x.diseases, disease ] : x.diseases.map((y, i) => (i === edit.index ? disease : y)) }));
    setEdit(null);
  }

  const setDisease = <K extends keyof DiseaseDraft>(field: K) => (value: DiseaseDraft[K]) =>
    setEdit((e) => (e ? { ...e, draft: { ...e.draft, [field]: value } } : e));
  // Código só se escreve em doença que a versão de partida não tem.
  const codeEditable = edit !== null && (edit.index === null || !baseCodes.has(d.diseases[edit.index]?.code ?? ""));
  const rows: DraftRow[] = d.diseases.map((disease, index) => ({ disease, index }));
  const nameOf = (x: DiseaseDraft) => x.name.trim() || x.code.trim() || "esta doença";

  return (
    <section aria-label="Versão nova">
      <Panel title={base ? `Versão nova da lista (a partir da v${base.version})` : "Primeira versão da lista"}>
        {formOutcome && <OutcomeNote outcome={formOutcome} />}
        <div style={grid}>
          <Field label="Portaria" value={d.ordinance} onChange={set("ordinance")} helpText="ex.: Portaria GM/MS nº 11.211/2026; até 200 caracteres" />
          <Field label="Início da vigência" type="date" value={d.effectiveFrom} onChange={set("effectiveFrom")}
            helpText="a partir de hoje e não antes da última versão publicada" />
          <Field label="Nota da versão" value={d.notes} onChange={set("notes")} helpText="opcional; até 500 caracteres" />
        </div>
        {rows.length === 0
          ? <p style={muted}>nenhuma doença ainda</p>
          : (
            <DataTable<DraftRow>
              columns={[
                { key: "name", label: "Doença", render: (r) => <strong>{r.disease.name}</strong> },
                { key: "deadline", label: "Prazo", render: (r) => deadlineText(r.disease.deadline) },
                { key: "cid10", label: "CID-10", render: (r) => codesOf(r.disease.cid10).join(", ") || "—" },
                { key: "ciap2", label: "CIAP-2", render: (r) => codesOf(r.disease.ciap2).join(", ") || "—" },
                {
                  key: "actions", label: "", render: (r) => (removing === r.index
                    ? (
                      <div style={row}>
                        <span style={{ fontSize: 12.5 }}>{`retirar ${nameOf(r.disease)} da versão nova?`}</span>
                        <Button variant="danger" onClick={() => {
                          setD((x) => ({ ...x, diseases: x.diseases.filter((_, i) => i !== r.index) }));
                          setRemoving(null);
                        }}>sim, retirar</Button>
                        <Button variant="secondary" onClick={() => setRemoving(null)}>manter</Button>
                      </div>
                    )
                    : (
                      <div style={row}>
                        <Button variant="secondary" disabled={edit !== null}
                          onClick={() => { setRemoving(null); setEdit({ index: r.index, draft: r.disease, problem: null }); }}>editar</Button>
                        <Button variant="secondary" disabled={edit !== null} onClick={() => setRemoving(r.index)}>retirar</Button>
                      </div>
                    ))
                }
              ]}
              rows={rows}
              rowKey={(r) => r.index}
            />
          )}
        {edit
          ? (
            <fieldset aria-label="Doença" style={fieldsetStyle}>
              <legend style={legendStyle}>{edit.index === null ? "Doença nova" : `Editar ${nameOf(edit.draft)}`}</legend>
              {edit.problem && <ErrorState message={edit.problem} />}
              <div style={grid}>
                {codeEditable
                  ? <Field label="Código da doença" value={edit.draft.code} onChange={setDisease("code")} helpText="minúsculas, números e _ (ex.: mpox)" />
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={labelStyle}>
                        <span>Código da doença</span>
                        <input value={edit.draft.code} readOnly disabled style={readOnlyStyle} />
                      </label>
                      <small style={{ color: "var(--ink3)", fontSize: 11 }}>o da doença; não muda</small>
                    </div>
                  )}
                <Field label="Nome" value={edit.draft.name} onChange={setDisease("name")} helpText="até 120 caracteres" />
                <label style={labelStyle}>
                  <span>Prazo</span>
                  <select value={edit.draft.deadline} onChange={(event) => setDisease("deadline")(event.target.value)} style={inputStyle}>
                    {optionsWith(DEADLINES, edit.draft.deadline).map((o) => <option key={o} value={o}>{deadlineText(o)}</option>)}
                  </select>
                </label>
                <Field label="CID-10" value={edit.draft.cid10} onChange={setDisease("cid10")} helpText="separados por vírgula; sem ponto (A90.0 vira A900)" />
                <Field label="CIAP-2" value={edit.draft.ciap2} onChange={setDisease("ciap2")} helpText="separados por vírgula" />
                <Field label="Janela de repetição (dias)" value={edit.draft.repeatAfterDays} onChange={setDisease("repeatAfterDays")}
                  helpText="inteiro; dentro dela a mesma doença do mesmo cidadão não pede notificação nova" />
                <Field label="Ficha do Sinan" value={edit.draft.sinanForm} onChange={setDisease("sinanForm")} helpText="opcional; até 60 caracteres" />
                <Field label="Nota" value={edit.draft.notes} onChange={setDisease("notes")} helpText="opcional; até 300 caracteres" />
                <Field label="Fonte do prazo" value={edit.draft.deadlineSource} onChange={setDisease("deadlineSource")} helpText="obrigatória" />
                <Field label="Fonte dos códigos" value={edit.draft.cid10Source} onChange={setDisease("cid10Source")} helpText="obrigatória" />
              </div>
              <div style={row}>
                <Button onClick={apply}>aplicar</Button>
                <Button variant="secondary" onClick={() => setEdit(null)}>cancelar</Button>
              </div>
            </fieldset>
          )
          : (
            <div style={row}>
              <Button variant="secondary" onClick={() => { setRemoving(null); setEdit({ index: null, draft: emptyDisease(), problem: null }); }}>acrescentar doença</Button>
            </div>
          )}
        <p style={{ margin: 0, fontSize: 12.5 }}>{diffText(listDiff(base, d))}</p>
        <p style={muted}>{NOTICE}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 360 }}>
          <Field label="Código" name="code" autoComplete="one-time-code" helpText={STEP_UP_CODE_HELP_TEXT} value={code} onChange={setCode} />
          {codeOutcome && <StepUpCodeError message={codeOutcome.text} />}
        </div>
        {edit && <p style={muted}>aplique ou cancele a doença aberta antes de publicar</p>}
        <div style={row}>
          <Button onClick={publish} busy={busy} disabled={edit !== null}>{`publicar versão ${next}`}</Button>
          <Button variant="secondary" onClick={onClose}>fechar</Button>
        </div>
      </Panel>
    </section>
  );
}

const fieldsetStyle = { border: "1px solid var(--rule)", borderRadius: 6, padding: 12, margin: "8px 0", display: "flex", flexDirection: "column" as const, gap: 8 };
const legendStyle = { fontSize: 12.5, fontWeight: 600, color: "var(--ink)" };
// Somente leitura com o visual de campo desabilitado (como o Button): fundo e texto de papéis do tema, borda tracejada.
const readOnlyStyle = { ...inputStyle, border: "1px dashed var(--rule2)", background: "var(--sunken)", color: "var(--ink2)", cursor: "default" };
