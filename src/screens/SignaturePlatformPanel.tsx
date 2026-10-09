// Prestadores de certificado em nuvem e serviço `signer` (módulo 19b, F-19.8;
// spec §3 e §9; contrato §8). Só leitura e de PLATAFORMA: vale para todas as
// cidades do ambiente. As credenciais ficam nas credenciais cifradas do api;
// aqui só aparece se existem e como foi a última checagem.
//
// Consulta PRÓPRIA, como a aba Funcionalidades no módulo 16: contra um api
// sem o 19b a validação recusa o documento inteiro, e só este quadro cai.
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import {
  PSC_MOCK_NOTICE, PSC_REAL_NOTICE,
  lastCheckText, providerName, providerStatus, signerDetail, signerStatus, type ProviderView
} from "../lib/signature";
import { Panel } from "../components/Panel";
import { Button } from "../components/Button";
import { Tag } from "../components/Tag";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";

const SignaturePlatformQuery = graphql(`
  query SignaturePlatform {
    signatureProviders { key configured lastCheckAt lastCheckOk }
    signerStatus { reachable version crlUpdatedAt }
  }
`);

const TITLE = "Assinatura digital — prestadores e signer (todas as cidades do ambiente)";
const OLD_API_CODES = new Set([ "undefinedField" ]);

function requestErrorText(err: unknown): string {
  if (err instanceof GraphQLRefusal && OLD_API_CODES.has(err.code)) {
    return "esta API ainda não tem a assinatura digital — o api do módulo 19b precisa subir antes do maintenance";
  }
  return err instanceof Error ? err.message : "erro inesperado";
}

export function SignaturePlatformPanel({ pscMock }: { pscMock: boolean }) {
  const query = useQuery({
    queryKey: [ "platform", "signature" ],
    queryFn: () => gql(SignaturePlatformQuery),
    staleTime: Infinity
  });
  const data = query.data?.data ?? null;
  const providers: ProviderView[] = data?.signatureProviders ?? [];
  const signer = data?.signerStatus ?? null;
  const fieldError = query.data?.fieldErrors[0];
  const status = signer ? signerStatus(signer, Date.now()) : null;

  return (
    <section aria-label={TITLE}>
      <Panel title={TITLE} actions={<Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>}>
        {/* Estado da cidade, não da consulta: aparece também enquanto carrega ou falha. */}
        <p role="note" aria-label="modo do PSC desta cidade" style={pscMock ? warnNote : note}>
          {pscMock ? PSC_MOCK_NOTICE : PSC_REAL_NOTICE}
        </p>
        <p style={note}>
          As credenciais dos prestadores ficam nas credenciais cifradas do api, por ambiente; aqui só aparece se existem.
          Prestador sem credencial não é oferecido aos profissionais.
        </p>
        {query.isPending && <p>carregando…</p>}
        {query.isError && <ErrorState message={requestErrorText(query.error)} />}
        {fieldError && <ErrorState message={`${fieldError.code} — ${fieldError.message}`} />}
        {data && (
          <>
            {providers.length === 0 ? <EmptyState message="nenhum prestador no catálogo" /> : (
              <DataTable<ProviderView>
                columns={[
                  { key: "provider", label: "Prestador", render: (p) => providerName(p.key) },
                  {
                    key: "state", label: "Estado",
                    render: (p) => {
                      const s = providerStatus(p);
                      return <Tag tone={s.tone}>{s.label}</Tag>;
                    }
                  },
                  { key: "lastCheck", label: "Última checagem", render: (p) => lastCheckText(p) }
                ]}
                rows={providers}
                rowKey={(p) => p.key}
              />
            )}
            {signer && status && (
              <div role="group" aria-label="serviço signer" style={signerRow}>
                <strong style={{ fontSize: 12.5 }}>Serviço signer</strong>
                <Tag tone={status.tone}>{status.label}</Tag>
                <span style={note}>{signerDetail(signer)}</span>
              </div>
            )}
          </>
        )}
      </Panel>
    </section>
  );
}

const note: CSSProperties = { margin: 0, fontSize: 11.5, color: "var(--ink3)" };
const warnNote: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--warn)" };
const signerRow: CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
