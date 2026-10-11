// SNCR da Anvisa (módulo 19d, F-19.24; spec §3 e §7; contrato §8). Só leitura
// e de PLATAFORMA: vale para todas as cidades do ambiente. A configuração
// (endereços do SNCR e CNPJ da mantenedora) fica nas credenciais cifradas do
// api; aqui só aparece se existe, se o api alcançou o SNCR e quando, e se o
// SNCR simulado existe neste ambiente.
//
// Consulta PRÓPRIA, como o SignaturePlatformPanel do 19b: contra um api sem o
// 19d a validação recusa o documento inteiro, e só este quadro cai.
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  SNCR_MOCK_NOTICE, SNCR_REAL_NOTICE,
  simulatedAvailabilityText, sncrDetail, sncrLastCheckText, sncrStatusLabel
} from "../lib/sncr";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { ErrorState } from "../components/ErrorState";

const SncrPlatformQuery = graphql(`
  query SncrPlatform {
    sncrStatus { configured reachable lastCheckAt simulatedAvailable }
  }
`);

const TITLE = "SNCR da Anvisa — numeração de receitas (todas as cidades do ambiente)";
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem o SNCR — o api do módulo 19d precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

export function SncrPlatformPanel({ sncrMock }: { sncrMock: boolean }) {
  const query = useQuery({
    queryKey: [ "platform", "sncr" ],
    queryFn: () => gql(SncrPlatformQuery),
    staleTime: Infinity
  });
  const status = query.data?.data?.sncrStatus ?? null;
  const fieldError = query.data?.fieldErrors[0];
  const label = status ? sncrStatusLabel(status) : null;

  return (
    <section aria-label={TITLE}>
      <Panel title={TITLE} actions={<Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>}>
        {/* Estado da cidade, não da consulta: aparece também enquanto carrega ou falha. */}
        <p role="note" aria-label="modo do SNCR desta cidade" style={sncrMock ? warnNote : note}>
          {sncrMock ? SNCR_MOCK_NOTICE : SNCR_REAL_NOTICE}
        </p>
        <p style={note}>
          A configuração do SNCR (cadastro da integração na Anvisa) fica nas credenciais cifradas do api, por ambiente;
          aqui só aparece se existe. Cada número é pedido pelo gov.br do próprio profissional.
        </p>
        {query.isPending && <p>carregando…</p>}
        {query.isError && <ErrorState message={requestErrorText(query.error)} />}
        {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
        {status && label && (
          <div role="group" aria-label="estado do SNCR" style={column}>
            <div style={row}>
              <strong style={{ fontSize: 12.5 }}>SNCR real</strong>
              <Tag tone={label.tone}>{label.label}</Tag>
              <span style={note}>{`última checagem: ${sncrLastCheckText(status)}`}</span>
            </div>
            <span style={note}>{sncrDetail(status)}</span>
            <span style={note}>{simulatedAvailabilityText(status)}</span>
          </div>
        )}
      </Panel>
    </section>
  );
}

const note: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--ink3)" };
const warnNote: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--warn)" };
const row: CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const column: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
