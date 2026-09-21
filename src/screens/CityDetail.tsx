import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { gql } from "../lib/api";
import { graphql } from "../gql";
import { GraphQLRefusal } from "../lib/errors";
import { Panel } from "../components/Panel";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { DataTable } from "../components/DataTable";
import { Tag } from "../components/Tag";
import { Button } from "../components/Button";
import { STATUS_LABELS } from "./Cities";

// Detalhe de uma cidade (Task 6). O topo (plataforma + canal) é UMA
// consulta, disparada ao abrir. Cada aba é OUTRA consulta, só disparada
// quando a aba é aberta (`enabled: activeTab === <chave>`) — abrir o
// detalhe nunca consulta profile/protocols/alertRecipients/accounts/
// counts/operations; abrir uma aba consulta só aquele campo.
const CityHeaderQuery = graphql(`
  query CityHeader($slug: String!) {
    city(slug: $slug) {
      slug name uf status schemaVersion schemaBehind createdAt
      channel { phoneNumberId wabaId displayPhoneNumber active }
    }
  }
`);

const CityProfileQuery = graphql(`
  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }
`);
const CityProtocolsQuery = graphql(`
  query CityProtocols($slug: String!) { city(slug: $slug) { slug protocols { name version status } } }
`);
const CityRecipientsQuery = graphql(`
  query CityRecipients($slug: String!) {
    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }
  }
`);
const CityAccountsQuery = graphql(`
  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }
`);
const CityCountsQuery = graphql(`
  query CityCounts($slug: String!) {
    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }
  }
`);
const CityOperationsQuery = graphql(`
  query CityOperations($slug: String!) {
    city(slug: $slug) {
      slug
      operations {
        domainEvents { name occurredAt publishedAt }
        reportSnapshots { id createdAt expiresAt }
        dashboardMetrics { dimension period label value computedAt }
        failedJobs { className failedAt errorClass }
      }
    }
  }
`);

type TabKey = "profile" | "protocols" | "alertRecipients" | "accounts" | "counts" | "operations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Perfil" },
  { key: "protocols", label: "Protocolos" },
  { key: "alertRecipients", label: "Destinatários" },
  { key: "accounts", label: "Contas" },
  { key: "counts", label: "Contagens" },
  { key: "operations", label: "Operação" }
];

const dlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  columnGap: 12,
  rowGap: 6,
  margin: 0,
  fontSize: 12.5
};

type GqlResult<T> = { data: T | null; fieldErrors: GraphQLRefusal[] };

// O erro de campo de uma aba chega em `fieldErrors`, nunca em `error`
// (spec do controller): acha o primeiro refusal cujo path começa por
// ["city", <campo da aba>] — ou é só ["city"], quando a cidade inteira
// veio nula por causa do erro daquele campo não-nulo.
function tabError(fieldErrors: GraphQLRefusal[], field: string): GraphQLRefusal | undefined {
  return fieldErrors.find((refusal) => {
    const path = refusal.path ?? [];
    return path[0] === "city" && (path.length === 1 || path[1] === field);
  });
}

function renderTab<TResult extends { city?: unknown }>(
  query: UseQueryResult<GqlResult<TResult>, Error>,
  field: string,
  content: (city: NonNullable<TResult["city"]>) => ReactNode
): ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <Button onClick={() => void query.refetch()} busy={query.isFetching}>atualizar</Button>
      </div>
      {query.isPending && <p>carregando…</p>}
      {query.isError && (
        <ErrorState message={query.error instanceof Error ? query.error.message : "erro inesperado"} />
      )}
      {query.data && (() => {
        const err = tabError(query.data.fieldErrors, field);
        const city = query.data.data?.city ?? null;
        return (
          <>
            {err && <ErrorState message={`${err.code} — ${err.message}`} />}
            {city && content(city as NonNullable<TResult["city"]>)}
          </>
        );
      })()}
    </div>
  );
}

