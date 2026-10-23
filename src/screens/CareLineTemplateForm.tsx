// src/screens/CareLineTemplateForm.tsx
// Versão nova de uma linha do catálogo-base (módulo 23; contrato §8; plano do
// api, Task 4): parte da vigente (ou do nome e indicador do contrato, na
// primeira), edita os campos simples da elegibilidade e das boas práticas e
// publica. Os campos avançados (all_of, code_filter, applies_to, identidades de
// gênero, `declared`) voltam iguais e aparecem em texto. Publicar SEMPRE cria a
// próxima versão e não muda nenhuma cidade até ela adotar. Formato conferido
// aqui (recusar, nunca cortar) e de novo no api. O indicador é o da chave
// (somente leitura); pontos são inteiros de 0 a 100 (D-02); CBO só na consulta.
import { useState } from "react";
import { optionsWith } from "../lib/labTemplates";
import {
  ANCHORS, CODED, SCHEDULES, SEXES, SOURCE_KINDS, advancedText, anchorText, changeSource, emptyPractice, indicatorOf, keyText, pointsTotal,
  scheduleText, sexText, sourceKindText, type PracticeDraft, type TemplateDraft
} from "../lib/careLineTemplates";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { checkStyle, grid, inputStyle, labelStyle, muted, row } from "./LabTemplates";

const NOTICE = "A versão nova só vale para a cidade que a adotar; as inscrições das cidades não mudam até lá.";
const CONDITION_TEXT: Record<string, string> = {
  "": "nenhuma", diabetes: "diabetes", hypertension: "hipertensão", pregnancy: "gestação", mental_health: "saúde mental"
};

type Props = { draft: TemplateDraft; fromVersion: number | null; busy: boolean; onSave(d: TemplateDraft): void; onClose(): void };

