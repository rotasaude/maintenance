import type { ReactNode } from "react";

// Tabela genérica (spec Task 6). `columns` decide o quê e como mostrar;
// `onRowClick`, se vier, faz a linha inteira ser clicável — usada pelo
// catálogo de cidades para abrir o detalhe.
export type Column<T> = {
  key: string;
  label: string;
  render?(row: T): ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey?(row: T, index: number): string | number;
  onRowClick?(row: T): void;
};

export function DataTable<T>({ columns, rows, rowKey, onRowClick }: Props<T>) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderBottom: "1px solid var(--rule)",
                color: "var(--ink3)",
                fontWeight: 600
              }}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={rowKey ? rowKey(row, index) : index}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ cursor: onRowClick ? "pointer" : undefined, borderBottom: "1px solid var(--rule)" }}
          >
            {columns.map((column) => (
              <td key={column.key} style={{ padding: "8px 10px" }}>
                {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