export function CityDetail({ slug, onBack }: { slug: string; onBack(): void }) {
  const [ activeTab, setActiveTab ] = useState<TabKey | null>(null);

  // staleTime: Infinity em TODA consulta daqui (spec §6: "sem atualização
  // automática"; ruling P5). Cada campo de cidade abre conexão com o banco
  // dela — sem isso, o padrão do react-query (staleTime: 0) marca a
  // consulta como stale assim que ela sai de `enabled`, e reabrir a aba
  // (enabled false→true de novo) dispara outra busca sozinha: Contas →
  // Perfil → Contas faria DUAS conexões com "Contas" sem o mantenedor
  // pedir. Com staleTime: Infinity, os dados carregados uma vez nunca
  // ficam stale sozinhos — só `refetch()` (o botão "atualizar") busca de
  // novo. A chave da consulta ainda leva o slug: trocar de cidade é cache
  // novo, do zero.
  const header = useQuery({
    queryKey: [ "city", slug, "header" ],
    queryFn: () => gql(CityHeaderQuery, { slug }),
    staleTime: Infinity
  });
  const profile = useQuery({
    queryKey: [ "city", slug, "profile" ],
    queryFn: () => gql(CityProfileQuery, { slug }),
    enabled: activeTab === "profile",
    staleTime: Infinity
  });
  const protocols = useQuery({
    queryKey: [ "city", slug, "protocols" ],
    queryFn: () => gql(CityProtocolsQuery, { slug }),
    enabled: activeTab === "protocols",
    staleTime: Infinity
  });
  const alertRecipients = useQuery({
    queryKey: [ "city", slug, "alertRecipients" ],
    queryFn: () => gql(CityRecipientsQuery, { slug }),
    enabled: activeTab === "alertRecipients",
    staleTime: Infinity
  });
  const accounts = useQuery({
    queryKey: [ "city", slug, "accounts" ],
    queryFn: () => gql(CityAccountsQuery, { slug }),
    enabled: activeTab === "accounts",
    staleTime: Infinity
  });
  const counts = useQuery({
    queryKey: [ "city", slug, "counts" ],
    queryFn: () => gql(CityCountsQuery, { slug }),
    enabled: activeTab === "counts",
    staleTime: Infinity
  });
  const operations = useQuery({
    queryKey: [ "city", slug, "operations" ],
    queryFn: () => gql(CityOperationsQuery, { slug }),
    enabled: activeTab === "operations",
    staleTime: Infinity
  });

  const city = header.data?.data?.city ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Button onClick={onBack}>voltar</Button>
      </div>

      {header.isPending && <p>carregando…</p>}
      {header.isError && (
        <ErrorState message={header.error instanceof Error ? header.error.message : "erro inesperado"} />
      )}
      {header.isSuccess && !city && <EmptyState message="cidade não encontrada" />}

      {city && (
        <Panel title={city.name}>
          <dl style={dlStyle}>
            <dt>Slug</dt><dd>{city.slug}</dd>
            <dt>UF</dt><dd>{city.uf ?? "—"}</dd>
            <dt>Status</dt><dd>{STATUS_LABELS[city.status] ?? city.status}</dd>
            <dt>Versão do schema</dt>
            <dd>
              {city.schemaVersion ?? "—"} {city.schemaBehind && <Tag tone="warn">schema atrasado</Tag>}
            </dd>
            <dt>Criada em</dt><dd>{city.createdAt}</dd>
          </dl>
          {city.channel ? (
            <dl style={dlStyle}>
              <dt>Canal</dt><dd>{city.channel.displayPhoneNumber}</dd>
              <dt>Phone number id</dt><dd>{city.channel.phoneNumberId}</dd>
              <dt>WABA id</dt><dd>{city.channel.wabaId ?? "—"}</dd>
              <dt>Canal ativo</dt><dd>{city.channel.active ? "sim" : "não"}</dd>
            </dl>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink3)" }}>sem canal configurado</p>
          )}
        </Panel>
      )}

      {city && (
        <>
          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                aria-current={activeTab === tab.key ? "true" : undefined}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--rule2)",
                  background: activeTab === tab.key ? "var(--accent-bg)" : "var(--panel)",
                  color: activeTab === tab.key ? "var(--accent)" : "var(--ink2)",
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "profile" && renderTab(profile, "profile", (c) => (
            <dl style={dlStyle}>
              <dt>Nome</dt><dd>{c.profile?.name ?? "—"}</dd>
              <dt>UF</dt><dd>{c.profile?.uf ?? "—"}</dd>
              <dt>Código IBGE</dt><dd>{c.profile?.ibgeCode ?? "—"}</dd>
              <dt>Termo de consentimento</dt><dd>{c.consentTermVersion ?? "—"}</dd>
            </dl>
          ))}

          {activeTab === "protocols" && renderTab(protocols, "protocols", (c) => (
            c.protocols.length === 0 ? <EmptyState message="nenhum protocolo" /> : (
              <DataTable
                columns={[
                  { key: "name", label: "Nome" },
                  { key: "version", label: "Versão" },
                  { key: "status", label: "Status" }
                ]}
                rows={c.protocols}
              />
            )
          ))}

          {activeTab === "alertRecipients" && renderTab(alertRecipients, "alertRecipients", (c) => (
            c.alertRecipients.length === 0 ? <EmptyState message="nenhum destinatário" /> : (
              <DataTable
                columns={[
                  { key: "channel", label: "Canal" },
                  { key: "destination", label: "Destino" },
                  { key: "escalationOrder", label: "Ordem" }
                ]}
                rows={c.alertRecipients}
              />
            )
          ))}

          {activeTab === "accounts" && renderTab(accounts, "accounts", (c) => (
            c.accounts.length === 0 ? <EmptyState message="nenhuma conta" /> : (
              <DataTable
                columns={[
                  { key: "login", label: "Login" },
                  { key: "roles", label: "Papéis", render: (row) => row.roles.join(", ") || "—" },
                  { key: "active", label: "Ativa", render: (row) => (row.active ? "sim" : "não") },
                  { key: "mfaEnrolled", label: "MFA", render: (row) => (row.mfaEnrolled ? "sim" : "não") }
                ]}
                rows={c.accounts}
              />
            )
          ))}

          {activeTab === "counts" && renderTab(counts, "counts", (c) => (
            c.counts ? (
              <dl style={dlStyle}>
                <dt>Usuários</dt><dd>{c.counts.users}</dd>
                <dt>Conversas</dt><dd>{c.counts.conversations}</dd>
                <dt>Triagens</dt><dd>{c.counts.triages}</dd>
                <dt>Mensagens recebidas</dt><dd>{c.counts.inboundMessages}</dd>
                <dt>Relatórios</dt><dd>{c.counts.reportSnapshots}</dd>
                <dt>Consentimentos</dt><dd>{c.counts.consents}</dd>
              </dl>
            ) : <EmptyState message="sem contagens" />
          ))}

          {activeTab === "operations" && renderTab(operations, "operations", (c) => (
            c.operations ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Panel title="Eventos de domínio">
                  {c.operations.domainEvents.length === 0 ? <EmptyState message="nenhum evento" /> : (
                    <DataTable
                      columns={[
                        { key: "name", label: "Nome" },
                        { key: "occurredAt", label: "Ocorreu em" },
                        { key: "publishedAt", label: "Publicado em", render: (row) => row.publishedAt ?? "—" }
                      ]}
                      rows={c.operations.domainEvents}
                    />
                  )}
                </Panel>
                <Panel title="Relatórios congelados">
                  {c.operations.reportSnapshots.length === 0 ? <EmptyState message="nenhum relatório" /> : (
                    <DataTable
                      columns={[
                        { key: "id", label: "ID" },
                        { key: "createdAt", label: "Criado em" },
                        { key: "expiresAt", label: "Expira em", render: (row) => row.expiresAt ?? "—" }
                      ]}
                      rows={c.operations.reportSnapshots}
                    />
                  )}
                </Panel>
                <Panel title="Métricas do dashboard">
                  {c.operations.dashboardMetrics.length === 0 ? <EmptyState message="nenhuma métrica" /> : (
                    <DataTable
                      columns={[
                        { key: "dimension", label: "Dimensão" },
                        { key: "period", label: "Período" },
                        { key: "label", label: "Rótulo" },
                        { key: "value", label: "Valor" },
                        { key: "computedAt", label: "Computado em" }
                      ]}
                      rows={c.operations.dashboardMetrics}
                    />
                  )}
                </Panel>
                <Panel title="Jobs com falha">
                  {c.operations.failedJobs.length === 0 ? <EmptyState message="nenhum job com falha" /> : (
                    <DataTable
                      columns={[
                        { key: "className", label: "Classe" },
                        { key: "failedAt", label: "Falhou em" },
                        { key: "errorClass", label: "Exceção", render: (row) => row.errorClass ?? "—" }
                      ]}
                      rows={c.operations.failedJobs}
                    />
                  )}
                </Panel>
              </div>
            ) : <EmptyState message="sem dados operacionais" />
          ))}
        </>
      )}
    </div>
  );
}
