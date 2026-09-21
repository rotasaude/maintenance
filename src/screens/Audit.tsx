import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";

// Auditoria (Task 9): só leitura — nenhum botão de ação, nenhuma mutation.
// A consulta de mantenedores é a mesma usada pela tela de Mantenedores (Task
// 7), mesma chave de cache (["maintainers"], staleTime: Infinity): serve só
// para preencher o filtro, e reaproveita o que já estiver carregado.
const MaintainersQuery = graphql(`
  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }
`);

const AuditQuery = graphql(`
  query AuditEvents($since: ISO8601DateTime, $until: ISO8601DateTime, $maintainerId: ID, $module: String, $outcome: String, $limit: Int) {
    auditEvents(since: $since, until: $until, maintainerId: $maintainerId, module: $module, outcome: $outcome, limit: $limit) {
      name module outcome occurredAt maintainerId login correlationId
    }
  }
`);

type AuditRow = {
  name: string;
  module: string;
  outcome: string;
  occurredAt: string;
  maintainerId: string | null;
  login: string | null;
  correlationId: string | null;
};

const OUTCOME_OPTIONS = [ "attempted", "ok", "rejected", "error" ] as const;
const OUTCOME_LABELS: Record<string, string> = {
  attempted: "tentativa",
  ok: "sucesso",
  rejected: "recusado",
  error: "erro"
};
const DEFAULT_LIMIT = 100;

// "Desde" vira meia-noite do dia; "até" vira o fim do mesmo dia — o período
// cobre o dia inteiro sem exigir hora do mantenedor.
function startOfDayIso(date: string): string { return `${date}T00:00:00.000Z`; }
function endOfDayIso(date: string): string { return `${date}T23:59:59.999Z`; }

// Agrupa por correlationId preservando a ordem de primeira aparição — a API
// já devolve tentativa e resultado próximos (mesmo occurred_at, DESC), mas o
// agrupamento não pode depender disso: eventos sem correlationId nunca se
// juntam a outro (cada um vira seu próprio grupo, sempre).
function groupByCorrelation(events: AuditRow[]): (AuditRow & { groupId: string; groupIndex: number })[] {
  const order: string[] = [];
  const groups = new Map<string, AuditRow[]>();

  events.forEach((event, index) => {
    const key = event.correlationId ?? `__solo_${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(event);
  });

  return order.flatMap((key, groupIndex) => groups.get(key)!.map((event) => ({ ...event, groupId: key, groupIndex })));
}

const cellStyle = { padding: "8px 10px", borderBottom: "1px solid var(--rule)" };
const headStyle = { textAlign: "left" as const, padding: "8px 10px", borderBottom: "1px solid var(--rule)", color: "var(--ink3)", fontWeight: 600 };
const inputStyle = { padding: "8px 10px", border: "1px solid var(--rule2)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 13 };
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 4, fontSize: 12, color: "var(--ink2)" };

// Campo de filtro com valor "rascunho": o input reage a cada tecla (para
// mostrar o que o mantenedor digita), mas só COMMITa — e só então vira
// variável da consulta — na perda de foco. Sem isso, "2026-01-01" dispararia
// uma consulta por caractere digitado; nenhum botão "filtrar" resolveria sem
// virar um botão de ação numa tela que a spec pede só leitura.
function FilterField({ label, type = "text", value, onChange, onCommit }: {
  label: string;
  type?: string;
  value: string;
  onChange(value: string): void;
  onCommit(value: string): void;
}) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

export function Audit() {
  const [ sinceDraft, setSinceDraft ] = useState("");
  const [ since, setSince ] = useState("");
  const [ untilDraft, setUntilDraft ] = useState("");
  const [ until, setUntil ] = useState("");
  const [ moduleDraft, setModuleDraft ] = useState("");
  const [ moduleFilter, setModuleFilter ] = useState("");
  const [ outcome, setOutcome ] = useState("");
  const [ maintainerId, setMaintainerId ] = useState("");
  const [ limitDraft, setLimitDraft ] = useState(String(DEFAULT_LIMIT));
  const [ limit, setLimit ] = useState(DEFAULT_LIMIT);

  const maintainersQuery = useQuery({
    queryKey: [ "maintainers" ],
    queryFn: () => gql(MaintainersQuery),
    staleTime: Infinity
  });

  const query = useQuery({
    queryKey: [ "auditEvents", since, until, moduleFilter, outcome, maintainerId, limit ],
    queryFn: () => gql(AuditQuery, {
      since: since === "" ? undefined : startOfDayIso(since),
      until: until === "" ? undefined : endOfDayIso(until),
      module: moduleFilter === "" ? undefined : moduleFilter,
      outcome: outcome === "" ? undefined : outcome,
      maintainerId: maintainerId === "" ? undefined : maintainerId,
      limit
    }),
    staleTime: Infinity
  });

  const maintainers = (maintainersQuery.data?.data?.maintainers ?? []) as { id: string; emailAddress: string }[];
  const events = groupByCorrelation((query.data?.data?.auditEvents ?? []) as AuditRow[]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Auditoria</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <FilterField label="Desde" type="date" value={sinceDraft} onChange={setSinceDraft} onCommit={setSince} />
        <FilterField label="Até" type="date" value={untilDraft} onChange={setUntilDraft} onCommit={setUntil} />
        <FilterField label="Módulo" value={moduleDraft} onChange={setModuleDraft} onCommit={setModuleFilter} />

        <label style={labelStyle}>
          <span>Resultado</span>
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            style={inputStyle}
          >
            <option value="">todos</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          <span>Mantenedor</span>
          <select
            value={maintainerId}
            onChange={(event) => setMaintainerId(event.target.value)}
            style={inputStyle}
          >
            <option value="">todos</option>
            {maintainers.map((m) => (
              <option key={m.id} value={m.id}>{m.emailAddress}</option>
            ))}
          </select>
        </label>

        <FilterField
          label="Limite"
          type="number"
          value={limitDraft}
          onChange={setLimitDraft}
          onCommit={(value) => setLimit(value === "" ? DEFAULT_LIMIT : Number(value))}
        />
      </div>

      {query.isError && (
        <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />
      )}

      {query.isSuccess && (
        events.length === 0 ? <EmptyState message="nenhum evento" /> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={headStyle}>Quando</th>
                <th style={headStyle}>Evento</th>
                <th style={headStyle}>Módulo</th>
                <th style={headStyle}>Resultado</th>
                <th style={headStyle}>Quem</th>
                <th style={headStyle}>Correlação</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr
                  key={`${event.groupId}-${index}`}
                  data-correlation-id={event.correlationId ?? undefined}
                  style={{ background: event.groupIndex % 2 === 0 ? "transparent" : "var(--sunken)" }}
                >
                  <td style={cellStyle}>{event.occurredAt}</td>
                  <td style={cellStyle}>{event.name}</td>
                  <td style={cellStyle}>{event.module}</td>
                  <td style={cellStyle}>{OUTCOME_LABELS[event.outcome] ?? event.outcome}</td>
                  <td style={cellStyle}>{event.login ?? "—"}</td>
                  <td style={cellStyle}>{event.correlationId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
