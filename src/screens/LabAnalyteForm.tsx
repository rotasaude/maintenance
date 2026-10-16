// src/screens/LabAnalyteForm.tsx
// Componente (analito) de um exame do catálogo-base, com as faixas de
// referência por sexo e idade (módulo 21b, F-21.14; spec §4; contrato §10).
// A conversão do que foi digitado (vírgula decimal, ponto de milhar recusado)
// é de labTemplates.ts; regras de conjunto das faixas são do api. Uma recusa
// nunca apaga o que foi digitado.
import { useState, type CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import type { UpsertLabAnalyteTemplateMutationVariables } from "../gql/graphql";
import {
  EMPTY_RANGE, KEY_HELP, LIMITS, SEXES, VALUE_TYPES, analyteChoicesProblem, decimalsProblem, draftsToRanges, keyProblem, loincProblem,
  optionsWith, orNull, rangeToDraft, sexText, textProblem, upsertErrorText, valueTypeText,
  type AnalyteView, type RangeDraft
} from "../lib/labTemplates";
import { grid, inputStyle, labelStyle, muted, refused, row } from "./LabTemplates";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { ErrorState } from "../components/ErrorState";
import { TableScroll } from "../components/TableScroll";

const UpsertLabAnalyteTemplateMutation = graphql(`
  mutation UpsertLabAnalyteTemplate(
    $id: ID, $labExamTemplateId: ID!, $key: String!, $name: String!, $loinc: String, $unit: String,
    $valueType: String!, $choices: [String!], $decimals: Int!, $position: Int!, $referenceRanges: [LabReferenceRangeInput!]!
  ) {
    upsertLabAnalyteTemplate(
      id: $id, labExamTemplateId: $labExamTemplateId, key: $key, name: $name, loinc: $loinc, unit: $unit,
      valueType: $valueType, choices: $choices, decimals: $decimals, position: $position, referenceRanges: $referenceRanges
    ) { ok errors { path message } }
  }
`);

type Props = { templateId: string; analyte: AnalyteView | null; nextPosition: number; onSaved(text: string): void; onClose(): void };
type RangeField = keyof RangeDraft;

const INTEGER = /^\d+$/;
const RANGE_COLUMNS: { field: RangeField; header: string; label: string }[] = [
  { field: "ageMinDays", header: "Idade mín. (dias)", label: "idade mínima em dias" },
  { field: "ageMaxDays", header: "Idade máx. (dias)", label: "idade máxima em dias" },
  { field: "low", header: "Baixo", label: "baixo" },
  { field: "high", header: "Alto", label: "alto" },
  { field: "text", header: "Texto", label: "texto" }
];

export function LabAnalyteForm({ templateId, analyte, nextPosition, onSaved, onClose }: Props) {
  const [ key, setKey ] = useState(analyte?.key ?? "");
  const [ name, setName ] = useState(analyte?.name ?? "");
  const [ loinc, setLoinc ] = useState(analyte?.loinc ?? "");
  const [ unit, setUnit ] = useState(analyte?.unit ?? "");
  const [ valueType, setValueType ] = useState(analyte?.valueType ?? "numeric");
  const [ choices, setChoices ] = useState((analyte?.choices ?? []).join("\n"));
  const [ decimals, setDecimals ] = useState(String(analyte?.decimals ?? 0));
  const [ position, setPosition ] = useState(String(analyte?.position ?? nextPosition));
  const [ ranges, setRanges ] = useState<RangeDraft[]>(analyte ? analyte.referenceRanges.map(rangeToDraft) : [ { ...EMPTY_RANGE } ]);
  const [ error, setError ] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (vars: UpsertLabAnalyteTemplateMutationVariables) => gql(UpsertLabAnalyteTemplateMutation, vars),
    onMutate: () => setError(null),
    onSuccess: ({ data, fieldErrors }) => {
      const payload = data?.upsertLabAnalyteTemplate ?? null;
      if (!payload) { setError(refused(fieldErrors)); return; }
      if (!payload.ok) { setError(upsertErrorText(payload.errors, "analyte")); return; }
      onSaved("Componente salvo.");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "erro inesperado")
  });

  function change(index: number, field: RangeField, value: string) {
    setRanges((rs) => rs.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function submit() {
    const options = choices.split("\n").map((c) => c.trim()).filter((c) => c !== "");
    const problem = keyProblem(key)
      ?? (name.trim() === "" ? upsertErrorText([ { path: "name", message: "blank" } ], "analyte") : null)
      ?? textProblem("Nome do componente", name, LIMITS.name)
      ?? loincProblem(loinc)
      ?? textProblem("Unidade", unit, LIMITS.unit)
      ?? decimalsProblem(decimals)
      ?? (INTEGER.test(position.trim()) ? null : "ordem: use um número inteiro")
      ?? analyteChoicesProblem(valueType, options);
    if (problem) { setError(problem); return; }
    const parsed = draftsToRanges(ranges);
    if ("error" in parsed) { setError(parsed.error); return; }
    save.mutate({
      id: analyte?.id ?? null, labExamTemplateId: templateId, key: key.trim(), name: name.trim(),
      loinc: orNull(loinc), unit: orNull(unit), valueType,
      choices: valueType === "choice" ? options : [],
      decimals: Number(decimals.trim()), position: Number(position.trim()), referenceRanges: parsed.ranges
    });
  }

  return (
    <section aria-label="Componente">
      <Panel title={analyte ? `Editar componente ${analyte.name}` : "Novo componente"}>
        <div style={grid}>
          <Field label="Chave" value={key} onChange={setKey} helpText={KEY_HELP} />
          <Field label="Nome do componente" value={name} onChange={setName} maxLength={LIMITS.name} />
          <Field label="LOINC" value={loinc} onChange={setLoinc} />
          <Field label="Unidade" value={unit} onChange={setUnit} maxLength={LIMITS.unit} />
          <label style={labelStyle}>
            <span>Tipo de valor</span>
            <select value={valueType} onChange={(event) => setValueType(event.target.value)} style={inputStyle}>
              {optionsWith(VALUE_TYPES, valueType).map((t) => <option key={t} value={t}>{valueTypeText(t)}</option>)}
            </select>
          </label>
          {valueType === "choice" && <Field label="Opções (uma por linha)" multiline value={choices} onChange={setChoices} />}
          <Field label="Casas decimais" value={decimals} onChange={setDecimals} />
          <Field label="Ordem" value={position} onChange={setPosition} />
        </div>

        <p style={muted}>
          Idade em dias na data da coleta (365 = 1 ano; 43800 = 120 anos, sem limite). Decimal com vírgula e sem ponto de
          milhar: 150000, não 150.000. Em branco, "baixo" ou "alto" fica sem limite.
        </p>
        <TableScroll>
          <table aria-label="Faixas de referência" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={th}>Sexo</th>
                {RANGE_COLUMNS.map((c) => <th key={c.field} style={th}>{c.header}</th>)}
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {ranges.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--rule)" }}>
                  <td style={td}>
                    <select aria-label={`faixa ${i + 1}: sexo`} value={r.sex} onChange={(event) => change(i, "sex", event.target.value)} style={inputStyle}>
                      {optionsWith(SEXES, r.sex).map((s) => <option key={s} value={s}>{sexText(s)}</option>)}
                    </select>
                  </td>
                  {RANGE_COLUMNS.map((c) => (
                    <td key={c.field} style={td}>
                      <input
                        aria-label={`faixa ${i + 1}: ${c.label}`}
                        value={r[c.field]}
                        inputMode={c.field === "text" ? undefined : "decimal"}
                        onChange={(event) => change(i, c.field, event.target.value)}
                        style={{ ...inputStyle, width: c.field === "text" ? 140 : 90 }}
                      />
                    </td>
                  ))}
                  <td style={td}>
                    <Button variant="secondary" onClick={() => setRanges((rs) => rs.filter((_, j) => j !== i))}>remover</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>

        {error && <ErrorState message={error} />}
        <div style={row}>
          <Button variant="secondary" onClick={() => setRanges((rs) => [ ...rs, { ...EMPTY_RANGE } ])}>acrescentar faixa</Button>
          <Button onClick={submit} busy={save.isPending}>salvar componente</Button>
          <Button variant="secondary" onClick={onClose}>cancelar</Button>
        </div>
      </Panel>
    </section>
  );
}

const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--rule)", color: "var(--ink3)", fontWeight: 600 };
const td: CSSProperties = { padding: "6px 10px" };
