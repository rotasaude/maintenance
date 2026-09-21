import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { Tag } from "../components/Tag";

// Catálogo de cidades (Task 6). Uma consulta só, sem abrir conexão com
// nenhuma cidade — `cities` nunca alcança o banco delas (comentário do
// schema). O filtro de status é parte da chave da consulta: trocar o
// status é, para o cache, uma consulta nova.
const CitiesQuery = graphql(`
  query Cities($status: CityStatus) {
    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }
  }
`);

type CitySummary = {
  slug: string;
  name: string;
  uf: string | null;
  status: string;
  schemaVersion: string | null;
  schemaBehind: boolean;
  createdAt: string;
};

export const STATUS_LABELS: Record<string, string> = {
  PROVISIONING: "provisionando",
  ACTIVE: "ativa",
  SUSPENDED: "suspensa",
  ARCHIVED: "arquivada"
};

const STATUS_OPTIONS = [ "PROVISIONING", "ACTIVE", "SUSPENDED", "ARCHIVED" ] as const;

export function Cities({ onOpen }: { onOpen(slug: string): void }) {
  const [ status, setStatus ] = useState<string>("");

  const query = useQuery({
    queryKey: [ "cities", status ],
    queryFn: () => gql(CitiesQuery, { status: (status === "" ? undefined : status) as never })
  });

  const columns: Column<CitySummary>[] = [
    { key: "slug", label: "Slug" },
    { key: "name", label: "Nome" },
    { key: "uf", label: "UF" },
    { key: "status", label: "Status", render: (row) => STATUS_LABELS[row.status] ?? row.status },
    {
      key: "schemaBehind",
      label: "Schema",
      render: (row) => (row.schemaBehind ? <Tag tone="warn">schema atrasado</Tag> : null)
    }
  ];

  const cities = (query.data?.data?.cities ?? []) as CitySummary[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Cidades</h1>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink2)", maxWidth: 200 }}>
        <span>Status</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          style={{ padding: "8px 10px", border: "1px solid var(--rule2)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)" }}
        >
          <option value="">todas</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </label>

      {query.isError && (
        <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />
      )}

      {query.isSuccess && (
        cities.length === 0
          ? <EmptyState message="nenhuma cidade" />
          : <DataTable columns={columns} rows={cities} rowKey={(row) => row.slug} onRowClick={(row) => onOpen(row.slug)} />
      )}
    </div>
  );
}