export function CareLineTemplateForm({ draft: initial, fromVersion, busy, onSave, onClose }: Props) {
  const [ d, setD ] = useState<TemplateDraft>(initial);
  const set = <K extends keyof TemplateDraft>(field: K) => (value: TemplateDraft[K]) => setD((x) => ({ ...x, [field]: value }));
  const setPractice = (i: number, patch: Partial<PracticeDraft>) =>
    setD((x) => ({ ...x, practices: x.practices.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  // Soma só do que já é inteiro; o resto é conferido ao publicar.
  const total = pointsTotal(d.practices.map((p) => ({ points: /^\d+$/.test(p.points.trim()) ? Number(p.points.trim()) : null })));
  const declared = d.preserved.declared ?? [];
  const preserved = [
    d.preserved.gender_identities_included?.length ? `inclui: ${d.preserved.gender_identities_included.join(", ")}` : null,
    d.preserved.gender_identities_excluded?.length ? `exclui: ${d.preserved.gender_identities_excluded.join(", ")}` : null,
    declared.length ? `condição declarada: ${declared.join(", ")}` : null
  ].filter((x): x is string => x !== null);

  const select = (label: string, value: string, options: readonly string[], text: (o: string) => string, onChange: (v: string) => void, help?: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={labelStyle}>
        <span>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle}>
          {optionsWith(options, value).map((o) => <option key={o} value={o}>{text(o)}</option>)}
        </select>
      </label>
      {help && <small style={{ color: "var(--ink3)", fontSize: 11 }}>{help}</small>}
    </div>
  );

  return (
    <section aria-label="Versão nova do catálogo-base">
      <Panel title={fromVersion === null ? `Primeira versão de ${keyText(d.key)}` : `Versão nova de ${keyText(d.key)} (a partir da v${fromVersion})`}>
        <p style={muted}>{NOTICE}</p>
        <div style={grid}>
          <Field label="Nome da linha" value={d.name} onChange={set("name")} helpText="até 120 caracteres" />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>
              <span>Indicador</span>
              <input value={indicatorOf(d.key) || d.indicator} readOnly style={inputStyle} />
            </label>
            <small style={{ color: "var(--ink3)", fontSize: 11 }}>o da linha; não muda</small>
          </div>
          {select("Condição declarada que sugere a linha", d.declaredCondition, [ "", ...declared ], (o) => CONDITION_TEXT[o] ?? o, set("declaredCondition"),
            "só vale uma das condições de entrada (eligibility.declared) desta versão")}
        </div>
        <fieldset aria-label="Elegibilidade" style={fieldsetStyle}>
          <legend style={legendStyle}>Quem é elegível</legend>
          <div style={grid}>
            <Field label="Códigos CIAP-2 (problema ativo)" value={d.ciap} onChange={set("ciap")} helpText="por prefixo, separados por vírgula" />
            <Field label="Códigos CID-10 (problema ativo)" value={d.cid10} onChange={set("cid10")} helpText="por prefixo, sem ponto (E11 casa E119)" />
            <Field label="Exceto CIAP-2" value={d.excludeCiap} onChange={set("excludeCiap")} helpText="ex.: aborto W82, W83" />
            <Field label="Exceto CID-10" value={d.excludeCid10} onChange={set("excludeCid10")} />
            <Field label="Idade mínima (anos)" value={d.ageMinYears} onChange={set("ageMinYears")} helpText="vazio = sem limite" />
            <Field label="Idade máxima (anos)" value={d.ageMaxYears} onChange={set("ageMaxYears")} helpText="vazio = sem limite" />
            <Field label="Idade mínima (dias de vida)" value={d.ageMinDays} onChange={set("ageMinDays")} />
            <Field label="Idade máxima (dias de vida)" value={d.ageMaxDays} onChange={set("ageMaxDays")} helpText="até 2 anos = 730" />
            {select("Sexo", d.sex, SEXES, sexText, set("sex"))}
          </div>
          <label style={checkStyle}>
            <input type="checkbox" checked={d.requiresAnchor === "lmp"} onChange={(event) => set("requiresAnchor")(event.target.checked ? "lmp" : "")} />
            pede a DUM na inscrição (gestação)
          </label>
          {preserved.length > 0 && <p style={muted}>{`regras avançadas (preservadas): ${preserved.join(" · ")}`}</p>}
        </fieldset>
        {d.practices.map((p, i) => {
          const advanced = advancedText({ key: p.key, label: p.label, source: p.sourceKind, anchor: p.anchor, window_days: 0, min_count: 0,
            schedule: p.schedule, ...p.advanced });
          return (
            <fieldset key={i} role="group" aria-label={`Boa prática ${i + 1}`} style={fieldsetStyle}>
              <legend style={legendStyle}>Boa prática {i + 1}</legend>
              <div style={grid}>
                <Field label="Chave" value={p.key} onChange={(v) => setPractice(i, { key: v })} helpText="minúsculas, números e _ (ex.: c4_e)" />
                <Field label="O que conta" value={p.label} onChange={(v) => setPractice(i, { label: v })} helpText="até 120 caracteres" />
                <Field label="Texto para o cidadão" value={p.citizenLabel} onChange={(v) => setPractice(i, { citizenLabel: v })}
                  helpText="até 80, em linguagem simples (Meu acompanhamento)" />
                {select("Fonte", p.sourceKind, SOURCE_KINDS, sourceKindText, (v) => setPractice(i, { ...changeSource(p, v), code: CODED.has(v) ? p.code : "" }))}
                {CODED.has(p.sourceKind) && (
                  <Field label="Código" value={p.code} onChange={(v) => setPractice(i, { code: v })}
                    helpText={p.sourceKind === "vaccine" ? "código da vacina" : "SIGTAP, 10 dígitos"} />
                )}
                <Field label="Início da janela (dias)" value={p.windowStartDays} onChange={(v) => setPractice(i, { windowStartDays: v })}
                  helpText="vazio = desde a âncora; só com âncora fixa" />
                <Field label="Fim da janela (dias)" value={p.windowDays} onChange={(v) => setPractice(i, { windowDays: v })} />
                <Field label="Quantidade mínima" value={p.minCount} onChange={(v) => setPractice(i, { minCount: v })} />
                {select("Cronograma", p.schedule, SCHEDULES, scheduleText, (v) => setPractice(i, { schedule: v }))}
                {select("Âncora", p.anchor, ANCHORS, anchorText, (v) => setPractice(i, { anchor: v }))}
                {p.sourceKind === "consultation" && (
                  <Field label="CBO que conta (prefixos)" value={p.cboFilter} onChange={(v) => setPractice(i, { cboFilter: v })}
                    helpText="vazio = qualquer; médico e enfermeiro = 2231, 2251, 2252, 2253, 2235" />
                )}
                <Field label="Pontos" value={p.points} onChange={(v) => setPractice(i, { points: v })} helpText="Quadro 01; inteiro de 0 a 100" />
              </div>
              {advanced && <p style={muted}>{`regras avançadas (preservadas): ${advanced}`}</p>}
              {d.practices.length > 1 && (
                <div style={row}>
                  <Button variant="secondary" onClick={() => setD((x) => ({ ...x, practices: x.practices.filter((_, j) => j !== i) }))}>
                    tirar boa prática {i + 1}
                  </Button>
                </div>
              )}
            </fieldset>
          );
        })}
        <div style={row}>
          <Button variant="secondary" onClick={() => setD((x) => ({ ...x, practices: [ ...x.practices, emptyPractice() ] }))}>incluir boa prática</Button>
        </div>
        <p style={muted}>{`Soma dos pontos: ${total}${total === 100 ? "" : " (precisa ser 100)"}`}</p>
        <div style={row}>
          <Button onClick={() => onSave(d)} busy={busy}>publicar versão</Button>
          <Button variant="secondary" onClick={onClose}>fechar</Button>
        </div>
      </Panel>
    </section>
  );
}

const fieldsetStyle = { border: "1px solid var(--rule)", borderRadius: 6, padding: 12, margin: "8px 0", display: "flex", flexDirection: "column" as const, gap: 8 };
const legendStyle = { fontSize: 12.5, fontWeight: 600, color: "var(--ink)" };
